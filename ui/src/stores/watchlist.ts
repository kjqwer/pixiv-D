import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { watchlistService, type WatchlistItem, type AddWatchlistItemParams, type UpdateWatchlistItemParams, type WatchlistConfig } from '@/services/watchlist';

export const useWatchlistStore = defineStore('watchlist', () => {
  // 状态
  const items = ref<WatchlistItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const configLoading = ref(false);
  const storageMode = ref<'json' | 'database'>('json');

  // 计算属性
  const itemCount = computed(() => items.value.length);
  const hasItems = computed(() => items.value.length > 0);

  // 通用错误处理
  const handleError = (err: any, defaultMessage: string) => {
    console.error(defaultMessage, err);
    error.value = err.response?.data?.error || err.message || defaultMessage;
  };

  // 获取所有待看项目
  const fetchItems = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await watchlistService.getItems();
      if (response.success && response.data) {
        items.value = response.data;
      } else {
        throw new Error(response.error || '获取待看名单失败');
      }
    } catch (err) {
      handleError(err, '获取待看名单失败');
    } finally {
      loading.value = false;
    }
  };

  // 获取存储配置
  const fetchConfig = async () => {
    try {
      configLoading.value = true;
      const response = await watchlistService.getConfig();
      if (response.success && response.data) {
        storageMode.value = (response.data.storageMode ?? 'json') as 'json' | 'database';
        return true;
      } else {
        throw new Error(response.error || '获取存储配置失败');
      }
    } catch (err) {
      handleError(err, '获取存储配置失败');
      return false;
    } finally {
      configLoading.value = false;
    }
  };

  // 保存存储模式
  const saveStorageModeConfig = async (mode: 'json' | 'database') => {
    try {
      configLoading.value = true;
      const response = await watchlistService.updateConfig(mode);
      if (response.success && response.data) {
        storageMode.value = response.data.storageMode;
        return true;
      } else {
        throw new Error(response.error || '更新存储配置失败');
      }
    } catch (err) {
      handleError(err, '更新存储配置失败');
      return false;
    } finally {
      configLoading.value = false;
    }
  };

  // 添加待看项目
  const addItem = async (params: AddWatchlistItemParams) => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await watchlistService.addItem(params);
      if (response.success && response.data) {
        items.value = response.data;
        return true;
      } else {
        throw new Error(response.error || '添加待看项目失败');
      }
    } catch (err) {
      handleError(err, '添加待看项目失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 更新待看项目
  const updateItem = async (id: string, params: UpdateWatchlistItemParams) => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await watchlistService.updateItem(id, params);
      if (response.success && response.data) {
        // 更新本地数据
        const index = items.value.findIndex(item => item.id === id);
        if (index !== -1) {
          items.value[index] = response.data;
        }
        return true;
      } else {
        throw new Error(response.error || '更新待看项目失败');
      }
    } catch (err) {
      handleError(err, '更新待看项目失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 删除待看项目
  const deleteItem = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await watchlistService.deleteItem(id);
      if (response.success && response.data) {
        items.value = response.data;
        return true;
      } else {
        throw new Error(response.error || '删除待看项目失败');
      }
    } catch (err) {
      handleError(err, '删除待看项目失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  // 提取URL路径的工具函数（忽略baseURL）
  const extractUrlPath = (url: string) => {
    try {
      // 处理完整URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        return urlObj.pathname + urlObj.search + urlObj.hash;
      } else {
        // 处理相对路径
        return url.startsWith('/') ? url : '/' + url;
      }
    } catch {
      // 如果解析失败，返回原始URL
      return url;
    }
  };

  // 提取作者ID的工具函数
  const extractAuthorId = (url: string) => {
    try {
      const path = extractUrlPath(url);
      
      // 匹配 /artist/数字 的模式
      const match = path.match(/\/artist\/(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // 检查URL是否已存在（只比较路径部分）
  const hasUrl = (url: string) => {
    const targetPath = extractUrlPath(url);
    return items.value.some(item => {
      const itemPath = extractUrlPath(item.url);
      return itemPath === targetPath;
    });
  };

  // 根据URL查找项目（只比较路径部分）
  const findByUrl = (url: string) => {
    const targetPath = extractUrlPath(url);
    return items.value.find(item => {
      const itemPath = extractUrlPath(item.url);
      return itemPath === targetPath;
    });
  };

  // 检查是否有相同作者但不同页面的项目
  const findSameAuthor = (url: string) => {
    const authorId = extractAuthorId(url);
    if (!authorId) return null;
    
    const targetPath = extractUrlPath(url);
    
    return items.value.find(item => {
      const itemAuthorId = extractAuthorId(item.url);
      const itemPath = extractUrlPath(item.url);
      return itemAuthorId === authorId && itemPath !== targetPath;
    });
  };

  // 检查当前URL是否与已存在的作者页面相同（忽略页面参数）
  const hasSameAuthor = (url: string) => {
    return findSameAuthor(url) !== null;
  };

  // 根据作者ID查找所有项目
  const findItemsByAuthor = (authorId: string) => {
    return items.value.filter(item => {
      const itemAuthorId = extractAuthorId(item.url);
      return itemAuthorId === authorId;
    });
  };

  // 导出待看名单数据（通过后端）
  const exportWatchlist = async () => {
    try {
      loading.value = true;
      error.value = null;
      const response = await watchlistService.export();
      if (response.success && response.data) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `watchlist-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        return { success: true };
      } else {
        throw new Error(response.error || '导出待看名单失败');
      }
    } catch (err) {
      handleError(err, '导出待看名单失败');
      return { success: false };
    } finally {
      loading.value = false;
    }
  };

  // 导入待看名单数据（通过后端）
  const importWatchlist = async (file: File, importMode: 'merge' | 'overwrite' = 'merge') => {
    try {
      loading.value = true;
      error.value = null;
      const text = await file.text();
      const importData = JSON.parse(text);
      if (!importData.items || !Array.isArray(importData.items)) {
        throw new Error('无效的导入文件格式');
      }
      const response = await watchlistService.import(importData, importMode);
      if (response.success && response.data) {
        // 刷新本地列表
        items.value = response.data.items || items.value;
        return { success: true, message: response.data.message, stats: response.data.stats };
      } else {
        throw new Error(response.error || '导入待看名单失败');
      }
    } catch (err) {
      handleError(err, '导入待看名单失败');
      return { success: false, message: error.value || '导入待看名单失败', stats: { successCount: 0, skipCount: 0, errorCount: 0, deletedCount: 0 } };
    } finally {
      loading.value = false;
    }
  };

  return {
    // 状态
    items,
    loading,
    error,
    configLoading,
    storageMode,
    // 计算属性
    itemCount,
    hasItems,
    // 方法
    fetchItems,
    fetchConfig,
    saveStorageModeConfig,
    addItem,
    updateItem,
    deleteItem,
    hasUrl,
    findByUrl,
    clearError,
    // 新增的作者相关方法
    extractAuthorId,
    findSameAuthor,
    hasSameAuthor,
    findItemsByAuthor,
    // 导出导入功能
    exportWatchlist,
    importWatchlist,
    // URL路径提取工具
    extractUrlPath
  };
});