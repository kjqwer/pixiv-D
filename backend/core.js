const Fse = require('fs-extra');
const Path = require('path');
const PixivAuth = require('./auth');
const DownloadService = require('./services/download');
const { defaultLogger } = require('./utils/logger');
// 配置文件路径
const CONFIG_FILE_DIR = require('appdata-path').getAppDataPath('pmanager');
const CONFIG_FILE = Path.resolve(CONFIG_FILE_DIR, 'config.json');

// 创建logger实例
const logger = defaultLogger.child('PixivCore');

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
    this.databaseManager = null;
  }

  /**
   * 初始化后端
   */
  async init() {
    logger.info('正在初始化 Pixiv 后端...');
    
    // 初始化配置
    this.initConfig();
    this.config = this.readConfig();
    
    // 自动加载数据库配置
    await this.initDatabaseConfig();
    
    // 创建认证实例，传入代理配置
    this.auth = new PixivAuth(this.config.proxy);
    
    // 设置token更新回调
    this.auth.setTokenUpdateCallback((tokens) => {
      this.config.access_token = tokens.access_token;
      this.config.refresh_token = tokens.refresh_token;
      this.config.user = tokens.user;
      this.saveConfig();
      logger.info('Token已更新并保存到配置文件');
    });
    
    // 同步已保存的token状态
    if (this.config.access_token && this.config.refresh_token) {
      this.auth.syncTokens(
        this.config.access_token,
        this.config.refresh_token,
        this.config.user
      );
    }
    
    // 创建下载服务实例
    this.downloadService = new DownloadService(this.auth, this.databaseManager);
    await this.downloadService.init();
    
    // 检查登录状态
    if (this.config.refresh_token) {
      logger.info('检测到已保存的登录信息，正在验证...');
      await this.relogin();
    } else {
      logger.info('未检测到登录信息，需要先登录');
    }
    
    // 启动token同步定时任务
    this.startTokenSyncTask();
    
    return this;
  }

  /**
   * 启动token同步定时任务
   */
  startTokenSyncTask() {
    // 清理可能存在的旧定时器
    if (this.tokenSyncTimer) {
      clearInterval(this.tokenSyncTimer);
    }
    
    // 每5分钟同步一次token状态到配置文件
    this.tokenSyncTimer = setInterval(() => {
      if (this.auth && this.isLoggedIn) {
        this.syncTokensToConfig();
      }
    }, 5 * 60 * 1000); // 5分钟
    
    logger.info('Token同步定时任务已启动');
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
      logger.error('读取配置文件失败:', error.message);
      return { ...defaultConfig };
    }
  }

  /**
   * 保存配置
   */
  saveConfig() {
    try {
      Fse.writeJsonSync(CONFIG_FILE, this.config);
      logger.info('配置已保存');
    } catch (error) {
      logger.error('保存配置失败:', error.message);
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
      logger.info('正在处理登录回调...');
      
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
        
        // 同步到auth实例并启动主动刷新
        this.auth.syncTokens(
          result.access_token,
          result.refresh_token,
          result.user
        );
        
        // 清理临时数据
        delete this.config.code_verifier;
        
        this.saveConfig();
        this.isLoggedIn = true;
        
        logger.info(`登录成功！用户: ${result.user.account}`);
        return {
          success: true,
          user: result.user
        };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      logger.error('登录失败:', error.message);
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

      logger.info('正在使用保存的登录信息重新登录...');
      
      const result = await this.auth.refreshAccessToken(this.config.refresh_token);
      
      if (result.success) {
        // 更新配置
        this.config.access_token = result.access_token;
        this.config.refresh_token = result.refresh_token;
        
        // 如果刷新令牌响应中包含用户信息，则更新
        if (result.user) {
          this.config.user = result.user;
        }
        
        // 同步到auth实例并启动主动刷新
        this.auth.syncTokens(
          result.access_token,
          result.refresh_token,
          result.user
        );
        
        this.saveConfig();
        
        this.isLoggedIn = true;
        logger.info('重新登录成功！');
        
        return { success: true };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      logger.error('重新登录失败:', error.message);
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
    logger.info('已登出');
    
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
    logger.info(`下载路径已设置为: ${path}`);
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
    logger.info(`代理已设置为: ${proxy}`);
    return { success: true };
  }

  /**
   * 获取认证实例
   */
  getAuth() {
    return this.auth;
  }

  /**
   * 同步token状态到配置
   */
  syncTokensToConfig() {
    if (this.auth) {
      this.config.access_token = this.auth.accessToken;
      this.config.refresh_token = this.auth.refreshToken;
      this.config.user = this.auth.user;
      this.saveConfig();
    }
  }

  /**
   * 初始化数据库配置
   */
  async initDatabaseConfig() {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      // 检测是否在pkg打包环境中运行
      const isPkg = process.pkg !== undefined;
      
      const configPath = isPkg 
        ? path.join(process.cwd(), 'data', 'database.json')  // 打包环境：当前工作目录的data文件夹
        : path.join(__dirname, '..', 'data', 'database.json');  // 开发环境：项目根目录的data文件夹
      
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        logger.info('检测到数据库配置文件，正在初始化数据库连接...');
        
        // 动态导入数据库管理器
        const DatabaseManager = require('./database/database-manager');
        const RegistryDatabase = require('./database/registry-database');
        
        // 创建并初始化数据库管理器
        this.databaseManager = new DatabaseManager();
        await this.databaseManager.init(config);
        
        // 初始化注册表数据库
        const registryDatabase = new RegistryDatabase(this.databaseManager);
        
        // 将实例设置到数据库路由模块中
        const databaseRoute = require('./routes/database');
        databaseRoute.setDatabaseInstances(this.databaseManager, registryDatabase);
        
        logger.info('数据库连接已自动初始化');
      } else {
        logger.info('未检测到数据库配置文件，跳过数据库初始化');
      }
    } catch (error) {
      logger.error('初始化数据库配置时出错:', error.message);
    }
  }

  /**
   * 获取下载服务实例
   */
  getDownloadService() {
    return this.downloadService;
  }

  /**
   * 清理资源
   */
  async cleanup() {
    logger.info('正在清理 Pixiv 后端资源...');
    
    try {
      // 停止token同步定时任务
      if (this.tokenSyncTimer) {
        clearInterval(this.tokenSyncTimer);
        this.tokenSyncTimer = null;
        logger.info('Token同步定时任务已停止');
      }
      
      // 清理认证实例的定时器
      if (this.auth) {
        this.auth.stopProactiveRefresh();
        logger.info('认证定时器已清理');
      }
      
      // 清理下载服务
      if (this.downloadService) {
        await this.downloadService.cleanup?.();
        logger.info('下载服务已清理');
      }
      
      logger.info('Pixiv 后端资源清理完成');
    } catch (error) {
      logger.error('清理 Pixiv 后端资源时出错:', error.message);
    }
  }
}

module.exports = PixivBackend;