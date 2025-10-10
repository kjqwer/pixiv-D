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

  // 导出待看名单数据
  const exportWatchlist = () => {
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      items: items.value.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `watchlist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // 导入待看名单数据
  const importWatchlist = async (file: File, importMode: 'merge' | 'overwrite' = 'merge') => {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // 验证数据格式
      if (!importData.items || !Array.isArray(importData.items)) {
        throw new Error('无效的导入文件格式');
      }
      
      // 统计导入结果
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;
      let deletedCount = 0;
      
      // 如果是覆盖模式，先删除所有现有项目
      if (importMode === 'overwrite') {
        const allItems = items.value;
        for (const item of allItems) {
          try {
            await deleteItem(item.id);
            deletedCount++;
          } catch (err) {
            console.error('删除项目失败:', item, err);
          }
        }
      }
      
      for (const item of importData.items) {
        try {
          // 在重合模式下检查是否已存在
          if (importMode === 'merge' && hasUrl(item.url)) {
            skipCount++;
            continue;
          }
          
          // 添加项目
          const success = await addItem({
            url: item.url,
            title: item.title
          });
          
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error('导入项目失败:', item, err);
          errorCount++;
        }
      }
      
      let message = '';
      if (importMode === 'overwrite') {
        message = `覆盖导入完成：删除 ${deletedCount} 项，成功添加 ${successCount} 项，失败 ${errorCount} 项`;
      } else {
        message = `重合导入完成：成功 ${successCount} 项，跳过 ${skipCount} 项，失败 ${errorCount} 项`;
      }
      
      return {
        success: true,
        message,
        stats: { successCount, skipCount, errorCount, deletedCount }
      };
    } catch (err) {
      console.error('导入失败:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : '导入失败',
        stats: { successCount: 0, skipCount: 0, errorCount: 0, deletedCount: 0 }
      };
    }
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
    findItemsByAuthor,
    // 导出导入功能
    exportWatchlist,
    importWatchlist,
    // URL路径提取工具
    extractUrlPath
  };
});