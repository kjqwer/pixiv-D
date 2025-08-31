const { defaultLogger } = require('./utils/logger');

// 创建logger实例
const logger = defaultLogger.child('ProxyConfig');

// 代理配置
const proxyConfig = {
  // 系统代理配置
  system: {
    host: '127.0.0.1',
    port: process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT) : 7890,
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