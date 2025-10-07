import apiService, { getApiBaseUrl } from './api';
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
   * 获取活跃任务（下载中或暂停）
   */
  async getActiveTasks() {
    return apiService.get('/api/download/tasks/active');
  }

  /**
   * 获取任务摘要（用于快速状态检查）
   */
  async getTasksSummary() {
    return apiService.get('/api/download/tasks/summary');
  }

  /**
   * 获取任务变更（增量更新）
   */
  async getTasksChanges(since?: number) {
    const params = since ? { since } : {};
    return apiService.get('/api/download/tasks/changes', { params });
  }

  /**
   * 获取已完成任务（分页）
   */
  async getCompletedTasks(offset = 0, limit = 50) {
    return apiService.get('/api/download/tasks/completed', { 
      params: { offset, limit } 
    });
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
   * 暂停批量下载任务
   */
  async pauseBatchTask(taskId: string) {
    return apiService.post(`/api/download/batch/pause/${taskId}`);
  }

  /**
   * 恢复批量下载任务
   */
  async resumeBatchTask(taskId: string) {
    return apiService.post(`/api/download/batch/resume/${taskId}`);
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
   * 清理历史记录
   */
  async cleanupHistory(keepCount = 500) {
    return apiService.post('/api/download/cleanup/history', { keepCount });
  }

  /**
   * 清理已完成的任务
   */
  async cleanupTasks(keepActive = true, keepCompleted = 100) {
    return apiService.post('/api/download/cleanup/tasks', { keepActive, keepCompleted });
  }

  /**
   * 获取系统统计信息
   */
  async getSystemStats() {
    return apiService.get('/api/download/stats');
  }

  /**
   * 使用SSE监听下载进度
   */
  streamTaskProgress(taskId: string, onProgress: (task: DownloadTask) => void, onComplete?: () => void) {
    const eventSource = new EventSource(`${getApiBaseUrl()}/api/download/stream/${taskId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 处理不同类型的SSE消息
        if (data.type === 'connected') {
          // console.log('SSE连接已建立:', data.taskId);
        } else if (data.type === 'progress') {
          // 新的数据格式：data.task 包含任务信息
          if (data.task) {
            onProgress(data.task);
          }
        } else if (data.type === 'completed') {
          // 任务完成
          console.log('任务完成:', data.status);
          if (onComplete) {
            onComplete();
          }
          eventSource.close();
        } else if (data.type === 'timeout') {
          // 连接超时
          console.warn('SSE连接超时');
          if (onComplete) {
            onComplete();
          }
          eventSource.close();
        } else if (data.type === 'heartbeat') {
          // 心跳消息，不需要处理
          console.debug('收到SSE心跳');
        } else if (data.type === 'complete') {
          // 兼容旧格式
          if (data.data) {
            onProgress(data.data);
          }
          if (onComplete) {
            onComplete();
          }
          eventSource.close();
        }
      } catch (error) {
        console.error('解析SSE数据失败:', error, 'Raw data:', event.data);
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
  /**
   * 获取下载注册表统计信息
   */
  async getRegistryStats() {
    return apiService.get('/api/download/registry/stats');
  }

  /**
   * 导出下载注册表
   */
  async exportRegistry() {
    return apiService.get('/api/download/registry/export');
  }

  /**
   * 导入下载注册表
   */
  async importRegistry(registryData: any) {
    return apiService.post('/api/download/registry/import', { registryData });
  }

  /**
   * 重建下载注册表（异步任务）
   */
  async rebuildRegistry() {
    return apiService.post('/api/download/registry/rebuild');
  }

  /**
   * 获取注册表重建任务状态
   */
  async getRegistryRebuildStatus(taskId: string) {
    return apiService.get(`/api/download/registry/rebuild/status/${taskId}`);
  }

  /**
   * 取消注册表重建任务
   */
  async cancelRegistryRebuild(taskId: string) {
    return apiService.delete(`/api/download/registry/rebuild/${taskId}`);
  }

  /**
   * 清理下载注册表
   */
  async cleanupRegistry() {
    return apiService.post('/api/download/registry/cleanup');
  }
}

export default new DownloadService();