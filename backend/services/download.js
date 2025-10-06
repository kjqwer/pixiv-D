const path = require('path');
const ArtworkService = require('./artwork');
const ArtistService = require('./artist');
const TaskManager = require('./task-manager');
const FileManager = require('./file-manager');
const ProgressManager = require('./progress-manager');
const HistoryManager = require('./history-manager');
const DownloadExecutor = require('./download-executor');
const DownloadRegistry = require('./download-registry');
const CacheConfigManager = require('../config/cache-config');
const fs = require('fs-extra'); // Added for fs-extra
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('DownloadService');


/**
 * 下载服务 - 主服务类，协调各个管理器
 */
class DownloadService {
  constructor(auth) {
    this.auth = auth;
    this.artworkService = new ArtworkService(auth);
    this.artistService = new ArtistService(auth);
    this.cacheConfigManager = new CacheConfigManager();

    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;

    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.dataPath = path.join(process.cwd(), 'data');
    } else {
      // 在开发环境中，使用相对路径
      this.dataPath = path.join(__dirname, '../../data');
    }

    // 初始化各个管理器
    this.fileManager = new FileManager();
    this.taskManager = new TaskManager(this.dataPath);
    this.progressManager = new ProgressManager();
    this.historyManager = new HistoryManager(this.dataPath);
    this.downloadRegistry = new DownloadRegistry(this.dataPath);
    // 先创建下载执行器，稍后在init方法中设置downloadService引用
    this.downloadExecutor = new DownloadExecutor(this.fileManager, this.taskManager, this.progressManager, this.historyManager, this);

    // 启动监听器定期清理检查
    this.progressManager.startPeriodicCleanup();

    this.initialized = false;
  }

  /**
   * 获取动态并发配置
   */
  async getConcurrentConfig() {
    try {
      const cacheConfig = await this.cacheConfigManager.loadConfig();
      return {
        concurrentDownloads: cacheConfig.download?.concurrentDownloads || 3,
        maxConcurrentFiles: cacheConfig.download?.maxConcurrentFiles || 5,
      };
    } catch (error) {
      logger.warn('获取并发配置失败，使用默认值:', error.message);
      return {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
      };
    }
  }

  /**
   * 初始化服务
   */
  async init() {
    try {
      // 确保目录存在
      const downloadPath = await this.fileManager.getDownloadPath();
      await this.fileManager.ensureDirectory(downloadPath);
      await this.fileManager.ensureDirectory(this.dataPath);

      // 初始化各个管理器
      await this.taskManager.init();
      await this.historyManager.init();
      await this.downloadRegistry.init();

      this.initialized = true;
      // 下载服务初始化完成
    } catch (error) {
      logger.error('下载服务初始化失败:', error);
      this.initialized = false;
    }
  }

  // 代理方法 - 进度管理
  addProgressListener(taskId, listener) {
    const result = this.progressManager.addProgressListener(taskId, listener);
    if (!result) {
      logger.warn(`添加进度监听器失败: ${taskId}`);
    }
    return result;
  }

  removeProgressListener(taskId, listener) {
    return this.progressManager.removeProgressListener(taskId, listener);
  }

  notifyProgressUpdate(taskId, task) {
    return this.progressManager.notifyProgressUpdate(taskId, task);
  }

  // 代理方法 - 任务管理
  getTask(taskId) {
    return this.taskManager.getTask(taskId);
  }

  async getTaskProgress(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    return {
      success: true,
      data: task,
    };
  }

  async getAllTasks() {
    return {
      success: true,
      data: this.taskManager.getAllTasks(),
    };
  }

  /**
   * 获取活跃任务（下载中或暂停）
   */
  async getActiveTasks() {
    return {
      success: true,
      data: this.taskManager.getActiveTasks(),
    };
  }

  /**
   * 获取任务摘要（用于快速状态检查）
   */
  async getTasksSummary() {
    const allTasks = this.taskManager.getAllTasks();
    const activeTasks = this.taskManager.getActiveTasks();
    
    const summary = {
      total: allTasks.length,
      active: activeTasks.length,
      downloading: activeTasks.filter(t => t.status === 'downloading').length,
      paused: activeTasks.filter(t => t.status === 'paused').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
      partial: allTasks.filter(t => t.status === 'partial').length,
      lastUpdate: Date.now()
    };
    
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * 获取任务变更（增量更新）
   */
  async getTasksChanges(since = null) {
    const allTasks = this.taskManager.getAllTasks();
    
    if (!since) {
      // 如果没有since参数，返回所有活跃任务
      return {
        success: true,
        data: {
          tasks: this.taskManager.getActiveTasks(),
          lastUpdate: Date.now()
        },
      };
    }
    
    // 过滤出自指定时间后有变更的任务
    const changedTasks = allTasks.filter(task => {
      const lastModified = Math.max(
        new Date(task.created_at).getTime(),
        task.updated_at ? new Date(task.updated_at).getTime() : 0,
        task.end_time ? new Date(task.end_time).getTime() : 0
      );
      return lastModified > since;
    });
    
    return {
      success: true,
      data: {
        tasks: changedTasks,
        lastUpdate: Date.now()
      },
    };
  }

  /**
   * 获取已完成任务（分页）
   */
  async getCompletedTasks(offset = 0, limit = 50) {
    const allTasks = this.taskManager.getAllTasks();
    const completedTasks = allTasks.filter(task => 
      ['completed', 'failed', 'cancelled', 'partial'].includes(task.status)
    );
    
    // 按完成时间倒序排列
    completedTasks.sort((a, b) => {
      const timeA = a.end_time ? new Date(a.end_time).getTime() : 0;
      const timeB = b.end_time ? new Date(b.end_time).getTime() : 0;
      return timeB - timeA;
    });
    
    const paginatedTasks = completedTasks.slice(offset, offset + limit);
    
    return {
      success: true,
      data: {
        tasks: paginatedTasks,
        total: completedTasks.length,
        offset,
        limit
      },
    };
  }

  async cancelTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    logger.info('开始取消任务', { taskId, status: task.status, type: task.type });

    try {
      // 更新任务状态为取消中，防止并发操作
      await this.taskManager.updateTask(taskId, { status: 'cancelling' });

      // 立即中断正在进行的下载
      this.downloadExecutor.abortTask(taskId);

      // 清理未完成的文件
      await this.cleanupIncompleteFiles(task);

      // 最终更新任务状态
      await this.taskManager.updateTask(taskId, {
        status: 'cancelled',
        end_time: new Date(),
      });

      // 获取更新后的任务并通知
      const updatedTask = this.taskManager.getTask(taskId);
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      logger.info('任务取消完成', { taskId });
      return { success: true };
    } catch (error) {
      logger.error('取消任务失败', { taskId, error: error.message });
      
      // 如果清理失败，仍然标记为取消，但记录错误
      await this.taskManager.updateTask(taskId, {
        status: 'cancelled',
        end_time: new Date(),
        error: `取消时清理失败: ${error.message}`
      });

      const updatedTask = this.taskManager.getTask(taskId);
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      return { success: true, warning: `任务已取消，但清理时出现问题: ${error.message}` };
    }
  }

  async pauseTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    // 只允许暂停正在下载的任务
    if (task.status !== 'downloading') {
      return { success: false, error: '只能暂停正在下载的任务' };
    }

    logger.info('开始暂停任务', { taskId, status: task.status, type: task.type });

    try {
      // 更新任务状态为暂停中，防止并发操作
      await this.taskManager.updateTask(taskId, { status: 'pausing' });

      // 立即中断正在进行的下载
      this.downloadExecutor.abortTask(taskId);

      // 清理未完成的文件
      await this.cleanupIncompleteFiles(task);

      // 最终更新任务状态为暂停
      await this.taskManager.updateTask(taskId, { status: 'paused' });
      
      // 获取更新后的任务
      const updatedTask = this.taskManager.getTask(taskId);
      
      // 立即通知状态更新
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      logger.info('任务暂停完成', { taskId });
      return { success: true, data: updatedTask };
    } catch (error) {
      logger.error('暂停任务失败', { taskId, error: error.message });
      
      // 如果清理失败，仍然标记为暂停，但记录错误
      await this.taskManager.updateTask(taskId, { 
        status: 'paused',
        error: `暂停时清理失败: ${error.message}`
      });

      const updatedTask = this.taskManager.getTask(taskId);
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      return { success: true, data: updatedTask, warning: `任务已暂停，但清理时出现问题: ${error.message}` };
    }
  }

  async resumeTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      logger.error('恢复任务失败：任务不存在', { taskId });
      return { success: false, error: '任务不存在' };
    }

    // 只允许恢复暂停的任务
    if (task.status !== 'paused') {
      logger.warn('恢复任务失败：任务状态不是暂停状态', { 
        taskId, 
        currentStatus: task.status 
      });
      return { success: false, error: '只能恢复暂停的任务' };
    }

    // 重新开始下载执行
    try {
      logger.info('开始恢复任务执行', { taskId });
      await this.downloadExecutor.resumeTask(taskId);
      
      // 确保状态已经更新后再返回
      const updatedTask = this.taskManager.getTask(taskId);
      
      // 立即通知状态更新
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      logger.info('任务恢复成功', { 
        taskId, 
        newStatus: updatedTask.status 
      });
      
      // 返回最新的任务状态
      return { success: true, data: updatedTask };
    } catch (error) {
      logger.error('恢复任务执行失败', { 
        taskId, 
        error: error.message,
        stack: error.stack 
      });
      // 如果恢复失败，保持暂停状态
      return { success: false, error: `恢复任务失败: ${error.message}` };
    }
  }

  /**
   * 暂停批量下载任务
   */
  async pauseBatchTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    // 检查是否为批量下载任务
    if (!['batch', 'artist', 'art'].includes(task.type)) {
      return { success: false, error: '此方法仅适用于批量下载任务' };
    }

    // 只允许暂停正在下载的任务
    if (task.status !== 'downloading') {
      return { success: false, error: '只能暂停正在下载的任务' };
    }

    logger.info('开始暂停批量下载任务', { taskId, status: task.status, type: task.type });

    try {
      // 直接设置任务状态为暂停，不进行文件清理
      // 批量下载中的每个文件都是独立完成的，不需要清理
      await this.taskManager.updateTask(taskId, { status: 'paused' });
      
      // 获取更新后的任务
      const updatedTask = this.taskManager.getTask(taskId);
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      logger.info('批量下载任务暂停完成', { taskId });
      return { success: true, data: updatedTask };
    } catch (error) {
      logger.error('暂停批量下载任务失败', { taskId, error: error.message });
      return { success: false, error: `暂停任务失败: ${error.message}` };
    }
  }

  /**
   * 恢复批量下载任务
   */
  async resumeBatchTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      logger.error('恢复批量下载任务失败：任务不存在', { taskId });
      return { success: false, error: '任务不存在' };
    }

    // 检查是否为批量下载任务
    if (!['batch', 'artist', 'art'].includes(task.type)) {
      return { success: false, error: '此方法仅适用于批量下载任务' };
    }

    // 只允许恢复暂停的任务
    if (task.status !== 'paused') {
      logger.warn('恢复批量下载任务失败：任务状态不是暂停状态', { 
        taskId, 
        currentStatus: task.status 
      });
      return { success: false, error: '只能恢复暂停的任务' };
    }

    // 重新开始批量下载执行
    try {
      logger.info('开始恢复批量下载任务执行', { taskId });
      
      // 直接设置任务状态为下载中
      await this.taskManager.updateTask(taskId, { status: 'downloading' });
      
      // 获取原始的作品列表
      const items = task.items || [];
      if (items.length === 0) {
        logger.error('批量下载任务没有作品列表，无法恢复', { taskId });
        await this.taskManager.updateTask(taskId, { status: 'paused' });
        return { success: false, error: '批量下载任务没有作品列表，无法恢复' };
      }
      
      // 通知状态更新
      const updatedTask = this.taskManager.getTask(taskId);
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      // 异步重新开始批量下载，不等待完成
      setImmediate(async () => {
        try {
          await this.downloadExecutor.executeBatchDownload(task, items, {
            size: task.size || 'original',
            quality: task.quality || 'high',
            format: task.format || 'auto',
            concurrent: task.concurrent || 3
          });
        } catch (error) {
          logger.error('批量下载任务恢复执行失败', { 
            taskId, 
            error: error.message,
            stack: error.stack 
          });
          // 如果执行失败，设置任务状态为失败
          await this.taskManager.updateTask(taskId, { 
            status: 'failed',
            error: error.message 
          });
          const failedTask = this.taskManager.getTask(taskId);
          this.progressManager.notifyProgressUpdate(taskId, failedTask);
        }
      });
      
      logger.info('批量下载任务恢复成功', { 
        taskId, 
        newStatus: updatedTask.status 
      });
      
      return { success: true, data: updatedTask };
    } catch (error) {
      logger.error('恢复批量下载任务失败', { 
        taskId, 
        error: error.message,
        stack: error.stack 
      });
      // 如果恢复失败，保持暂停状态
      await this.taskManager.updateTask(taskId, { status: 'paused' });
      return { success: false, error: `恢复任务失败: ${error.message}` };
    }
  }

  /**
   * 清理未完成的文件
   * @param {Object} task - 任务对象
   */
  async cleanupIncompleteFiles(task) {
    if (!task) {
      logger.warn('清理未完成文件：任务对象为空');
      return;
    }

    logger.info('开始清理未完成文件', { taskId: task.id, type: task.type });

    try {
      if (task.type === 'artwork') {
        await this.cleanupArtworkIncompleteFiles(task);
      } else if (task.type === 'batch' || task.type === 'artist') {
        // 批量下载任务通常不需要清理单个文件，因为每个作品都是独立处理的
        logger.info('批量任务无需清理单个文件', { taskId: task.id, type: task.type });
      }
    } catch (error) {
      logger.error('清理未完成文件失败', { taskId: task.id, error: error.message });
      throw error;
    }
  }

  /**
   * 清理单个作品任务的未完成文件
   * @param {Object} task - 作品下载任务
   */
  async cleanupArtworkIncompleteFiles(task) {
    if (!task.artwork_id || !task.artist_name || !task.artwork_title) {
      logger.warn('作品任务信息不完整，跳过文件清理', { 
        taskId: task.id,
        artwork_id: task.artwork_id,
        artist_name: task.artist_name,
        artwork_title: task.artwork_title
      });
      return;
    }

    try {
      // 构建作品目录路径
      const downloadPath = await this.fileManager.getDownloadPath();
      const artistName = this.fileManager.createSafeDirectoryName(task.artist_name);
      const artworkTitle = this.fileManager.createSafeDirectoryName(task.artwork_title);
      const artistDir = path.join(downloadPath, artistName);
      const artworkDirName = `${task.artwork_id}_${artworkTitle}`;
      const artworkDir = path.join(artistDir, artworkDirName);

      // 检查作品目录是否存在
      if (!(await this.fileManager.directoryExists(artworkDir))) {
        logger.debug('作品目录不存在，无需清理', { taskId: task.id, artworkDir });
        return;
      }

      // 获取目录中的所有文件
      const files = await this.fileManager.listDirectory(artworkDir);
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file) && file !== 'artwork_info.json'
      );

      let cleanedCount = 0;
      let errorCount = 0;

      // 检查并删除未完成的图片文件
      for (const fileName of imageFiles) {
        const filePath = path.join(artworkDir, fileName);
        
        try {
          // 检查文件完整性，根据文件扩展名推断MIME类型
          const expectedMimeType = this.getMimeTypeFromExtension(fileName);
          const integrity = await this.fileManager.checkFileIntegrity(filePath, null, expectedMimeType);
          
          if (!integrity.valid) {
            // 文件不完整，删除它
            const deleted = await this.fileManager.safeDeleteFile(filePath);
            if (deleted) {
              cleanedCount++;
              logger.debug('删除未完成文件', { 
                taskId: task.id, 
                fileName, 
                reason: integrity.reason 
              });
            } else {
              errorCount++;
              logger.warn('删除未完成文件失败', { 
                taskId: task.id, 
                fileName,
                reason: '文件可能被占用'
              });
            }
          }
        } catch (error) {
          errorCount++;
          logger.warn('检查文件完整性失败', { 
            taskId: task.id, 
            fileName, 
            error: error.message 
          });
        }
      }

      // 如果目录中只剩下artwork_info.json或为空，删除整个目录
      const remainingFiles = await this.fileManager.listDirectory(artworkDir);
      const remainingImageFiles = remainingFiles.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      );

      if (remainingImageFiles.length === 0) {
        try {
          await this.fileManager.removeDirectory(artworkDir);
          logger.info('删除空的作品目录', { taskId: task.id, artworkDir });
        } catch (error) {
          logger.warn('删除空目录失败', { 
            taskId: task.id, 
            artworkDir, 
            error: error.message 
          });
        }
      }

      logger.info('文件清理完成', { 
        taskId: task.id, 
        cleanedCount, 
        errorCount,
        totalImageFiles: imageFiles.length
      });

    } catch (error) {
      logger.error('清理作品文件失败', { taskId: task.id, error: error.message });
      throw error;
    }
  }

  /**
   * 根据文件扩展名获取MIME类型
   * @param {string} fileName - 文件名
   * @returns {string} MIME类型
   */
  getMimeTypeFromExtension(fileName) {
    const ext = path.extname(fileName).toLowerCase().replace('.', '');
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'bmp':
        return 'image/bmp';
      default:
        return 'image/jpeg'; // 默认为JPEG
    }
  }

  // 代理方法 - 历史记录管理
  async getDownloadHistory(offset = 0, limit = 50) {
    const result = this.historyManager.getDownloadHistory(offset, limit);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 清理历史记录
   */
  async cleanupHistory(keepCount = 500) {
    try {
      const result = await this.historyManager.cleanupHistoryManually(keepCount);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清理已完成的任务
   */
  async cleanupTasks(keepActive = true, keepCompleted = 100) {
    try {
      const result = await this.taskManager.cleanupTasksManually(keepActive, keepCompleted);
      return {
        success: true,
        data: { cleaned: result }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取系统统计信息
   */
  async getSystemStats() {
    try {
      const taskStats = this.taskManager.getTaskStats();
      const historyStats = this.historyManager.getHistoryStats();
      
      return {
        tasks: taskStats,
        history: historyStats,
        activeConnections: this.progressManager.getTotalListenerCount()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 代理方法 - 文件管理
  async getDownloadedFiles() {
    try {
      const files = [];
      const downloadPath = await this.fileManager.getDownloadPath();
      const artists = await this.fileManager.listDirectory(downloadPath);

      for (const artist of artists) {
        const artistPath = path.join(downloadPath, artist);
        const artistStat = await this.fileManager.getFileInfo(artistPath);

        if (artistStat.exists && artistStat.isDirectory) {
          const artworks = await this.fileManager.listDirectory(artistPath);

          for (const artwork of artworks) {
            const artworkPath = path.join(artistPath, artwork);
            const artworkStat = await this.fileManager.getFileInfo(artworkPath);

            if (artworkStat.exists && artworkStat.isDirectory) {
              const artworkFiles = await this.fileManager.listDirectory(artworkPath);
              const imageFiles = artworkFiles.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

              if (imageFiles.length > 0) {
                files.push({
                  artist: artist,
                  artwork: artwork,
                  path: artworkPath,
                  files: imageFiles,
                  total_size: await this.fileManager.getDirectorySize(artworkPath),
                  created_at: artworkStat.created,
                });
              }
            }
          }
        }
      }

      return files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      logger.error('获取下载文件列表失败:', error);
      return [];
    }
  }

  async getDownloadedArtworkIds() {
    try {
      const downloadedIds = new Set();
      const downloadPath = await this.fileManager.getDownloadPath();

      // 扫描下载目录获取所有已下载的作品ID
      const artists = await this.fileManager.listDirectory(downloadPath);

      for (const artist of artists) {
        const artistPath = path.join(downloadPath, artist);
        const artistStat = await this.fileManager.getFileInfo(artistPath);

        if (artistStat.exists && artistStat.isDirectory) {
          const artworks = await this.fileManager.listDirectory(artistPath);

          for (const artwork of artworks) {
            // 检查是否是作品目录（包含数字ID）
            const artworkMatch = artwork.match(/^(\d+)_(.+)$/);
            if (artworkMatch) {
              const artworkId = artworkMatch[1];

              // 检查作品目录是否包含图片文件
              const artworkPath = path.join(artistPath, artwork);
              const artworkStat = await this.fileManager.getFileInfo(artworkPath);

              if (artworkStat.exists && artworkStat.isDirectory) {
                const files = await this.fileManager.listDirectory(artworkPath);
                const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
                if (imageFiles.length > 0) {
                  downloadedIds.add(parseInt(artworkId));
                }
              }
            }
          }
        }
      }

      return Array.from(downloadedIds);
    } catch (error) {
      logger.error('获取已下载作品ID列表失败:', error);
      return [];
    }
  }

  async isArtworkDownloaded(artworkId) {
    try {
      // 获取配置，决定使用哪种检测方式
      const cacheConfig = await this.cacheConfigManager.loadConfig();
      const useRegistryCheck = cacheConfig.download?.useRegistryCheck !== false; // 默认启用
      const fallbackToScan = cacheConfig.download?.fallbackToScan === true; // 默认不启用

      // 优先使用注册表检测（如果启用）
      if (useRegistryCheck) {
        try {
          const isDownloaded = await this.downloadRegistry.isArtworkDownloaded(artworkId);
          if (isDownloaded || !fallbackToScan) {
            return isDownloaded;
          }
          // 如果注册表显示未下载但启用了回退，继续使用扫盘检测
        } catch (error) {
          logger.warn('注册表检测失败，使用扫盘检测:', error.message);
          if (!fallbackToScan) {
            return false;
          }
        }
      }

      // 使用原有的扫盘检测逻辑
      return await this.isArtworkDownloadedByScan(artworkId);
    } catch (error) {
      logger.error('检查作品下载状态失败:', error);
      return false;
    }
  }

  /**
   * 通过扫描文件系统检测作品是否已下载（原有逻辑）
   */
  async isArtworkDownloadedByScan(artworkId) {
    try {
      const downloadPath = await this.fileManager.getDownloadPath();

      // 扫描所有作者目录
      const artistEntries = await this.fileManager.listDirectory(downloadPath);

      for (const artistEntry of artistEntries) {
        const artistPath = path.join(downloadPath, artistEntry);
        const artistStat = await this.fileManager.getFileInfo(artistPath);

        if (!artistStat.exists || !artistStat.isDirectory) continue;

        // 扫描作者下的作品目录
        const artworkEntries = await this.fileManager.listDirectory(artistPath);

        for (const artworkEntry of artworkEntries) {
          // 检查是否是目标作品目录（包含数字ID）
          const artworkMatch = artworkEntry.match(/^(\d+)_(.+)$/);
          if (artworkMatch && artworkMatch[1] === artworkId.toString()) {
            const artworkPath = path.join(artistPath, artworkEntry);

            // 检查作品信息文件 - 这是最可靠的判断标准
            const infoPath = path.join(artworkPath, 'artwork_info.json');
            let artworkInfo;
            try {
              const infoContent = await fs.readFile(infoPath, 'utf8');
              artworkInfo = JSON.parse(infoContent);
            } catch (error) {
              logger.info(`作品 ${artworkId} 缺少信息文件，认为未下载`);
              return false;
            }

            // 检查是否有图片文件
            const files = await this.fileManager.listDirectory(artworkPath);
            const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file) && file !== 'artwork_info.json');

            if (imageFiles.length === 0) {
              logger.info(`作品 ${artworkId} 有信息文件但没有图片文件，认为未下载`);
              return false;
            }

            // 检查图片数量是否与artwork_info.json中记录的一致
            const expectedImageCount = artworkInfo.page_count || 1;
            if (imageFiles.length < expectedImageCount) {
              logger.info(`作品 ${artworkId} 图片数量不匹配: 期望 ${expectedImageCount} 个，实际 ${imageFiles.length} 个`);
              return false;
            }

            // 有信息文件、有图片文件且数量匹配，认为已下载
            // logger.info(`作品 ${artworkId} 已完整下载，有信息文件和 ${imageFiles.length}/${expectedImageCount} 个图片文件`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error('扫盘检查作品下载状态失败:', error);
      return false;
    }
  }

  /**
   * 下载单个作品
   */
  async downloadArtwork(artworkId, options = {}) {
    const { size = 'original', quality = 'high', format = 'auto', skipExisting = true } = options;

    try {
      // 检查是否已下载
      if (skipExisting && (await this.isArtworkDownloaded(artworkId))) {
        return {
          success: true,
          data: {
            task_id: null,
            artwork_id: artworkId,
            skipped: true,
            message: '作品已存在且完整，跳过下载',
          },
        };
      }

      // 获取作品信息
      const artworkResult = await this.artworkService.getArtworkDetail(artworkId);
      if (!artworkResult.success) {
        throw new Error(`获取作品信息失败: ${artworkResult.error}`);
      }

      const artwork = artworkResult.data;

      // 确保作品信息完整
      if (!artwork || !artwork.user || !artwork.title) {
        throw new Error('作品信息不完整');
      }

      const artistName = this.fileManager.createSafeDirectoryName(artwork.user.name || 'Unknown Artist');
      const artworkTitle = this.fileManager.createSafeDirectoryName(artwork.title || 'Untitled');

      // 创建作品目录
      const downloadPath = await this.fileManager.getDownloadPath();
      const artistDir = path.join(downloadPath, artistName);
      const artworkDirName = `${artworkId}_${artworkTitle}`;
      const artworkDir = path.join(artistDir, artworkDirName);

      // 如果是重新下载，先删除现有目录
      if (!skipExisting && (await this.fileManager.directoryExists(artworkDir))) {
        logger.info(`删除现有作品目录: ${artworkDir}`);
        await this.fileManager.removeDirectory(artworkDir);
      }

      await this.fileManager.ensureDirectory(artworkDir);

      // 获取图片URL
      const imagesResult = await this.artworkService.getArtworkImages(artworkId, size);
      if (!imagesResult.success) {
        throw new Error(`获取图片URL失败: ${imagesResult.error}`);
      }

      const images = imagesResult.data.images;

      // 创建任务记录
      const task = this.taskManager.createTask('artwork', {
        artwork_id: artworkId,
        artist_name: artistName,
        artwork_title: artworkTitle,
        total_files: images.length,
        completed_files: 0,
        failed_files: 0,
      });

      await this.taskManager.saveTasks();

      // 立即发送初始状态更新，让前端能立即看到进度条
      this.progressManager.notifyProgressUpdate(task.id, task);

      // 立即返回任务ID，异步执行下载
      this.downloadExecutor.executeArtworkDownload(task, images, size, artworkDir, artwork);

      return {
        success: true,
        data: {
          task_id: task.id,
          artwork_id: artworkId,
          artist_name: artistName,
          artwork_title: artworkTitle,
          total_files: images.length,
          status: 'downloading',
          message: '下载任务已创建，正在后台执行',
        },
      };
    } catch (error) {
      logger.error('下载作品失败:', {
        artworkId,
        error: error.message,
        stack: error.stack,
        options
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量下载作品
   */
  async downloadMultipleArtworks(artworkIds, options = {}) {
    try {
      // 使用统一的批量下载方法
      return await this.downloadBatchArtworks(artworkIds, {
        ...options,
        taskType: 'batch',
      });
    } catch (error) {
      logger.error('批量下载失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 内部方法：下载单个作品（用于批量下载，不创建新任务）
   */
  async downloadSingleArtworkForBatch(artworkId, options = {}) {
    const { size = 'original', quality = 'high', format = 'auto', skipExisting = true } = options;

    try {
      // 检查是否已下载
      if (skipExisting && (await this.isArtworkDownloaded(artworkId))) {
        // 获取作品信息用于返回
        let artistName = 'Unknown Artist';
        let artworkTitle = 'Untitled';
        
        try {
          const artworkResult = await this.artworkService.getArtworkDetail(artworkId);
          if (artworkResult.success && artworkResult.data) {
            const artwork = artworkResult.data;
            artistName = this.fileManager.createSafeDirectoryName(artwork.user?.name || 'Unknown Artist');
            artworkTitle = this.fileManager.createSafeDirectoryName(artwork.title || 'Untitled');
          }
        } catch (error) {
          logger.debug(`获取已下载作品信息失败: ${artworkId}`, error.message);
        }
        
        return {
          success: true,
          skipped: true,
          artwork_id: artworkId,
          artist_name: artistName,
          artwork_title: artworkTitle,
          message: '作品已存在且完整，跳过下载',
        };
      }

      // 获取作品信息
      const artworkResult = await this.artworkService.getArtworkDetail(artworkId);
      if (!artworkResult.success) {
        throw new Error(`获取作品信息失败: ${artworkResult.error}`);
      }

      const artwork = artworkResult.data;

      // 确保作品信息完整
      if (!artwork || !artwork.user || !artwork.title) {
        throw new Error('作品信息不完整');
      }

      const artistName = this.fileManager.createSafeDirectoryName(artwork.user.name || 'Unknown Artist');
      const artworkTitle = this.fileManager.createSafeDirectoryName(artwork.title || 'Untitled');

      // 创建作品目录
      const downloadPath = await this.fileManager.getDownloadPath();
      const artistDir = path.join(downloadPath, artistName);
      const artworkDirName = `${artworkId}_${artworkTitle}`;
      const artworkDir = path.join(artistDir, artworkDirName);

      // 如果是重新下载，先删除现有目录
      if (!skipExisting && (await this.fileManager.directoryExists(artworkDir))) {
        logger.info(`删除现有作品目录: ${artworkDir}`);
        await this.fileManager.removeDirectory(artworkDir);
      }

      await this.fileManager.ensureDirectory(artworkDir);

      // 获取图片URL
      const imagesResult = await this.artworkService.getArtworkImages(artworkId, size);
      if (!imagesResult.success) {
        throw new Error(`获取图片URL失败: ${imagesResult.error}`);
      }

      const images = imagesResult.data.images;

      // 直接下载，不创建新任务
      const results = [];
      for (let index = 0; index < images.length; index++) {
        // 从图片对象中获取指定尺寸的URL
        const imageObj = images[index];
        let imageUrl;
        
        // 根据size参数选择对应的URL
        switch (size) {
          case 'original':
            imageUrl = imageObj.original;
            break;
          case 'large':
            imageUrl = imageObj.large;
            break;
          case 'medium':
            imageUrl = imageObj.medium;
            break;
          case 'square_medium':
            imageUrl = imageObj.square_medium;
            break;
          default:
            imageUrl = imageObj.original || imageObj.large || imageObj.medium;
        }

        // 确保imageUrl是字符串
        if (typeof imageUrl !== 'string') {
          logger.error(`图片URL不是字符串:`, imageUrl);
          results.push({ success: false, error: '图片URL格式错误' });
          continue;
        }

        const fileName = `image_${index + 1}.${this.getFileExtension(imageUrl)}`;
        const filePath = path.join(artworkDir, fileName);

        // 检查文件是否已存在
        if (await this.fileManager.fileExists(filePath)) {
          results.push({ success: true, file: fileName, skipped: true });
          continue;
        }

        try {
          // 确保目录存在
          await this.fileManager.ensureDirectory(path.dirname(filePath));
          await this.fileManager.downloadFile(imageUrl, filePath);
          results.push({ success: true, file: fileName });
        } catch (error) {
          logger.error(`下载图片失败 ${index + 1}:`, {
            artworkId,
            imageIndex: index + 1,
            imageUrl,
            filePath,
            error: error.message,
            stack: error.stack
          });
          results.push({ success: false, error: error.message });
        }
      }

      // 保存作品信息
      const infoPath = path.join(artworkDir, 'artwork_info.json');
      await fs.writeJson(infoPath, artwork, { spaces: 2 });

      // 检查下载结果
      const failedCount = results.filter(r => !r.success).length;
      const successCount = results.filter(r => r.success && !r.skipped).length;
      const skippedCount = results.filter(r => r.success && r.skipped).length;

      // 只有在所有文件都成功下载（包括跳过的文件）时才添加到注册表
      const allFilesSuccessful = failedCount === 0;
      
      if (allFilesSuccessful) {
        try {
          // 执行文件完整性检查
          let integrityCheckPassed = true;
          for (let index = 0; index < images.length; index++) {
            const fileName = `image_${index + 1}.${this.getFileExtension(images[index].original || images[index].large || images[index].medium)}`;
            const filePath = path.join(artworkDir, fileName);
            
            if (await this.fileManager.fileExists(filePath)) {
              // 检查文件大小
              const stats = await fs.stat(filePath);
              if (stats.size === 0) {
                logger.warn(`文件大小为0，完整性检查失败: ${filePath}`);
                integrityCheckPassed = false;
                break;
              }
              
              // 检查MIME类型 - 使用checkFileHeader方法来检测文件类型
              const headerCheck = await this.fileManager.checkFileHeader(filePath);
              if (!headerCheck.valid || !headerCheck.detectedType || !headerCheck.detectedType.startsWith('image/')) {
                logger.warn(`文件MIME类型检查失败: ${filePath}, 检测结果: ${JSON.stringify(headerCheck)}`);
                integrityCheckPassed = false;
                break;
              }
            }
          }
          
          if (integrityCheckPassed) {
            // 添加到下载注册表（仅用于单个作品下载，批量下载在executeBatchDownload中处理）
            await this.downloadRegistry.addArtwork(artistName, artworkId);
            logger.debug(`作品 ${artworkId} 已添加到下载注册表`, {
              artworkId,
              artistName,
              totalFiles: images.length,
              completedFiles: successCount,
              skippedFiles: skippedCount
            });
          } else {
            logger.warn(`作品 ${artworkId} 文件完整性检查失败，未添加到下载注册表`, {
              artworkId,
              artistName
            });
          }
        } catch (error) {
          logger.error(`添加作品到下载注册表失败: ${artworkId}`, {
            artworkId,
            artistName,
            error: error.message,
            stack: error.stack
          });
        }
      } else {
        logger.debug(`作品 ${artworkId} 下载不完整，未添加到下载注册表`, {
          artworkId,
          artistName,
          failedCount,
          totalFiles: images.length
        });
      }

      return {
        success: allFilesSuccessful,
        artwork_id: artworkId,
        artist_name: artistName,
        artwork_title: artworkTitle,
        total_files: images.length,
        completed_files: successCount,
        failed_files: failedCount,
        results: results,
      };
    } catch (error) {
      logger.error(`下载作品 ${artworkId} 失败:`, {
        artworkId,
        error: error.message,
        stack: error.stack,
        options
      });
      return {
        success: false,
        error: error.message,
        artwork_id: artworkId,
      };
    }
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(url) {
    if (typeof url !== 'string') {
      logger.warn('URL不是字符串，使用默认扩展名:', url);
      return 'jpg';
    }
    
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1] : 'jpg';
  }

  /**
   * 下载批量作品 - 统一的批量下载方法
   * @param {Array} items - 要下载的项目列表（可以是作品ID数组或作品对象数组）
   * @param {Object} options - 下载选项
   */
  async downloadBatchArtworks(items, options = {}) {
    const { size = 'original', quality = 'high', format = 'auto', skipExisting = true, maxConcurrent = 3, taskType = 'batch' } = options;

    try {
      // 生成任务描述
      let taskDescription = '';
      let taskTitle = '';
      
      if (taskType === 'ranking') {
        const modeMap = {
          'day': '日榜',
          'week': '周榜', 
          'month': '月榜',
          'rookie': '新人榜'
        };
        const typeMap = {
          'art': '插画',
          'manga': '漫画',
          'novel': '小说'
        };
        const modeText = modeMap[options.mode] || options.mode;
        const typeText = typeMap[options.type] || options.type;
        taskDescription = `${modeText}${typeText}排行榜`;
        taskTitle = `排行榜下载 - ${taskDescription}`;
      } else if (taskType === 'artist') {
        const artistName = options.artist_name || `作者ID: ${options.artist_id}`;
        taskDescription = `作者作品 - ${artistName}`;
        taskTitle = `作者作品下载 - ${artistName}`;
      } else {
        taskDescription = '批量下载';
        taskTitle = '批量下载';
      }

      // 创建任务记录
      const task = this.taskManager.createTask(taskType, {
        total_files: 0,
        completed_files: 0,
        failed_files: 0,
        skipped: 0,
        results: [],
        task_description: taskDescription,
        task_title: taskTitle,
        items: items, // 保存原始的作品列表，用于恢复任务
        // 保留原有的任务特定字段
        ...(options.artist_id && { artist_id: options.artist_id }),
        ...(options.artist_name && { artist_name: options.artist_name }),
        ...(options.mode && { mode: options.mode }),
        ...(options.type && { type: options.type }),
      });

      await this.taskManager.saveTasks();

      // 获取已下载的作品ID
      const downloadedIds = skipExisting ? await this.getDownloadedArtworkIds() : [];
      const downloadedSet = new Set(downloadedIds);

      // 过滤已下载的作品
      let newItems;
      if (skipExisting) {
        newItems = items.filter(item => {
          const artworkId = typeof item === 'object' ? item.id : item;
          return !downloadedSet.has(artworkId);
        });
      } else {
        newItems = items;
      }

      const skippedCount = items.length - newItems.length;

      await this.taskManager.updateTask(task.id, {
        skipped: skippedCount,
        total_files: newItems.length,
      });

      // 如果没有需要下载的作品，直接返回
      if (newItems.length === 0) {
        await this.taskManager.updateTask(task.id, {
          status: 'completed',
          end_time: new Date(),
        });

        return {
          success: true,
          data: {
            task_id: task.id,
            total_artworks: items.length,
            completed_artworks: 0,
            failed_artworks: 0,
            skipped_artworks: skippedCount,
            message: '所有作品都已下载完成',
          },
        };
      }

      // 异步执行批量下载
      this.downloadExecutor.executeBatchDownload(task, newItems, options);

      return {
        success: true,
        data: {
          task_id: task.id,
          total_artworks: task.total_files,
          completed_artworks: task.completed_files,
          failed_artworks: task.failed_files,
          message: '批量下载任务已创建，正在后台执行',
        },
      };
    } catch (error) {
      logger.error('批量下载失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 下载作者作品
   */
  async downloadArtistArtworks(artistId, options = {}) {
    const { type = 'art', limit = 50, pageSize = 30 } = options;

    try {
      // 先获取作者信息
      let artistName = '未知作者';
      try {
        const artistResult = await this.artistService.getArtistInfo(artistId);
        if (artistResult.success && artistResult.data) {
          artistName = artistResult.data.name || `作者 ${artistId}`;
        }
      } catch (err) {
        logger.warn(`获取作者 ${artistId} 信息失败:`, err.message);
      }

      // 分页获取作者作品列表
      let allArtworks = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && allArtworks.length < limit) {
        const artworksResult = await this.artistService.getArtistArtworks(artistId, {
          type,
          offset: offset,
        });

        if (!artworksResult.success) {
          throw new Error(`获取作者作品失败: ${artworksResult.error}`);
        }

        const artworks = artworksResult.data.artworks;
        if (artworks.length === 0) {
          hasMore = false;
        } else {
          // 确保不超过指定的 limit
          const remainingSlots = limit - allArtworks.length;
          const artworksToAdd = artworks.slice(0, remainingSlots);
          
          allArtworks.push(...artworksToAdd);
          offset += artworks.length;

          // 基于 next_url 判断是否还有更多页面
          hasMore = !!artworksResult.data.next_url && allArtworks.length < limit;

          // 添加延迟避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 使用统一的批量下载方法
      return await this.downloadBatchArtworks(allArtworks, {
        ...options,
        taskType: 'artist',
        artist_id: artistId,
        artist_name: artistName,
      });
    } catch (error) {
      logger.error('作者作品下载失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 下载排行榜作品
   */
  async downloadRankingArtworks(options = {}) {
    const { mode = 'day', type = 'art', limit = 50, pageSize = 30 } = options;

    try {
      // 分页获取排行榜作品列表
      let allArtworks = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && allArtworks.length < limit) {
        const remainingLimit = limit - allArtworks.length;
        const requestLimit = Math.min(pageSize, remainingLimit);
        
        const rankingResult = await this.getRankingArtworks(mode, type, {
          offset: offset,
          limit: requestLimit,
        });

        if (!rankingResult.success) {
          throw new Error(`获取排行榜作品失败: ${rankingResult.error}`);
        }

        const artworks = rankingResult.data.artworks;
        if (artworks.length === 0) {
          hasMore = false;
        } else {
          // 确保不超过指定的 limit
          const remainingSlots = limit - allArtworks.length;
          const artworksToAdd = artworks.slice(0, remainingSlots);
          
          allArtworks.push(...artworksToAdd);
          offset += artworks.length;

          // 基于 next_url 判断是否还有更多页面
          hasMore = !!rankingResult.data.next_url && allArtworks.length < limit;

          // 添加延迟避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 使用统一的批量下载方法
      return await this.downloadBatchArtworks(allArtworks, {
        ...options,
        taskType: 'ranking',
        mode: mode,
        type: type,
      });
    } catch (error) {
      logger.error('排行榜作品下载失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取排行榜作品列表
   */
  async getRankingArtworks(mode, type, options = {}) {
    const { offset = 0, limit = 30 } = options;

    try {
      // 使用作品服务来获取排行榜数据
      const artworkService = new (require('./artwork'))(this.auth);

      const result = await artworkService.getRankingArtworks({
        mode,
        content: type,
        offset,
        limit,
      });

      // 检查 ArtworkService 返回的结果
      if (!result.success) {
        throw new Error(result.error || '获取排行榜数据失败');
      }

      // 确保数据结构正确
      const artworks = result.data?.artworks || [];
      const nextUrl = result.data?.next_url || null;

      return {
        success: true,
        data: {
          artworks: artworks,
          next_url: nextUrl,
        },
      };
    } catch (error) {
      logger.error('获取排行榜失败:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 删除已下载的文件
   * @param {string} artist - 作者名称
   * @param {string} artwork - 作品目录名称
   * @returns {Object} 删除结果
   */
  async deleteDownloadedFiles(artist, artwork) {

    try {
      const downloadPath = await this.fileManager.getDownloadPath();
      const artworkPath = path.join(downloadPath, artist, artwork);
      
      // 检查作品目录是否存在
      const artworkStat = await this.fileManager.getFileInfo(artworkPath);
      if (!artworkStat.exists) {
        return {
          success: false,
          error: '作品目录不存在'
        };
      }

      // 从作品目录名称中提取作品ID
      const artworkMatch = artwork.match(/^(\d+)_(.+)$/);
      if (!artworkMatch) {
        return {
          success: false,
          error: '无效的作品目录格式'
        };
      }
      
      const artworkId = parseInt(artworkMatch[1]);

      // 删除作品目录
      await this.fileManager.removeDirectory(artworkPath);
      
      // 从注册表中移除作品记录
      try {
        await this.downloadRegistry.removeArtwork(artist, artworkId);
        logger.debug('已从下载注册表中移除作品', { 
          artistName: artist, 
          artworkId: artworkId 
        });
      } catch (error) {
        logger.warn('从下载注册表中移除作品失败:', error.message);
      }

      // 检查作者目录是否为空，如果为空则删除
      const artistPath = path.join(downloadPath, artist);
      try {
        const artistEntries = await this.fileManager.listDirectory(artistPath);
        const hasArtworks = artistEntries.some(entry => entry.match(/^\d+_/));
        
        if (!hasArtworks) {
          await this.fileManager.removeDirectory(artistPath);
          logger.debug('已删除空的作者目录', { artistName: artist });
        }
      } catch (error) {
        logger.warn(`检查作者目录失败: ${error.message}`);
      }

      return {
        success: true,
        message: '作品删除成功'
      };
    } catch (error) {
      logger.error('删除作品失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DownloadService;
