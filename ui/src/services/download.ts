import apiService from './api';
import type { ApiResponse, DownloadTask, DownloadParams } from '@/types';

export interface DownloadArtworkRequest extends DownloadParams {
  size?: 'original' | 'large' | 'medium' | 'square_medium';
  quality?: 'high' | 'medium' | 'low';
  format?: 'auto' | 'jpg' | 'png';
}

export interface DownloadMultipleRequest extends DownloadParams {
  artworkIds: number[];
  concurrent?: number;
}

export interface DownloadArtistRequest extends DownloadParams {
  type?: 'art' | 'manga' | 'novel';
  filter?: 'for_ios' | 'for_android';
  limit?: number;
}

class DownloadService {
  /**
   * 下载单个作品
   */
  async downloadArtwork(id: number, params: DownloadArtworkRequest = {}): Promise<ApiResponse<any>> {
    return apiService.post(`/api/download/artwork/${id}`, params);
  }

  /**
   * 批量下载作品
   */
  async downloadMultipleArtworks(params: DownloadMultipleRequest): Promise<ApiResponse<any>> {
    return apiService.post('/api/download/artworks', params);
  }

  /**
   * 下载作者作品
   */
  async downloadArtistArtworks(id: number, params: DownloadArtistRequest = {}): Promise<ApiResponse<any>> {
    return apiService.post(`/api/download/artist/${id}`, params);
  }

  /**
   * 获取下载进度
   */
  async getDownloadProgress(taskId: string): Promise<ApiResponse<DownloadTask>> {
    return apiService.get<DownloadTask>(`/api/download/progress/${taskId}`);
  }

  /**
   * 取消下载任务
   */
  async cancelDownload(taskId: string): Promise<ApiResponse> {
    return apiService.delete(`/api/download/cancel/${taskId}`);
  }

  /**
   * 获取下载历史
   */
  async getDownloadHistory(offset: number = 0, limit: number = 20): Promise<ApiResponse<{ tasks: DownloadTask[]; total: number; offset: number; limit: number }>> {
    return apiService.get<{ tasks: DownloadTask[]; total: number; offset: number; limit: number }>(`/api/download/history?offset=${offset}&limit=${limit}`);
  }
}

export const downloadService = new DownloadService();
export default downloadService; 