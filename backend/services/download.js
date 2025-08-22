const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ArtworkService = require('./artwork');
const ArtistService = require('./artist');
const ConfigManager = require('../config/config-manager');

class DownloadService {
  constructor(auth) {
    this.auth = auth;
    this.artworkService = new ArtworkService(auth);
    this.artistService = new ArtistService(auth);
    this.configManager = new ConfigManager();
    
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.dataPath = path.join(process.cwd(), 'data');
    } else {
      // 在开发环境中，使用相对路径
      this.dataPath = path.join(__dirname, '../../data');
    }
    
    this.tasksFile = path.join(this.dataPath, 'download_tasks.json');
    this.historyFile = path.join(this.dataPath, 'download_history.json');
    
    this.tasks = new Map(); // 内存中的任务状态
    this.history = []; // 下载历史
    this.initialized = false;
  }

  /**
   * 获取当前下载路径
   */
  async getDownloadPath() {
    try {
      const config = await this.configManager.readConfig();
      const downloadDir = config.downloadDir || './downloads';
      
      // 如果是相对路径，转换为绝对路径
      return path.isAbsolute(downloadDir) 
        ? downloadDir 
        : path.resolve(process.cwd(), downloadDir);
    } catch (error) {
      console.error('获取下载路径失败:', error);
      // 返回默认路径
      return path.resolve(process.cwd(), 'downloads');
    }
  }

  /**
   * 初始化服务
   */
  async init() {
    try {
      // 确保目录存在
      const downloadPath = await this.getDownloadPath();
      await fs.ensureDir(downloadPath);
      await fs.ensureDir(this.dataPath);
      
      // 加载历史记录
      await this.loadHistory();
      
      // 加载任务状态
      await this.loadTasks();
      
      this.initialized = true;
      console.log('下载服务初始化完成，下载路径:', downloadPath);
    } catch (error) {
      console.error('下载服务初始化失败:', error);
      this.initialized = false;
    }
  }

  /**
   * 加载下载历史
   */
  async loadHistory() {
    try {
      if (await fs.pathExists(this.historyFile)) {
        this.history = await fs.readJson(this.historyFile);
      }
    } catch (error) {
      console.error('加载下载历史失败:', error);
      this.history = [];
    }
  }

  /**
   * 保存下载历史
   */
  async saveHistory() {
    try {
      await fs.writeJson(this.historyFile, this.history, { spaces: 2 });
    } catch (error) {
      console.error('保存下载历史失败:', error);
    }
  }

  /**
   * 加载任务状态
   */
  async loadTasks() {
    try {
      if (await fs.pathExists(this.tasksFile)) {
        const tasksData = await fs.readJson(this.tasksFile);
        // 只加载未完成的任务
        for (const [taskId, task] of Object.entries(tasksData)) {
          if (task.status === 'downloading' || task.status === 'pending') {
            this.tasks.set(taskId, task);
          }
        }
      }
    } catch (error) {
      console.error('加载任务状态失败:', error);
    }
  }

  /**
   * 保存任务状态
   */
  async saveTasks() {
    try {
      const tasksData = {};
      for (const [taskId, task] of this.tasks.entries()) {
        tasksData[taskId] = task;
      }
      await fs.writeJson(this.tasksFile, tasksData, { spaces: 2 });
    } catch (error) {
      console.error('保存任务状态失败:', error);
    }
  }

  /**
   * 获取任务进度
   */
  getTaskProgress(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }
    
    return {
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
      error: task.error
    };
  }

  /**
   * 获取所有任务
   */
  getAllTasks() {
    const tasks = [];
    for (const [taskId, task] of this.tasks.entries()) {
      tasks.push(this.getTaskProgress(taskId));
    }
    return tasks;
  }

  /**
   * 获取下载历史
   */
  getDownloadHistory(limit = 50, offset = 0) {
    return this.history
      .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))
      .slice(offset, offset + limit);
  }

  /**
   * 获取下载的文件列表
   */
  async getDownloadedFiles() {
    try {
      const files = [];
      const downloadPath = await this.getDownloadPath();
      const artists = await fs.readdir(downloadPath);
      
      for (const artist of artists) {
        const artistPath = path.join(downloadPath, artist);
        const artistStat = await fs.stat(artistPath);
        
        if (artistStat.isDirectory()) {
          const artworks = await fs.readdir(artistPath);
          
          for (const artwork of artworks) {
            const artworkPath = path.join(artistPath, artwork);
            const artworkStat = await fs.stat(artworkPath);
            
            if (artworkStat.isDirectory()) {
              const artworkFiles = await fs.readdir(artworkPath);
              const imageFiles = artworkFiles.filter(file => 
                /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
              );
              
              if (imageFiles.length > 0) {
                files.push({
                  artist: artist,
                  artwork: artwork,
                  path: artworkPath,
                  files: imageFiles,
                  total_size: await this.getDirectorySize(artworkPath),
                  created_at: artworkStat.birthtime
                });
              }
            }
          }
        }
      }
      
      return files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.error('获取下载文件列表失败:', error);
      return [];
    }
  }

  /**
   * 检查作品是否已下载
   */
  async isArtworkDownloaded(artworkId) {
    try {
      const downloadPath = await this.getDownloadPath();
      
      // 扫描下载目录查找作品
      const artists = await fs.readdir(downloadPath);
      
      for (const artist of artists) {
        const artistPath = path.join(downloadPath, artist);
        const artistStat = await fs.stat(artistPath);
        
        if (artistStat.isDirectory()) {
          const artworks = await fs.readdir(artistPath);
          
          for (const artwork of artworks) {
            // 检查是否是作品目录（包含数字ID）
            const artworkMatch = artwork.match(/^(\d+)_(.+)$/);
            if (artworkMatch) {
              const foundArtworkId = artworkMatch[1];
              
              if (parseInt(foundArtworkId) === parseInt(artworkId)) {
                // 找到作品目录，检查是否包含图片文件
                const artworkPath = path.join(artistPath, artwork);
                const artworkStat = await fs.stat(artworkPath);
                
                if (artworkStat.isDirectory()) {
                  const files = await fs.readdir(artworkPath);
                  const imageFiles = files.filter(file => 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
                  );
                  return imageFiles.length > 0;
                }
              }
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('检查作品下载状态失败:', error);
      return false;
    }
  }

  /**
   * 获取已下载的作品ID列表
   */
  async getDownloadedArtworkIds() {
    try {
      const downloadedIds = new Set();
      const downloadPath = await this.getDownloadPath();
      
      // 扫描下载目录获取所有已下载的作品ID
      const artists = await fs.readdir(downloadPath);
      
      for (const artist of artists) {
        const artistPath = path.join(downloadPath, artist);
        const artistStat = await fs.stat(artistPath);
        
        if (artistStat.isDirectory()) {
          const artworks = await fs.readdir(artistPath);
          
          for (const artwork of artworks) {
            // 检查是否是作品目录（包含数字ID）
            const artworkMatch = artwork.match(/^(\d+)_(.+)$/);
            if (artworkMatch) {
              const artworkId = artworkMatch[1];
              
              // 检查作品目录是否包含图片文件
              const artworkPath = path.join(artistPath, artwork);
              const artworkStat = await fs.stat(artworkPath);
              
              if (artworkStat.isDirectory()) {
                const files = await fs.readdir(artworkPath);
                const imageFiles = files.filter(file => 
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
                );
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
      console.error('获取已下载作品ID列表失败:', error);
      return [];
    }
  }

  /**
   * 获取目录大小
   */
  async getDirectorySize(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          totalSize += stat.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 删除下载的文件
   */
  async deleteDownloadedFiles(artist, artwork) {
    try {
      const downloadPath = await this.getDownloadPath();
      const targetPath = path.join(downloadPath, artist, artwork);
      if (await fs.pathExists(targetPath)) {
        await fs.remove(targetPath);
        
        // 从历史记录中移除
        this.history = this.history.filter(item => 
          !(item.artist_name === artist && item.artwork_title === artwork)
        );
        await this.saveHistory();
        
        return { success: true };
      }
      return { success: false, error: '文件不存在' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 取消下载任务
   */
  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }
    
    if (task.status === 'completed' || task.status === 'failed') {
      return { success: false, error: '任务已完成，无法取消' };
    }
    
    task.status = 'cancelled';
    task.end_time = new Date();
    await this.saveTasks();
    
    return { success: true };
  }

  /**
   * 下载单个作品
   */
  async downloadArtwork(artworkId, options = {}) {
    const taskId = uuidv4();
    const { size = 'original', quality = 'high', format = 'auto', skipExisting = true } = options;
    
    try {
      // 检查是否已下载
      if (skipExisting && await this.isArtworkDownloaded(artworkId)) {
        console.log(`作品 ${artworkId} 已存在，跳过下载`);
        return {
          success: true,
          data: {
            task_id: taskId,
            artwork_id: artworkId,
            skipped: true,
            message: '作品已存在，跳过下载'
          }
        };
      }

      // 创建任务记录
      const task = {
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
        end_time: null,
        error: null
      };
      
      this.tasks.set(taskId, task);
      await this.saveTasks();

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
      
      const artistName = (artwork.user.name || 'Unknown Artist').replace(/[<>:"/\\|?*]/g, '_');
      const artworkTitle = (artwork.title || 'Untitled').replace(/[<>:"/\\|?*]/g, '_');
      
      // 创建作品目录 - 使用仓库管理格式
      const downloadPath = await this.getDownloadPath();
      const artistDir = path.join(downloadPath, artistName);
      const artworkDirName = `${artworkId}_${artworkTitle}`;
      const artworkDir = path.join(artistDir, artworkDirName);
      await fs.ensureDir(artworkDir);

      // 获取图片URL
      const imagesResult = await this.artworkService.getArtworkImages(artworkId, size);
      if (!imagesResult.success) {
        throw new Error(`获取图片URL失败: ${imagesResult.error}`);
      }

      const images = imagesResult.data.images;
      task.total = images.length;

      // 下载所有图片
      const downloadPromises = images.map(async (image, index) => {
        if (task.status === 'cancelled') {
          return { success: false, error: '任务已取消' };
        }
        
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
            size: size,
            filename: fileName
          });

          await this.saveTasks();
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
      await this.saveTasks();

      // 添加到历史记录
      const historyItem = {
        id: taskId,
        type: 'artwork',
        artwork_id: artworkId,
        artist_name: artistName,
        artwork_title: artworkTitle,
        download_path: artworkDir,
        total_files: task.total,
        completed_files: task.completed,
        failed_files: task.failed,
        files: task.files,
        start_time: task.start_time,
        end_time: task.end_time,
        status: task.status
      };
      
      this.history.unshift(historyItem);
      await this.saveHistory();
      
      console.log('下载完成，历史记录已保存:', {
        taskId,
        historyLength: this.history.length,
        tasksCount: this.tasks.size
      });

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
        task.error = error.message;
        task.end_time = new Date();
        await this.saveTasks();
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(url, filePath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'Referer': 'https://www.pixiv.net/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
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
    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    return match ? `.${match[1]}` : '.jpg';
  }

  /**
   * 批量下载作品
   */
  async downloadMultipleArtworks(artworkIds, options = {}) {
    const taskId = uuidv4();
    const { concurrent = 3, size = 'original', quality = 'high', format = 'auto', skipExisting = true } = options;
    
    try {
      // 检查重复下载
      let filteredIds = artworkIds;
      let skippedCount = 0;
      
      if (skipExisting) {
        const downloadedIds = await this.getDownloadedArtworkIds();
        const downloadedSet = new Set(downloadedIds);
        
        filteredIds = artworkIds.filter(id => !downloadedSet.has(id));
        skippedCount = artworkIds.length - filteredIds.length;
        
        console.log(`批量下载: 总共 ${artworkIds.length} 个作品，跳过 ${skippedCount} 个已下载的作品，需要下载 ${filteredIds.length} 个作品`);
      }

      // 创建任务记录
      const task = {
        id: taskId,
        type: 'batch',
        artwork_ids: artworkIds,
        filtered_ids: filteredIds,
        status: 'downloading',
        progress: 0,
        total: filteredIds.length,
        completed: 0,
        failed: 0,
        skipped: skippedCount,
        results: [],
        start_time: new Date(),
        end_time: null,
        error: null
      };
      
      this.tasks.set(taskId, task);
      await this.saveTasks();

      const results = [];

      // 如果没有需要下载的作品，直接返回
      if (filteredIds.length === 0) {
        task.status = 'completed';
        task.end_time = new Date();
        await this.saveTasks();
        
        return {
          success: true,
          data: {
            task_id: taskId,
            total_artworks: artworkIds.length,
            completed_artworks: 0,
            failed_artworks: 0,
            skipped_artworks: skippedCount,
            message: '所有作品都已下载完成'
          }
        };
      }

      // 分批下载
      for (let i = 0; i < filteredIds.length; i += concurrent) {
        if (task.status === 'cancelled') {
          break;
        }
        
        const batch = filteredIds.slice(i, i + concurrent);
        const batchPromises = batch.map(async (artworkId) => {
          try {
            const result = await this.downloadArtwork(artworkId, { size, quality, format, skipExisting: false });
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
        await this.saveTasks();
        
        // 添加延迟避免请求过于频繁
        if (i + concurrent < filteredIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.saveTasks();

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
        task.error = error.message;
        task.end_time = new Date();
        await this.saveTasks();
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
      limit = 50, 
      size = 'original', 
      quality = 'high', 
      format = 'auto',
      skipExisting = true,
      maxConcurrent = 3,
      pageSize = 30
    } = options;
    
    try {
      // 创建任务记录
      const task = {
        id: taskId,
        type: 'artist',
        artist_id: artistId,
        status: 'downloading',
        progress: 0,
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        results: [],
        start_time: new Date(),
        end_time: null,
        error: null
      };
      
      this.tasks.set(taskId, task);
      await this.saveTasks();

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
          limit: Math.min(pageSize, limit - allArtworks.length)
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
      const newArtworks = skipExisting 
        ? allArtworks.filter(artwork => !downloadedSet.has(artwork.id))
        : allArtworks;
      
      const skippedCount = allArtworks.length - newArtworks.length;
      task.skipped = skippedCount;
      task.total = newArtworks.length;
      await this.saveTasks();

      console.log(`作者作品下载: 总共 ${allArtworks.length} 个作品，跳过 ${skippedCount} 个已下载的作品，需要下载 ${newArtworks.length} 个作品`);

      // 如果没有需要下载的作品，直接返回
      if (newArtworks.length === 0) {
        task.status = 'completed';
        task.end_time = new Date();
        await this.saveTasks();
        
        return {
          success: true,
          data: {
            task_id: taskId,
            artist_id: artistId,
            total_artworks: allArtworks.length,
            completed_artworks: 0,
            failed_artworks: 0,
            skipped_artworks: skippedCount,
            message: '所有作品都已下载完成'
          }
        };
      }

      const results = [];

      // 分批下载作品
      for (let i = 0; i < newArtworks.length; i += maxConcurrent) {
        if (task.status === 'cancelled') {
          break;
        }
        
        const batch = newArtworks.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (artwork) => {
          try {
            const result = await this.downloadArtwork(artwork.id, { size, quality, format, skipExisting: false });
            task.completed++;
            results.push({ artwork_id: artwork.id, ...result });
            return result;
          } catch (error) {
            task.failed++;
            results.push({ artwork_id: artwork.id, success: false, error: error.message });
            return { success: false, error: error.message };
          }
        });

        await Promise.all(batchPromises);
        task.progress = Math.round((task.completed / task.total) * 100);
        await this.saveTasks();
        
        // 添加延迟避免请求过于频繁
        if (i + maxConcurrent < newArtworks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 更新任务状态
      task.status = task.failed === 0 ? 'completed' : 'partial';
      task.end_time = new Date();
      task.results = results;
      await this.saveTasks();

      return {
        success: true,
        data: {
          task_id: taskId,
          artist_id: artistId,
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
        task.error = error.message;
        task.end_time = new Date();
        await this.saveTasks();
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DownloadService; 