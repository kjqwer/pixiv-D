const fs = require('fs-extra');
const path = require('path');
const { defaultLogger } = require('./logger');

// 创建logger实例
const logger = defaultLogger.child('FileUtils');


/**
 * 文件操作工具类 - 确保与 pkg 打包兼容
 */
class FileUtils {
  /**
   * 安全删除文件（兼容 pkg 打包）
   */
  static async safeDeleteFile(filePath) {
    try {
      // 首先尝试使用 fs-extra
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        return true;
      }
    } catch (error) {
      try {
        // 降级到原生 fs
        const nativeFs = require('fs').promises;
        await nativeFs.unlink(filePath);
        return true;
      } catch (nativeError) {
        logger.error(`文件删除失败: ${filePath}`, nativeError.message);
        return false;
      }
    }
    return false;
  }

  /**
   * 安全创建目录（兼容 pkg 打包）
   */
  static async safeEnsureDir(dirPath) {
    try {
      // 首先尝试使用 fs-extra
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      try {
        // 降级到原生 fs
        const nativeFs = require('fs').promises;
        await nativeFs.mkdir(dirPath, { recursive: true });
        return true;
      } catch (nativeError) {
        logger.error(`目录创建失败: ${dirPath}`, nativeError.message);
        return false;
      }
    }
  }

  /**
   * 增强的目录创建方法（专门处理打包后的权限问题）
   */
  static async safeEnsureDirEnhanced(dirPath) {
    try {
      // 规范化路径
      const normalizedPath = path.resolve(dirPath);
      
      // 检查是否在打包环境中
      const isPkg = process.pkg !== undefined;
      
      if (isPkg) {
        // 在打包环境中，使用更保守的方法
        return await this.createDirectoryRecursive(normalizedPath);
      } else {
        // 在开发环境中，使用标准方法
        await fs.ensureDir(normalizedPath);
        return true;
      }
    } catch (error) {
      logger.error(`增强目录创建失败: ${dirPath}`, error.message);
      return false;
    }
  }

  /**
   * 递归创建目录（处理权限问题）
   */
  static async createDirectoryRecursive(dirPath) {
    try {
      const parts = dirPath.split(path.sep);
      let currentPath = '';
      
      for (const part of parts) {
        if (!part) continue;
        
        currentPath = currentPath ? path.join(currentPath, part) : part;
        
        try {
          // 检查目录是否已存在
          const stats = await fs.stat(currentPath);
          if (!stats.isDirectory()) {
            throw new Error(`路径存在但不是目录: ${currentPath}`);
          }
        } catch (error) {
          if (error.code === 'ENOENT') {
            // 目录不存在，尝试创建
            try {
              await fs.mkdir(currentPath);
              // 验证创建是否成功
              await fs.access(currentPath);
            } catch (mkdirError) {
              logger.error(`创建目录失败: ${currentPath}`, mkdirError.message);
              throw mkdirError;
            }
          } else {
            throw error;
          }
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`递归创建目录失败: ${dirPath}`, error.message);
      return false;
    }
  }

  /**
   * 安全写入文件（处理权限问题）
   */
  static async safeWriteFile(filePath, data, options = {}) {
    try {
      // 确保目录存在
      const dirPath = path.dirname(filePath);
      const dirCreated = await this.safeEnsureDirEnhanced(dirPath);
      
      if (!dirCreated) {
        throw new Error(`无法创建目录: ${dirPath}`);
      }
      
      // 检查文件是否被占用
      if (await fs.pathExists(filePath)) {
        try {
          // 尝试删除现有文件
          await fs.remove(filePath);
        } catch (removeError) {
          logger.warn(`删除现有文件失败: ${filePath}`, removeError.message);
          // 继续尝试写入，可能会覆盖
        }
      }
      
      // 写入文件
      await fs.writeFile(filePath, data, options);
      
      // 验证写入是否成功
      await fs.access(filePath);
      
      return true;
    } catch (error) {
      logger.error(`安全写入文件失败: ${filePath}`, error.message);
      return false;
    }
  }

  /**
   * 安全创建写入流（处理权限问题）
   */
  static async safeCreateWriteStream(filePath) {
    try {
      // 确保目录存在
      const dirPath = path.dirname(filePath);
      const dirCreated = await this.safeEnsureDirEnhanced(dirPath);
      
      if (!dirCreated) {
        throw new Error(`无法创建目录: ${dirPath}`);
      }
      
      // 检查文件是否被占用
      if (await fs.pathExists(filePath)) {
        try {
          await fs.remove(filePath);
        } catch (removeError) {
          logger.warn(`删除现有文件失败: ${filePath}`, removeError.message);
        }
      }
      
      // 创建写入流
      return fs.createWriteStream(filePath);
    } catch (error) {
      logger.error(`创建写入流失败: ${filePath}`, error.message);
      throw error;
    }
  }

  /**
   * 安全检查文件是否存在（兼容 pkg 打包）
   */
  static async safePathExists(filePath) {
    try {
      // 首先尝试使用 fs-extra
      return await fs.pathExists(filePath);
    } catch (error) {
      try {
        // 降级到原生 fs
        const nativeFs = require('fs').promises;
        await nativeFs.access(filePath);
        return true;
      } catch (nativeError) {
        return false;
      }
    }
  }

  /**
   * 安全读取目录（兼容 pkg 打包）
   */
  static async safeReadDir(dirPath) {
    try {
      // 首先尝试使用 fs-extra
      return await fs.readdir(dirPath);
    } catch (error) {
      try {
        // 降级到原生 fs
        const nativeFs = require('fs').promises;
        return await nativeFs.readdir(dirPath);
      } catch (nativeError) {
        logger.error(`读取目录失败: ${dirPath}`, nativeError.message);
        return [];
      }
    }
  }

  /**
   * 安全写入 JSON 文件（兼容 pkg 打包）
   */
  static async safeWriteJson(filePath, data, options = {}) {
    try {
      // 首先尝试使用 fs-extra
      await fs.writeJson(filePath, data, options);
      return true;
    } catch (error) {
      try {
        // 降级到原生 fs
        const nativeFs = require('fs').promises;
        const jsonString = JSON.stringify(data, null, options.spaces || 2);
        await nativeFs.writeFile(filePath, jsonString, 'utf8');
        return true;
      } catch (nativeError) {
        logger.error(`JSON 写入失败: ${filePath}`, nativeError.message);
        return false;
      }
    }
  }

  /**
   * 检测是否在 pkg 打包环境中运行
   */
  static isPkgEnvironment() {
    return process.pkg !== undefined;
  }

  /**
   * 获取当前运行环境信息
   */
  static getEnvironmentInfo() {
    return {
      isPkg: this.isPkgEnvironment(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pkgVersion: process.pkg ? process.pkg.version : null,
    };
  }

  /**
   * 检查文件权限
   */
  static async checkFilePermissions(filePath, mode = 'w') {
    try {
      const nativeFs = require('fs').promises;
      await nativeFs.access(filePath, mode === 'w' ? nativeFs.constants.W_OK : nativeFs.constants.R_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查目录权限
   */
  static async checkDirectoryPermissions(dirPath, mode = 'w') {
    try {
      const nativeFs = require('fs').promises;
      await nativeFs.access(dirPath, mode === 'w' ? nativeFs.constants.W_OK : nativeFs.constants.R_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 等待文件释放（处理文件占用问题）
   */
  static async waitForFileRelease(filePath, maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const nativeFs = require('fs').promises;
        await nativeFs.access(filePath, nativeFs.constants.W_OK);
        return true;
      } catch (error) {
        if (error.code === 'EBUSY' || error.code === 'EACCES') {
          // 文件被占用或无权限，等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        // 其他错误，直接返回
        return false;
      }
    }
    
    return false;
  }
}

module.exports = FileUtils;
