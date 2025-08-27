const axios = require('axios');
const Crypto = require('crypto');
const { Base64 } = require('js-base64');
const { stringify } = require('qs');
const moment = require('moment');
const { ProxyAgent } = require('proxy-agent');

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
    
    // 创建 axios 实例，支持代理
    this.axiosInstance = this.createAxiosInstance();
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
      console.log('使用代理:', this.proxy);
      config.httpsAgent = new ProxyAgent(this.proxy);
    } else {
      // 尝试使用系统代理
      const systemProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;
      if (systemProxy) {
        console.log('使用系统代理:', systemProxy);
        config.httpsAgent = new ProxyAgent(systemProxy);
      }
    }

    return axios.create(config);
  }

  /**
   * 设置代理
   */
  setProxy(proxy) {
    this.proxy = proxy;
    this.axiosInstance = this.createAxiosInstance();
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
      console.log('正在获取访问令牌...');
      console.log('Code:', code);
      console.log('Code Verifier:', codeVerifier);
      
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

      console.log('获取访问令牌成功');
      return {
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user
      };

    } catch (error) {
      console.error('获取访问令牌失败:');
      console.error('错误对象:', error);
      console.error('响应状态:', error.response?.status);
      console.error('响应数据:', error.response?.data);
      console.error('错误消息:', error.message);
      
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
      console.log('正在刷新访问令牌...');
      
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

      console.log('刷新访问令牌成功');
      return {
        success: true,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user
      };

    } catch (error) {
      console.error('刷新访问令牌失败:', error.response?.data || error.message);
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
      console.error('获取用户信息失败:', error.response?.data || error.message);
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
    console.log('已登出');
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