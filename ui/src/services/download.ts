import apiService from './api';
import type { DownloadTask } from '@/types';

class DownloadService {
  /**
   * 下载单个作品
   */
  async downloadArtwork(artworkId: number, options: {
    size?: string;
    quality?: string;
    format?: string;
    skipExisting?: boolean;
  } = {}) {
    return apiService.post(`/api/download/artwork/${artworkId}`, options);
  }

  /**
   * 获取任务进度
   */
  async getTaskProgress(taskId: string) {
    return apiService.get(`/api/download/progress/${taskId}`);
  }

  /**
   * 获取所有任务
   */
  async getAllTasks() {
    return apiService.get('/api/download/tasks');
  }

  /**
   * 暂停任务
   */
  async pauseTask(taskId: string) {
    return apiService.post(`/api/download/pause/${taskId}`);
  }

  /**
   * 恢复任务
   */
  async resumeTask(taskId: string) {
    return apiService.post(`/api/download/resume/${taskId}`);
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string) {
    return apiService.delete(`/api/download/cancel/${taskId}`);
  }

  /**
   * 获取下载历史
   */
  async getDownloadHistory(offset = 0, limit = 50) {
    return apiService.get('/api/download/history', { params: { offset, limit } });
  }

  /**
   * 检查作品是否已下载
   */
  async checkArtworkDownloaded(artworkId: number) {
    return apiService.get(`/api/download/check/${artworkId}`);
  }

  /**
   * 批量下载作品
   */
  async downloadMultipleArtworks(artworkIds: number[], options: {
    size?: string;
    quality?: string;
    format?: string;
    concurrent?: number;
  } = {}) {
    return apiService.post('/api/download/artworks', {
      artworkIds,
      ...options
    });
  }

  /**
   * 下载作者作品
   */
  async downloadArtistArtworks(artistId: number, options: {
    type?: string;
    limit?: number;
    size?: string;
    quality?: string;
    format?: string;
  } = {}) {
    return apiService.post(`/api/download/artist/${artistId}`, options);
  }

  /**
   * 下载排行榜作品
   */
  async downloadRankingArtworks(options: {
    mode: 'day' | 'week' | 'month';
    type: 'art' | 'manga' | 'novel';
    limit?: number;
    size?: string;
    quality?: string;
    format?: string;
  }) {
    return apiService.post('/api/download/ranking', options);
  }

  /**
   * 获取已下载的文件列表
   */
  async getDownloadedFiles() {
    return apiService.get('/api/download/files');
  }

  /**
   * 删除下载的文件
   */
  async deleteDownloadedFiles(artist: string, artwork: string) {
    return apiService.delete('/api/download/files', {
      data: { artist, artwork }
    });
  }

  /**
   * 获取已下载的作品ID列表
   */
  async getDownloadedArtworkIds() {
    return apiService.get('/api/download/downloaded-ids');
  }

  /**
   * 使用SSE监听下载进度
   */
  streamTaskProgress(taskId: string, onProgress: (task: DownloadTask) => void, onComplete?: () => void) {
    const eventSource = new EventSource(`http://localhost:3000/api/download/stream/${taskId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          onProgress(data.data);
        } else if (data.type === 'complete') {
          onProgress(data.data);
          if (onComplete) {
            onComplete();
          }
          eventSource.close();
        }
      } catch (error) {
        console.error('解析SSE数据失败:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      eventSource.close();
    };

    // 返回关闭函数
    return () => {
      eventSource.close();
    };
  }
}

export default new DownloadService(); 