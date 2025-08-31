const fs = require('fs');
const path = require('path');

/**
 * 日志级别枚举
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

/**
 * 日志级别名称映射
 */
const LogLevelNames = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE'
};

/**
 * 日志级别颜色映射
 */
const LogLevelColors = {
  [LogLevel.ERROR]: '\x1b[31m', // 红色
  [LogLevel.WARN]: '\x1b[33m',  // 黄色
  [LogLevel.INFO]: '\x1b[36m',  // 青色
  [LogLevel.DEBUG]: '\x1b[35m', // 紫色
  [LogLevel.TRACE]: '\x1b[90m'  // 灰色
};

/**
 * 模块颜色映射 - 为不同模块设置不同颜色
 */
const ModuleColors = {
  'Server': '\x1b[32m',      // 绿色
  'Start': '\x1b[34m',       // 蓝色
  'PixivBackend': '\x1b[35m', // 紫色
  'PixivAuth': '\x1b[36m',   // 青色
  'TaskManager': '\x1b[33m', // 黄色
  'ImageCache': '\x1b[37m',  // 白色
  'HistoryManager': '\x1b[90m', // 灰色
  'ProxyConfig': '\x1b[95m', // 亮紫色
  'Download': '\x1b[93m',    // 亮黄色
  'Artwork': '\x1b[96m',     // 亮青色
  'Artist': '\x1b[92m',      // 亮绿色
  'Repository': '\x1b[94m',  // 亮蓝色
  'ErrorHandler': '\x1b[91m', // 亮红色
  'API': '\x1b[97m',         // 亮白色
  'FileManager': '\x1b[98m', // 亮青色
  'ProgressManager': '\x1b[99m', // 亮紫色
  'Default': '\x1b[39m'      // 默认颜色
};

/**
 * 重置颜色
 */
const RESET_COLOR = '\x1b[0m';

/**
 * 日志图标映射
 */
const LogLevelIcons = {
  [LogLevel.ERROR]: '❌',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.DEBUG]: '🔧',
  [LogLevel.TRACE]: '🔍'
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    
    // 动态设置日志目录，避免pkg静态分析问题
    this.logDir = options.logDir || this._getLogDir();
    
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.enableColors = options.enableColors !== false;
    this.module = options.module || 'App';
    
    // 延迟初始化，不在构造函数中创建目录
    this._initialized = false;
  }

  /**
   * 动态获取日志目录路径
   */
  _getLogDir() {
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      return path.join(process.cwd(), 'logs');
    } else {
      // 在开发环境中，使用项目根目录的logs文件夹
      // 使用相对路径避免pkg静态分析问题
      return 'logs';
    }
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 获取当前时间字符串
   */
  getTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * 获取日期字符串
   */
  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, data = null) {
    const timeStr = this.getTimeString();
    const levelName = LogLevelNames[level];
    const icon = LogLevelIcons[level];
    
    let formattedMessage = `[${timeStr}] [${levelName}] [${this.module}] ${icon} ${message}`;
    
    if (data !== null && data !== undefined) {
      if (typeof data === 'object') {
        formattedMessage += ` ${JSON.stringify(data, null, 2)}`;
      } else {
        formattedMessage += ` ${data}`;
      }
    }
    
    return formattedMessage;
  }

  /**
   * 写入文件日志
   */
  writeToFile(message) {
    if (!this.enableFile) return;

    // 延迟初始化，只在第一次写入时创建目录
    if (!this._initialized) {
      this.ensureLogDir();
      this._initialized = true;
    }

    const dateStr = this.getDateString();
    const logFile = path.join(this.logDir, `${dateStr}.log`);
    
    try {
      // 检查文件大小
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile(logFile);
        }
      }
      
      fs.appendFileSync(logFile, message + '\n', 'utf8');
    } catch (error) {
      // 如果写入文件失败，至少输出到控制台
      if (this.enableConsole) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  /**
   * 轮转日志文件
   */
  rotateLogFile(logFile) {
    try {
      // 删除最旧的文件
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = `${logFile}.${i}`;
        const newFile = `${logFile}.${i + 1}`;
        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // 重命名当前文件
      fs.renameSync(logFile, `${logFile}.1`);
    } catch (error) {
      // 如果轮转失败，删除当前文件
      try {
        fs.unlinkSync(logFile);
      } catch (e) {
        // 忽略删除错误
      }
    }
  }

  /**
   * 输出到控制台
   */
  writeToConsole(message, level) {
    if (!this.enableConsole) return;

    if (this.enableColors && level !== undefined) {
      const levelColor = LogLevelColors[level];
      const moduleColor = ModuleColors[this.module] || ModuleColors['Default'];
      
      // 解析消息，为模块名添加颜色
      const coloredMessage = message.replace(
        new RegExp(`\\[${this.module}\\]`, 'g'),
        `${moduleColor}[${this.module}]${RESET_COLOR}`
      );
      
      console.log(`${levelColor}${coloredMessage}${RESET_COLOR}`);
    } else {
      console.log(message);
    }
  }

  /**
   * 记录日志
   */
  log(level, message, data = null) {
    if (level > this.level) return;

    const formattedMessage = this.formatMessage(level, message, data);
    
    this.writeToConsole(formattedMessage, level);
    this.writeToFile(formattedMessage);
  }

  /**
   * 错误日志
   */
  error(message, data = null) {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 警告日志
   */
  warn(message, data = null) {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 信息日志
   */
  info(message, data = null) {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * 调试日志
   */
  debug(message, data = null) {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 跟踪日志
   */
  trace(message, data = null) {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * 创建子logger
   */
  child(module) {
    return new Logger({
      level: this.level,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      logDir: this.logDir,
      maxFileSize: this.maxFileSize,
      maxFiles: this.maxFiles,
      enableColors: this.enableColors,
      module: module
    });
  }

  /**
   * 设置日志级别
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * 启用/禁用控制台输出
   */
  setConsoleOutput(enabled) {
    this.enableConsole = enabled;
  }

  /**
   * 启用/禁用文件输出
   */
  setFileOutput(enabled) {
    this.enableFile = enabled;
    if (enabled) {
      this.ensureLogDir();
    }
  }
}

// 创建默认logger实例
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL ? LogLevel[process.env.LOG_LEVEL.toUpperCase()] : LogLevel.INFO,
  enableConsole: true,
  enableFile: process.env.LOG_TO_FILE === 'true',
  enableColors: process.env.LOG_COLORS !== 'false'
});

module.exports = {
  Logger,
  LogLevel,
  LogLevelNames,
  defaultLogger
}; 