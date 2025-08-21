const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ArtworkService = require('./artwork');
const ArtistService = require('./artist');

class DownloadService {
  constructor(auth) {
    this.auth = auth;
    this.artworkService = new ArtworkService(auth);
    this.artistService = new ArtistService(auth);
    this.downloadPath = path.join(__dirname, '../../downloads');
    this.tasks = new Map(); // 存储下载任务状态
    
    // 确保下载目录存在
    this.ensureDownloadDir();
  }

  /**
   * 确保下载目录存在
   */
  async ensureDownloadDir() {
    try {
      await fs.ensureDir(this.downloadPath);
      console.log('下载目录已创建:', this.downloadPath);
    } catch (error) {
      console.error('创建下载目录失败:', error);
    }
  }

  /**
   * 下载单个作品
   */
  async downloadArtwork(artworkId, options = {}) {
    const taskId = uuidv4();
    const { size = 'original', quality = 'high', format = 'auto' } = options;
    
    try {
      // 创建任务记录
      this.tasks.set(taskId, {
        id: taskId,
        type: 'artwork',
        artwork_id: artworkId,
        status: 'downloading',
        progress: 0,
        total: 1,
        completed: 0,
        failed: 0,
        files: [],
        start_time: new Date(),
        end_time: null
      });

      // 获取作品信息
      const artworkResult = await this.artworkService.getArtworkDetail(artworkId);
      if (!artworkResult.success) {
        throw new Error(`获取作品信息失败: ${artworkResult.error}`);
      }

      const artwork = artworkResult.data;
      const artistName = artwork.user.name.replace(/[<>:"/\\|?*]/g, '_');
      const artworkTitle = artwork.title.replace(/[<>:"/\\|?*]/g, '_');
      
      // 创建作品目录
      const artworkDir = path.join(this.downloadPath, `${artistName}_${artworkId}`, artworkTitle);
      await fs.ensureDir(artworkDir);

      // 获取图片URL
      const imagesResult = await this.artworkService.getArtworkImages(artworkId, size);
      if (!imagesResult.success) {
        throw new Error(`获取图片URL失败: ${imagesResult.error}`);
      }

      const images = imagesResult.data.images;
      const task = this.tasks.get(taskId);
      task.total = images.length;

      // 下载所有图片
      const downloadPromises = images.map(async (image, index) => {
        try {
          const imageUrl = image[size] || image.original;
          const fileExt = this.getFileExtension(imageUrl);
          const fileName = `${artworkTitle}_${artworkId}_${index + 1}${fileExt}`;
          const filePath = path.join(artworkDir, fileName);

          await this.downloadFile(imageUrl, filePath);
          
          task.completed++;
          task.progress = Math.round((task.completed / task.total) * 100);
          task.files.push({
            path: filePath,
            url: imageUrl,
            size: size
          });

          return { success: true, file: fileName };
        } catch (error) {
          task.failed++;
          console.error(`下载图片失败 ${index + 1}:`, error.message);
          return { success: false, error: error.message };
        }
      });

      await Promise.all(downloadPromises);

      // 保存作品信息
      const infoPath = path.join(artworkDir, 'artwork_info.json');
      await fs.writeJson(infoPath, artwork, { spaces: 2 });

      // 更新任务状态
      task.status = task.failed === 0 ? 'completed' : 'partial';
      task.end_time = new Date();

      return {
        success: true,
        data: {
          task_id: taskId,
          artwork_id: artworkId,
          artist_name: artistName,
          artwork_title: artworkTitle,
          download_path: artworkDir,
          total_files: task.total,
          completed_files: task.completed,
          failed_files: task.failed,
          files: task.files
        }
      };

    } catch (error) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.end_time = new Date();
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量下载作品
   */
  async downloadMultipleArtworks(artworkIds, options = {}) {
    const taskId = uuidv4();
    const { concurrent = 3, size = 'original', quality = 'high', format = 'auto' } = options;
    
    try {
      // 创建任务记录
      this.tasks.set(taskId, {
        id: taskId,
        type: 'batch',
        artwork_ids: artworkIds,
        status: 'downloading',
        progress: 0,
        total: artworkIds.length,
        completed: 0,
        failed: 0,
        results: [],
        start_time: new Date(),
        end_time: null
      });

      const task = this.tasks.get(taskId);
      const results = [];

      // 分批下载
      for (let i = 0; i < artworkIds.length; i += concurrent) {
        const batch = artworkIds.slice(i, i + concurrent);
        const batchPromises = batch.map(async (artworkId) => {
          try {
            const result = await this.downloadArtwork(artworkId, { size, quality, format });
            task.completed++;
            results.push({ artwork_id: artworkId, ...result });
            return result;
          } catch (error) {
            task.failed++;
            results.push({ artwork_id: artworkId, success: false, error: error.message });
            return { success: false, error: error.message };
          }
        });

        await Promise.all(batchPromises);
        task.progress = Math.round((task.completed / task.total) * 100);
      }

      // 更新任务状态
      task.status = task.failed === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;

      return {
        success: true,
        data: {
          task_id: taskId,
          total_artworks: task.total,
          completed_artworks: task.completed,
          failed_artworks: task.failed,
          results: results
        }
      };

    } catch (error) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.end_time = new Date();
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 下载作者作品
   */
  async downloadArtistArtworks(artistId, options = {}) {
    const taskId = uuidv4();
    const {
      type = 'art',
      filter = 'for_ios',
      size = 'original',
      quality = 'high',
      format = 'auto',
      limit = 50,
      concurrent = 3
    } = options;

    try {
      // 获取作者信息
      const artistResult = await this.artistService.getArtistInfo(artistId);
      if (!artistResult.success) {
        throw new Error(`获取作者信息失败: ${artistResult.error}`);
      }

      const artist = artistResult.data;
      const artistName = artist.name.replace(/[<>:"/\\|?*]/g, '_');

      // 获取作者作品列表
      const artworksResult = await this.artistService.getArtistArtworks(artistId, {
        type,
        filter,
        limit
      });

      if (!artworksResult.success) {
        throw new Error(`获取作者作品列表失败: ${artworksResult.error}`);
      }

      const artworks = artworksResult.data.artworks;
      const artworkIds = artworks.map(artwork => artwork.id);

      // 创建任务记录
      this.tasks.set(taskId, {
        id: taskId,
        type: 'artist',
        artist_id: artistId,
        artist_name: artistName,
        status: 'downloading',
        progress: 0,
        total: artworkIds.length,
        completed: 0,
        failed: 0,
        results: [],
        start_time: new Date(),
        end_time: null
      });

      // 批量下载作品
      const batchResult = await this.downloadMultipleArtworks(artworkIds, {
        concurrent,
        size,
        quality,
        format
      });

      if (batchResult.success) {
        const task = this.tasks.get(taskId);
        task.status = batchResult.data.failed_artworks === 0 ? 'completed' : 'partial';
        task.end_time = new Date();
        task.results = batchResult.data.results;

        return {
          success: true,
          data: {
            task_id: taskId,
            artist_id: artistId,
            artist_name: artistName,
            total_artworks: batchResult.data.total_artworks,
            completed_artworks: batchResult.data.completed_artworks,
            failed_artworks: batchResult.data.failed_artworks,
            results: batchResult.data.results
          }
        };
      } else {
        throw new Error(batchResult.error);
      }

    } catch (error) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.end_time = new Date();
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取下载进度
   */
  async getDownloadProgress(taskId) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }

    return {
      success: true,
      data: {
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        total: task.total,
        completed: task.completed,
        failed: task.failed,
        start_time: task.start_time,
        end_time: task.end_time,
        files: task.files || [],
        results: task.results || []
      }
    };
  }

  /**
   * 取消下载任务
   */
  async cancelDownload(taskId) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return {
        success: false,
        error: 'Task not found'
      };
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return {
        success: false,
        error: 'Task already finished'
      };
    }

    task.status = 'cancelled';
    task.end_time = new Date();

    return {
      success: true,
      message: 'Download task cancelled successfully'
    };
  }

  /**
   * 获取下载历史
   */
  async getDownloadHistory(options = {}) {
    const { offset = 0, limit = 20 } = options;
    
    try {
      const tasks = Array.from(this.tasks.values())
        .filter(task => task.status === 'completed' || task.status === 'partial')
        .sort((a, b) => b.end_time - a.end_time)
        .slice(offset, offset + limit);

      return {
        success: true,
        data: {
          tasks: tasks,
          total: this.tasks.size,
          offset,
          limit
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 下载单个文件
   */
  async downloadFile(url, filePath) {
    const headers = {
      'Referer': 'https://app-api.pixiv.net/',
      'User-Agent': 'PixivAndroidApp/5.0.234 (Android 9.0; Pixel 3)'
    };

    const response = await axios({
      method: 'GET',
      url: url,
      headers,
      responseType: 'stream',
      timeout: 60000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? `.${match[1]}` : '.jpg';
  }
}

module.exports = DownloadService; 