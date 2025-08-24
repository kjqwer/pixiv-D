const fs = require('fs-extra');
const path = require('path');

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
        console.error(`文件删除失败: ${filePath}`, nativeError.message);
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
        console.error(`目录创建失败: ${dirPath}`, nativeError.message);
        return false;
      }
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
        console.error(`读取目录失败: ${dirPath}`, nativeError.message);
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
        console.error(`JSON 写入失败: ${filePath}`, nativeError.message);
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
}

module.exports = FileUtils;
