import { defineStore } from 'pinia';
import { ref } from 'vue';
import downloadService from '@/services/download';
import databaseService from '@/services/database';
import { getApiBaseUrl } from '@/services/api';

export interface RegistryStats {
  totalArtists: number;
  totalArtworks: number;
  lastUpdated: string;
}

export interface RegistryConfig {
  useRegistryCheck: boolean;
  fallbackToScan: boolean;
  storageMode?: 'json' | 'database';
}

export const useRegistryStore = defineStore('registry', () => {
  // 状态
  const stats = ref<RegistryStats | null>(null);
  const config = ref<RegistryConfig>({
    useRegistryCheck: true,
    fallbackToScan: false,
    storageMode: 'json'
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 获取注册表统计信息
  const fetchStats = async (useDatabase = false) => {
    try {
      loading.value = true;
      error.value = null;
      
      let response;
      if (useDatabase) {
        response = await databaseService.getRegistryStats();
      } else {
        response = await downloadService.getRegistryStats();
      }
      
      if (response.success) {
        // 映射API响应数据到组件期望的格式
        stats.value = {
          totalArtists: response.data.artistCount || 0,
          totalArtworks: response.data.artworkCount || 0,
          lastUpdated: response.data.updated_at || response.data.created_at || ''
        };
      } else {
        throw new Error(response.error || '获取统计信息失败');
      }
    } catch (err: any) {
      error.value = err.message || '获取统计信息失败';
      console.error('获取注册表统计信息失败:', err);
    } finally {
      loading.value = false;
    }
  };

  // 导出注册表
  const exportRegistry = async (useDatabase = false) => {
    try {
      loading.value = true;
      error.value = null;
      
      let response;
      if (useDatabase) {
        response = await databaseService.exportRegistry();
      } else {
        response = await downloadService.exportRegistry();
      }
      
      if (response.success) {
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || '导出注册表失败');
      }
    } catch (err: any) {
      error.value = err.message || '导出注册表失败';
      console.error('导出注册表失败:', err);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // 导入注册表
  const importRegistry = async (data: any, useDatabase = false) => {
    try {
      loading.value = true;
      error.value = null;
      
      let response;
      if (useDatabase) {
        response = await databaseService.importRegistry(data);
      } else {
        response = await downloadService.importRegistry(data);
      }
      
      if (response.success) {
        // 刷新统计信息
        await fetchStats(useDatabase);
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || '导入注册表失败');
      }
    } catch (err: any) {
      error.value = err.message || '导入注册表失败';
      console.error('导入注册表失败:', err);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // 重建注册表
  const rebuildRegistry = async (useDatabase = false) => {
    try {
      loading.value = true;
      error.value = null;
      
      let response;
      if (useDatabase) {
        response = await databaseService.rebuildRegistry();
      } else {
        response = await downloadService.rebuildRegistry();
      }
      
      if (response.success) {
        // 刷新统计信息
        await fetchStats(useDatabase);
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || '重建注册表失败');
      }
    } catch (err: any) {
      error.value = err.message || '重建注册表失败';
      console.error('重建注册表失败:', err);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // 清理注册表
  const cleanupRegistry = async (useDatabase = false) => {
    try {
      loading.value = true;
      error.value = null;
      
      let response;
      if (useDatabase) {
        response = await databaseService.cleanupRegistry();
      } else {
        response = await downloadService.cleanupRegistry();
      }
      
      if (response.success) {
        // 刷新统计信息
        await fetchStats(useDatabase);
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || '清理注册表失败');
      }
    } catch (err: any) {
      error.value = err.message || '清理注册表失败';
      console.error('清理注册表失败:', err);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // 获取配置
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/download/registry/config`);
      const result = await response.json();
      
      if (result.success && result.data) {
        config.value = { ...config.value, ...result.data };
        return result.data;
      } else {
        throw new Error(result.error || '获取配置失败');
      }
    } catch (err: any) {
      error.value = err.message || '获取配置失败';
      console.error('获取配置失败:', err);
      throw err;
    }
  };

  // 更新配置
  const updateConfig = async (newConfig: Partial<RegistryConfig>) => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await fetch(`${getApiBaseUrl()}/api/download/registry/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfig),
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        config.value = { ...config.value, ...result.data };
        return { success: true, data: result.data };
      } else {
        throw new Error(result.error || '更新配置失败');
      }
    } catch (err: any) {
      error.value = err.message || '更新配置失败';
      console.error('更新配置失败:', err);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  return {
    // 状态
    stats,
    config,
    loading,
    error,
    
    // 方法
    fetchStats,
    exportRegistry,
    importRegistry,
    rebuildRegistry,
    cleanupRegistry,
    fetchConfig,
    updateConfig,
    clearError
  };
});