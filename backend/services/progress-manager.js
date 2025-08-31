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
  }

  /**
   * 添加进度监听器
   */
  addProgressListener(taskId, listener) {
    if (!this.progressListeners.has(taskId)) {
      this.progressListeners.set(taskId, []);
    }
    this.progressListeners.get(taskId).push(listener);
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
      }
      if (listeners.length === 0) {
        this.progressListeners.delete(taskId);
        // 清理节流控制
        this.throttleControl.delete(taskId);
      }
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
    this.progressListeners.clear();
  }
}

module.exports = ProgressManager; 