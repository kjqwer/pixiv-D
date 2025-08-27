const Fse = require('fs-extra');
const Path = require('path');
const PixivAuth = require('./auth');
const DownloadService = require('./services/download');

// 配置文件路径
const CONFIG_FILE_DIR = require('appdata-path').getAppDataPath('pmanager');
const CONFIG_FILE = Path.resolve(CONFIG_FILE_DIR, 'config.json');

// 默认配置
const defaultConfig = {
  download: {
    thread: 5,
    timeout: 30,
    path: null
  },
  refresh_token: null,
  access_token: null,
  user: null,
  proxy: null
};

class PixivBackend {
  constructor() {
    this.config = null;
    this.auth = null;
    this.isLoggedIn = false;
    this.downloadService = null;
  }

  /**
   * 初始化后端
   */
  async init() {
    console.log('正在初始化 Pixiv 后端...');
    
    // 初始化配置
    this.initConfig();
    this.config = this.readConfig();
    
    // 创建认证实例，传入代理配置
    this.auth = new PixivAuth(this.config.proxy);
    
    // 创建下载服务实例
    this.downloadService = new DownloadService(this.auth);
    await this.downloadService.init();
    
    // 检查登录状态
    if (this.config.refresh_token) {
      console.log('检测到已保存的登录信息，正在验证...');
      await this.relogin();
    } else {
      console.log('未检测到登录信息，需要先登录');
    }
    
    return this;
  }

  /**
   * 初始化配置文件
   */
  initConfig() {
    Fse.ensureDirSync(CONFIG_FILE_DIR);
    if (!Fse.existsSync(CONFIG_FILE)) {
      Fse.writeJSONSync(CONFIG_FILE, defaultConfig);
    }
  }

  /**
   * 读取配置
   */
  readConfig() {
    try {
      const config = Fse.readJsonSync(CONFIG_FILE);
      // 合并默认配置
      return { ...defaultConfig, ...config };
    } catch (error) {
      console.error('读取配置文件失败:', error.message);
      return { ...defaultConfig };
    }
  }

  /**
   * 保存配置
   */
  saveConfig() {
    try {
      Fse.writeJsonSync(CONFIG_FILE, this.config);
      console.log('配置已保存');
    } catch (error) {
      console.error('保存配置失败:', error.message);
    }
  }

  /**
   * 获取登录URL
   */
  getLoginUrl() {
    const loginData = this.auth.getLoginUrl();
    this.config.code_verifier = loginData.code_verifier;
    this.saveConfig();
    
    return {
      login_url: loginData.login_url,
      code_verifier: loginData.code_verifier
    };
  }

  /**
   * 处理登录回调
   */
  async handleLoginCallback(code) {
    try {
      console.log('正在处理登录回调...');
      
      if (!this.config.code_verifier) {
        throw new Error('缺少 code_verifier，请重新获取登录URL');
      }

      // 使用新的认证模块进行登录
      const result = await this.auth.getAccessToken(code, this.config.code_verifier);
      
      if (result.success) {
        // 保存登录信息
        this.config.refresh_token = result.refresh_token;
        this.config.access_token = result.access_token;
        this.config.user = result.user;
        
        // 清理临时数据
        delete this.config.code_verifier;
        
        this.saveConfig();
        this.isLoggedIn = true;
        
        console.log(`登录成功！用户: ${result.user.account}`);
        return {
          success: true,
          user: result.user
        };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('登录失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 重新登录（使用保存的 refresh_token）
   */
  async relogin() {
    try {
      if (!this.config.refresh_token) {
        throw new Error('没有保存的登录信息');
      }

      console.log('正在使用保存的登录信息重新登录...');
      
      const result = await this.auth.refreshAccessToken(this.config.refresh_token);
      
      if (result.success) {
        // 更新配置
        this.config.access_token = result.access_token;
        this.config.refresh_token = result.refresh_token;
        
        // 如果刷新令牌响应中包含用户信息，则更新
        if (result.user) {
          this.config.user = result.user;
        }
        
        this.saveConfig();
        
        this.isLoggedIn = true;
        console.log('重新登录成功！');
        
        return { success: true };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('重新登录失败:', error.message);
      // 清除无效的登录信息
      this.config.refresh_token = null;
      this.config.access_token = null;
      this.config.user = null;
      this.saveConfig();
      this.isLoggedIn = false;
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 登出
   */
  logout() {
    this.auth.logout();
    this.config.refresh_token = null;
    this.config.access_token = null;
    this.config.user = null;
    this.isLoggedIn = false;
    
    this.saveConfig();
    console.log('已登出');
    
    return { success: true };
  }

  /**
   * 获取登录状态
   */
  getLoginStatus() {
    const status = this.auth.getStatus();
    return {
      isLoggedIn: status.isLoggedIn,
      username: this.config.user?.account,
      user_id: this.config.user?.id
    };
  }

  /**
   * 设置下载路径
   */
  setDownloadPath(path) {
    this.config.download.path = path;
    this.saveConfig();
    console.log(`下载路径已设置为: ${path}`);
    return { success: true };
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return {
      download: this.config.download,
      proxy: this.config.proxy,
      isLoggedIn: this.isLoggedIn
    };
  }

  /**
   * 设置代理
   */
  setProxy(proxy) {
    this.config.proxy = proxy;
    this.auth.setProxy(proxy);
    this.saveConfig();
    console.log(`代理已设置为: ${proxy}`);
    return { success: true };
  }

  /**
   * 获取认证实例（用于后续API调用）
   */
  getAuth() {
    return this.auth;
  }

  /**
   * 获取下载服务实例
   */
  getDownloadService() {
    return this.downloadService;
  }
}

module.exports = PixivBackend; 