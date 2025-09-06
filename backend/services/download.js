const path = require('path');
const ArtworkService = require('./artwork');
const ArtistService = require('./artist');
const TaskManager = require('./task-manager');
const FileManager = require('./file-manager');
const ProgressManager = require('./progress-manager');
const HistoryManager = require('./history-manager');
const DownloadExecutor = require('./download-executor');
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
    // 先创建下载执行器，稍后在init方法中设置downloadService引用
    this.downloadExecutor = new DownloadExecutor(this.fileManager, this.taskManager, this.progressManager, this.historyManager, this);

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

      this.initialized = true;
      // 下载服务初始化完成
    } catch (error) {
      logger.error('下载服务初始化失败:', error);
      this.initialized = false;
    }
  }

  // 代理方法 - 进度管理
  addProgressListener(taskId, listener) {
    return this.progressManager.addProgressListener(taskId, listener);
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

    await this.taskManager.updateTask(taskId, {
      status: 'cancelled',
      end_time: new Date(),
    });

    this.progressManager.notifyProgressUpdate(taskId, task);
    return { success: true };
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

    await this.taskManager.updateTask(taskId, { status: 'paused' });
    
    // 获取更新后的任务
    const updatedTask = this.taskManager.getTask(taskId);
    this.progressManager.notifyProgressUpdate(taskId, updatedTask);
    
    return { success: true, data: updatedTask };
  }

  async resumeTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      logger.error('恢复任务失败：任务不存在', { taskId });
      return { success: false, error: '任务不存在' };
    }

    // logger.info('尝试恢复任务', { 
    //   taskId, 
    //   currentStatus: task.status, 
    //   type: task.type,
    //   artwork_id: task.artwork_id 
    // });

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
      
      // 获取更新后的任务状态
      const updatedTask = this.taskManager.getTask(taskId);
      this.progressManager.notifyProgressUpdate(taskId, updatedTask);
      
      logger.info('任务恢复成功', { 
        taskId, 
        newStatus: updatedTask.status 
      });
    } catch (error) {
      logger.error('恢复任务执行失败', { 
        taskId, 
        error: error.message,
        stack: error.stack 
      });
      // 如果恢复失败，保持暂停状态
      return { success: false, error: `恢复任务失败: ${error.message}` };
    }

    return { success: true, data: this.taskManager.getTask(taskId) };
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
      logger.error('检查作品下载状态失败:', error);
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
      logger.error('下载作品失败:', error);
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
    // 获取动态并发配置
    const concurrentConfig = await this.getConcurrentConfig();
    const { concurrent = concurrentConfig.concurrentDownloads, size = 'original', quality = 'high', format = 'auto', skipExisting = true } = options;

    try {
      // 检查重复下载
      let filteredIds = artworkIds;
      let skippedCount = 0;

      if (skipExisting) {
        const downloadedIds = await this.getDownloadedArtworkIds();
        const downloadedSet = new Set(downloadedIds);

        filteredIds = artworkIds.filter(id => !downloadedSet.has(id));
        skippedCount = artworkIds.length - filteredIds.length;
      }

      // 创建任务记录
      const task = this.taskManager.createTask('batch', {
        artwork_ids: artworkIds,
        filtered_ids: filteredIds,
        total_files: filteredIds.length,
        completed_files: 0,
        failed_files: 0,
        skipped: skippedCount,
        results: [],
      });

      await this.taskManager.saveTasks();

      // 立即发送初始状态更新，让前端能立即看到进度条
      this.progressManager.notifyProgressUpdate(task.id, task);

      // 如果没有需要下载的作品，直接返回
      if (filteredIds.length === 0) {
        await this.taskManager.updateTask(task.id, {
          status: 'completed',
          end_time: new Date(),
        });

        return {
          success: true,
          data: {
            task_id: task.id,
            total_artworks: artworkIds.length,
            completed_artworks: 0,
            failed_artworks: 0,
            skipped_artworks: skippedCount,
            message: '所有作品都已下载完成',
          },
        };
      }

      // 异步执行批量下载
      this.downloadExecutor.executeBatchDownload(task, filteredIds, options);

      return {
        success: true,
        data: {
          task_id: task.id,
          total_artworks: task.total,
          completed_artworks: task.completed,
          failed_artworks: task.failed,
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
   * 内部方法：下载单个作品（用于批量下载，不创建新任务）
   */
  async downloadSingleArtworkForBatch(artworkId, options = {}) {
    const { size = 'original', quality = 'high', format = 'auto', skipExisting = true } = options;

    try {
      // 检查是否已下载
      if (skipExisting && (await this.isArtworkDownloaded(artworkId))) {
        return {
          success: true,
          skipped: true,
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
          logger.error(`下载图片失败 ${index + 1}: ${error.message}`);
          results.push({ success: false, error: error.message });
        }
      }

      // 保存作品信息
      const infoPath = path.join(artworkDir, 'artwork_info.json');
      await fs.writeJson(infoPath, artwork, { spaces: 2 });

      // 检查下载结果
      const failedCount = results.filter(r => !r.success).length;
      const successCount = results.filter(r => r.success && !r.skipped).length;

      return {
        success: failedCount === 0,
        artwork_id: artworkId,
        artist_name: artistName,
        artwork_title: artworkTitle,
        total_files: images.length,
        completed_files: successCount,
        failed_files: failedCount,
        results: results,
      };
    } catch (error) {
      logger.error(`下载作品 ${artworkId} 失败:`, error);
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
   * 下载作者作品
   */
  async downloadArtistArtworks(artistId, options = {}) {
    const { type = 'art', limit = 50, size = 'original', quality = 'high', format = 'auto', skipExisting = true, maxConcurrent = 3, pageSize = 30 } = options;

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

      // 创建任务记录
      const task = this.taskManager.createTask('artist', {
        artist_id: artistId,
        artist_name: artistName,
        total_files: 0,
        completed_files: 0,
        failed_files: 0,
        skipped: 0,
        results: [],
      });

      await this.taskManager.saveTasks();

      // 获取已下载的作品ID
      const downloadedIds = skipExisting ? await this.getDownloadedArtworkIds() : [];
      const downloadedSet = new Set(downloadedIds);

      // 分页获取作者作品列表
      let allArtworks = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && allArtworks.length < limit) {
        const artworksResult = await this.artistService.getArtistArtworks(artistId, {
          type,
          offset: offset,
          limit: Math.min(pageSize, limit - allArtworks.length),
        });

        if (!artworksResult.success) {
          throw new Error(`获取作者作品失败: ${artworksResult.error}`);
        }

        const artworks = artworksResult.data.artworks;
        if (artworks.length === 0) {
          hasMore = false;
        } else {
          allArtworks.push(...artworks);
          offset += artworks.length;

          // 基于 next_url 判断是否还有更多页面
          hasMore = !!artworksResult.data.next_url;

          // 添加延迟避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 过滤已下载的作品
      const newArtworks = skipExisting ? allArtworks.filter(artwork => !downloadedSet.has(artwork.id)) : allArtworks;

      const skippedCount = allArtworks.length - newArtworks.length;

      await this.taskManager.updateTask(task.id, {
        skipped: skippedCount,
        total_files: newArtworks.length,
      });

      // 作者作品下载统计

      // 如果没有需要下载的作品，直接返回
      if (newArtworks.length === 0) {
        await this.taskManager.updateTask(task.id, {
          status: 'completed',
          end_time: new Date(),
        });

        return {
          success: true,
          data: {
            task_id: task.id,
            artist_id: artistId,
            artist_name: artistName,
            total_artworks: allArtworks.length,
            completed_artworks: 0,
            failed_artworks: 0,
            skipped_artworks: skippedCount,
            message: '所有作品都已下载完成',
          },
        };
      }

      // 异步执行作者作品下载
      this.downloadExecutor.executeArtistDownload(task, newArtworks, options);

      return {
        success: true,
        data: {
          task_id: task.id,
          artist_id: artistId,
          artist_name: artistName,
          total_artworks: task.total_files,
          completed_artworks: task.completed_files,
          failed_artworks: task.failed_files,
          message: '作者作品下载任务已创建，正在后台执行',
        },
      };
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
    const { mode = 'day', type = 'art', limit = 50, size = 'original', quality = 'high', format = 'auto', skipExisting = true, maxConcurrent = 3, pageSize = 30 } = options;

    try {
      // 创建任务记录
      const task = this.taskManager.createTask('ranking', {
        mode: mode,
        type: type,
        total_files: 0,
        completed_files: 0,
        failed_files: 0,
        skipped: 0,
        results: [],
      });

      await this.taskManager.saveTasks();

      // 获取已下载的作品ID
      const downloadedIds = skipExisting ? await this.getDownloadedArtworkIds() : [];
      const downloadedSet = new Set(downloadedIds);

      // 分页获取排行榜作品列表
      let allArtworks = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore && allArtworks.length < limit) {
        const rankingResult = await this.getRankingArtworks(mode, type, {
          offset: offset,
          limit: Math.min(pageSize, limit - allArtworks.length),
        });

        if (!rankingResult.success) {
          throw new Error(`获取排行榜作品失败: ${rankingResult.error}`);
        }

        const artworks = rankingResult.data.artworks;
        if (artworks.length === 0) {
          hasMore = false;
        } else {
          allArtworks.push(...artworks);
          offset += artworks.length;

          // 基于 next_url 判断是否还有更多页面
          hasMore = !!rankingResult.data.next_url;

          // 添加延迟避免请求过于频繁
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 过滤已下载的作品
      const newArtworks = skipExisting ? allArtworks.filter(artwork => !downloadedSet.has(artwork.id)) : allArtworks;

      const skippedCount = allArtworks.length - newArtworks.length;

      await this.taskManager.updateTask(task.id, {
        skipped: skippedCount,
        total_files: newArtworks.length,
      });

      // 排行榜作品下载统计

      // 如果没有需要下载的作品，直接返回
      if (newArtworks.length === 0) {
        await this.taskManager.updateTask(task.id, {
          status: 'completed',
          end_time: new Date(),
        });

        return {
          success: true,
          data: {
            task_id: task.id,
            mode: mode,
            type: type,
            total_artworks: allArtworks.length,
            completed_artworks: 0,
            failed_artworks: 0,
            skipped_artworks: skippedCount,
            message: '所有作品都已下载完成',
          },
        };
      }

      // 异步执行排行榜作品下载
      this.downloadExecutor.executeRankingDownload(task, newArtworks, options);

      return {
        success: true,
        data: {
          task_id: task.id,
          mode: mode,
          type: type,
          total_artworks: task.total,
          completed_artworks: task.completed,
          failed_artworks: task.failed,
          message: '排行榜作品下载任务已创建，正在后台执行',
        },
      };
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

      return {
        success: true,
        data: {
          artworks: result.artworks,
          next_url: result.next_url || null,
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
}

module.exports = DownloadService;
