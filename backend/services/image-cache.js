const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const CacheConfigManager = require('../config/cache-config');
const { defaultLogger } = require('../utils/logger');
const FileUtils = require('../utils/file-utils');

// 创建logger实例
const logger = defaultLogger.child('ImageCache');

/**
 * 图片缓存服务
 * 负责管理图片代理的缓存功能
 */
class ImageCacheService {
  constructor() {
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.cacheDir = path.join(process.cwd(), 'data', 'image-cache');
      this.indexPath = path.join(process.cwd(), 'data', 'image-cache-index.json');
    } else {
      // 在开发环境中，使用项目根目录的data文件夹
      this.cacheDir = path.join(__dirname, '..', '..', 'data', 'image-cache');
      this.indexPath = path.join(__dirname, '..', '..', 'data', 'image-cache-index.json');
    }
    
    // 确保路径是绝对路径
    this.cacheDir = path.resolve(this.cacheDir);
    this.indexPath = path.resolve(this.indexPath);
    
    // 创建配置管理器
    this.configManager = new CacheConfigManager();
    
    // 默认缓存配置
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24小时缓存
      maxSize: 100 * 1024 * 1024, // 100MB最大缓存大小
      cleanupInterval: 60 * 60 * 1000, // 1小时清理一次
      enabled: true,
      proxy: {
        enabled: true,
        timeout: 30000,
        retryCount: 3,
        retryDelay: 1000,
      },
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    };
    
    // 缓存索引
    this.cacheIndex = new Map();
    
    // 添加删除状态跟踪，防止循环删除
    this.deletingFiles = new Set();
    
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
      
      // 加载缓存索引
      await this.loadCacheIndex();
      
      // 验证并同步缓存索引
      await this.validateAndSyncIndex();
      
      // 启动定期清理任务
      this.startCleanupTask();
      
      logger.info('图片缓存服务初始化完成');
    } catch (error) {
      logger.error('图片缓存服务初始化失败', error);
    }
  }

  /**
   * 确保缓存目录存在
   */
  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.info('图片缓存目录创建成功');
    } catch (error) {
      logger.error('创建图片缓存目录失败', error);
    }
  }

  /**
   * 生成缓存文件名
   * @param {string} url 原始图片URL
   * @returns {string} 缓存文件名
   */
  generateCacheKey(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const ext = this.getFileExtension(url);
    return `${hash}${ext}`;
  }

  /**
   * 获取文件扩展名
   * @param {string} url 图片URL
   * @returns {string} 文件扩展名
   */
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = path.extname(pathname);
      return ext || '.jpg'; // 默认使用.jpg
    } catch (error) {
      return '.jpg';
    }
  }

  /**
   * 获取缓存文件路径
   * @param {string} url 原始图片URL
   * @returns {string} 缓存文件路径
   */
  getCacheFilePath(url) {
    const cacheKey = this.generateCacheKey(url);
    return path.join(this.cacheDir, cacheKey);
  }

  /**
   * 检查缓存是否存在且有效
   * @param {string} url 原始图片URL
   * @returns {Promise<boolean>} 缓存是否有效
   */
  async isCacheValid(url) {
    try {
      const cachePath = this.getCacheFilePath(url);
      const stats = await fs.stat(cachePath);
      
      // 检查文件是否过期
      const age = Date.now() - stats.mtime.getTime();
      return age < this.config.maxAge;
    } catch (error) {
      return false;
    }
  }

  /**
   * 从缓存获取图片
   * @param {string} url 原始图片URL
   * @returns {Promise<Buffer|null>} 图片数据，如果缓存不存在则返回null
   */
  async getFromCache(url) {
    try {
      if (!(await this.isCacheValid(url))) {
        return null;
      }

      const cachePath = this.getCacheFilePath(url);
      const data = await fs.readFile(cachePath);
      
      // 更新文件访问时间
      await fs.utimes(cachePath, new Date(), new Date());
      
      return data;
    } catch (error) {
      logger.error('读取缓存失败:', error);
      return null;
    }
  }

  /**
   * 将图片保存到缓存
   * @param {string} url 原始图片URL
   * @param {Buffer} data 图片数据
   * @returns {Promise<void>}
   */
  async saveToCache(url, data) {
    try {
      const cacheKey = this.generateCacheKey(url);
      const cachePath = this.getCacheFilePath(url);
      const filename = path.basename(cachePath);
      
      await fs.writeFile(cachePath, data);
      
      // 获取文件信息并添加到索引
      const stats = await fs.stat(cachePath);
      this.addToIndex(cacheKey, filename, stats.size, stats.mtime.getTime());
      
      // 异步保存索引
      this.saveCacheIndex().catch(error => {
        logger.error('异步保存缓存索引失败:', error);
      });
      
      // 检查缓存大小，如果超过限制则清理
      await this.checkCacheSize();
    } catch (error) {
      logger.error('保存缓存失败:', error);
    }
  }

  /**
   * 从网络下载图片并缓存
   * @param {string} url 图片URL
   * @returns {Promise<Buffer>} 图片数据
   */
  async downloadAndCache(url) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.proxy.retryCount; attempt++) {
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer',
          headers: {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: this.config.proxy.timeout
        });

        const data = Buffer.from(response.data);
        
        // 异步保存到缓存（不等待完成）
        if (this.config.enabled) {
          this.saveToCache(url, data).catch(error => {
            logger.error('异步保存缓存失败:', error);
          });
        }

        return data;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.proxy.retryCount) {
          await new Promise(resolve => setTimeout(resolve, this.config.proxy.retryDelay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 获取图片（优先从缓存，缓存不存在则下载）
   * @param {string} url 图片URL
   * @returns {Promise<Buffer>} 图片数据
   */
  async getImage(url) {
    // 检查缓存是否启用
    if (!this.config.enabled) {
      return await this.downloadAndCache(url);
    }

    // 检查文件类型是否允许缓存
    const ext = this.getFileExtension(url);
    if (!this.config.allowedExtensions.includes(ext)) {
      return await this.downloadAndCache(url);
    }

    // 首先尝试从缓存获取
    const cachedData = await this.getFromCache(url);
    if (cachedData) {
      return cachedData;
    }

    // 缓存不存在，从网络下载
    return await this.downloadAndCache(url);
  }

  /**
   * 检查缓存大小并清理
   * @returns {Promise<void>}
   */
  async checkCacheSize() {
    try {
      let totalSize = 0;
      const fileStats = [];

      // 使用索引计算总大小和收集文件信息
      for (const [cacheKey, fileInfo] of this.cacheIndex.entries()) {
        const filePath = path.join(this.cacheDir, fileInfo.filename);
        
        // 防止重复删除同一个文件
        if (this.deletingFiles.has(filePath)) {
          continue;
        }
        
        try {
          // 验证文件是否实际存在
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileStats.push({
            path: filePath,
            size: stats.size,
            mtime: new Date(fileInfo.mtime),
            cacheKey: cacheKey
          });
        } catch (error) {
          // 如果文件不存在，从索引中移除
          if (error.code === 'ENOENT') {
            logger.warn(`缓存文件不存在，从索引中移除: ${filePath}`);
            this.removeFromIndex(cacheKey);
          } else {
            logger.error(`检查缓存文件失败: ${filePath}`, error);
          }
        }
      }

      // 如果超过最大大小，删除最旧的文件
      if (totalSize > this.config.maxSize) {
        logger.info(`缓存大小 ${totalSize} 超过限制 ${this.config.maxSize}，开始清理...`);
        
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
              // 从索引中移除
              this.removeFromIndex(file.cacheKey);
              logger.debug(`成功删除缓存文件: ${file.path}`);
            } else {
              errorCount++;
              logger.debug(`删除缓存文件失败: ${file.path}`);
              // 即使删除失败，也从索引中移除，避免重复尝试
              this.removeFromIndex(file.cacheKey);
            }
            
            if (totalSize <= this.config.maxSize * 0.8) { // 清理到80%
              break;
            }
          } finally {
            // 移除删除标记
            this.deletingFiles.delete(file.path);
          }
        }
        
        // 保存更新后的索引
        await this.saveCacheIndex();
        
        if (errorCount > 0) {
          logger.info(`缓存清理完成，当前大小: ${totalSize}，成功删除 ${deletedCount} 个文件，失败 ${errorCount} 个文件`);
        } else {
          logger.info(`缓存清理完成，当前大小: ${totalSize}，删除了 ${deletedCount} 个文件`);
        }
      }
    } catch (error) {
      logger.error('检查缓存大小失败:', error);
    }
  }

  /**
   * 手动清理所有缓存
   * @returns {Promise<void>}
   */
  async clearAllCache() {
    try {
      let deletedCount = 0;
      let errorCount = 0;
      const errorDetails = {
        permission: 0,
        busy: 0,
        system: 0,
        other: 0
      };
      
      // 使用索引清理所有文件
      for (const [cacheKey, fileInfo] of this.cacheIndex.entries()) {
        const filePath = path.join(this.cacheDir, fileInfo.filename);
        
        // 防止重复删除
        if (this.deletingFiles.has(filePath)) {
          continue;
        }
        
        // 标记文件为删除中
        this.deletingFiles.add(filePath);
        
        try {
          // 使用带重试的删除方法
          const deleteSuccess = await this.safeDeleteFileWithRetry(filePath);
          if (deleteSuccess) {
            deletedCount++;
            logger.debug(`成功删除缓存文件: ${filePath}`);
          } else {
            errorCount++;
            errorDetails.other++;
            logger.debug(`删除缓存文件失败: ${filePath}`);
          }
        } catch (error) {
          const errorInfo = this.categorizeError(error);
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
          
          logger.debug(`删除缓存文件异常: ${filePath}`, error.message);
        } finally {
          // 移除删除标记
          this.deletingFiles.delete(filePath);
        }
      }
      
      // 清空索引
      this.cacheIndex.clear();
      // 清空删除标记
      this.deletingFiles.clear();
      await this.saveCacheIndex();
      
      if (errorCount === 0) {
        logger.info(`所有缓存已清理，共删除 ${deletedCount} 个文件`);
      } else {
        let errorMsg = `缓存清理完成，成功删除 ${deletedCount} 个文件，失败 ${errorCount} 个文件`;
        
        const errorBreakdown = [];
        if (errorDetails.permission > 0) errorBreakdown.push(`权限错误 ${errorDetails.permission} 个`);
        if (errorDetails.busy > 0) errorBreakdown.push(`文件占用 ${errorDetails.busy} 个`);
        if (errorDetails.system > 0) errorBreakdown.push(`系统错误 ${errorDetails.system} 个`);
        if (errorDetails.other > 0) errorBreakdown.push(`其他错误 ${errorDetails.other} 个`);
        
        if (errorBreakdown.length > 0) {
          errorMsg += ` (${errorBreakdown.join(', ')})`;
        }
        
        logger.info(errorMsg);
      }
    } catch (error) {
      logger.error('清理所有缓存失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期缓存
   * @returns {Promise<void>}
   */
  async cleanupExpiredCache() {
    try {
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

      // 使用索引检查过期文件
      for (const [cacheKey, fileInfo] of this.cacheIndex.entries()) {
        const filePath = path.join(this.cacheDir, fileInfo.filename);
        
        // 防止重复删除同一个文件
        if (this.deletingFiles.has(filePath)) {
          logger.debug(`文件正在删除中，跳过: ${filePath}`);
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
                this.removeFromIndex(cacheKey);
                cleanedCount++;
                logger.debug(`成功删除过期缓存文件: ${filePath}`);
              } else {
                errorCount++;
                errorDetails.other++;
                logger.debug(`删除过期缓存文件失败: ${filePath}`);
                // 即使删除失败，也从索引中移除，避免重复尝试
                this.removeFromIndex(cacheKey);
              }
            } finally {
              // 无论成功失败，都要移除删除标记
              this.deletingFiles.delete(filePath);
            }
          }
        } catch (error) {
          // 如果文件不存在，从索引中移除
          if (error.code === 'ENOENT') {
            logger.debug(`过期缓存文件不存在，从索引中移除: ${filePath}`);
            this.removeFromIndex(cacheKey);
          } else {
            const errorInfo = this.categorizeError(error);
            logger.debug(`检查过期缓存文件失败: ${filePath}`, error.message);
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
        // 保存更新后的索引
        await this.saveCacheIndex();
        
        if (errorCount === 0 && skippedCount === 0) {
          logger.info(`清理了 ${cleanedCount} 个过期缓存文件`);
        } else {
          let errorMsg = `缓存清理完成，成功删除 ${cleanedCount} 个文件，失败 ${errorCount} 个文件，跳过 ${skippedCount} 个被占用文件`;
          
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
      logger.error('清理过期缓存失败:', error);
    }
  }

  /**
   * 检查是否有活跃的下载任务
   */
  hasActiveDownloads() {
    // 这里可以集成任务管理器来检查下载状态
    // 暂时返回false，避免过于复杂的依赖
    return false;
  }

  /**
   * 智能清理过期缓存
   * 避免在下载过程中清理
   */
  async smartCleanupExpiredCache() {
    // 检查是否有活跃下载
    if (this.hasActiveDownloads()) {
      logger.info('检测到活跃下载任务，跳过缓存清理');
      return;
    }

    // 执行正常的清理
    await this.cleanupExpiredCache();
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTask() {
    setInterval(() => {
      this.smartCleanupExpiredCache().catch(error => {
        logger.error('定期清理任务失败:', error);
      });
    }, this.config.cleanupInterval);
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
          logger.debug(`删除文件失败，${delay}ms后重试 (${attempt}/${maxRetries}): ${filePath}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        logger.debug(`删除文件异常 (${attempt}/${maxRetries}): ${filePath}`, error.message);
        
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

  /**
   * 获取缓存统计信息
   * @returns {Promise<Object>} 缓存统计信息
   */
  async getCacheStats() {
    try {
      let totalSize = 0;
      let fileCount = 0;
      let errorCount = 0;
      let indexSize = this.cacheIndex.size;

      // 使用索引获取统计信息
      for (const [cacheKey, fileInfo] of this.cacheIndex.entries()) {
        const filePath = path.join(this.cacheDir, fileInfo.filename);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;
        } catch (error) {
          if (error.code === 'ENOENT') {
            logger.warn(`统计缓存时文件不存在: ${filePath}`);
            // 从索引中移除不存在的文件
            this.removeFromIndex(cacheKey);
          } else {
            logger.error(`获取缓存文件统计失败: ${filePath}`, error);
          }
          errorCount++;
        }
      }

      // 如果有文件被移除，保存索引
      if (errorCount > 0) {
        await this.saveCacheIndex();
      }

      return {
        fileCount,
        totalSize,
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        enabled: this.config.enabled,
        config: this.config,
        errorCount,
        indexSize
      };
    } catch (error) {
      logger.error('获取缓存统计失败:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        enabled: this.config.enabled,
        config: this.config,
        errorCount: 0,
        indexSize: this.cacheIndex.size
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
   * 加载缓存索引
   */
  async loadCacheIndex() {
    try {
      if (await fs.access(this.indexPath).then(() => true).catch(() => false)) {
        const indexData = await fs.readFile(this.indexPath, 'utf8');
        const index = JSON.parse(indexData);
        this.cacheIndex = new Map(Object.entries(index));
        logger.info(`已加载缓存索引，包含 ${this.cacheIndex.size} 个文件记录`);
      } else {
        logger.info('缓存索引文件不存在，将创建新的索引');
        this.cacheIndex = new Map();
      }
    } catch (error) {
      logger.warn('加载缓存索引失败，将创建新的索引:', error.message);
      this.cacheIndex = new Map();
    }
  }

  /**
   * 保存缓存索引
   */
  async saveCacheIndex() {
    try {
      const indexData = Object.fromEntries(this.cacheIndex);
      await fs.writeFile(this.indexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      logger.error('保存缓存索引失败:', error);
    }
  }

  /**
   * 验证并同步缓存索引
   */
  async validateAndSyncIndex() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const fileSet = new Set(files);
      let removedCount = 0;
      let addedCount = 0;

      // 检查索引中的文件是否实际存在
      for (const [cacheKey, fileInfo] of this.cacheIndex.entries()) {
        if (!fileSet.has(fileInfo.filename)) {
          this.cacheIndex.delete(cacheKey);
          removedCount++;
        }
      }

      // 检查实际文件是否在索引中
      for (const filename of files) {
        const filePath = path.join(this.cacheDir, filename);
        try {
          const stats = await fs.stat(filePath);
          const cacheKey = this.findCacheKeyByFilename(filename);
          
          if (!cacheKey) {
            // 文件存在但不在索引中，添加到索引
            this.cacheIndex.set(filename, {
              filename: filename,
              size: stats.size,
              mtime: stats.mtime.getTime(),
              added: Date.now()
            });
            addedCount++;
          }
        } catch (error) {
          // 文件不存在，从索引中移除
          const cacheKey = this.findCacheKeyByFilename(filename);
          if (cacheKey) {
            this.cacheIndex.delete(cacheKey);
            removedCount++;
          }
        }
      }

      if (removedCount > 0 || addedCount > 0) {
        logger.info(`缓存索引同步完成: 移除 ${removedCount} 个无效记录，添加 ${addedCount} 个新记录`);
        await this.saveCacheIndex();
      }
    } catch (error) {
      logger.error('验证缓存索引失败:', error);
    }
  }

  /**
   * 根据文件名查找缓存键
   */
  findCacheKeyByFilename(filename) {
    for (const [cacheKey, fileInfo] of this.cacheIndex.entries()) {
      if (fileInfo.filename === filename) {
        return cacheKey;
      }
    }
    return null;
  }

  /**
   * 添加文件到缓存索引
   */
  addToIndex(cacheKey, filename, size, mtime) {
    this.cacheIndex.set(cacheKey, {
      filename: filename,
      size: size,
      mtime: mtime,
      added: Date.now()
    });
  }

  /**
   * 从缓存索引中移除文件
   */
  removeFromIndex(cacheKey) {
    this.cacheIndex.delete(cacheKey);
  }
}

module.exports = ImageCacheService;