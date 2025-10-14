import { apiService } from './api';
import type { ApiResponse } from '@/types';

// 待看名单项目接口
export interface WatchlistItem {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// 添加项目的参数接口
export interface AddWatchlistItemParams {
  url: string;
  title?: string;
}

// 更新项目的参数接口
export interface UpdateWatchlistItemParams {
  title?: string;
  url?: string;
}

// 存储配置接口
export interface WatchlistConfig {
  storageMode: 'json' | 'database';
}

class WatchlistService {
  /**
   * 获取所有待看项目
   */
  async getItems(): Promise<ApiResponse<WatchlistItem[]>> {
    return apiService.get<WatchlistItem[]>('/api/watchlist');
  }

  /**
   * 添加待看项目
   */
  async addItem(params: AddWatchlistItemParams): Promise<ApiResponse<WatchlistItem[]>> {
    return apiService.post<WatchlistItem[]>('/api/watchlist', params);
  }

  /**
   * 更新待看项目
   */
  async updateItem(id: string, params: UpdateWatchlistItemParams): Promise<ApiResponse<WatchlistItem>> {
    return apiService.put<WatchlistItem>(`/api/watchlist/${id}`, params);
  }

  /**
   * 删除待看项目
   */
  async deleteItem(id: string): Promise<ApiResponse<WatchlistItem[]>> {
    return apiService.delete<WatchlistItem[]>(`/api/watchlist/${id}`);
  }

  /**
   * 导出待看名单（后端）
   */
  async export(): Promise<ApiResponse<{ version: string; exportTime: string; items: WatchlistItem[] }>> {
    return apiService.get<{ version: string; exportTime: string; items: WatchlistItem[] }>(
      '/api/watchlist/export'
    );
  }

  /**
   * 导入待看名单（后端）
   */
  async import(data: any, importMode: 'merge' | 'overwrite' = 'merge'): Promise<
    ApiResponse<{ message: string; stats: { successCount: number; skipCount: number; errorCount: number; deletedCount: number }; items: WatchlistItem[] }>
  > {
    return apiService.post(
      '/api/watchlist/import',
      {
        watchlistData: data,
        importMode
      }
    );
  }

  /**
   * 获取待看名单存储配置
   */
  async getConfig(): Promise<ApiResponse<WatchlistConfig>> {
    return apiService.get<WatchlistConfig>('/api/watchlist/config');
  }

  /**
   * 更新待看名单存储配置
   */
  async updateConfig(storageMode: 'json' | 'database'): Promise<ApiResponse<WatchlistConfig>> {
    return apiService.put<WatchlistConfig>('/api/watchlist/config', { storageMode });
  }
}

export const watchlistService = new WatchlistService();
export default watchlistService;