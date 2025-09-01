const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const CacheConfigManager = require('../config/cache-config');
const { defaultLogger } = require('../utils/logger');

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
    } else {
      // 在开发环境中，使用项目根目录的data文件夹
      this.cacheDir = path.join(__dirname, '..', '..', 'data', 'image-cache');
    }
    
    // 确保路径是绝对路径
    this.cacheDir = path.resolve(this.cacheDir);
    
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
      logger.info('图片缓存目录创建成功', { cacheDir: this.cacheDir });
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
      const cachePath = this.getCacheFilePath(url);
      await fs.writeFile(cachePath, data);
      
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
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const fileStats = [];

      // 计算总大小和收集文件信息
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileStats.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime
          });
        } catch (error) {
          // 如果文件不存在，记录日志但继续处理其他文件
          if (error.code === 'ENOENT') {
            logger.warn(`缓存文件不存在，跳过: ${filePath}`);
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
        
        for (const file of fileStats) {
          try {
            await fs.unlink(file.path);
            totalSize -= file.size;
            
            if (totalSize <= this.config.maxSize * 0.8) { // 清理到80%
              break;
            }
          } catch (error) {
            // 如果删除文件失败，记录日志但继续处理其他文件
            if (error.code === 'ENOENT') {
              logger.warn(`删除缓存文件时文件不存在: ${file.path}`);
            } else {
              logger.error(`删除缓存文件失败: ${file.path}`, error);
            }
          }
        }
        
        logger.info(`缓存清理完成，当前大小: ${totalSize}`);
      }
    } catch (error) {
      logger.error('检查缓存大小失败:', error);
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
        try {
          const stats = await fs.stat(filePath);
          
          const age = Date.now() - stats.mtime.getTime();
          if (age > this.config.maxAge) {
            try {
              await fs.unlink(filePath);
              cleanedCount++;
            } catch (deleteError) {
              if (deleteError.code === 'ENOENT') {
                logger.warn(`删除过期缓存文件时文件不存在: ${filePath}`);
              } else {
                logger.error(`删除过期缓存文件失败: ${filePath}`, deleteError);
              }
            }
          }
        } catch (error) {
          // 如果文件不存在，记录日志但继续处理其他文件
          if (error.code === 'ENOENT') {
            logger.warn(`过期缓存文件不存在，跳过: ${filePath}`);
          } else {
            logger.error(`检查过期缓存文件失败: ${filePath}`, error);
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`清理了 ${cleanedCount} 个过期缓存文件`);
      }
    } catch (error) {
      logger.error('清理过期缓存失败:', error);
    }
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTask() {
    setInterval(() => {
      this.cleanupExpiredCache().catch(error => {
        logger.error('定期清理任务失败:', error);
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
      let errorCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          await fs.unlink(filePath);
          deletedCount++;
        } catch (error) {
          if (error.code === 'ENOENT') {
            logger.warn(`清理缓存时文件不存在: ${filePath}`);
          } else {
            logger.error(`删除缓存文件失败: ${filePath}`, error);
            errorCount++;
          }
        }
      }
      
      if (errorCount === 0) {
        logger.info(`所有缓存已清理，共删除 ${deletedCount} 个文件`);
      } else {
        logger.warn(`缓存清理完成，成功删除 ${deletedCount} 个文件，失败 ${errorCount} 个文件`);
      }
    } catch (error) {
      logger.error('清理所有缓存失败:', error);
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
      let errorCount = 0;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          fileCount++;
        } catch (error) {
          if (error.code === 'ENOENT') {
            logger.warn(`统计缓存时文件不存在: ${filePath}`);
          } else {
            logger.error(`获取缓存文件统计失败: ${filePath}`, error);
          }
          errorCount++;
        }
      }

      return {
        fileCount,
        totalSize,
        maxSize: this.config.maxSize,
        maxAge: this.config.maxAge,
        enabled: this.config.enabled,
        config: this.config,
        errorCount
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
        errorCount: 0
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

module.exports = ImageCacheService; 