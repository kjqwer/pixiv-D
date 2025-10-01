const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const CacheConfigManager = require('../config/cache-config');
const { defaultLogger } = require('../utils/logger');
const FileUtils = require('../utils/file-utils');

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
    
    // 防重复删除机制 - 跟踪正在删除的文件
    this.deletingFiles = new Set();
    
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
        
        // 防止重复删除同一个文件
        if (this.deletingFiles.has(filePath)) {
          continue;
        }
        
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileStats.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime
          });
        } catch (error) {
          // 如果文件不存在，跳过
          if (error.code === 'ENOENT') {
            logger.debug(`API缓存文件不存在，跳过: ${filePath}`);
          } else {
            logger.debug(`检查API缓存文件失败: ${filePath}`, error.message);
          }
        }
      }

      // 如果超过最大大小，删除最旧的文件
      if (totalSize > this.config.maxSize) {
        logger.info(`API缓存大小 ${totalSize} 超过限制 ${this.config.maxSize}，开始清理...`);
        
        // 按修改时间排序，删除最旧的文件
        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const file of fileStats) {
          // 防止重复删除
          if (this.deletingFiles.has(file.path)) {
            continue;
          }
          
          // 标记文件为删除中
          this.deletingFiles.add(file.path);
          
          try {
            const deleteSuccess = await this.safeDeleteFileWithRetry(file.path);
            if (deleteSuccess) {
              totalSize -= file.size;
              deletedCount++;
              logger.debug(`删除过大API缓存文件: ${file.path}`);
            } else {
              errorCount++;
              logger.debug(`删除过大API缓存文件失败: ${file.path}`);
            }
            
            if (totalSize <= this.config.maxSize * 0.8) { // 清理到80%
              break;
            }
          } finally {
            // 移除删除标记
            this.deletingFiles.delete(file.path);
          }
        }
        
        if (errorCount > 0) {
          logger.info(`API缓存清理完成，当前大小: ${totalSize}，成功删除 ${deletedCount} 个文件，失败 ${errorCount} 个文件`);
        } else {
          logger.info(`API缓存清理完成，当前大小: ${totalSize}，删除了 ${deletedCount} 个文件`);
        }
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
      let errorCount = 0;
      let skippedCount = 0;
      const now = Date.now();
      const errorDetails = {
        permission: 0,
        busy: 0,
        system: 0,
        other: 0
      };

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        
        // 防止重复删除同一个文件
        if (this.deletingFiles.has(filePath)) {
          logger.debug(`API缓存文件正在删除中，跳过: ${filePath}`);
          skippedCount++;
          continue;
        }
        
        try {
          const stats = await fs.stat(filePath);
          
          const age = now - stats.mtime.getTime();
          if (age > this.config.maxAge) {
            // 标记文件为删除中
            this.deletingFiles.add(filePath);
            
            try {
              // 使用带重试的删除方法
              const deleteSuccess = await this.safeDeleteFileWithRetry(filePath);
              if (deleteSuccess) {
                cleanedCount++;
                logger.debug(`成功删除过期API缓存文件: ${filePath}`);
              } else {
                errorCount++;
                errorDetails.other++;
                logger.debug(`删除过期API缓存文件失败: ${filePath}`);
              }
            } finally {
              // 无论成功失败，都要移除删除标记
              this.deletingFiles.delete(filePath);
            }
          }
        } catch (error) {
          // 如果文件不存在，静默忽略
          if (error.code === 'ENOENT') {
            logger.debug(`过期API缓存文件不存在，跳过: ${filePath}`);
          } else {
            const errorInfo = this.categorizeError(error);
            logger.debug(`检查过期API缓存文件失败: ${filePath}`, error.message);
            errorCount++;
            
            // 统计错误类型
            switch (errorInfo.type) {
              case 'permission':
                errorDetails.permission++;
                break;
              case 'busy':
                errorDetails.busy++;
                break;
              case 'system':
                errorDetails.system++;
                break;
              default:
                errorDetails.other++;
            }
          }
          
          // 移除删除标记
          this.deletingFiles.delete(filePath);
        }
      }

      if (cleanedCount > 0 || errorCount > 0 || skippedCount > 0) {
        if (errorCount === 0 && skippedCount === 0) {
          logger.info(`清理了 ${cleanedCount} 个过期API缓存文件`);
        } else {
          let errorMsg = `API缓存清理完成，成功删除 ${cleanedCount} 个文件，失败 ${errorCount} 个文件，跳过 ${skippedCount} 个被占用文件`;
          
          if (errorCount > 0) {
            const errorBreakdown = [];
            if (errorDetails.permission > 0) errorBreakdown.push(`权限错误 ${errorDetails.permission} 个`);
            if (errorDetails.busy > 0) errorBreakdown.push(`文件占用 ${errorDetails.busy} 个`);
            if (errorDetails.system > 0) errorBreakdown.push(`系统错误 ${errorDetails.system} 个`);
            if (errorDetails.other > 0) errorBreakdown.push(`其他错误 ${errorDetails.other} 个`);
            
            if (errorBreakdown.length > 0) {
              errorMsg += ` (${errorBreakdown.join(', ')})`;
            }
          }
          
          logger.info(errorMsg);
        }
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
      let deletedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const errorDetails = {
        permission: 0,
        busy: 0,
        system: 0,
        other: 0
      };

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        
        // 防止重复删除同一个文件
        if (this.deletingFiles.has(filePath)) {
          logger.debug(`API缓存文件正在删除中，跳过: ${filePath}`);
          skippedCount++;
          continue;
        }
        
        // 标记文件为删除中
        this.deletingFiles.add(filePath);
        
        try {
          // 使用带重试的删除方法
          const deleteSuccess = await this.safeDeleteFileWithRetry(filePath);
          if (deleteSuccess) {
            deletedCount++;
            logger.debug(`成功删除API缓存文件: ${filePath}`);
          } else {
            failedCount++;
            errorDetails.other++;
            logger.debug(`删除API缓存文件失败: ${filePath}`);
          }
        } catch (error) {
          const errorInfo = this.categorizeError(error);
          logger.debug(`删除API缓存文件时发生错误: ${filePath}`, error.message);
          failedCount++;
          
          // 统计错误类型
          switch (errorInfo.type) {
            case 'permission':
              errorDetails.permission++;
              break;
            case 'busy':
              errorDetails.busy++;
              break;
            case 'system':
              errorDetails.system++;
              break;
            default:
              errorDetails.other++;
          }
        } finally {
          // 无论成功失败，都要移除删除标记
          this.deletingFiles.delete(filePath);
        }
      }

      // 清空缓存索引
      this.cacheIndex.clear();
      await this.saveCacheIndex();

      if (deletedCount > 0 || failedCount > 0 || skippedCount > 0) {
        if (failedCount === 0 && skippedCount === 0) {
          logger.info(`成功清空所有API缓存，删除了 ${deletedCount} 个文件`);
        } else {
          let errorMsg = `API缓存清空完成，成功删除 ${deletedCount} 个文件，失败 ${failedCount} 个文件，跳过 ${skippedCount} 个被占用文件`;
          
          if (failedCount > 0) {
            const errorBreakdown = [];
            if (errorDetails.permission > 0) errorBreakdown.push(`权限错误 ${errorDetails.permission} 个`);
            if (errorDetails.busy > 0) errorBreakdown.push(`文件占用 ${errorDetails.busy} 个`);
            if (errorDetails.system > 0) errorBreakdown.push(`系统错误 ${errorDetails.system} 个`);
            if (errorDetails.other > 0) errorBreakdown.push(`其他错误 ${errorDetails.other} 个`);
            
            if (errorBreakdown.length > 0) {
              errorMsg += ` (${errorBreakdown.join(', ')})`;
            }
          }
          
          logger.info(errorMsg);
        }
      } else {
        logger.info('API缓存目录为空，无需清理');
      }
    } catch (error) {
      logger.error('清空API缓存失败:', error);
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
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;
        } catch (error) {
          // 如果文件不存在，跳过
          if (error.code === 'ENOENT') {
            logger.debug(`API缓存文件不存在，跳过: ${filePath}`);
          } else {
            logger.debug(`检查API缓存文件失败: ${filePath}`, error.message);
          }
        }
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

  /**
   * 带重试的安全删除文件
   * @param {string} filePath 文件路径
   * @param {number} maxRetries 最大重试次数
   * @returns {Promise<boolean>} 删除是否成功
   */
  async safeDeleteFileWithRetry(filePath, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const success = await FileUtils.safeDeleteFile(filePath);
        if (success) {
          return true;
        }
        
        // 如果删除失败但不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * attempt, 5000); // 递增延迟，最大5秒
          logger.debug(`删除API缓存文件失败，${delay}ms后重试 (${attempt}/${maxRetries}): ${filePath}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.debug(`删除API缓存文件异常 (${attempt}/${maxRetries}): ${filePath}`, error.message);
        
        // 如果是最后一次尝试，返回失败
        if (attempt === maxRetries) {
          return false;
        }
        
        // 等待后重试
        const delay = Math.min(1000 * attempt, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  /**
   * 分类错误类型
   * @param {Error} error 错误对象
   * @returns {Object} 错误分类信息
   */
  categorizeError(error) {
    const errorInfo = {
      type: 'unknown',
      retryable: false,
      message: error.message || '未知错误'
    };

    if (!error.code) {
      return errorInfo;
    }

    switch (error.code) {
      case 'EPERM':
      case 'EACCES':
        errorInfo.type = 'permission';
        errorInfo.retryable = true;
        break;
      case 'EBUSY':
        errorInfo.type = 'busy';
        errorInfo.retryable = true;
        break;
      case 'ENOENT':
        errorInfo.type = 'not_found';
        errorInfo.retryable = false; // 文件不存在，不需要重试
        break;
      case 'EMFILE':
      case 'ENFILE':
        errorInfo.type = 'resource';
        errorInfo.retryable = true;
        break;
      default:
        errorInfo.type = 'system';
        errorInfo.retryable = false;
    }

    return errorInfo;
  }
}

module.exports = ApiCacheService;