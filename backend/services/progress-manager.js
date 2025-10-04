const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('ProgressManager');


/**
 * 进度管理器 - 负责处理下载进度的监听和通知
 */
class ProgressManager {
  constructor() {
    // 进度监听器: taskId -> listeners[]
    this.progressListeners = new Map();
    // 节流控制: taskId -> { lastUpdate, pending }
    this.throttleControl = new Map();
    // 节流间隔（毫秒）
    this.throttleInterval = 100;
    // 每个任务的最大监听器数量
    this.maxListenersPerTask = 10;
    // 全局最大监听器数量
    this.maxTotalListeners = 100;
  }

  /**
   * 添加进度监听器
   */
  addProgressListener(taskId, listener) {
    // 检查全局监听器数量限制
    if (this.getTotalListenerCount() >= this.maxTotalListeners) {
      logger.warn(`全局监听器数量已达上限 (${this.maxTotalListeners})，拒绝添加新监听器`);
      return false;
    }

    if (!this.progressListeners.has(taskId)) {
      this.progressListeners.set(taskId, []);
    }

    const listeners = this.progressListeners.get(taskId);
    
    // 检查单个任务的监听器数量限制
    if (listeners.length >= this.maxListenersPerTask) {
      logger.warn(`任务 ${taskId} 的监听器数量已达上限 (${this.maxListenersPerTask})，拒绝添加新监听器`);
      return false;
    }

    listeners.push(listener);
    logger.debug(`为任务 ${taskId} 添加监听器，当前数量: ${listeners.length}`);
    return true;
  }

  /**
   * 移除进度监听器
   */
  removeProgressListener(taskId, listener) {
    if (this.progressListeners.has(taskId)) {
      const listeners = this.progressListeners.get(taskId);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
        logger.debug(`从任务 ${taskId} 移除监听器，剩余数量: ${listeners.length}`);
      }
      if (listeners.length === 0) {
        this.progressListeners.delete(taskId);
        // 清理节流控制
        this.throttleControl.delete(taskId);
        logger.debug(`任务 ${taskId} 的所有监听器已清理`);
      }
    } else {
      logger.debug(`尝试移除不存在任务 ${taskId} 的监听器`);
    }
  }

  /**
   * 通知进度更新（带节流）
   */
  notifyProgressUpdate(taskId, task) {
    if (!this.progressListeners.has(taskId)) {
      return;
    }

    const now = Date.now();
    const throttleInfo = this.throttleControl.get(taskId);

    // 如果是重要状态变更（完成、失败、取消），立即通知
    const isImportantStatus = ['completed', 'failed', 'cancelled', 'partial', 'paused'].includes(task.status);
    
    if (isImportantStatus) {
      // 立即通知重要状态变更
      this._executeListeners(taskId, task);
      // 清理节流控制
      this.throttleControl.delete(taskId);
      return;
    }

    // 对于普通进度更新，使用节流
    if (!throttleInfo || (now - throttleInfo.lastUpdate) >= this.throttleInterval) {
      // 立即通知
      this._executeListeners(taskId, task);
      this.throttleControl.set(taskId, { lastUpdate: now, pending: false });
    } else if (!throttleInfo.pending) {
      // 延迟通知
      throttleInfo.pending = true;
      setTimeout(() => {
        const currentThrottleInfo = this.throttleControl.get(taskId);
        if (currentThrottleInfo && currentThrottleInfo.pending) {
          this._executeListeners(taskId, task);
          this.throttleControl.delete(taskId);
        }
      }, this.throttleInterval - (now - throttleInfo.lastUpdate));
    }
  }

  /**
   * 执行监听器（内部方法）
   */
  _executeListeners(taskId, task) {
    if (this.progressListeners.has(taskId)) {
      const listeners = this.progressListeners.get(taskId);
      listeners.forEach(listener => {
        try {
          listener(task);
        } catch (error) {
          logger.error('进度监听器执行失败:', error);
        }
      });
    }
  }

  /**
   * 获取指定任务的监听器数量
   */
  getListenerCount(taskId) {
    return this.progressListeners.has(taskId) 
      ? this.progressListeners.get(taskId).length 
      : 0;
  }

  /**
   * 获取总连接数
   */
  getTotalListenerCount() {
    let total = 0;
    for (const listeners of this.progressListeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  /**
   * 清理所有监听器
   */
  clearAllListeners() {
    const totalCount = this.getTotalListenerCount();
    this.progressListeners.clear();
    this.throttleControl.clear();
    logger.info(`已清理所有监听器，共 ${totalCount} 个`);
  }

  /**
   * 定期清理超时的监听器（可选功能）
   */
  startPeriodicCleanup(intervalMs = 300000) { // 默认5分钟
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      const totalListeners = this.getTotalListenerCount();
      if (totalListeners > 0) {
        logger.debug(`定期检查: 当前活跃监听器数量 ${totalListeners}`);
        
        // 如果监听器数量过多，记录警告
        if (totalListeners > this.maxTotalListeners * 0.8) {
          logger.warn(`监听器数量接近上限: ${totalListeners}/${this.maxTotalListeners}`);
        }
      }
    }, intervalMs);
    
    logger.info(`已启动监听器定期清理检查，间隔 ${intervalMs / 1000} 秒`);
  }

  /**
   * 停止定期清理
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('已停止监听器定期清理检查');
    }
  }
}

module.exports = ProgressManager;