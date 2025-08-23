const fs = require('fs-extra');
const path = require('path');

/**
 * 历史记录管理器 - 负责下载历史的管理
 */
class HistoryManager {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.historyFile = path.join(dataPath, 'download_history.json');
    this.history = [];
    this.initialized = false;
  }

  /**
   * 初始化历史记录管理器
   */
  async init() {
    try {
      await fs.ensureDir(this.dataPath);
      await this.loadHistory();
      this.initialized = true;
      console.log('历史记录管理器初始化完成');
    } catch (error) {
      console.error('历史记录管理器初始化失败:', error);
      this.initialized = false;
    }
  }

  /**
   * 加载下载历史
   */
  async loadHistory() {
    try {
      if (await fs.pathExists(this.historyFile)) {
        this.history = await fs.readJson(this.historyFile);
      }
    } catch (error) {
      console.error('加载下载历史失败:', error);
      this.history = [];
    }
  }

  /**
   * 保存下载历史
   */
  async saveHistory() {
    try {
      await fs.writeJson(this.historyFile, this.history, { spaces: 2 });
    } catch (error) {
      console.error('保存下载历史失败:', error);
    }
  }

  /**
   * 添加历史记录
   */
  async addHistoryItem(item) {
    this.history.unshift(item);
    await this.saveHistory();
  }

  /**
   * 获取下载历史
   */
  getDownloadHistory(offset = 0, limit = 50) {
    const start = offset;
    const end = offset + limit;
    const history = this.history.slice(start, end);
    
    return {
      history,
      total: this.history.length,
      offset,
      limit
    };
  }

  /**
   * 根据作品ID查找历史记录
   */
  findHistoryByArtworkId(artworkId) {
    return this.history.find(item => item.artwork_id === artworkId);
  }

  /**
   * 根据作者ID查找历史记录
   */
  findHistoryByArtistId(artistId) {
    return this.history.filter(item => item.artist_id === artistId);
  }

  /**
   * 删除历史记录
   */
  async removeHistoryItem(artworkId) {
    const index = this.history.findIndex(item => item.artwork_id === artworkId);
    if (index > -1) {
      this.history.splice(index, 1);
      await this.saveHistory();
      return true;
    }
    return false;
  }

  /**
   * 清理历史记录
   */
  async clearHistory() {
    this.history = [];
    await this.saveHistory();
  }

  /**
   * 获取历史统计信息
   */
  getHistoryStats() {
    const stats = {
      total: this.history.length,
      completed: 0,
      failed: 0,
      partial: 0,
      totalFiles: 0,
      totalSize: 0
    };

    for (const item of this.history) {
      if (stats.hasOwnProperty(item.status)) {
        stats[item.status]++;
      }
      if (item.completed_files) {
        stats.totalFiles += item.completed_files;
      }
    }

    return stats;
  }

  /**
   * 获取最近下载的作品
   */
  getRecentDownloads(limit = 10) {
    return this.history.slice(0, limit);
  }

  /**
   * 搜索历史记录
   */
  searchHistory(query) {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(item => 
      (item.artwork_title && item.artwork_title.toLowerCase().includes(lowerQuery)) ||
      (item.artist_name && item.artist_name.toLowerCase().includes(lowerQuery))
    );
  }
}

module.exports = HistoryManager; 