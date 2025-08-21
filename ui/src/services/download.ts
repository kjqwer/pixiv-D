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
  } = {}) {
    return apiService.post(`/api/download/artwork/${artworkId}`, options);
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
   * 取消下载任务
   */
  async cancelTask(taskId: string) {
    return apiService.post(`/api/download/cancel/${taskId}`);
  }

  /**
   * 获取下载历史
   */
  async getDownloadHistory(limit: number = 50, offset: number = 0) {
    return apiService.get('/api/download/history', {
      params: { limit, offset }
    });
  }

  /**
   * 获取下载的文件列表
   */
  async getDownloadedFiles() {
    return apiService.get('/api/download/files');
  }

  /**
   * 检查作品是否已下载
   */
  async checkArtworkDownloaded(artworkId: number) {
    return apiService.get(`/api/download/check/${artworkId}`);
  }

  /**
   * 获取已下载的作品ID列表
   */
  async getDownloadedArtworkIds() {
    return apiService.get('/api/download/downloaded-ids');
  }

  /**
   * 删除下载的文件
   */
  async deleteDownloadedFiles(artist: string, artwork: string) {
    return apiService.delete('/api/download/files', {
      data: { artist, artwork }
    });
  }
}

export default new DownloadService(); 