const path = require('path');
const fs = require('fs-extra');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('DownloadExecutor');


/**
 * 下载执行器 - 负责具体的下载逻辑执行
 */
class DownloadExecutor {
  constructor(fileManager, taskManager, progressManager, historyManager, downloadService) {
    this.fileManager = fileManager;
    this.taskManager = taskManager;
    this.progressManager = progressManager;
    this.historyManager = historyManager;
    this.downloadService = downloadService; // 添加下载服务引用
  }

  /**
   * 执行单个作品下载
   */
  async executeArtworkDownload(task, images, size, artworkDir, artwork) {
    try {
      const results = [];

      for (let index = 0; index < images.length; index++) {
        if (task.status === 'cancelled') {
          break;
        }

        // 检查是否应该暂停
        if (this.shouldPause(task.id)) {
          logger.info('任务已暂停，停止下载:', task.id);
          // 确保任务状态为暂停
          task.status = 'paused';
          await this.taskManager.saveTasks();
          this.progressManager.notifyProgressUpdate(task.id, task);
          break;
        }

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
          task.failed_files++;
          this.progressManager.notifyProgressUpdate(task.id, task);
          results.push({ success: false, error: '图片URL格式错误' });
          continue;
        }

        const fileName = `image_${index + 1}.${this.getFileExtension(imageUrl)}`;
        const filePath = path.join(artworkDir, fileName);

        // 检查文件是否已存在且完整
        if (await this.fileManager.fileExists(filePath)) {
          // 验证文件完整性
          const integrity = await this.fileManager.checkFileIntegrity(filePath);
          if (integrity.valid) {
            // 只有在非恢复模式下才增加计数，避免重复计算
            if (!task.isResuming) {
              task.completed_files++;
              task.progress = Math.round((task.completed_files / task.total_files) * 100);
              await this.taskManager.saveTasks();
              this.progressManager.notifyProgressUpdate(task.id, task);
            }
            results.push({ success: true, file: fileName, skipped: true });
            continue;
          } else {
            // 文件不完整，删除重新下载
            logger.info(`文件不完整，重新下载: ${filePath}`);
            await this.fileManager.safeDeleteFile(filePath);
          }
        }

        try {
          // 确保目录存在
          await this.fileManager.ensureDirectory(path.dirname(filePath));

          // 下载文件并等待完成
          await this.fileManager.downloadFile(imageUrl, filePath);

          // 验证下载的文件完整性
          const integrity = await this.fileManager.checkFileIntegrity(filePath);
          if (!integrity.valid) {
            throw new Error(`文件下载不完整: ${integrity.reason}`);
          }

          task.completed_files++;
          task.progress = Math.round((task.completed_files / task.total_files) * 100);
          await this.taskManager.saveTasks();
          this.progressManager.notifyProgressUpdate(task.id, task);

          results.push({ success: true, file: fileName });
        } catch (error) {
          task.failed_files++;
          logger.error(`下载图片失败 ${index + 1}: ${error.message}`);
          this.progressManager.notifyProgressUpdate(task.id, task);
          results.push({ success: false, error: error.message });
        }
      }

      // 检查任务是否被暂停，如果是则不要更新最终状态
      if (task.status === 'paused') {
        logger.info('任务已暂停，跳过最终状态更新:', task.id);
        return;
      }

      // 保存作品信息
      const infoPath = path.join(artworkDir, 'artwork_info.json');
      await fs.writeJson(infoPath, artwork, { spaces: 2 });

      // 更新任务状态 - 确保所有文件都处理完成后再更新
      task.status = task.failed_files === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.progress = 100;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);

      // 添加到历史记录
      const historyItem = {
        id: task.id,
        type: 'artwork',
        artwork_id: task.artwork_id,
        artist_name: task.artist_name,
        artwork_title: task.artwork_title,
        download_path: artworkDir,
        total_files: task.total_files,
        completed_files: task.completed_files,
        failed_files: task.failed_files,
        start_time: task.start_time,
        end_time: task.end_time instanceof Date ? task.end_time.toISOString() : task.end_time,
        status: task.status,
      };

      await this.historyManager.addHistoryItem(historyItem);
    } catch (error) {
      logger.error('异步下载执行失败:', error);
      task.status = 'failed';
      task.error = error.message;
      task.end_time = new Date();
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
    }
  }

  /**
   * 执行批量下载
   */
  async executeBatchDownload(task, artworkIds, options) {
    const { concurrent = 3, size = 'original', quality = 'high', format = 'auto' } = options;

    try {
      const results = [];
      const recentCompleted = []; // 最近完成的作品列表

      // 分批下载
      for (let i = 0; i < artworkIds.length; i += concurrent) {
        if (task.status === 'cancelled') {
          break;
        }

        // 检查是否应该暂停
        if (this.shouldPause(task.id)) {
          logger.info('批量下载任务已暂停，停止下载:', task.id);
          break;
        }

        const batch = artworkIds.slice(i, i + concurrent);
        const batchPromises = batch.map(async artworkId => {
          try {
            // 使用专门的批量下载方法，避免创建重复任务
            const downloadResult = await this.downloadService.downloadSingleArtworkForBatch(artworkId, {
              size,
              quality,
              format,
              skipExisting: true
            });

            if (downloadResult.success) {
              // 检查是否跳过下载
              if (downloadResult.skipped) {
                // 跳过下载，不计入失败，但也不计入完成
                const result = { artwork_id: artworkId, success: true, skipped: true };
                results.push(result);
                return result;
              } else {
                // 真正下载成功
                task.completed_files++;
                
                // 添加到最近完成列表
                const completedItem = {
                  artwork_id: artworkId,
                  artwork_title: downloadResult.artwork_title || `作品 ${artworkId}`,
                  artist_name: downloadResult.artist_name || '未知作者'
                };
                
                recentCompleted.unshift(completedItem);
                // 只保留最近5个
                if (recentCompleted.length > 5) {
                  recentCompleted.pop();
                }
                
                // 更新任务的recent_completed
                task.recent_completed = [...recentCompleted];
                
                const result = { artwork_id: artworkId, success: true };
                results.push(result);
                return result;
              }
            } else {
              // 下载失败
              task.failed_files++;
              const result = { artwork_id: artworkId, success: false, error: downloadResult.error };
              results.push(result);
              return result;
            }
          } catch (error) {
            // 异常情况
            task.failed_files++;
            const result = { artwork_id: artworkId, success: false, error: error.message };
            results.push(result);
            return result;
          }
        });

        await Promise.all(batchPromises);

        // 更新进度并通知
        task.progress = Math.round((task.completed_files / task.total_files) * 100);
        await this.taskManager.saveTasks();
        this.progressManager.notifyProgressUpdate(task.id, task);

        // 添加延迟避免请求过于频繁
        if (i + concurrent < artworkIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed_files === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
      
      // 添加到历史记录
      const historyItem = {
        id: task.id,
        type: 'batch',
        total_files: task.total_files,
        completed_files: task.completed_files,
        failed_files: task.failed_files,
        start_time: task.start_time,
        end_time: task.end_time instanceof Date ? task.end_time.toISOString() : task.end_time,
        status: task.status,
      };
      
      await this.historyManager.addHistoryItem(historyItem);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.end_time = new Date();
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
    }
  }

  /**
   * 执行作者作品下载
   */
  async executeArtistDownload(task, newArtworks, options) {
    const { maxConcurrent = 3, size = 'original', quality = 'high', format = 'auto' } = options;

    try {
      const results = [];
      const recentCompleted = []; // 最近完成的作品列表

      // 分批下载作品
      for (let i = 0; i < newArtworks.length; i += maxConcurrent) {
        if (task.status === 'cancelled') {
          break;
        }

        const batch = newArtworks.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async artwork => {
          try {
            // 使用专门的批量下载方法，避免创建重复任务
            const downloadResult = await this.downloadService.downloadSingleArtworkForBatch(artwork.id, {
              size,
              quality,
              format,
              skipExisting: true
            });

            if (downloadResult.success) {
              // 检查是否跳过下载
              if (downloadResult.skipped) {
                // 跳过下载，不计入失败，但也不计入完成
                const result = { artwork_id: artwork.id, success: true, skipped: true };
                results.push(result);
                return result;
              } else {
                // 真正下载成功
                task.completed_files++;
                
                // 添加到最近完成列表
                const completedItem = {
                  artwork_id: artwork.id,
                  artwork_title: downloadResult.artwork_title || artwork.title || `作品 ${artwork.id}`,
                  artist_name: downloadResult.artist_name || artwork.user?.name || '未知作者'
                };
                
                recentCompleted.unshift(completedItem);
                // 只保留最近5个
                if (recentCompleted.length > 5) {
                  recentCompleted.pop();
                }
                
                // 更新任务的recent_completed
                task.recent_completed = [...recentCompleted];
                
                const result = { artwork_id: artwork.id, success: true };
                results.push(result);
                return result;
              }
            } else {
              // 下载失败
              task.failed_files++;
              const result = { artwork_id: artwork.id, success: false, error: downloadResult.error };
              results.push(result);
              return result;
            }
          } catch (error) {
            // 异常情况
            task.failed_files++;
            const result = { artwork_id: artwork.id, success: false, error: error.message };
            results.push(result);
            return result;
          }
        });

        await Promise.all(batchPromises);

        // 更新进度并通知
        task.progress = Math.round((task.completed_files / task.total_files) * 100);
        await this.taskManager.saveTasks();
        this.progressManager.notifyProgressUpdate(task.id, task);

        // 添加延迟避免请求过于频繁
        if (i + maxConcurrent < newArtworks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed_files === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
      
      // 添加到历史记录
      const historyItem = {
        id: task.id,
        type: 'artist',
        artist_name: task.artist_name,
        total_files: task.total_files,
        completed_files: task.completed_files,
        failed_files: task.failed_files,
        start_time: task.start_time,
        end_time: task.end_time instanceof Date ? task.end_time.toISOString() : task.end_time,
        status: task.status,
      };
      
      await this.historyManager.addHistoryItem(historyItem);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.end_time = new Date();
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
    }
  }

  /**
   * 执行排行榜作品下载
   */
  async executeRankingDownload(task, newArtworks, options) {
    const { maxConcurrent = 3, size = 'original', quality = 'high', format = 'auto' } = options;

    try {
      const results = [];
      const recentCompleted = []; // 最近完成的作品列表

      // 分批下载作品
      for (let i = 0; i < newArtworks.length; i += maxConcurrent) {
        if (task.status === 'cancelled') {
          break;
        }

        const batch = newArtworks.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async artwork => {
          try {
            // 使用专门的批量下载方法，避免创建重复任务
            const downloadResult = await this.downloadService.downloadSingleArtworkForBatch(artwork.id, {
              size,
              quality,
              format,
              skipExisting: true
            });

            if (downloadResult.success) {
              // 检查是否跳过下载
              if (downloadResult.skipped) {
                // 跳过下载，不计入失败，但也不计入完成
                const result = { artwork_id: artwork.id, success: true, skipped: true };
                results.push(result);
                return result;
              } else {
                // 真正下载成功
                task.completed_files++;
                
                // 添加到最近完成列表
                const completedItem = {
                  artwork_id: artwork.id,
                  artwork_title: downloadResult.artwork_title || artwork.title || `作品 ${artwork.id}`,
                  artist_name: downloadResult.artist_name || artwork.user?.name || '未知作者'
                };
                
                recentCompleted.unshift(completedItem);
                // 只保留最近5个
                if (recentCompleted.length > 5) {
                  recentCompleted.pop();
                }
                
                // 更新任务的recent_completed
                task.recent_completed = [...recentCompleted];
                
                const result = { artwork_id: artwork.id, success: true };
                results.push(result);
                return result;
              }
            } else {
              // 下载失败
              task.failed_files++;
              const result = { artwork_id: artwork.id, success: false, error: downloadResult.error };
              results.push(result);
              return result;
            }
          } catch (error) {
            // 异常情况
            task.failed_files++;
            const result = { artwork_id: artwork.id, success: false, error: error.message };
            results.push(result);
            return result;
          }
        });

        await Promise.all(batchPromises);

        // 更新进度并通知
        task.progress = Math.round((task.completed_files / task.total_files) * 100);
        await this.taskManager.saveTasks();
        this.progressManager.notifyProgressUpdate(task.id, task);

        // 添加延迟避免请求过于频繁
        if (i + maxConcurrent < newArtworks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed_files === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
      
      // 添加到历史记录
      const historyItem = {
        id: task.id,
        type: 'ranking',
        total_files: task.total_files,
        completed_files: task.completed_files,
        failed_files: task.failed_files,
        start_time: task.start_time,
        end_time: task.end_time instanceof Date ? task.end_time.toISOString() : task.end_time,
        status: task.status,
      };
      
      await this.historyManager.addHistoryItem(historyItem);
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.end_time = new Date();
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
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
   * 恢复暂停的任务
   */
  async resumeTask(taskId) {
    const task = this.taskManager.getTask(taskId);
    if (!task) {
      logger.error('恢复任务失败：任务不存在', { taskId });
      throw new Error('任务不存在');
    }

    // logger.info('下载执行器检查任务状态', { 
    //   taskId, 
    //   currentStatus: task.status,
    //   type: task.type 
    // });

    if (task.status !== 'paused') {
      logger.error('恢复任务失败：任务状态不是暂停状态', { 
        taskId, 
        currentStatus: task.status 
      });
      throw new Error('任务状态不是暂停状态');
    }

    // 根据任务类型重新开始下载
    if (task.type === 'artwork') {
      // logger.info('开始恢复单个作品下载任务', { taskId, artwork_id: task.artwork_id });
      
      // 重新获取作品信息和图片URL
      const artworkResult = await this.downloadService.artworkService.getArtworkDetail(task.artwork_id);
      if (!artworkResult.success) {
        logger.error('获取作品信息失败', { taskId, error: artworkResult.error });
        throw new Error(`获取作品信息失败: ${artworkResult.error}`);
      }

      let imagesResult = await this.downloadService.artworkService.getArtworkImages(task.artwork_id, 'original');
      if (!imagesResult.success) {
        logger.error('获取图片URL失败', { taskId, error: imagesResult.error });
        throw new Error(`获取图片URL失败: ${imagesResult.error}`);
      }

      const artwork = artworkResult.data;
      let images = imagesResult.data.images;
      
      // 创建作品目录（使用与DownloadService相同的逻辑）
      const artistName = this.fileManager.createSafeDirectoryName(artwork.user.name || 'Unknown Artist');
      const artworkTitle = this.fileManager.createSafeDirectoryName(artwork.title || 'Untitled');
      const downloadPath = await this.fileManager.getDownloadPath();
      const artistDir = path.join(downloadPath, artistName);
      const artworkDirName = `${task.artwork_id}_${artworkTitle}`;
      const artworkDir = path.join(artistDir, artworkDirName);

      // logger.info('准备恢复下载，重置任务状态', { 
      //   taskId, 
      //   originalTotalFiles: task.total_files,
      //   newImageCount: images.length,
      //   artworkDir 
      // });

      // 如果新获取的图片数量与原始数量不同，记录警告但使用原始数量
      if (images.length !== task.total_files) {
        logger.warn('恢复时图片数量发生变化', { 
          taskId, 
          originalTotalFiles: task.total_files,
          newImageCount: images.length 
        });
        // 使用原始数量，避免任务状态混乱
        images = images.slice(0, task.total_files);
      }

      // 检查哪些文件已经完成下载
      const completedFiles = [];
      const incompleteFiles = [];
      
      for (let index = 0; index < images.length; index++) {
        const imageObj = images[index];
        let imageUrl = imageObj.original || imageObj.large || imageObj.medium;
        const fileName = `image_${index + 1}.${this.getFileExtension(imageUrl)}`;
        const filePath = path.join(artworkDir, fileName);
        
        // 检查文件是否存在且完整
        if (await this.fileManager.fileExists(filePath)) {
          const integrity = await this.fileManager.checkFileIntegrity(filePath);
          if (integrity.valid) {
            completedFiles.push({ index, fileName, filePath });
          } else {
            incompleteFiles.push({ index, fileName, filePath });
          }
        } else {
          incompleteFiles.push({ index, fileName, filePath });
        }
      }

      // logger.info('文件检查完成', { 
      //   taskId, 
      //   completedCount: completedFiles.length,
      //   incompleteCount: incompleteFiles.length 
      // });

      // 只删除未完成的文件
      for (const fileInfo of incompleteFiles) {
        try {
          await this.fileManager.safeDeleteFile(fileInfo.filePath);
          logger.debug(`删除未完成文件: ${fileInfo.fileName}`);
        } catch (error) {
          // 忽略删除错误，文件可能不存在
          logger.debug(`删除文件失败（可能不存在）: ${fileInfo.filePath}`);
        }
      }

      // 重置任务状态，但保留已完成的文件计数
      task.completed_files = completedFiles.length;
      task.failed_files = 0;
      task.progress = Math.round((task.completed_files / task.total_files) * 100);
      task.status = 'downloading';
      // 添加恢复标志，避免重复计算已完成的文件
      task.isResuming = true;
      await this.taskManager.saveTasks();

      // logger.info('开始执行作品下载', { taskId });

      // 重新开始下载 - 等待异步执行开始
      await this.executeArtworkDownload(task, images, 'original', artworkDir, artwork);
    } else if (task.type === 'batch' || task.type === 'artist') {
      // 批量下载和作者下载的恢复逻辑
      // 这里需要根据具体实现来恢复
      logger.info('恢复批量下载任务:', taskId);
      // TODO: 实现批量下载的恢复逻辑
    }

    logger.info('任务恢复执行完成', { taskId });
    return { success: true };
  }

  /**
   * 检查任务是否应该暂停
   */
  shouldPause(taskId) {
    const task = this.taskManager.getTask(taskId);
    return task && task.status === 'paused';
  }
}

module.exports = DownloadExecutor;
