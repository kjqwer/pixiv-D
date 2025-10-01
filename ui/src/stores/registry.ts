import { defineStore } from 'pinia';
import { ref } from 'vue';
import downloadService from '@/services/download';
import { getApiBaseUrl } from '@/services/api';

export interface RegistryStats {
  totalArtists: number;
  totalArtworks: number;
  lastUpdated: string;
}

export interface RegistryConfig {
  useRegistryCheck: boolean;
  fallbackToScan: boolean;
}

export const useRegistryStore = defineStore('registry', () => {
  // 状态
  const stats = ref<RegistryStats | null>(null);
  const config = ref<RegistryConfig>({
    useRegistryCheck: true,
    fallbackToScan: false
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 获取注册表统计信息
  const fetchStats = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await downloadService.getRegistryStats();
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
  const exportRegistry = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await downloadService.exportRegistry();
      
      // 创建下载链接
      const blob = new Blob([JSON.stringify(response, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `download-registry-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (err: any) {
      error.value = err.message || '导出注册表失败';
      console.error('导出注册表失败:', err);
      return { success: false, error: error.value };
    } finally {
      loading.value = false;
    }
  };

  // 导入注册表
  const importRegistry = async (file: File) => {
    try {
      loading.value = true;
      error.value = null;
      
      const text = await file.text();
      const registryData = JSON.parse(text);
      
      const response = await downloadService.importRegistry(registryData);
      if (response.success) {
        // 刷新统计信息
        await fetchStats();
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
  const rebuildRegistry = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await downloadService.rebuildRegistry();
      if (response.success) {
        // 刷新统计信息
        await fetchStats();
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
  const cleanupRegistry = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await downloadService.cleanupRegistry();
      if (response.success) {
        // 刷新统计信息
        await fetchStats();
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
        config.value = result.data;
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