import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import artistService from '@/services/artist';
import type { Artist } from '@/types';

export const useArtistStore = defineStore('artist', () => {
  // 状态
  const followingArtists = ref<Artist[]>([]);
  const searchResults = ref<Artist[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastFetchTime = ref<number>(0);
  const cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

  // 计算属性
  const isDataStale = computed(() => {
    return Date.now() - lastFetchTime.value > cacheExpiry;
  });

  const hasFollowingArtists = computed(() => {
    return followingArtists.value.length > 0;
  });

  const hasSearchResults = computed(() => {
    return searchResults.value.length > 0;
  });

  // 获取关注的作者
  const fetchFollowingArtists = async (forceRefresh = false, options: { restrict?: 'public' | 'private' } = {}) => {
    // 如果数据不是过期的且不是强制刷新，直接返回缓存的数据
    if (!forceRefresh && !isDataStale.value && hasFollowingArtists.value) {
      return {
        success: true,
        data: { artists: followingArtists.value }
      };
    }

    try {
      loading.value = true;
      error.value = null;
      
      const restrict = options.restrict || 'public';
      
      // 后端会自动循环获取所有数据
      const response = await artistService.getFollowingArtists({
        restrict: restrict
      });
      
      if (response.success && response.data) {
        followingArtists.value = response.data.artists;
        lastFetchTime.value = Date.now();
      } else {
        throw new Error('获取关注列表失败');
      }
      
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取关注列表失败';
      console.error('获取关注列表失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 搜索作者
  const searchArtists = async (keyword: string) => {
    if (!keyword.trim()) {
      searchResults.value = [];
      return { success: true, data: { artists: [] } };
    }

    try {
      const response = await artistService.searchArtists({ keyword });
      if (response.success && response.data) {
        searchResults.value = response.data.artists;
        return response;
      } else {
        throw new Error('搜索失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '搜索失败';
      console.error('搜索失败:', err);
      throw err;
    }
  };

  // 关注作者
  const followArtist = async (artistId: number) => {
    try {
      const response = await artistService.followArtist(artistId, 'follow');
      
      if (response.success) {
        // 更新搜索结果的关注状态
        const artist = searchResults.value.find(a => a.id === artistId);
        if (artist) {
          artist.is_followed = true;
        }
        
        // 添加到关注列表
        const artistToAdd = searchResults.value.find(a => a.id === artistId);
        if (artistToAdd && !followingArtists.value.find(a => a.id === artistId)) {
          followingArtists.value.push(artistToAdd);
        }
      } else {
        throw new Error('关注失败');
      }
      
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '关注失败';
      console.error('关注失败:', err);
      throw err;
    }
  };

  // 取消关注
  const unfollowArtist = async (artistId: number) => {
    try {
      const response = await artistService.followArtist(artistId, 'unfollow');
      
      if (response.success) {
        // 从关注列表中移除
        followingArtists.value = followingArtists.value.filter(a => a.id !== artistId);
        
        // 更新搜索结果的关注状态
        const artist = searchResults.value.find(a => a.id === artistId);
        if (artist) {
          artist.is_followed = false;
        }
      } else {
        throw new Error('取消关注失败');
      }
      
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '取消关注失败';
      console.error('取消关注失败:', err);
      throw err;
    }
  };

  // 清除搜索结果
  const clearSearchResults = () => {
    searchResults.value = [];
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  // 强制刷新数据
  const refreshData = async () => {
    return await fetchFollowingArtists(true);
  };

  // 重置状态
  const reset = () => {
    followingArtists.value = [];
    searchResults.value = [];
    loading.value = false;
    error.value = null;
    lastFetchTime.value = 0;
  };

  return {
    // 状态
    followingArtists,
    searchResults,
    loading,
    error,
    lastFetchTime,
    
    // 计算属性
    isDataStale,
    hasFollowingArtists,
    hasSearchResults,
    
    // 方法
    fetchFollowingArtists,
    searchArtists,
    followArtist,
    unfollowArtist,
    clearSearchResults,
    clearError,
    refreshData,
    reset
  };
}); 