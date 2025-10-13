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
  /**
   * 检查文件完整性
   * @param {string} filePath - 文件路径
   * @param {number} expectedSize - 期望的文件大小
   * @param {string} expectedMimeType - 期望的MIME类型
   * @returns {Object} 检查结果
   */
  async checkFileIntegrity(filePath, expectedSize = null, expectedMimeType = null) {
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
      const minSize = this.getMinimumFileSize(filePath, expectedMimeType);
      if (stats.size < minSize) {
        return { valid: false, reason: '文件过小，可能下载不完整', size: stats.size, minSize };
      }

      // 检查文件头部是否符合预期格式
      const headerCheck = await this.checkFileHeader(filePath, expectedMimeType);
      if (!headerCheck.valid) {
        return headerCheck;
      }

      // 文件存在且大小正常，认为有效
      return { valid: true, size: stats.size };
    } catch (error) {
      return { valid: false, reason: '检查文件失败', error: error.message };
    }
  }

  /**
   * 获取文件的最小合理大小
   * @param {string} filePath - 文件路径
   * @param {string} expectedMimeType - 期望的MIME类型
   * @returns {number} 最小文件大小
   */
  getMinimumFileSize(filePath, expectedMimeType) {
    const ext = path.extname(filePath).toLowerCase();
    
    // 根据文件类型设置最小大小
    if (expectedMimeType) {
      if (expectedMimeType.startsWith('image/')) {
        return 1024; // 图片文件至少1KB
      } else if (expectedMimeType.includes('zip')) {
        return 1024; // ZIP文件至少1KB
      }
    }
    
    // 根据扩展名判断
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 1024; // JPEG文件至少1KB
      case '.png':
        return 512; // PNG文件至少512字节
      case '.gif':
        return 256; // GIF文件至少256字节
      case '.webp':
        return 512; // WebP文件至少512字节
      case '.bmp':
        return 1024; // BMP文件至少1KB
      default:
        return 256; // 其他文件至少256字节
    }
  }

  /**
   * 检查文件头部格式
   * @param {string} filePath - 文件路径
   * @param {string} expectedMimeType - 期望的MIME类型
   * @returns {Object} 检查结果
   */
  async checkFileHeader(filePath, expectedMimeType) {
    try {
      // 读取文件前几个字节来检查文件头
      const buffer = Buffer.alloc(16);
      const fd = await fs.open(filePath, 'r');
      
      try {
        const { bytesRead } = await fs.read(fd, buffer, 0, 16, 0);
        
        if (bytesRead < 4) {
          return { valid: false, reason: '文件头部数据不足' };
        }

        // 检查常见图片格式的文件头
        const header = buffer.toString('hex', 0, Math.min(bytesRead, 8));
        
        // JPEG文件头: FFD8FF
        if (header.startsWith('ffd8ff')) {
          if (expectedMimeType && !expectedMimeType.includes('jpeg') && !expectedMimeType.includes('jpg')) {
            return { valid: false, reason: '文件格式不匹配：检测到JPEG但期望其他格式' };
          }
          return { valid: true, detectedType: 'image/jpeg' };
        }
        
        // PNG文件头: 89504E47
        if (header.startsWith('89504e47')) {
          if (expectedMimeType && !expectedMimeType.includes('png')) {
            return { valid: false, reason: '文件格式不匹配：检测到PNG但期望其他格式' };
          }
          return { valid: true, detectedType: 'image/png' };
        }
        
        // GIF文件头: 474946
        if (header.startsWith('474946')) {
          if (expectedMimeType && !expectedMimeType.includes('gif')) {
            return { valid: false, reason: '文件格式不匹配：检测到GIF但期望其他格式' };
          }
          return { valid: true, detectedType: 'image/gif' };
        }
        
        // WebP文件头: 52494646...57454250
        if (header.startsWith('52494646') && buffer.toString('hex', 8, 12) === '57454250') {
          if (expectedMimeType && !expectedMimeType.includes('webp')) {
            return { valid: false, reason: '文件格式不匹配：检测到WebP但期望其他格式' };
          }
          return { valid: true, detectedType: 'image/webp' };
        }

        // 非图片类型的文件头检查（例如ZIP）
        if (expectedMimeType && expectedMimeType.includes('zip')) {
          // ZIP文件头常见为 504B0304 或 504B0506 等，以 504B 开头
          const headerHex = buffer.toString('hex', 0, Math.min(bytesRead, 4));
          if (headerHex.startsWith('504b')) {
            return { valid: true, detectedType: 'application/zip' };
          }
          return { valid: false, reason: '文件格式不匹配：期望ZIP但未检测到ZIP头部' };
        }

        // 如果没有明确的期望类型，且检测到了有效的图片头部，则认为有效
        if (!expectedMimeType) {
          return { valid: true, detectedType: 'unknown' };
        }

        // 如果有期望类型但未匹配到已知格式，可能是损坏的文件
        return { valid: false, reason: '无法识别的文件格式或文件头部损坏' };
      
      } finally {
        await fs.close(fd);
      }
    } catch (error) {
      return { valid: false, reason: '检查文件头部失败', error: error.message };
    }
  }

  /**
   * 简单的文件下载方法
   */
  async downloadFile(url, filePath, abortController = null) {
    const downloadConfig = await this.getDownloadConfig();
    const maxRetries = downloadConfig.retryAttempts;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let writer = null;
      let response = null;
      
      try {
        // 检查是否已被中断
        if (abortController && abortController.signal.aborted) {
          throw new Error('下载已被中断');
        }

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

        // 再次检查是否已被中断
        if (abortController && abortController.signal.aborted) {
          throw new Error('下载已被中断');
        }

        response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          headers: {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: downloadConfig.timeout,
          signal: abortController ? abortController.signal : undefined,
          // 添加连接超时和响应超时配置
          httpsAgent: new (require('https')).Agent({
            keepAlive: true,
            timeout: 60000, // 连接超时60秒
          }),
          // 添加重试配置
          validateStatus: (status) => status < 500, // 只对5xx错误重试
        });

        // 使用增强的写入流创建方法
        writer = await FileUtils.safeCreateWriteStream(filePath);
        let downloadedBytes = 0;
        const totalBytes = parseInt(response.headers['content-length']) || 0;

        // 设置流超时
        let streamTimeout = setTimeout(() => {
          logger.warn(`流传输超时，中断下载: ${filePath}`);
          if (writer && !writer.destroyed) {
            writer.destroy();
          }
          if (abortController) {
            abortController.abort();
          }
        }, downloadConfig.timeout + 60000);

        response.data.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          // 重置流超时
          clearTimeout(streamTimeout);
          streamTimeout = setTimeout(() => {
            if (writer && !writer.destroyed) {
              logger.warn(`流传输超时，中断下载: ${filePath}`);
              writer.destroy();
              if (abortController) {
                abortController.abort();
              }
            }
          }, downloadConfig.timeout + 60000);
        });

        response.data.on('error', (error) => {
          clearTimeout(streamTimeout);
          logger.error(`下载流错误: ${filePath}`, error);
          if (writer && !writer.destroyed) {
            writer.destroy();
          }
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          let isResolved = false;
          let abortListener = null;
          
          const cleanup = () => {
            clearTimeout(streamTimeout);
            if (writer && !writer.destroyed) {
              writer.destroy();
            }
            if (response && response.data && !response.data.destroyed) {
              response.data.destroy();
            }
            // 清理 AbortSignal 监听器
            if (abortController && abortListener) {
              abortController.signal.removeEventListener('abort', abortListener);
              abortListener = null;
            }
          };

          // 监听中断信号
          if (abortController) {
            abortListener = () => {
              if (isResolved) return;
              isResolved = true;
              
              logger.info(`下载被中断: ${filePath}`);
              cleanup();
              
              // 删除未完成的文件
              this.safeDeleteFile(filePath).catch(error => {
                logger.warn('删除被中断的文件失败', { filePath, error: error.message });
              });
              
              reject(new Error('下载被中断'));
            };
            abortController.signal.addEventListener('abort', abortListener);
          }

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
            
            logger.error(`文件写入流错误: ${filePath}`, {
              error: error.message,
              stack: error.stack,
              attempt,
              url
            });
            
            // 下载失败时删除文件
            try {
              if (await fs.pathExists(filePath)) {
                await this.safeDeleteFile(filePath);
                logger.debug('已清理失败的下载文件', { filePath });
              }
            } catch (removeError) {
              logger.warn('清理失败文件时出错:', {
                filePath,
                error: removeError.message
              });
            }
            
            cleanup();
            reject(error);
          });
          
          // 添加超时处理
          const timeout = setTimeout(() => {
            if (isResolved) return;
            isResolved = true;
            
            logger.error(`下载超时: ${filePath}`, {
              url,
              timeout: downloadConfig.timeout + 60000,
              attempt
            });
            
            const timeoutError = new Error('下载超时');
            cleanup();
            reject(timeoutError);
          }, downloadConfig.timeout + 60000); // 动态超时 + 1分钟缓冲
          
          // 清理超时定时器和监听器
          const clearTimeoutAndCleanup = () => {
            clearTimeout(timeout);
            cleanup();
          };
          
          writer.on('finish', clearTimeoutAndCleanup);
          writer.on('error', clearTimeoutAndCleanup);
          if (abortListener) {
            // 超时时也要清理监听器
            const originalTimeout = timeout._onTimeout;
            timeout._onTimeout = () => {
              cleanup();
              originalTimeout();
            };
          }
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
        
        // 首先检查是否是中断错误，如果是则直接抛出，不重试
        if (error.message === '下载已被中断' || 
            error.code === 'ERR_CANCELED' || 
            error.name === 'AbortError' ||
            (error.message && error.message.includes('canceled'))) {
          
          logger.error(`下载文件失败 (尝试 ${attempt}/${maxRetries}): ${filePath}`, {
            error: error.message,
            stack: error.stack,
            url,
            retryable: false,
            attempt,
            reason: 'download_interrupted'
          });
          
          throw error;
        }
        
        // 检查是否是可重试的网络错误
        const isRetryable = ErrorHandler.isRetryableError(error);
        
        logger.error(`下载文件失败 (尝试 ${attempt}/${maxRetries}): ${filePath}`, {
          error: error.message,
          stack: error.stack,
          url,
          retryable: isRetryable,
          attempt,
          errorCode: error.code
        });
        
        // 如果不是可重试的错误，直接抛出
        if (!isRetryable) {
          throw error;
        }
        
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          logger.error(`下载文件最终失败: ${filePath}`, {
            error: error.message,
            stack: error.stack,
            url,
            totalAttempts: maxRetries
          });
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
   * 获取所有艺术家目录
   */
  async getArtistDirectories() {
    try {
      const downloadPath = await this.getDownloadPath();
      if (!await this.directoryExists(downloadPath)) {
        return [];
      }
      
      const items = await this.listDirectory(downloadPath);
      const artistDirs = [];
      
      for (const item of items) {
        const itemPath = path.join(downloadPath, item);
        const stat = await fs.stat(itemPath);
        if (stat.isDirectory()) {
          artistDirs.push(item);
        }
      }
      
      return artistDirs;
    } catch (error) {
      logger.error('获取艺术家目录失败:', error);
      return [];
    }
  }

  /**
   * 获取指定艺术家目录下的所有作品目录
   */
  async getArtworkDirectories(artistName) {
    try {
      const downloadPath = await this.getDownloadPath();
      const artistPath = path.join(downloadPath, artistName);
      
      if (!await this.directoryExists(artistPath)) {
        return [];
      }
      
      const items = await this.listDirectory(artistPath);
      const artworkDirs = [];
      
      for (const item of items) {
        const itemPath = path.join(artistPath, item);
        const stat = await fs.stat(itemPath);
        if (stat.isDirectory()) {
          artworkDirs.push(item);
        }
      }
      
      return artworkDirs;
    } catch (error) {
      logger.error(`获取艺术家 ${artistName} 的作品目录失败:`, error);
      return [];
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
        logger.debug('文件删除成功', { filePath });
      }
    } catch (error) {
      logger.error(`文件删除失败: ${filePath}`, {
        error: error.message,
        stack: error.stack,
        code: error.code
      });
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