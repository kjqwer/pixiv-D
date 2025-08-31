const fs = require('fs').promises;
const path = require('path');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('CacheConfigManager');


/**
 * 缓存配置管理器
 * 负责管理图片缓存的配置选项
 */
class CacheConfigManager {
  constructor() {
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.configPath = path.join(process.cwd(), 'data', 'cache-config.json');
    } else {
      // 在开发环境中，使用项目根目录的data文件夹
      this.configPath = path.join(__dirname, '..', '..', 'data', 'cache-config.json');
    }
    
    // 确保路径是绝对路径
    this.configPath = path.resolve(this.configPath);
    
    // 默认配置
    this.defaultConfig = {
      // 缓存配置
      maxAge: 24 * 60 * 60 * 1000, // 24小时缓存
      maxSize: 100 * 1024 * 1024, // 100MB最大缓存大小
      cleanupInterval: 60 * 60 * 1000, // 1小时清理一次
      
      // 缓存启用状态
      enabled: true,
      
      // 代理配置
      proxy: {
        enabled: true,
        timeout: 30000, // 30秒超时
        retryCount: 3, // 重试次数
        retryDelay: 1000, // 重试延迟（毫秒）
      },
      
      // 文件类型过滤
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
      
      // 最后更新时间
      lastUpdated: new Date().toISOString()
    };
    
    // 确保配置目录存在
    this.ensureConfigDir();
  }

  /**
   * 确保配置目录存在
   */
  ensureConfigDir() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!require('fs').existsSync(configDir)) {
        require('fs').mkdirSync(configDir, { recursive: true });
        // logger.info('缓存配置目录创建成功:', configDir);
      }
    } catch (error) {
      logger.error('创建缓存配置目录失败:', error);
    }
  }

  /**
   * 初始化配置文件
   */
  async initialize() {
    try {
      // 检查配置文件是否存在
      await fs.access(this.configPath);
      // logger.info('缓存配置文件已存在');
    } catch (error) {
      // 配置文件不存在，创建默认配置
      logger.info('创建默认缓存配置文件...');
      await this.createDefaultConfig();
    }
  }

  /**
   * 创建默认配置文件
   */
  async createDefaultConfig() {
    try {
      const configContent = JSON.stringify(this.defaultConfig, null, 2);
      await fs.writeFile(this.configPath, configContent, 'utf8');
      // logger.info('默认缓存配置文件创建成功:', this.configPath);
    } catch (error) {
      logger.error('创建默认缓存配置文件失败:', error);
      throw error;
    }
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configContent);
      
      // 合并默认配置，确保所有字段都存在
      return { ...this.defaultConfig, ...config };
    } catch (error) {
      logger.error('加载缓存配置失败:', error);
      return this.defaultConfig;
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(config) {
    try {
      // 更新最后修改时间
      config.lastUpdated = new Date().toISOString();
      
      const configContent = JSON.stringify(config, null, 2);
      await fs.writeFile(this.configPath, configContent, 'utf8');
      logger.info('缓存配置保存成功');
    } catch (error) {
      logger.error('保存缓存配置失败:', error);
      throw error;
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(updates) {
    try {
      const currentConfig = await this.loadConfig();
      const newConfig = { ...currentConfig, ...updates };
      await this.saveConfig(newConfig);
      return newConfig;
    } catch (error) {
      logger.error('更新缓存配置失败:', error);
      throw error;
    }
  }

  /**
   * 重置为默认配置
   */
  async resetToDefault() {
    try {
      await this.saveConfig(this.defaultConfig);
      logger.info('缓存配置已重置为默认值');
      return this.defaultConfig;
    } catch (error) {
      logger.error('重置缓存配置失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];
    
    if (config.maxAge < 0) {
      errors.push('maxAge 必须大于等于 0');
    }
    
    if (config.maxSize < 0) {
      errors.push('maxSize 必须大于等于 0');
    }
    
    if (config.cleanupInterval < 0) {
      errors.push('cleanupInterval 必须大于等于 0');
    }
    
    if (config.proxy.timeout < 0) {
      errors.push('proxy.timeout 必须大于等于 0');
    }
    
    if (config.proxy.retryCount < 0) {
      errors.push('proxy.retryCount 必须大于等于 0');
    }
    
    if (config.proxy.retryDelay < 0) {
      errors.push('proxy.retryDelay 必须大于等于 0');
    }
    
    return errors;
  }

  /**
   * 获取配置路径
   */
  getConfigPath() {
    return this.configPath;
  }
}

module.exports = CacheConfigManager; 