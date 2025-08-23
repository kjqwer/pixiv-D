/**
 * 进度管理器 - 负责处理下载进度的监听和通知
 */
class ProgressManager {
  constructor() {
    // 进度监听器: taskId -> listeners[]
    this.progressListeners = new Map();
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
      }
    }
  }

  /**
   * 通知进度更新
   */
  notifyProgressUpdate(taskId, task) {
    if (this.progressListeners.has(taskId)) {
      const listeners = this.progressListeners.get(taskId);
      listeners.forEach(listener => {
        try {
          listener(task);
        } catch (error) {
          console.error('进度监听器执行失败:', error);
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
   * 清理所有监听器
   */
  clearAllListeners() {
    this.progressListeners.clear();
  }
}

module.exports = ProgressManager; 