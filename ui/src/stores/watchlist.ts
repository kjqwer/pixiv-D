import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { watchlistService, type WatchlistItem, type AddWatchlistItemParams, type UpdateWatchlistItemParams } from '@/services/watchlist';

export const useWatchlistStore = defineStore('watchlist', () => {
  // 状态
  const items = ref<WatchlistItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  // 检查URL是否已存在
  const hasUrl = (url: string) => {
    return items.value.some(item => item.url === url);
  };

  // 根据URL查找项目
  const findByUrl = (url: string) => {
    return items.value.find(item => item.url === url);
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  return {
    // 状态
    items,
    loading,
    error,
    // 计算属性
    itemCount,
    hasItems,
    // 方法
    fetchItems,
    addItem,
    updateItem,
    deleteItem,
    hasUrl,
    findByUrl,
    clearError
  };
}); 