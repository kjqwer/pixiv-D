const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const ConfigManager = require('../config/config-manager');
const CacheConfigManager = require('../config/cache-config');
const FileUtils = require('../utils/file-utils');
const ErrorHandler = require('../utils/error-handler');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('FileManager');

/**
 * 文件管理器 - 负责文件下载、检查和目录管理
 */
class FileManager {
  constructor() {
    this.configManager = new ConfigManager();
    this.cacheConfigManager = new CacheConfigManager();
    
    // 默认下载配置（作为后备）
    this.defaultDownloadConfig = {
      timeout: 300000, // 5分钟超时
      chunkSize: 1024 * 1024, // 1MB块大小
      retryAttempts: 3, // 重试次数
      retryDelay: 2000, // 重试延迟
      concurrentDownloads: 3 // 并发下载数
    };
    
    // 初始化时设置线程池大小
    this.initializeThreadPool();
  }

  /**
   * 初始化线程池大小
   */
  async initializeThreadPool() {
    try {
      const config = await this.getDownloadConfig();
      if (config.threadPoolSize && !process.env.UV_THREADPOOL_SIZE) {
        process.env.UV_THREADPOOL_SIZE = config.threadPoolSize.toString();
        logger.info(`设置线程池大小为: ${config.threadPoolSize}`);
      }
    } catch (error) {
      logger.warn('初始化线程池大小失败，使用默认值:', error.message);
    }
  }

  /**
   * 获取下载配置
   */
  async getDownloadConfig() {
    try {
      const cacheConfig = await this.cacheConfigManager.loadConfig();
      return {
        timeout: cacheConfig.download?.downloadTimeout || this.defaultDownloadConfig.timeout,
        chunkSize: cacheConfig.download?.chunkSize || this.defaultDownloadConfig.chunkSize,
        retryAttempts: cacheConfig.download?.retryAttempts || this.defaultDownloadConfig.retryAttempts,
        retryDelay: cacheConfig.download?.retryDelay || this.defaultDownloadConfig.retryDelay,
        concurrentDownloads: cacheConfig.download?.concurrentDownloads || this.defaultDownloadConfig.concurrentDownloads,
        maxConcurrentFiles: cacheConfig.download?.maxConcurrentFiles || 5,
        threadPoolSize: cacheConfig.download?.threadPoolSize || 16,
        maxFileSize: cacheConfig.download?.maxFileSize || 50 * 1024 * 1024,
      };
    } catch (error) {
      logger.warn('获取下载配置失败，使用默认配置:', error.message);
      return this.defaultDownloadConfig;
    }
  }

  /**
   * 获取当前下载路径
   */
  async getDownloadPath() {
    try {
      const config = await this.configManager.readConfig();
      const downloadDir = config.downloadDir || './downloads';
      
      // 如果是相对路径，转换为绝对路径
      return path.isAbsolute(downloadDir) 
        ? downloadDir 
        : path.resolve(process.cwd(), downloadDir);
    } catch (error) {
      logger.error('获取下载路径失败:', error);
      // 返回默认路径
      return path.resolve(process.cwd(), 'downloads');
    }
  }

  /**
   * 计算文件MD5
   */
  async calculateFileMD5(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * 检查文件完整性
   */
  async checkFileIntegrity(filePath, expectedSize = null) {
    try {
      if (!await fs.pathExists(filePath)) {
        return { valid: false, reason: '文件不存在' };
      }

      const stats = await fs.stat(filePath);
      
      // 检查文件大小
      if (expectedSize && stats.size !== expectedSize) {
        return { valid: false, reason: '文件大小不匹配', actual: stats.size, expected: expectedSize };
      }
      
      // 检查文件是否为空
      if (stats.size === 0) {
        return { valid: false, reason: '文件为空' };
      }

      // 检查文件是否过小（可能下载不完整）
      if (stats.size < 512) { // 小于512字节的文件可能是损坏的
        return { valid: false, reason: '文件过小，可能下载不完整', size: stats.size };
      }

      // 文件存在且大小正常，认为有效
      return { valid: true, size: stats.size };
    } catch (error) {
      return { valid: false, reason: '检查文件失败', error: error.message };
    }
  }

  /**
   * 简单的文件下载方法
   */
  async downloadFile(url, filePath) {
    const downloadConfig = await this.getDownloadConfig();
    const maxRetries = downloadConfig.retryAttempts;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let writer = null;
      let response = null;
      
      try {
        // 使用增强的文件工具类确保目录存在
        const dirPath = path.dirname(filePath);
        const dirCreated = await FileUtils.safeEnsureDirEnhanced(dirPath);
        
        if (!dirCreated) {
          throw new Error(`无法创建目录: ${dirPath}`);
        }

        // 检查文件是否被占用
        if (await fs.pathExists(filePath)) {
          const fileReleased = await FileUtils.waitForFileRelease(filePath);
          if (!fileReleased) {
            throw new Error(`文件被占用，无法写入: ${filePath}`);
          }
        }

        response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          headers: {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: downloadConfig.timeout
        });

        // 使用增强的写入流创建方法
        writer = await FileUtils.safeCreateWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          let isResolved = false;
          
          const cleanup = () => {
            if (writer && !writer.destroyed) {
              writer.destroy();
            }
            if (response && response.data && !response.data.destroyed) {
              response.data.destroy();
            }
          };

          writer.on('finish', async () => {
            if (isResolved) return;
            isResolved = true;
            
            try {
              // 验证文件是否写入成功
              await fs.access(filePath);
              cleanup();
              resolve();
            } catch (error) {
              logger.error(`文件写入验证失败: ${filePath}`, error.message);
              cleanup();
              reject(error);
            }
          });
          
          writer.on('error', async (error) => {
            if (isResolved) return;
            isResolved = true;
            
            // 下载失败时删除文件
            try {
              await this.safeDeleteFile(filePath);
            } catch (removeError) {
              logger.warn('清理失败文件时出错:', removeError.message);
            }
            
            cleanup();
            reject(error);
          });
          
          // 添加超时处理
          const timeout = setTimeout(() => {
            if (isResolved) return;
            isResolved = true;
            
            const timeoutError = new Error('下载超时');
            cleanup();
            reject(timeoutError);
          }, downloadConfig.timeout + 60000); // 动态超时 + 1分钟缓冲
          
          // 清理超时定时器
          writer.on('finish', () => clearTimeout(timeout));
          writer.on('error', () => clearTimeout(timeout));
        });
        
      } catch (error) {
        // 确保清理资源
        if (writer && !writer.destroyed) {
          writer.destroy();
        }
        if (response && response.data && !response.data.destroyed) {
          response.data.destroy();
        }
        
        lastError = error;
        
        // 处理文件系统错误
        const errorResult = ErrorHandler.handleFileSystemError(error, filePath, 'download');
        
        logger.error(`下载文件失败 (尝试 ${attempt}/${maxRetries}): ${filePath}`, error.message);
        
        // 如果不是可重试的错误，直接抛出
        if (!errorResult.retryable) {
          throw error;
        }
        
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          logger.error(`下载文件最终失败: ${filePath}`, error.message);
          throw error;
        }
        
        // 等待后重试
        const retryDelay = ErrorHandler.getRetryDelay(error, attempt);
        logger.info(`等待 ${retryDelay}ms 后重试下载: ${filePath}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    // 如果所有重试都失败了
    throw lastError;
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    return match ? `.${match[1]}` : '.jpg';
  }

  /**
   * 获取目录大小
   */
  async getDirectorySize(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          totalSize += stat.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 创建安全的目录名
   */
  createSafeDirectoryName(name) {
    if (!name) return 'Untitled';
    
    // 移除或替换Windows文件系统不允许的字符
    let safeName = name
      // 替换Windows文件系统不允许的字符
      .replace(/[<>:"/\\|?*]/g, '_')
      // 替换波浪号和其他可能导致问题的字符
      .replace(/[~`!@#$%^&*()+=\[\]{};',]/g, '_')
      // 替换控制字符
      .replace(/[\x00-\x1f\x7f]/g, '_')
      // 替换Unicode控制字符
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '_')
      // 替换零宽字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '_')
      // 替换其他可能导致问题的Unicode字符
      .replace(/[\uFFFD]/g, '_');
    
    // 移除前后空格和点
    safeName = safeName.trim().replace(/^\.+|\.+$/g, '');
    
    // 如果处理后为空，使用默认名称
    if (!safeName) {
      safeName = 'Untitled';
    }
    
    // 限制长度，避免路径过长（Windows路径限制为260字符）
    if (safeName.length > 100) {
      safeName = safeName.substring(0, 100);
    }
    
    // 确保不以数字开头（避免与Windows保留名称冲突）
    if (/^\d/.test(safeName)) {
      safeName = 'artwork_' + safeName;
    }
    
    // 检查是否为Windows保留名称
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(safeName.toUpperCase())) {
      safeName = 'artwork_' + safeName;
    }
    
    return safeName;
  }

  /**
   * 确保目录存在
   */
  async ensureDirectory(dirPath) {
    const success = await FileUtils.safeEnsureDirEnhanced(dirPath);
    if (!success) {
      throw new Error(`目录创建失败: ${dirPath}`);
    }
  }

  /**
   * 删除目录
   */
  async removeDirectory(dirPath) {
    if (await fs.pathExists(dirPath)) {
      await fs.remove(dirPath);
    }
  }

  /**
   * 检查目录是否存在
   */
  async directoryExists(dirPath) {
    return await fs.pathExists(dirPath);
  }

  /**
   * 列出目录内容
   */
  async listDirectory(dirPath) {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      return [];
    }
  }

  /**
   * 复制文件
   */
  async copyFile(src, dest) {
    await fs.copy(src, dest);
  }

  /**
   * 移动文件
   */
  async moveFile(src, dest) {
    await fs.move(src, dest);
  }

  /**
   * 删除文件
   */
  async deleteFile(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      logger.error(`文件删除失败: ${filePath}`, error.message);
      // 不抛出错误，避免影响其他操作
    }
  }

  /**
   * 安全删除文件（兼容 pkg 打包）
   */
  async safeDeleteFile(filePath) {
    return await FileUtils.safeDeleteFile(filePath);
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filePath) {
    return await fs.pathExists(filePath);
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      return { exists: false };
    }
  }
}

module.exports = FileManager; 