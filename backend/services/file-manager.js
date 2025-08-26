const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const ConfigManager = require('../config/config-manager');
const FileUtils = require('../utils/file-utils');
const ErrorHandler = require('../utils/error-handler');

/**
 * 文件管理器 - 负责文件下载、检查和目录管理
 */
class FileManager {
  constructor() {
    this.configManager = new ConfigManager();
    
    // 下载配置
    this.downloadConfig = {
      timeout: 300000, // 5分钟超时
      chunkSize: 1024 * 1024, // 1MB块大小
      retryAttempts: 3, // 重试次数
      retryDelay: 2000, // 重试延迟
      concurrentDownloads: 3 // 并发下载数
    };
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
      console.error('获取下载路径失败:', error);
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

      return { valid: true, size: stats.size };
    } catch (error) {
      return { valid: false, reason: '检查文件失败', error: error.message };
    }
  }

  /**
   * 简单的文件下载方法
   */
  async downloadFile(url, filePath) {
    const maxRetries = this.downloadConfig.retryAttempts;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          headers: {
            'Referer': 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 60000
        });

        // 使用增强的写入流创建方法
        const writer = await FileUtils.safeCreateWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => {
            // 验证文件是否写入成功
            fs.access(filePath)
              .then(() => resolve())
              .catch(error => {
                console.error(`文件写入验证失败: ${filePath}`, error.message);
                reject(error);
              });
          });
          writer.on('error', async (error) => {
            // 下载失败时删除文件
            try {
              await this.safeDeleteFile(filePath);
            } catch (removeError) {
              console.warn('清理失败文件时出错:', removeError.message);
            }
            reject(error);
          });
        });
      } catch (error) {
        lastError = error;
        
        // 处理文件系统错误
        const errorResult = ErrorHandler.handleFileSystemError(error, filePath, 'download');
        
        console.error(`下载文件失败 (尝试 ${attempt}/${maxRetries}): ${filePath}`, error.message);
        
        // 如果不是可重试的错误，直接抛出
        if (!errorResult.retryable) {
          throw error;
        }
        
        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          console.error(`下载文件最终失败: ${filePath}`, error.message);
          throw error;
        }
        
        // 等待后重试
        const retryDelay = ErrorHandler.getRetryDelay(error, attempt);
        console.log(`等待 ${retryDelay}ms 后重试下载: ${filePath}`);
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
      console.error(`文件删除失败: ${filePath}`, error.message);
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