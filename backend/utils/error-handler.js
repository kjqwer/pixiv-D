const path = require('path');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('ErrorHandler');


/**
 * 错误处理工具类 - 专门处理打包后的权限问题
 */
class ErrorHandler {
  /**
   * 处理文件系统错误
   */
  static handleFileSystemError(error, filePath, operation = 'unknown') {
    const errorInfo = {
      originalError: error,
      filePath: filePath,
      operation: operation,
      isPkg: process.pkg !== undefined,
      platform: process.platform,
      errorCode: error.code,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    // 记录详细错误信息
    logger.error(`文件系统错误 [${operation}]:`, {
      filePath: filePath,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack,
      isPkg: errorInfo.isPkg,
      platform: errorInfo.platform,
      timestamp: errorInfo.timestamp
    });

    // 根据错误类型提供解决方案
    switch (error.code) {
      case 'EPERM':
        return this.handlePermissionError(errorInfo);
      case 'EACCES':
        return this.handleAccessError(errorInfo);
      case 'EBUSY':
        return this.handleBusyError(errorInfo);
      case 'ENOENT':
        return this.handleNotFoundError(errorInfo);
      case 'EISDIR':
        return this.handleIsDirectoryError(errorInfo);
      case 'ENOTDIR':
        return this.handleNotDirectoryError(errorInfo);
      default:
        return this.handleGenericError(errorInfo);
    }
  }

  /**
   * 处理权限错误 (EPERM)
   */
  static handlePermissionError(errorInfo) {
    const { filePath, isPkg, platform } = errorInfo;
    
    logger.error('权限错误 (EPERM) 解决方案:');
    
    if (platform === 'win32') {
      logger.error('Windows 权限问题解决方案:');
      logger.error('1. 以管理员身份运行程序');
      logger.error('2. 检查文件/目录权限');
      logger.error('3. 检查防病毒软件是否阻止访问');
      logger.error('4. 检查文件是否被其他程序占用');
      
      if (isPkg) {
        logger.error('5. 打包环境特殊处理:');
        logger.error('   - 确保程序有写入权限');
        logger.error('   - 尝试使用用户目录而不是程序目录');
      }
    } else {
      logger.error('Unix/Linux 权限问题解决方案:');
      logger.error('1. 检查文件权限: chmod 755 <file>');
      logger.error('2. 检查目录权限: chmod 755 <directory>');
      logger.error('3. 检查用户权限');
    }

    return {
      type: 'PERMISSION_ERROR',
      message: `权限不足，无法${errorInfo.operation}文件: ${filePath}`,
      solutions: this.getPermissionSolutions(errorInfo),
      retryable: true
    };
  }

  /**
   * 处理访问错误 (EACCES)
   */
  static handleAccessError(errorInfo) {
    const { filePath, platform } = errorInfo;
    
    logger.error('访问错误 (EACCES) 解决方案:');
    logger.error('1. 检查文件/目录是否存在');
    logger.error('2. 检查用户是否有访问权限');
    logger.error('3. 检查文件系统权限');
    
    if (platform === 'win32') {
      logger.error('4. 检查 Windows 安全设置');
      logger.error('5. 尝试以管理员身份运行');
    }

    return {
      type: 'ACCESS_ERROR',
      message: `访问被拒绝: ${filePath}`,
      solutions: this.getAccessSolutions(errorInfo),
      retryable: true
    };
  }

  /**
   * 处理文件占用错误 (EBUSY)
   */
  static handleBusyError(errorInfo) {
    const { filePath } = errorInfo;
    
    logger.error('文件占用错误 (EBUSY) 解决方案:');
    logger.error('1. 关闭可能占用文件的程序');
    logger.error('2. 等待文件释放后重试');
    logger.error('3. 重启相关程序');
    logger.error('4. 检查是否有其他进程在使用文件');

    return {
      type: 'BUSY_ERROR',
      message: `文件被占用: ${filePath}`,
      solutions: this.getBusySolutions(errorInfo),
      retryable: true,
      retryDelay: 1000 // 1秒后重试
    };
  }

  /**
   * 处理文件不存在错误 (ENOENT)
   */
  static handleNotFoundError(errorInfo) {
    const { filePath } = errorInfo;
    
    logger.error('文件不存在错误 (ENOENT) 解决方案:');
    logger.error('1. 检查文件路径是否正确');
    logger.error('2. 确保目录存在');
    logger.error('3. 检查文件名是否正确');

    return {
      type: 'NOT_FOUND_ERROR',
      message: `文件不存在: ${filePath}`,
      solutions: this.getNotFoundSolutions(errorInfo),
      retryable: false
    };
  }

  /**
   * 处理是目录错误 (EISDIR)
   */
  static handleIsDirectoryError(errorInfo) {
    const { filePath } = errorInfo;
    
    logger.error('是目录错误 (EISDIR) 解决方案:');
    logger.error('1. 检查路径是否指向目录而不是文件');
    logger.error('2. 确保使用正确的文件路径');

    return {
      type: 'IS_DIRECTORY_ERROR',
      message: `路径是目录而不是文件: ${filePath}`,
      solutions: this.getIsDirectorySolutions(errorInfo),
      retryable: false
    };
  }

  /**
   * 处理不是目录错误 (ENOTDIR)
   */
  static handleNotDirectoryError(errorInfo) {
    const { filePath } = errorInfo;
    
    logger.error('不是目录错误 (ENOTDIR) 解决方案:');
    logger.error('1. 检查路径是否指向文件而不是目录');
    logger.error('2. 确保使用正确的目录路径');

    return {
      type: 'NOT_DIRECTORY_ERROR',
      message: `路径不是目录: ${filePath}`,
      solutions: this.getNotDirectorySolutions(errorInfo),
      retryable: false
    };
  }

  /**
   * 处理通用错误
   */
  static handleGenericError(errorInfo) {
    const { filePath, errorCode, errorMessage } = errorInfo;
    
    logger.error(`通用文件系统错误 (${errorCode}): ${errorMessage}`);
    logger.error('1. 检查文件系统状态');
    logger.error('2. 检查磁盘空间');
    logger.error('3. 检查文件系统权限');

    return {
      type: 'GENERIC_ERROR',
      message: `文件系统错误: ${errorMessage}`,
      errorCode: errorCode,
      solutions: this.getGenericSolutions(errorInfo),
      retryable: true
    };
  }

  /**
   * 获取权限错误解决方案
   */
  static getPermissionSolutions(errorInfo) {
    const solutions = [];
    
    if (errorInfo.platform === 'win32') {
      solutions.push('以管理员身份运行程序');
      solutions.push('检查文件和目录权限');
      solutions.push('检查防病毒软件设置');
      solutions.push('检查文件是否被其他程序占用');
      
      if (errorInfo.isPkg) {
        solutions.push('尝试使用用户目录而不是程序目录');
        solutions.push('检查程序安装目录的写入权限');
      }
    } else {
      solutions.push('使用 chmod 命令修改文件权限');
      solutions.push('检查用户和组权限');
      solutions.push('使用 sudo 运行程序');
    }
    
    return solutions;
  }

  /**
   * 获取访问错误解决方案
   */
  static getAccessSolutions(errorInfo) {
    return [
      '检查文件/目录是否存在',
      '检查用户访问权限',
      '检查文件系统权限',
      errorInfo.platform === 'win32' ? '以管理员身份运行' : '使用 sudo 运行'
    ];
  }

  /**
   * 获取文件占用错误解决方案
   */
  static getBusySolutions(errorInfo) {
    return [
      '关闭占用文件的程序',
      '等待文件释放后重试',
      '重启相关程序',
      '检查进程列表'
    ];
  }

  /**
   * 获取文件不存在错误解决方案
   */
  static getNotFoundSolutions(errorInfo) {
    return [
      '检查文件路径是否正确',
      '确保目录存在',
      '检查文件名是否正确',
      '检查路径分隔符'
    ];
  }

  /**
   * 获取是目录错误解决方案
   */
  static getIsDirectorySolutions(errorInfo) {
    return [
      '检查路径是否指向目录',
      '使用正确的文件路径',
      '检查路径分隔符'
    ];
  }

  /**
   * 获取不是目录错误解决方案
   */
  static getNotDirectorySolutions(errorInfo) {
    return [
      '检查路径是否指向文件',
      '使用正确的目录路径',
      '检查路径分隔符'
    ];
  }

  /**
   * 获取通用错误解决方案
   */
  static getGenericSolutions(errorInfo) {
    return [
      '检查文件系统状态',
      '检查磁盘空间',
      '检查文件系统权限',
      '重启程序或系统'
    ];
  }

  /**
   * 判断错误是否可重试
   */
  static isRetryableError(error) {
    const retryableCodes = ['EPERM', 'EACCES', 'EBUSY', 'EAGAIN', 'ENOSPC', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
    const retryableMessages = ['aborted', 'socket hang up', 'network timeout'];
    
    // 检查错误码
    if (retryableCodes.includes(error.code)) {
      return true;
    }
    
    // 检查错误消息
    if (error.message) {
      const message = error.message.toLowerCase();
      return retryableMessages.some(msg => message.includes(msg));
    }
    
    return false;
  }

  /**
   * 获取重试延迟时间
   */
  static getRetryDelay(error, attempt = 1) {
    const baseDelay = 1000; // 1秒
    const maxDelay = 10000; // 10秒
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    
    // 对于特定错误类型，使用不同的延迟策略
    switch (error.code) {
      case 'EBUSY':
        return Math.min(delay, 2000); // 文件占用错误，较短延迟
      case 'EPERM':
      case 'EACCES':
        return Math.min(delay, 5000); // 权限错误，中等延迟
      case 'ECONNRESET':
      case 'ETIMEDOUT':
        return Math.min(delay, 3000); // 网络错误，较短延迟
      case 'ENOTFOUND':
        return Math.min(delay, 5000); // DNS错误，中等延迟
      default:
        // 检查是否是网络相关的错误消息
        if (error.message && (
          error.message.toLowerCase().includes('aborted') ||
          error.message.toLowerCase().includes('socket hang up') ||
          error.message.toLowerCase().includes('network timeout')
        )) {
          return Math.min(delay, 3000); // 网络错误，较短延迟
        }
        return delay;
    }
  }
}

module.exports = ErrorHandler;