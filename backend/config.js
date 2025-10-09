const { defaultLogger } = require('./utils/logger');
const Fse = require('fs-extra');
const Path = require('path');

// 创建logger实例
const logger = defaultLogger.child('ProxyConfig');

// 配置文件路径
const CONFIG_FILE_DIR = require('appdata-path').getAppDataPath('pmanager');
const CONFIG_FILE = Path.resolve(CONFIG_FILE_DIR, 'config.json');

// 读取用户配置中的代理设置
function getUserProxyConfig() {
  try {
    if (Fse.existsSync(CONFIG_FILE)) {
      const config = Fse.readJsonSync(CONFIG_FILE);
      if (config.proxy) {
        // 解析代理URL获取端口
        const proxyUrl = config.proxy;
        const match = proxyUrl.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }
  } catch (error) {
    logger.debug('读取用户代理配置失败:', error.message);
  }
  return null;
}

// 代理配置
const proxyConfig = {
  // 系统代理配置
  system: {
    host: '127.0.0.1',
    port: (() => {
      // 优先级：环境变量 > 用户配置 > 默认值
      if (process.env.PROXY_PORT) {
        return parseInt(process.env.PROXY_PORT);
      }
      const userPort = getUserProxyConfig();
      if (userPort) {
        logger.info('从用户配置读取代理端口:', userPort);
        return userPort;
      }
      return 7890;
    })(),
    protocol: 'http'
  },
  
  // 代理URL格式
  get proxyUrl() {
    return `${this.system.protocol}://${this.system.host}:${this.system.port}`;
  },
  
  // 环境变量设置
  setEnvironmentVariables() {
    process.env.HTTP_PROXY = this.proxyUrl;
    process.env.HTTPS_PROXY = this.proxyUrl;
    process.env.http_proxy = this.proxyUrl;
    process.env.https_proxy = this.proxyUrl;
    
    logger.info('代理环境变量已设置:', this.proxyUrl);
  },
  
  // 清除环境变量
  clearEnvironmentVariables() {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.https_proxy;
    
    logger.info('代理环境变量已清除');
  }
};

module.exports = proxyConfig;