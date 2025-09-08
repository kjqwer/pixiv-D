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
}

export const watchlistService = new WatchlistService();
export default watchlistService; 