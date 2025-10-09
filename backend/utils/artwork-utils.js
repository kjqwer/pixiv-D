const ConfigManager = require('../config/config-manager');
const { defaultLogger } = require('./logger');

const logger = defaultLogger.child('ArtworkUtils');

class ArtworkUtils {
  constructor() {
    this.configManager = new ConfigManager();
    this._cachedConfig = null;
    this._configCacheTime = 0;
    this.CACHE_DURATION = 30000; // 30秒缓存
  }

  /**
   * 获取配置（带缓存）
   * @returns {Promise<Object>} 配置对象
   */
  async getConfig() {
    const now = Date.now();
    if (this._cachedConfig && (now - this._configCacheTime) < this.CACHE_DURATION) {
      return this._cachedConfig;
    }

    this._cachedConfig = await this.configManager.readConfig();
    this._configCacheTime = now;
    return this._cachedConfig;
  }

  /**
   * 从作品目录名中提取作品ID
   * @param {string} artworkDir - 作品目录名
   * @returns {Promise<number|null>} 作品ID，如果无法提取则返回null
   */
  async extractArtworkIdFromDir(artworkDir) {
    try {
      // 获取配置中的命名模式
      const config = await this.getConfig();
      const namingPattern = config.namingPattern || "{artist_name}/{artwork_id}_{title}";
      
      // 从命名模式中提取作品目录部分（去掉 {artist_name}/ 前缀）
      let artworkPattern = namingPattern;
      if (artworkPattern.includes('/')) {
        artworkPattern = artworkPattern.split('/').pop(); // 取最后一部分
      }
      
      // 将命名模式转换为正则表达式
      // 替换占位符为对应的正则表达式组
      let regexPattern = artworkPattern
        .replace(/\{artwork_id\}/g, '(\\d+)')  // artwork_id 匹配数字
        .replace(/\{title\}/g, '(.+)')         // title 匹配任意字符
        .replace(/\{artist_name\}/g, '(.+)')   // artist_name 匹配任意字符（虽然在这里不应该出现）
        .replace(/\{[^}]+\}/g, '(.+)');        // 其他占位符匹配任意字符
      
      // 转义特殊字符
      regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
        // 不转义我们添加的正则表达式组
        if (match === '(' || match === ')' || match === '\\') {
          return match;
        }
        return '\\' + match;
      });
      
      // 创建正则表达式
      const regex = new RegExp(`^${regexPattern}$`);
      const match = artworkDir.match(regex);
      
      if (match) {
        // 找到 artwork_id 在模式中的位置
        const placeholders = artworkPattern.match(/\{[^}]+\}/g) || [];
        const artworkIdIndex = placeholders.findIndex(placeholder => placeholder === '{artwork_id}');
        
        if (artworkIdIndex !== -1 && match[artworkIdIndex + 1]) {
          return parseInt(match[artworkIdIndex + 1]);
        }
      }
      
      // 如果动态解析失败，回退到默认格式 {artwork_id}_{title}
      const fallbackMatch = artworkDir.match(/^(\d+)_(.+)$/);
      if (fallbackMatch) {
        logger.debug(`使用回退模式解析作品目录: ${artworkDir}`);
        return parseInt(fallbackMatch[1]);
      }
      
      return null;
    } catch (error) {
      logger.warn(`解析作品目录名失败: ${artworkDir}`, error.message);
      
      // 发生错误时回退到默认格式
      const fallbackMatch = artworkDir.match(/^(\d+)_(.+)$/);
      if (fallbackMatch) {
        return parseInt(fallbackMatch[1]);
      }
      
      return null;
    }
  }

  /**
   * 检查目录名是否匹配作品目录格式
   * @param {string} dirName - 目录名
   * @returns {Promise<boolean>} 是否匹配作品目录格式
   */
  async isArtworkDirectory(dirName) {
    const artworkId = await this.extractArtworkIdFromDir(dirName);
    return artworkId !== null;
  }

  /**
   * 从作品目录名中提取标题
   * @param {string} artworkDir - 作品目录名
   * @returns {Promise<string|null>} 作品标题，如果无法提取则返回null
   */
  async extractTitleFromDir(artworkDir) {
    try {
      // 获取配置中的命名模式
      const config = await this.getConfig();
      const namingPattern = config.namingPattern || "{artist_name}/{artwork_id}_{title}";
      
      // 从命名模式中提取作品目录部分（去掉 {artist_name}/ 前缀）
      let artworkPattern = namingPattern;
      if (artworkPattern.includes('/')) {
        artworkPattern = artworkPattern.split('/').pop(); // 取最后一部分
      }
      
      // 将命名模式转换为正则表达式
      let regexPattern = artworkPattern
        .replace(/\{artwork_id\}/g, '(\\d+)')  // artwork_id 匹配数字
        .replace(/\{title\}/g, '(.+)')         // title 匹配任意字符
        .replace(/\{artist_name\}/g, '(.+)')   // artist_name 匹配任意字符
        .replace(/\{[^}]+\}/g, '(.+)');        // 其他占位符匹配任意字符
      
      // 转义特殊字符
      regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, (match) => {
        if (match === '(' || match === ')' || match === '\\') {
          return match;
        }
        return '\\' + match;
      });
      
      // 创建正则表达式
      const regex = new RegExp(`^${regexPattern}$`);
      const match = artworkDir.match(regex);
      
      if (match) {
        // 找到 title 在模式中的位置
        const placeholders = artworkPattern.match(/\{[^}]+\}/g) || [];
        const titleIndex = placeholders.findIndex(placeholder => placeholder === '{title}');
        
        if (titleIndex !== -1 && match[titleIndex + 1]) {
          return match[titleIndex + 1];
        }
      }
      
      // 如果动态解析失败，回退到默认格式 {artwork_id}_{title}
      const fallbackMatch = artworkDir.match(/^(\d+)_(.+)$/);
      if (fallbackMatch) {
        return fallbackMatch[2];
      }
      
      return null;
    } catch (error) {
      logger.warn(`解析作品标题失败: ${artworkDir}`, error.message);
      
      // 发生错误时回退到默认格式
      const fallbackMatch = artworkDir.match(/^(\d+)_(.+)$/);
      if (fallbackMatch) {
        return fallbackMatch[2];
      }
      
      return null;
    }
  }
}

// 创建单例实例
const artworkUtils = new ArtworkUtils();

module.exports = artworkUtils;