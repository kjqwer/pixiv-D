const path = require('path');
const fs = require('fs-extra');
const { defaultLogger } = require('../utils/logger');
const abortControllerManager = require('../utils/abort-controller-manager');

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
    
    // 存储每个任务的中断控制器ID（使用管理器）
    this.taskControllerIds = new Set();
  }

  /**
   * 执行单个作品下载
   */
  async executeArtworkDownload(task, images, size, artworkDir, artwork) {
    const controllerId = `task_${task.id}`;
    
    try {
      // 使用管理器创建中断控制器
      const abortController = abortControllerManager.createController(controllerId);
      if (!abortController) {
        throw new Error('无法创建 AbortController，可能已达到数量限制');
      }
      
      this.taskControllerIds.add(controllerId);
      
      const results = [];

      for (let index = 0; index < images.length; index++) {
        if (task.status === 'cancelled') {
          break;
        }

        // 检查是否应该暂停
        if (this.shouldPause(task.id)) {
          logger.info('任务已暂停，停止下载:', task.id);
          // 中断当前下载
          abortControllerManager.abortAndCleanup(controllerId);
          this.taskControllerIds.delete(controllerId);
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
          // 验证文件完整性，传入期望的MIME类型
          const expectedMimeType = this.getMimeTypeFromUrl(imageUrl);
          const integrity = await this.fileManager.checkFileIntegrity(filePath, null, expectedMimeType);
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
            logger.info(`文件不完整，重新下载: ${filePath}, 原因: ${integrity.reason}`);
            await this.fileManager.safeDeleteFile(filePath);
          }
        }

        try {
          // 确保目录存在
          await this.fileManager.ensureDirectory(path.dirname(filePath));

          // 下载文件并等待完成，传入中断控制器
          await this.fileManager.downloadFile(imageUrl, filePath, abortController);

          // 验证下载的文件完整性，传入期望的MIME类型
          const expectedMimeType = this.getMimeTypeFromUrl(imageUrl);
          const integrity = await this.fileManager.checkFileIntegrity(filePath, null, expectedMimeType);
          if (!integrity.valid) {
            // 删除损坏的文件
            await this.fileManager.safeDeleteFile(filePath);
            throw new Error(`文件下载不完整: ${integrity.reason}`);
          }

          task.completed_files++;
          task.progress = Math.round((task.completed_files / task.total_files) * 100);
          await this.taskManager.saveTasks();
          this.progressManager.notifyProgressUpdate(task.id, task);

          results.push({ success: true, file: fileName });
        } catch (error) {
          task.failed_files++;
          logger.error(`下载图片失败 ${index + 1}: ${error.message}`, {
            taskId: task.id,
            imageUrl,
            filePath,
            error: error.stack
          });
          
          // 尝试清理可能存在的损坏文件
          try {
            if (await this.fileManager.fileExists(filePath)) {
              await this.fileManager.safeDeleteFile(filePath);
              logger.debug('已清理损坏的文件', { filePath });
            }
          } catch (cleanupError) {
            logger.warn('清理损坏文件失败', { 
              filePath, 
              error: cleanupError.message 
            });
          }
          
          this.progressManager.notifyProgressUpdate(task.id, task);
          results.push({ success: false, error: error.message, file: fileName });
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

      // 只有在所有文件都成功下载且完整性检查通过时，才更新下载注册表
      if (task.status === 'completed' && task.failed_files === 0 && task.completed_files === task.total_files) {
        // 再次验证所有文件的完整性
        let allFilesValid = true;
        const artworkFiles = await fs.readdir(artworkDir);
        const imageFiles = artworkFiles.filter(file => 
          file.startsWith('image_') && 
          !file.endsWith('.json') && 
          !file.endsWith('.txt')
        );

        for (const imageFile of imageFiles) {
          const filePath = path.join(artworkDir, imageFile);
          const expectedMimeType = this.getMimeTypeFromUrl(imageFile);
          const integrity = await this.fileManager.checkFileIntegrity(filePath, null, expectedMimeType);
          if (!integrity.valid) {
            allFilesValid = false;
            logger.warn('发现不完整文件，不添加到下载注册表', { 
              file: imageFile, 
              reason: integrity.reason 
            });
            break;
          }
        }

        if (allFilesValid && imageFiles.length === task.total_files) {
          try {
            await this.downloadService.downloadRegistry.addArtwork(task.artist_name, task.artwork_id);
            logger.debug('已更新下载注册表', { 
              artistName: task.artist_name, 
              artworkId: task.artwork_id,
              totalFiles: task.total_files,
              completedFiles: task.completed_files
            });
          } catch (error) {
            logger.warn('更新下载注册表失败:', error.message);
          }
        } else {
          logger.warn('文件完整性验证失败或文件数量不匹配，不添加到下载注册表', {
            expectedFiles: task.total_files,
            actualFiles: imageFiles.length,
            allFilesValid
          });
        }
      }

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
    } finally {
      // 确保清理中断控制器
      abortControllerManager.abortAndCleanup(controllerId);
      this.taskControllerIds.delete(controllerId);
    }
  }

  /**
   * 执行批量下载 - 统一的批量下载方法
   * @param {Object} task - 任务对象
   * @param {Array} items - 要下载的项目列表（可以是作品ID数组或作品对象数组）
   * @param {Object} options - 下载选项
   */
  async executeBatchDownload(task, items, options = {}) {
    // 获取动态并发配置
    const concurrentConfig = await this.downloadService.getConcurrentConfig();
    const { 
      concurrent = concurrentConfig.concurrentDownloads,
      maxConcurrent = concurrentConfig.maxConcurrentFiles,
      size = 'original', 
      quality = 'high', 
      format = 'auto' 
    } = options;

    // 使用合适的并发数
    const batchSize = concurrent || maxConcurrent;

    try {
      const results = [];
      const recentCompleted = []; // 最近完成的作品列表

      // 分批下载
      for (let i = 0; i < items.length; i += batchSize) {
        if (task.status === 'cancelled') {
          break;
        }

        // 检查是否应该暂停
        if (this.shouldPause(task.id)) {
          logger.info('批量下载任务已暂停，停止下载:', task.id);
          break;
        }

        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(async item => {
          // 为每个下载添加超时控制，防止单个下载卡住整个批次
          return Promise.race([
            // 实际下载Promise
            (async () => {
              try {
                // 检查是否应该暂停（在每个作品下载前检查）
                if (this.shouldPause(task.id)) {
                  logger.info('批量下载任务已暂停，停止当前作品下载:', task.id);
                  // 设置任务状态为暂停
                  task.status = 'paused';
                  await this.taskManager.saveTasks();
                  this.progressManager.notifyProgressUpdate(task.id, task);
                  return { artwork_id: typeof item === 'object' ? item.id : item, success: false, paused: true };
                }
                
                // 获取作品ID - 支持直接传入ID或作品对象
                const artworkId = typeof item === 'object' ? item.id : item;
                
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
                    // 真正下载成功，立即添加到注册表
                    task.completed_files++;
                    
                    // 立即添加到下载注册表
                    try {
                      await this.downloadService.downloadRegistry.addArtwork(
                        downloadResult.artist_name, 
                        artworkId
                      );
                      logger.debug(`批量下载中的作品 ${artworkId} 已添加到下载注册表`, {
                        artworkId,
                        artistName: downloadResult.artist_name,
                        taskId: task.id
                      });
                    } catch (error) {
                      logger.error(`批量下载中添加作品到注册表失败: ${artworkId}`, {
                        artworkId,
                        artistName: downloadResult.artist_name,
                        taskId: task.id,
                        error: error.message,
                        stack: error.stack
                      });
                    }
                    
                    // 添加到最近完成列表
                    const completedItem = {
                      artwork_id: artworkId,
                      artwork_title: downloadResult.artwork_title || 
                        (typeof item === 'object' ? item.title : null) || 
                        `作品 ${artworkId}`,
                      artist_name: downloadResult.artist_name || 
                        (typeof item === 'object' ? item.user?.name : null) || 
                        '未知作者'
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
                const artworkId = typeof item === 'object' ? item.id : item;
                task.failed_files++;
                const result = { artwork_id: artworkId, success: false, error: error.message };
                results.push(result);
                return result;
              }
            })(),
            // 超时Promise - 防止单个下载卡住整个批次
            new Promise((_, reject) => {
              setTimeout(() => {
                const artworkId = typeof item === 'object' ? item.id : item;
                logger.warn(`作品下载超时，跳过: ${artworkId}`, { taskId: task.id, timeout: '120s' });
                reject(new Error(`下载超时: ${artworkId}`));
              }, 120000); // 2分钟超时
            })
          ]).catch(error => {
            // 处理超时或其他错误
            const artworkId = typeof item === 'object' ? item.id : item;
            task.failed_files++;
            const result = { artwork_id: artworkId, success: false, error: error.message };
            results.push(result);
            return result;
          });
        });

        // 使用 Promise.allSettled 替代 Promise.all，确保不会因为单个Promise卡住而阻塞整个批次
        const batchResults = await Promise.allSettled(batchPromises);
        
        // 处理结果，确保所有Promise都有结果
        batchResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            const artworkId = typeof batch[index] === 'object' ? batch[index].id : batch[index];
            logger.error(`批次中的作品处理失败: ${artworkId}`, { 
              error: result.reason?.message || result.reason,
              taskId: task.id 
            });
            // 确保失败的作品也被计入
            task.failed_files++;
            results.push({ 
              artwork_id: artworkId, 
              success: false, 
              error: result.reason?.message || '未知错误' 
            });
          }
        });

        // 更新进度并通知
        task.progress = Math.round((task.completed_files / task.total_files) * 100);
        await this.taskManager.saveTasks();
        this.progressManager.notifyProgressUpdate(task.id, task);

        // 添加延迟避免请求过于频繁
        if (i + batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 检查任务是否被暂停，如果是则不要更新最终状态
      if (task.status === 'paused') {
        logger.info('批量下载任务已暂停，跳过最终状态更新:', task.id);
        return;
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
        type: task.type, // 使用任务的原始类型
        artist_name: task.artist_name, // 如果是作者下载任务会有这个字段
        artist_id: task.artist_id, // 作者ID
        mode: task.mode, // 如果是排行榜下载任务会有这个字段
        ranking_type: task.ranking_type, // 排行榜类型
        task_description: task.task_description, // 任务描述
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
   * 根据URL获取MIME类型
   * @param {string} url - 图片URL
   * @returns {string} MIME类型
   */
  getMimeTypeFromUrl(url) {
    const ext = this.getFileExtension(url).toLowerCase();
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
          const expectedMimeType = this.getMimeTypeFromUrl(imageUrl);
          const integrity = await this.fileManager.checkFileIntegrity(filePath, null, expectedMimeType);
          if (integrity.valid) {
            completedFiles.push({ index, fileName, filePath });
          } else {
            incompleteFiles.push({ index, fileName, filePath, reason: integrity.reason });
          }
        } else {
          incompleteFiles.push({ index, fileName, filePath, reason: '文件不存在' });
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
      logger.info('恢复批量下载任务:', taskId);
      
      // 重置任务状态为下载中
      task.status = 'downloading';
      task.isResuming = true;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
      
      // 获取原始的作品列表
      const items = task.items || [];
      if (items.length === 0) {
        logger.error('批量下载任务没有作品列表，无法恢复', { taskId });
        throw new Error('批量下载任务没有作品列表，无法恢复');
      }
      
      // 重新开始批量下载
      await this.executeBatchDownload(task, items, {
        size: task.size || 'original',
        quality: task.quality || 'high',
        format: task.format || 'auto',
        concurrent: task.concurrent || 3
      });
    }

    logger.info('任务恢复执行完成', { taskId });
    return { success: true };
  }

  /**
   * 中断指定任务的下载
   * @param {string} taskId - 任务ID
   */
  abortTask(taskId) {
    const controllerId = `task_${taskId}`;
    const success = abortControllerManager.abortAndCleanup(controllerId);
    
    if (success) {
      this.taskControllerIds.delete(controllerId);
      logger.info('中断任务下载', { taskId });
    } else {
      logger.debug('未找到要中断的任务控制器', { taskId });
    }
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
