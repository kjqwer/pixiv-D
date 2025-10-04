const { defaultLogger } = require('./logger');

// 创建logger实例
const logger = defaultLogger.child('AbortControllerManager');

/**
 * AbortController 管理器 - 防止内存泄漏
 */
class AbortControllerManager {
  constructor() {
    // 全局 AbortController 跟踪
    this.controllers = new Map();
    // 监听器数量限制
    this.maxListenersPerController = 10;
    this.maxTotalControllers = 50;
    
    // 定期清理间隔（5分钟）
    this.cleanupInterval = 5 * 60 * 1000;
    this.cleanupTimer = null;
    
    this.startPeriodicCleanup();
  }

  /**
   * 创建新的 AbortController
   */
  createController(id) {
    // 检查全局控制器数量限制
    if (this.controllers.size >= this.maxTotalControllers) {
      logger.warn(`AbortController 数量已达上限 (${this.maxTotalControllers})，拒绝创建新控制器`);
      return null;
    }

    const controller = new AbortController();
    const controllerInfo = {
      id,
      controller,
      createdAt: Date.now(),
      listenerCount: 0
    };

    this.controllers.set(id, controllerInfo);
    logger.debug(`创建 AbortController: ${id}，当前总数: ${this.controllers.size}`);
    
    return controller;
  }

  /**
   * 获取 AbortController
   */
  getController(id) {
    const info = this.controllers.get(id);
    return info ? info.controller : null;
  }

  /**
   * 添加监听器（带限制检查）
   */
  addListener(id, event, listener) {
    const info = this.controllers.get(id);
    if (!info) {
      logger.warn(`未找到 AbortController: ${id}`);
      return false;
    }

    if (info.listenerCount >= this.maxListenersPerController) {
      logger.warn(`AbortController ${id} 的监听器数量已达上限 (${this.maxListenersPerController})`);
      return false;
    }

    info.controller.signal.addEventListener(event, listener);
    info.listenerCount++;
    logger.debug(`为 AbortController ${id} 添加监听器，当前数量: ${info.listenerCount}`);
    
    return true;
  }

  /**
   * 移除监听器
   */
  removeListener(id, event, listener) {
    const info = this.controllers.get(id);
    if (!info) {
      return false;
    }

    info.controller.signal.removeEventListener(event, listener);
    info.listenerCount = Math.max(0, info.listenerCount - 1);
    logger.debug(`从 AbortController ${id} 移除监听器，剩余数量: ${info.listenerCount}`);
    
    return true;
  }

  /**
   * 中断并清理 AbortController
   */
  abortAndCleanup(id) {
    const info = this.controllers.get(id);
    if (!info) {
      return false;
    }

    try {
      if (!info.controller.signal.aborted) {
        info.controller.abort();
      }
    } catch (error) {
      logger.warn(`中断 AbortController ${id} 时出错:`, error.message);
    } finally {
      this.controllers.delete(id);
      logger.debug(`清理 AbortController: ${id}，剩余总数: ${this.controllers.size}`);
    }

    return true;
  }

  /**
   * 清理所有控制器
   */
  cleanupAll() {
    logger.info(`清理所有 AbortController，当前数量: ${this.controllers.size}`);
    
    for (const [id, info] of this.controllers) {
      try {
        if (!info.controller.signal.aborted) {
          info.controller.abort();
        }
      } catch (error) {
        logger.warn(`清理 AbortController ${id} 时出错:`, error.message);
      }
    }
    
    this.controllers.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const totalControllers = this.controllers.size;
    let totalListeners = 0;
    let oldestController = null;
    let oldestAge = 0;

    for (const [id, info] of this.controllers) {
      totalListeners += info.listenerCount;
      const age = Date.now() - info.createdAt;
      if (age > oldestAge) {
        oldestAge = age;
        oldestController = id;
      }
    }

    return {
      totalControllers,
      totalListeners,
      oldestController,
      oldestAge: Math.round(oldestAge / 1000), // 秒
      maxTotalControllers: this.maxTotalControllers,
      maxListenersPerController: this.maxListenersPerController
    };
  }

  /**
   * 开始定期清理检查
   */
  startPeriodicCleanup() {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      const stats = this.getStats();
      
      // 记录统计信息
      if (stats.totalControllers > 0) {
        logger.debug('AbortController 统计:', {
          总控制器数: stats.totalControllers,
          总监听器数: stats.totalListeners,
          最老控制器: stats.oldestController,
          最老年龄: `${stats.oldestAge}秒`
        });

        // 警告检查
        if (stats.totalControllers > stats.maxTotalControllers * 0.8) {
          logger.warn(`AbortController 数量接近上限: ${stats.totalControllers}/${stats.maxTotalControllers}`);
        }

        if (stats.totalListeners > stats.maxTotalControllers * stats.maxListenersPerController * 0.8) {
          logger.warn(`AbortController 监听器总数过多: ${stats.totalListeners}`);
        }

        // 清理超过 30 分钟的控制器
        const maxAge = 30 * 60 * 1000; // 30分钟
        const now = Date.now();
        const toCleanup = [];

        for (const [id, info] of this.controllers) {
          if (now - info.createdAt > maxAge) {
            toCleanup.push(id);
          }
        }

        if (toCleanup.length > 0) {
          logger.info(`清理 ${toCleanup.length} 个超时的 AbortController`);
          toCleanup.forEach(id => this.abortAndCleanup(id));
        }
      }
    }, this.cleanupInterval);

    logger.info('AbortController 定期清理已启动');
  }

  /**
   * 停止定期清理
   */
  stopPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info('AbortController 定期清理已停止');
    }
  }
}

// 创建全局实例
const abortControllerManager = new AbortControllerManager();

module.exports = abortControllerManager;