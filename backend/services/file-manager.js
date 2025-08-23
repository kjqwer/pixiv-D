const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const ConfigManager = require('../config/config-manager');

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

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', (error) => {
        // 下载失败时删除文件
        fs.unlink(filePath, () => {});
        reject(error);
      });
    });
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
    return name.replace(/[<>:"/\\|?*]/g, '_');
  }

  /**
   * 确保目录存在
   */
  async ensureDirectory(dirPath) {
    await fs.ensureDir(dirPath);
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
    if (await fs.pathExists(filePath)) {
      await fs.unlink(filePath);
    }
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