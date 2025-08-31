const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('TaskManager');

/**
 * 任务管理器 - 负责下载任务的生命周期管理
 */
class TaskManager {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.tasksFile = path.join(dataPath, 'download_tasks.json');
    this.tasks = new Map(); // 内存中的任务状态
    this.initialized = false;
    
    // 配置
    this.maxCompletedTasks = 100; // 最多保留100个已完成的任务
    this.cleanupThreshold = 150; // 超过150个时开始清理
  }

  /**
   * 初始化任务管理器
   */
  async init() {
    try {
      await fs.ensureDir(this.dataPath);
      await this.loadTasks();
      
      // 初始化时清理已完成的任务
      await this.cleanupCompletedTasks();
      
      this.initialized = true;
      logger.info('任务管理器初始化完成');
    } catch (error) {
      logger.error('任务管理器初始化失败', error);
      this.initialized = false;
    }
  }

  /**
   * 加载任务状态
   */
  async loadTasks() {
    try {
      if (await fs.pathExists(this.tasksFile)) {
        const tasksData = await fs.readJson(this.tasksFile);
        this.tasks = new Map(Object.entries(tasksData));

        // 恢复进行中的任务状态
        for (const [taskId, task] of this.tasks) {
          if (task.status === 'downloading' || task.status === 'paused') {
            task.status = 'paused'; // 重启后暂停所有进行中的任务
          }
        }
      }
    } catch (error) {
      logger.error('加载任务状态失败', error);
      this.tasks = new Map();
    }
  }

  /**
   * 保存任务状态
   */
  async saveTasks() {
    try {
      const tasksData = Object.fromEntries(this.tasks);
      await fs.writeJson(this.tasksFile, tasksData, { spaces: 2 });
    } catch (error) {
      logger.error('保存任务状态失败', error);
    }
  }

  /**
   * 创建新任务
   */
  createTask(type, data) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      type,
      status: 'downloading',
      progress: 0,
      start_time: new Date(),
      end_time: null,
      error: null,
      ...data,
    };

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * 获取任务
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * 更新任务
   */
  async updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    Object.assign(task, updates);
    
    // 如果任务完成，检查是否需要清理
    if (['completed', 'failed', 'cancelled', 'partial'].includes(updates.status)) {
      await this.checkAndCleanupTasks();
    } else {
      await this.saveTasks();
    }
    
    return true;
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId) {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      await this.saveTasks();
    }
    return deleted;
  }

  /**
   * 获取所有任务
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取活跃任务（下载中或暂停）
   */
  getActiveTasks() {
    return Array.from(this.tasks.values()).filter(task => 
      ['downloading', 'paused'].includes(task.status)
    );
  }

  /**
   * 获取已完成的任务
   */
  getCompletedTasks() {
    return Array.from(this.tasks.values()).filter(task => 
      ['completed', 'failed', 'cancelled', 'partial'].includes(task.status)
    );
  }

  /**
   * 获取指定状态的任务
   */
  getTasksByStatus(status) {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * 检查并清理任务
   */
  async checkAndCleanupTasks() {
    const completedTasks = this.getCompletedTasks();
    
    if (completedTasks.length > this.cleanupThreshold) {
      await this.cleanupCompletedTasks();
    } else {
      await this.saveTasks();
    }
  }

  /**
   * 清理已完成的任务
   */
  async cleanupCompletedTasks() {
    const completedStatuses = ['completed', 'failed', 'cancelled', 'partial'];
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => completedStatuses.includes(task.status))
      .sort((a, b) => new Date(b[1].end_time) - new Date(a[1].end_time)); // 按完成时间排序

    if (completedTasks.length <= this.maxCompletedTasks) {
      await this.saveTasks();
      return 0;
    }

    // 删除超出限制的已完成任务
    const tasksToDelete = completedTasks.slice(this.maxCompletedTasks);
    let cleanedCount = 0;

    for (const [taskId, _] of tasksToDelete) {
      this.tasks.delete(taskId);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      await this.saveTasks();
      logger.info(`清理已完成任务: ${cleanedCount} 个`);
    }

    return cleanedCount;
  }

  /**
   * 获取任务统计信息
   */
  getTaskStats() {
    const stats = {
      total: this.tasks.size,
      downloading: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      partial: 0,
    };

    for (const task of this.tasks.values()) {
      if (stats.hasOwnProperty(task.status)) {
        stats[task.status]++;
      }
    }

    return stats;
  }

  /**
   * 手动清理任务
   */
  async cleanupTasksManually(keepActive = true, keepCompleted = this.maxCompletedTasks) {
    let cleanedCount = 0;
    
    if (keepActive) {
      // 保留活跃任务
      const activeTasks = this.getActiveTasks();
      const completedTasks = this.getCompletedTasks()
        .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))
        .slice(0, keepCompleted);
      
      // 重建任务Map
      const newTasks = new Map();
      
      // 添加活跃任务
      for (const task of activeTasks) {
        newTasks.set(task.id, task);
      }
      
      // 添加要保留的已完成任务
      for (const task of completedTasks) {
        newTasks.set(task.id, task);
      }
      
      cleanedCount = this.tasks.size - newTasks.size;
      this.tasks = newTasks;
    } else {
      // 清理所有已完成任务
      cleanedCount = await this.cleanupCompletedTasks();
    }
    
    await this.saveTasks();
    return cleanedCount;
  }
}

module.exports = TaskManager;
