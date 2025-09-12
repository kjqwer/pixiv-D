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

  // 提取作者ID的工具函数
  const extractAuthorId = (url: string) => {
    try {
      let path = '';
      
      // 处理完整URL
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        path = urlObj.pathname;
      } else {
        // 处理相对路径
        path = url.startsWith('/') ? url : '/' + url;
      }
      
      // 匹配 /artist/数字 的模式
      const match = path.match(/\/artist\/(\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // 检查是否有相同作者但不同页面的项目
  const findSameAuthor = (url: string) => {
    const authorId = extractAuthorId(url);
    if (!authorId) return null;
    
    return items.value.find(item => {
      const itemAuthorId = extractAuthorId(item.url);
      return itemAuthorId === authorId && item.url !== url;
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
    clearError,
    // 新增的作者相关方法
    extractAuthorId,
    findSameAuthor,
    hasSameAuthor,
    findItemsByAuthor
  };
}); 