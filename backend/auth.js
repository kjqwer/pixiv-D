const axios = require('axios');
const Crypto = require('crypto');
const { Base64 } = require('js-base64');
const { stringify } = require('qs');
const moment = require('moment');
const { ProxyAgent } = require('proxy-agent');
const { defaultLogger } = require('./utils/logger');

// 创建logger实例
const logger = defaultLogger.child('PixivAuth');


// OAuth 2.0 配置
const CLIENT_ID = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const CLIENT_SECRET = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';
const REDIRECT_URI = 'https://app-api.pixiv.net/web/v1/users/auth/pixiv/callback';
const LOGIN_URL = 'https://app-api.pixiv.net/web/v1/login';
const HASH_SECRET = '28c1fdd170a5204386cb1313c7077b34f83e4aaf4aa829ce78c231e05b0bae2c';

class PixivAuth {
  constructor(proxy = null) {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    this.proxy = proxy;
    this.isRefreshing = false;
    this.failedQueue = [];
    this.refreshTimer = null; // 添加定时器引用
    this.onTokenUpdate = null; // 添加token更新回调
    
    // 创建 axios 实例，支持代理
    this.axiosInstance = this.createAxiosInstance();
    
    // 设置响应拦截器，自动处理token刷新
    this.setupResponseInterceptor();
  }

  /**
   * 创建支持代理的 axios 实例
   */
  createAxiosInstance() {
    const config = {
      timeout: 30000, // 30秒超时
      headers: this.getDefaultHeaders()
    };

    // 如果设置了代理，添加代理配置
    if (this.proxy) {
      logger.info('使用代理:', this.proxy);
      config.httpsAgent = new ProxyAgent(this.proxy);
    } else {
      // 尝试使用系统代理
      const systemProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;
      if (systemProxy) {
        logger.info('使用系统代理:', systemProxy);
        config.httpsAgent = new ProxyAgent(systemProxy);
      }
    }

    return axios.create(config);
  }

  /**
   * 设置响应拦截器，自动处理token刷新
   */
  setupResponseInterceptor() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // 如果是401错误且不是刷新token的请求，尝试自动刷新
        if (error.response?.status === 401 && 
            !originalRequest._retry && 
            !originalRequest.url.includes('/auth/token') &&
            this.refreshToken) {
          
          if (this.isRefreshing) {
            // 如果正在刷新，将请求加入队列
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(() => {
              return this.axiosInstance(originalRequest);
            }).catch((err) => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            logger.info('检测到token过期，正在自动刷新...'); 
            const result = await this.refreshAccessToken(this.refreshToken);
            
            if (result.success) {
              // 更新token
              this.accessToken = result.access_token;
              this.refreshToken = result.refresh_token;
              if (result.user) {
                this.user = result.user;
              }

              // 触发token更新回调
              this.triggerTokenUpdate();

              // 处理队列中的请求
              this.processQueue(null, result.access_token);
              
              // 重试原始请求
              originalRequest.headers['Authorization'] = `Bearer ${result.access_token}`;
              return this.axiosInstance(originalRequest);
            } else {
              throw new Error('Token刷新失败');
            }
          } catch (refreshError) {
            logger.error('自动刷新token失败:', refreshError.message);
            this.processQueue(refreshError, null);
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * 处理失败的请求队列
   */
  processQueue(error, token = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
    this.failedQueue = [];
  }

  /**
   * 设置代理
   */
  setProxy(proxy) {
    this.proxy = proxy;
    this.axiosInstance = this.createAxiosInstance();
    this.setupResponseInterceptor();
  }

  /**
   * 同步token状态（从外部配置更新）
   */
  syncTokens(accessToken, refreshToken, user = null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (user) {
      this.user = user;
    }
    
    // 启动主动定时刷新
    this.startProactiveRefresh();
  }

  /**
   * 设置token更新回调
   */
  setTokenUpdateCallback(callback) {
    this.onTokenUpdate = callback;
  }

  /**
   * 触发token更新回调
   */
  triggerTokenUpdate() {
    if (this.onTokenUpdate && typeof this.onTokenUpdate === 'function') {
      try {
        this.onTokenUpdate({
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
          user: this.user
        });
      } catch (error) {
        logger.error('Token更新回调执行失败:', error.message);
      }
    }
  }

  /**
   * 启动主动定时刷新token
   */
  startProactiveRefresh() {
    // 清除之前的定时器
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // 如果没有refreshToken，不启动定时刷新
    if (!this.refreshToken) {
      return;
    }

    // 计算下次刷新时间（在token过期前30分钟刷新）
    // Pixiv的access_token通常有效期为1小时，我们提前30分钟刷新
    const refreshInterval = 30 * 60 * 1000; // 30分钟

    this.refreshTimer = setTimeout(async () => {
      try {
        logger.info('主动刷新token...');
        const result = await this.refreshAccessToken(this.refreshToken);
        
        if (result.success) {
          logger.info('主动刷新token成功');
          // 更新token
          this.accessToken = result.access_token;
          this.refreshToken = result.refresh_token;
          if (result.user) {
            this.user = result.user;
          }
          
          // 触发token更新回调
          this.triggerTokenUpdate();
          
          // 重新启动定时刷新
          this.startProactiveRefresh();
        } else {
          logger.error('主动刷新token失败:', result.error);
          // 刷新失败，5分钟后重试
          setTimeout(() => {
            this.startProactiveRefresh();
          }, 5 * 60 * 1000);
        }
      } catch (error) {
        logger.error('主动刷新token异常:', error.message);
        // 发生异常，5分钟后重试
        setTimeout(() => {
          this.startProactiveRefresh();
        }, 5 * 60 * 1000);
      }
    }, refreshInterval);

    logger.info(`主动刷新定时器已启动，${refreshInterval / 1000 / 60}分钟后刷新token`); 
  }

  /**
   * 停止主动定时刷新
   */
  stopProactiveRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
      logger.info('主动刷新定时器已停止');
    }
  }

  /**
   * 获取默认头部信息
   */
  getDefaultHeaders() {
    const datetime = moment().format();
    return {
      'App-OS': 'android',
      'Accept-Language': 'en-us',
      'App-OS-Version': '9.0',
      'App-Version': '5.0.234',
      'User-Agent': 'PixivAndroidApp/5.0.234 (Android 9.0; Pixel 3)',
      'X-Client-Time': datetime,
      'X-Client-Hash': Crypto.createHash('md5').update(`${datetime}${HASH_SECRET}`).digest('hex')
    };
  }

  /**
   * 生成 PKCE 参数
   */
  generatePKCE() {
    const codeVerifier = Base64.fromUint8Array(Crypto.randomBytes(32), true);
    const codeChallenge = Base64.encodeURI(Crypto.createHash('sha256').update(codeVerifier).digest());
    
    return {
      code_verifier: codeVerifier,
      code_challenge: codeChallenge
    };
  }

  /**
   * 获取登录URL
   */
  getLoginUrl() {
    const pkce = this.generatePKCE();
    
    const params = {
      code_challenge: pkce.code_challenge,
      code_challenge_method: 'S256',
      client: 'pixiv-android'
    };

    const loginUrl = `${LOGIN_URL}?${stringify(params)}`;
    
    return {
      login_url: loginUrl,
      code_verifier: pkce.code_verifier
    };
  }

  /**
   * 使用授权码获取访问令牌
   */
  async getAccessToken(code, codeVerifier) {
    try {
      logger.info('正在获取访问令牌...');
      logger.info('Code:', code);
      logger.info('Code Verifier:', codeVerifier);
      
      const data = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
        include_policy: true
      };

      const headers = {
        ...this.getDefaultHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      const response = await this.axiosInstance.post('https://oauth.secure.pixiv.net/auth/token', 
        stringify(data),
        { headers }
      );

      const tokenData = response.data.response;
      
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;
      this.user = tokenData.user;

      logger.info('获取访问令牌成功');
      return {
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user
      };

    } catch (error) {
      logger.error('获取访问令牌失败:');
      logger.error('错误对象:', error);
      logger.error('响应状态:', error.response?.status);
      logger.error('响应数据:', error.response?.data);
      logger.error('错误消息:', error.message);
      
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 使用刷新令牌更新访问令牌
   */
  async refreshAccessToken(refreshToken) {
    try {
      logger.info('正在刷新访问令牌...');
      
      const data = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        get_secure_url: true,
        include_policy: true,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      };

      const headers = {
        ...this.getDefaultHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      const response = await this.axiosInstance.post('https://oauth.secure.pixiv.net/auth/token',
        stringify(data),
        { headers }
      );

      const tokenData = response.data.response;
      
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;

      // 如果响应中包含用户信息，则保存
      if (tokenData.user) {
        this.user = tokenData.user;
      }

      logger.info('刷新访问令牌成功');
      return {
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user
      };

    } catch (error) {
      logger.error('刷新访问令牌失败:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    if (!this.accessToken) {
      return { success: false, error: '未登录' };
    }

    try {
      const headers = {
        ...this.getDefaultHeaders(),
        'Authorization': `Bearer ${this.accessToken}`
      };

      const response = await this.axiosInstance.get('https://app-api.pixiv.net/v1/user/me', {
        headers
      });

      return {
        success: true,
        user: response.data.user
      };

    } catch (error) {
      logger.error('获取用户信息失败:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 登出
   */
  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    
    // 停止主动刷新
    this.stopProactiveRefresh();
    
    logger.info('已登出');
    return { success: true };
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isLoggedIn: !!this.accessToken,
      user: this.user,
      hasRefreshToken: !!this.refreshToken
    };
  }
}

module.exports = PixivAuth; 