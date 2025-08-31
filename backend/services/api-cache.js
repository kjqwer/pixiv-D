const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const CacheConfigManager = require('../config/cache-config');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('ApiCacheService');


/**
 * API缓存服务
 * 负责管理API请求的缓存功能，特别是作者相关的API
 */
class ApiCacheService {
  constructor() {
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.cacheDir = path.join(process.cwd(), 'data', 'api-cache');
    } else {
      // 在开发环境中，使用项目根目录的data文件夹
      this.cacheDir = path.join(__dirname, '..', '..', 'data', 'api-cache');
    }
    
    // 确保路径是绝对路径
    this.cacheDir = path.resolve(this.cacheDir);
    
    // 创建配置管理器
    this.configManager = new CacheConfigManager();
    
    // 默认缓存配置
    this.config = {
      maxAge: 5 * 60 * 1000, // 5分钟缓存（API数据变化较快）
      maxSize: 50 * 1024 * 1024, // 50MB最大缓存大小
      cleanupInterval: 30 * 60 * 1000, // 30分钟清理一次
      enabled: true,
      allowedEndpoints: [
        '/v1/user/detail',
        '/v1/user/illusts',
        '/v1/user/following',
        '/v1/user/follower',
        '/v1/search/user',
        '/v1/search/illust',
        '/v1/illust/detail',
        '/v1/illust/recommended',
        '/v1/illust/ranking',
        '/v1/user/bookmarks/illust',
        '/v1/user/bookmarks/novel'
      ],
      // 缓存键生成策略
      keyStrategy: {
        includeQueryParams: true, // 包含查询参数
        includeHeaders: false, // 不包含请求头
        hashAlgorithm: 'md5'
      }
    };
    
    // 初始化配置
    this.initializeConfig();
  }

  /**
   * 初始化配置
   */
  async initializeConfig() {
    try {
      await this.configManager.initialize();
      const config = await this.configManager.loadConfig();
      this.config = { ...this.config, ...config };
      
      // 确保缓存目录存在
      await this.ensureCacheDir();
      
      // 启动定期清理任务
      this.startCleanupTask();
      
    //   logger.info('API缓存服务初始化完成');
    } catch (error) {
      logger.error('API缓存服务初始化失败:', error);
    }
  }

  /**
   * 确保缓存目录存在
   */
  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    //   logger.info('API缓存目录创建成功:', this.cacheDir);
    } catch (error) {
      logger.error('创建API缓存目录失败:', error);
    }
  }

  /**
   * 生成缓存键
   * @param {string} method HTTP方法
   * @param {string} endpoint API端点
   * @param {Object} params 查询参数
   * @returns {string} 缓存键
   */
  generateCacheKey(method, endpoint, params = {}) {
    // 构建缓存键的基础部分
    let keyBase = `${method.toUpperCase()}:${endpoint}`;
    
    // 确保params是对象
    const safeParams = params || {};
    
    // 如果endpoint已经包含查询参数（包含?），则解析endpoint中的参数
    if (endpoint.includes('?')) {
      // 分离endpoint和查询参数
      const [baseEndpoint, queryString] = endpoint.split('?');
      keyBase = `${method.toUpperCase()}:${baseEndpoint}`;
      
      // 解析查询字符串
      const urlParams = new URLSearchParams(queryString);
      const endpointParams = {};
      for (const [key, value] of urlParams) {
        endpointParams[key] = value;
      }
      
      // 合并endpoint中的参数和传入的params
      const allParams = { ...endpointParams, ...safeParams };
      
      // 如果有参数，添加到键中
      if (Object.keys(allParams).length > 0) {
        const sortedParams = Object.keys(allParams)
          .sort()
          .map(key => `${key}=${allParams[key]}`)
          .join('&');
        keyBase += `?${sortedParams}`;
      }
    } else if (this.config.keyStrategy.includeQueryParams && Object.keys(safeParams).length > 0) {
      // 如果endpoint不包含查询参数，且params不为空，则添加查询参数
      const sortedParams = Object.keys(safeParams)
        .sort()
        .map(key => `${key}=${safeParams[key]}`)
        .join('&');
      keyBase += `?${sortedParams}`;
    }
    
    // 使用指定的哈希算法生成最终的键
    const hash = crypto.createHash(this.config.keyStrategy.hashAlgorithm).update(keyBase).digest('hex');
    return `${hash}.json`;
  }

  /**
   * 获取缓存文件路径
   * @param {string} cacheKey 缓存键
   * @returns {string} 缓存文件路径
   */
  getCacheFilePath(cacheKey) {
    return path.join(this.cacheDir, cacheKey);
  }

  /**
   * 检查缓存是否存在且有效
   * @param {string} cacheKey 缓存键
   * @returns {Promise<boolean>} 缓存是否有效
   */
  async isCacheValid(cacheKey) {
    try {
      const cachePath = this.getCacheFilePath(cacheKey);
      const stats = await fs.stat(cachePath);
      
      // 检查文件是否过期
      const age = Date.now() - stats.mtime.getTime();
      return age < this.config.maxAge;
    } catch (error) {
      return false;
    }
  }

  /**
   * 从缓存获取数据
   * @param {string} cacheKey 缓存键
   * @returns {Promise<Object|null>} 缓存数据，如果缓存不存在则返回null
   */
  async getFromCache(cacheKey) {
    try {
      if (!(await this.isCacheValid(cacheKey))) {
        return null;
      }

      const cachePath = this.getCacheFilePath(cacheKey);
      const data = await fs.readFile(cachePath, 'utf8');
      
      // 更新文件访问时间
      await fs.utimes(cachePath, new Date(), new Date());
      
      return JSON.parse(data);
    } catch (error) {
      logger.error('读取API缓存失败:', error);
      return null;
    }
  }

  /**
   * 将数据保存到缓存
   * @param {string} cacheKey 缓存键
   * @param {Object} data 要缓存的数据
   * @returns {Promise<void>}
   */
  async saveToCache(cacheKey, data) {
    try {
      const cachePath = this.getCacheFilePath(cacheKey);
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(cachePath, jsonData, 'utf8');
      
      // 检查缓存大小，如果超过限制则清理
      await this.checkCacheSize();
    } catch (error) {
      logger.error('保存API缓存失败:', error);
    }
  }

  /**
   * 检查是否应该缓存该请求
   * @param {string} method HTTP方法
   * @param {string} endpoint API端点
   * @returns {boolean} 是否应该缓存
   */
  shouldCache(method, endpoint) {
    // 只缓存GET请求
    if (method.toUpperCase() !== 'GET') {
      return false;
    }
    
    // 检查端点是否在允许列表中
    return this.config.allowedEndpoints.some(allowedEndpoint => 
      endpoint.includes(allowedEndpoint)
    );
  }

  /**
   * 获取缓存数据（如果存在且有效）
   * @param {string} method HTTP方法
   * @param {string} endpoint API端点
   * @param {Object} params 查询参数
   * @returns {Promise<Object|null>} 缓存数据，如果不存在则返回null
   */
  async get(method, endpoint, params = {}) {
    // 检查缓存是否启用
    if (!this.config.enabled) {
      return null;
    }

    // 检查是否应该缓存该请求
    if (!this.shouldCache(method, endpoint)) {
      return null;
    }

    // 确保params是对象
    const safeParams = params || {};
    const cacheKey = this.generateCacheKey(method, endpoint, safeParams);
    return await this.getFromCache(cacheKey);
  }

  /**
   * 设置缓存数据
   * @param {string} method HTTP方法
   * @param {string} endpoint API端点
   * @param {Object} params 查询参数
   * @param {Object} data 要缓存的数据
   * @returns {Promise<void>}
   */
  async set(method, endpoint, params = {}, data) {
    // 检查缓存是否启用
    if (!this.config.enabled) {
      return;
    }

    // 检查是否应该缓存该请求
    if (!this.shouldCache(method, endpoint)) {
      return;
    }

    // 确保params是对象
    const safeParams = params || {};
    const cacheKey = this.generateCacheKey(method, endpoint, safeParams);
    await this.saveToCache(cacheKey, data);
  }

  /**
   * 检查缓存大小并清理
   * @returns {Promise<void>}
   */
  async checkCacheSize() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const fileStats = [];

      // 计算总大小和收集文件信息
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileStats.push({
          path: filePath,
          size: stats.size,
          mtime: stats.mtime
        });
      }

      // 如果超过最大大小，删除最旧的文件
      if (totalSize > this.config.maxSize) {
        logger.info(`API缓存大小 ${totalSize} 超过限制 ${this.config.maxSize}，开始清理...`);
        
        // 按修改时间排序，删除最旧的文件
        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        for (const file of fileStats) {
          await fs.unlink(file.path);
          totalSize -= file.size;
          
          if (totalSize <= this.config.maxSize * 0.8) { // 清理到80%
            break;
          }
        }
        
        logger.info(`API缓存清理完成，当前大小: ${totalSize}`);
      }
    } catch (error) {
      logger.error('检查API缓存大小失败:', error);
    }
  }

  /**
   * 清理过期缓存
   * @returns {Promise<void>}
   */
  async cleanupExpiredCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        
        const age = Date.now() - stats.mtime.getTime();
        if (age > this.config.maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`清理了 ${cleanedCount} 个过期API缓存文件`);
      }
    } catch (error) {
      logger.error('清理过期API缓存失败:', error);
    }
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTask() {
    setInterval(() => {
      this.cleanupExpiredCache().catch(error => {
        logger.error('定期清理API缓存任务失败:', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * 手动清理所有缓存
   * @returns {Promise<void>}
   */
  async clearAllCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        await fs.unlink(filePath);
      }
      
      logger.info('所有API缓存已清理');
    } catch (error) {
      logger.error('清理所有API缓存失败:', error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Promise<Object>} 缓存统计信息
   */
  async getCacheStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileCount++;
      }

      return {
        fileCount,
        totalSize,
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        enabled: this.config.enabled,
        allowedEndpoints: this.config.allowedEndpoints,
        config: this.config
      };
    } catch (error) {
      logger.error('获取API缓存统计失败:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        enabled: this.config.enabled,
        allowedEndpoints: this.config.allowedEndpoints,
        config: this.config
      };
    }
  }

  /**
   * 获取缓存配置
   * @returns {Promise<Object>} 缓存配置
   */
  async getConfig() {
    return await this.configManager.loadConfig();
  }

  /**
   * 更新缓存配置
   * @param {Object} updates 配置更新
   * @returns {Promise<Object>} 更新后的配置
   */
  async updateConfig(updates) {
    const newConfig = await this.configManager.updateConfig(updates);
    this.config = { ...this.config, ...newConfig };
    return newConfig;
  }

  /**
   * 重置缓存配置
   * @returns {Promise<Object>} 重置后的配置
   */
  async resetConfig() {
    const defaultConfig = await this.configManager.resetToDefault();
    this.config = { ...this.config, ...defaultConfig };
    return defaultConfig;
  }
}

module.exports = ApiCacheService; 