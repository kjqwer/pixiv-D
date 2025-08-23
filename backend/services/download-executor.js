const fs = require('fs-extra');
const path = require('path');

/**
 * 下载执行器 - 负责具体的下载逻辑执行
 */
class DownloadExecutor {
  constructor(fileManager, taskManager, progressManager, historyManager) {
    this.fileManager = fileManager;
    this.taskManager = taskManager;
    this.progressManager = progressManager;
    this.historyManager = historyManager;
  }

  /**
   * 执行单个作品下载
   */
  async executeArtworkDownload(task, images, size, artworkDir, artwork) {
    try {
      // 检查哪些文件已经存在（断点续传）
      const existingFiles = new Set();
      if (await this.fileManager.directoryExists(artworkDir)) {
        const files = await this.fileManager.listDirectory(artworkDir);
        for (const file of files) {
          if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
            existingFiles.add(file);
          }
        }
      }

      // 逐个下载图片，实时更新进度
      const results = [];
      for (let index = 0; index < images.length; index++) {
        if (task.status === 'cancelled') {
          break;
        }
        
        const image = images[index];
        const imageUrl = image[size] || image.original;
        const fileName = `${artwork.title || 'Untitled'}_${artwork.id}_${index + 1}${this.fileManager.getFileExtension(imageUrl)}`;
        const filePath = path.join(artworkDir, fileName);

        // 如果文件已存在，跳过下载
        if (existingFiles.has(fileName)) {
          task.completed_files++;
          task.progress = Math.round((task.completed_files / task.total_files) * 100);
          await this.taskManager.saveTasks();
          this.progressManager.notifyProgressUpdate(task.id, task);
          results.push({ success: true, file: fileName, skipped: true });
          continue;
        }
        
        try {
          await this.fileManager.downloadFile(imageUrl, filePath);
          
          task.completed_files++;
          task.progress = Math.round((task.completed_files / task.total_files) * 100);
          await this.taskManager.saveTasks();
          this.progressManager.notifyProgressUpdate(task.id, task);
          
          results.push({ success: true, file: fileName });
        } catch (error) {
          task.failed_files++;
          console.error(`下载图片失败 ${index + 1}:`, error.message);
          this.progressManager.notifyProgressUpdate(task.id, task);
          results.push({ success: false, error: error.message });
        }
      }

      // 保存作品信息
      const infoPath = path.join(artworkDir, 'artwork_info.json');
      await fs.writeJson(infoPath, artwork, { spaces: 2 });

      // 更新任务状态
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
        end_time: task.end_time,
        status: task.status
      };
      
      await this.historyManager.addHistoryItem(historyItem);
      
      console.log('下载完成，历史记录已保存:', {
        taskId: task.id,
        historyLength: this.historyManager.history.length,
        tasksCount: this.taskManager.tasks.size
      });

    } catch (error) {
      console.error('异步下载执行失败:', error);
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

      // 分批下载
      for (let i = 0; i < task.filtered_ids.length; i += concurrent) {
        if (task.status === 'cancelled') {
          break;
        }
        
        const batch = task.filtered_ids.slice(i, i + concurrent);
        const batchPromises = batch.map(async (artworkId) => {
          try {
            // 这里需要调用主下载服务的方法，暂时返回模拟结果
            task.completed++;
            const result = { artwork_id: artworkId, success: true };
            results.push(result);
            return result;
          } catch (error) {
            task.failed++;
            const result = { artwork_id: artworkId, success: false, error: error.message };
            results.push(result);
            return result;
          }
        });

        await Promise.all(batchPromises);
        task.progress = Math.round((task.completed / task.total) * 100);
        await this.taskManager.saveTasks();
        this.progressManager.notifyProgressUpdate(task.id, task);
        
        // 添加延迟避免请求过于频繁
        if (i + concurrent < task.filtered_ids.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);

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

      // 分批下载作品
      for (let i = 0; i < newArtworks.length; i += maxConcurrent) {
        if (task.status === 'cancelled') {
          break;
        }
        
        const batch = newArtworks.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (artwork) => {
          try {
            // 这里需要调用主下载服务的方法，暂时返回模拟结果
            task.completed++;
            const result = { artwork_id: artwork.id, success: true };
            results.push(result);
            return result;
          } catch (error) {
            task.failed++;
            const result = { artwork_id: artwork.id, success: false, error: error.message };
            results.push(result);
            return result;
          }
        });

        await Promise.all(batchPromises);
        task.progress = Math.round((task.completed / task.total) * 100);
        await this.taskManager.saveTasks();
        this.progressManager.notifyProgressUpdate(task.id, task);
        
        // 添加延迟避免请求过于频繁
        if (i + maxConcurrent < newArtworks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);

    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.end_time = new Date();
      await this.taskManager.saveTasks();
      this.progressManager.notifyProgressUpdate(task.id, task);
    }
  }
}

module.exports = DownloadExecutor; 