const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 任务管理器 - 负责下载任务的生命周期管理
 */
class TaskManager {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.tasksFile = path.join(dataPath, 'download_tasks.json');
    this.tasks = new Map(); // 内存中的任务状态
    this.initialized = false;
  }

  /**
   * 初始化任务管理器
   */
  async init() {
    try {
      await fs.ensureDir(this.dataPath);
      await this.loadTasks();
      this.initialized = true;
      // 任务管理器初始化完成
    } catch (error) {
      console.error('任务管理器初始化失败:', error);
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
      console.error('加载任务状态失败:', error);
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
      console.error('保存任务状态失败:', error);
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
    await this.saveTasks();
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
   * 获取指定状态的任务
   */
  getTasksByStatus(status) {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * 清理已完成的任务
   */
  async cleanupCompletedTasks() {
    const completedStatuses = ['completed', 'failed', 'cancelled', 'partial'];
    let cleanedCount = 0;

    for (const [taskId, task] of this.tasks) {
      if (completedStatuses.includes(task.status)) {
        this.tasks.delete(taskId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      await this.saveTasks();
      // 清理了已完成的任务
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
}

module.exports = TaskManager;
