import apiService from './api';
import type { ApiResponse } from '@/types';

export interface CacheConfig {
  maxAge: number;
  maxSize: number;
  cleanupInterval: number;
  enabled: boolean;
  proxy: {
    enabled: boolean;
    timeout: number;
    retryCount: number;
    retryDelay: number;
  };
  allowedExtensions: string[];
  lastUpdated: string;
}

export interface CacheStats {
  fileCount: number;
  totalSize: number;
  maxSize: number;
  maxAge: number;
  usagePercentage: number;
}

class CacheService {
  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<ApiResponse<CacheStats>> {
    return apiService.get<CacheStats>('/api/proxy/cache/stats');
  }

  /**
   * 获取缓存配置
   */
  async getCacheConfig(): Promise<ApiResponse<CacheConfig>> {
    return apiService.get<CacheConfig>('/api/proxy/cache/config');
  }

  /**
   * 更新缓存配置
   */
  async updateCacheConfig(config: Partial<CacheConfig>): Promise<ApiResponse<CacheConfig>> {
    return apiService.put<CacheConfig>('/api/proxy/cache/config', config);
  }

  /**
   * 重置缓存配置为默认值
   */
  async resetCacheConfig(): Promise<ApiResponse<CacheConfig>> {
    return apiService.post<CacheConfig>('/api/proxy/cache/config/reset');
  }

  /**
   * 清理所有缓存
   */
  async clearAllCache(): Promise<ApiResponse<{ message: string }>> {
    return apiService.delete<{ message: string }>('/api/proxy/cache');
  }

  /**
   * 清理过期缓存
   */
  async clearExpiredCache(): Promise<ApiResponse<{ message: string }>> {
    return apiService.delete<{ message: string }>('/api/proxy/cache/expired');
  }
}

export const cacheService = new CacheService();
export default cacheService; 