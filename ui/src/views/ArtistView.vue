<template>
  <div class="artist-page">
    <div class="container">
      <div v-if="loading" class="loading-section">
        <LoadingSpinner text="加载中..." />
      </div>

      <div v-else-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <!-- 下载成功提示 -->
      <div v-if="downloadSuccess" class="success-message">
        <div class="success-content">
          <svg viewBox="0 0 24 24" fill="currentColor" class="success-icon">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span>{{ downloadSuccess }}</span>
        </div>
      </div>

      <div v-else-if="artist" class="artist-content">
        <!-- 作者信息卡片 -->
        <div class="artist-header">
          <div class="artist-profile">
            <img :src="getImageUrl(artist.profile_image_urls.medium)" :alt="artist.name" class="artist-avatar"
              crossorigin="anonymous" />
            <div class="artist-info">
              <h1 class="artist-name">{{ artist.name }}</h1>
              <p class="artist-account">@{{ artist.account }}</p>
              <p v-if="artist.comment" class="artist-comment">{{ artist.comment }}</p>
            </div>
          </div>

          <div class="artist-actions">
            <button @click="handleFollow" class="btn btn-primary">
              {{ artist.is_followed ? '取消关注' : '关注' }}
            </button>
            <div class="download-section">
              <div class="download-input-group">
                <label for="downloadLimit">下载数量:</label>
                <select v-model="downloadLimit" id="downloadLimit" class="download-select">
                  <option value="10">10个</option>
                  <option value="30">30个</option>
                  <option value="50">50个</option>
                  <option value="100">100个</option>
                  <option value="200">200个</option>
                  <option value="500">500个</option>
                  <option value="9999">全部</option>
                </select>
              </div>
              <button @click="handleDownloadAll" class="btn btn-secondary" :disabled="downloading">
                {{ downloading ? '下载中...' : '下载作品' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 作品列表 -->
        <div class="artworks-section">
          <div class="section-header">
            <h2>作品列表</h2>
            <div class="artwork-filters">
              <select v-model="artworkType" @change="handleTypeChange" class="filter-select">
                <option value="art">插画</option>
                <option value="manga">漫画</option>
                <option value="novel">小说</option>
              </select>
            </div>
          </div>

          <div v-if="artworksLoading" class="loading-section">
            <LoadingSpinner text="加载作品中..." />
          </div>

          <div v-else-if="artworks.length > 0" class="artworks-grid">
            <ArtworkCard v-for="artwork in artworks" :key="artwork.id" :artwork="artwork" @click="handleArtworkClick" />
          </div>

          <div v-else class="empty-section">
            <p>暂无作品</p>
          </div>

          <!-- 分页导航 -->
          <div v-if="totalPages > 1 && artworks.length > 0" class="pagination">
            <button @click="goToPage(currentPage - 1)" class="page-btn" :disabled="currentPage <= 1">
              <svg viewBox="0 0 24 24" fill="currentColor" class="page-icon">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
              上一页
            </button>

            <div class="page-numbers">
              <button v-for="page in visiblePages" :key="page" @click="goToPage(page)" class="page-number"
                :class="{ active: page === currentPage }">
                {{ page }}
              </button>
            </div>

            <button @click="goToPage(currentPage + 1)" class="page-btn" :disabled="currentPage >= totalPages">
              下一页
              <svg viewBox="0 0 24 24" fill="currentColor" class="page-icon">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
              </svg>
            </button>
          </div>

          <!-- 跳转到指定页面 -->
          <div v-if="totalPages > 1 && artworks.length > 0" class="jump-to-page">
            <div class="jump-input-group">
              <label for="jumpPage">跳转到:</label>
              <input v-model="jumpPageInput" type="number" id="jumpPage" class="jump-input" :min="1" :max="totalPages"
                placeholder="页码" @keyup.enter="handleJumpToPage" />
              <button @click="handleJumpToPage" class="jump-btn" :disabled="!jumpPageInput || jumping">
                {{ jumping ? '跳转中...' : '跳转' }}
              </button>
            </div>
          </div>

          <!-- 页面信息 -->
          <div v-if="totalPages > 1 && artworks.length > 0" class="page-info">
            <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
            <span>共 {{ totalCount }} 个作品</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import artistService from '@/services/artist';
import downloadService from '@/services/download';
import { getImageProxyUrl } from '@/services/api';
import type { Artist, Artwork } from '@/types';

import ArtworkCard from '@/components/artwork/ArtworkCard.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// 状态
const artist = ref<Artist | null>(null);
const artworks = ref<Artwork[]>([]);
const loading = ref(false);
const artworksLoading = ref(false);
const error = ref<string | null>(null);
const downloading = ref(false);
const downloadSuccess = ref<string | null>(null);

// 筛选和分页状态
const artworkType = ref<'art' | 'manga' | 'novel'>('art');
const currentPage = ref(1);
const pageSize = ref(30);
const totalCount = ref(0);
const totalPages = ref(0);

// 下载设置
const downloadLimit = ref('50');

// 缓存相关
const cache = ref<Map<string, any>>(new Map());
const cacheTimeout = ref<Map<string, number>>(new Map());
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 计算属性
const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return pages;
});

// 缓存键生成
const getCacheKey = (type: string, page: number) => {
  return `${route.params.id}_${type}_${page}`;
};

// 获取缓存
const getCache = (key: string) => {
  const cached = cache.value.get(key);
  const timeout = cacheTimeout.value.get(key);

  if (cached && timeout && Date.now() < timeout) {
    return cached;
  }

  // 清除过期缓存
  if (cached) {
    cache.value.delete(key);
    cacheTimeout.value.delete(key);
  }

  return null;
};

// 设置缓存
const setCache = (key: string, data: any) => {
  cache.value.set(key, data);
  cacheTimeout.value.set(key, Date.now() + CACHE_DURATION);
};

// 清除缓存
const clearCache = () => {
  cache.value.clear();
  cacheTimeout.value.clear();
};

// 获取作者信息
const fetchArtistInfo = async () => {
  const artistId = parseInt(route.params.id as string);
  if (isNaN(artistId)) {
    error.value = '无效的作者ID';
    return;
  }

  // 检查缓存
  const cacheKey = `artist_${artistId}`;
  const cached = getCache(cacheKey);
  if (cached) {
    artist.value = cached;
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    const response = await artistService.getArtistInfo(artistId);

    if (response.success && response.data) {
      artist.value = response.data;
      setCache(cacheKey, response.data);
    } else {
      throw new Error(response.error || '获取作者信息失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取作者信息失败';
    console.error('获取作者信息失败:', err);
  } finally {
    loading.value = false;
  }
};

// 获取作者作品
const fetchArtworks = async (page = 1, isJumpToPage = false) => {
  if (!artist.value) return;

  const cacheKey = getCacheKey(artworkType.value, page);
  const cached = getCache(cacheKey);

  if (cached) {
    artworks.value = cached.artworks;
    totalCount.value = cached.totalCount;
    totalPages.value = cached.totalPages;
    currentPage.value = page;
    return;
  }

  try {
    artworksLoading.value = true;

    const offset = (page - 1) * pageSize.value;
    const response = await artistService.getArtistArtworks(artist.value.id, {
      type: artworkType.value,
      offset: offset,
      limit: pageSize.value
    });

    if (response.success && response.data) {
      artworks.value = response.data.artworks;

      // 基于 next_url 来判断是否还有更多页面
      const hasMore = !!response.data.next_url;

      if (page === 1) {
        // 第一页，基于是否有下一页来判断总数
        if (hasMore) {
          // 如果有下一页，至少说明有2页
          totalCount.value = pageSize.value * 2;
          totalPages.value = 2;
        } else {
          // 没有下一页，说明只有1页
          totalCount.value = response.data.artworks.length;
          totalPages.value = 1;
        }
      } else {
        // 非第一页，基于当前页面位置和是否有下一页来判断
        if (hasMore) {
          // 如果有下一页，说明至少还有1页
          totalCount.value = Math.max(totalCount.value, (page + 1) * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page + 1);
        } else {
          // 没有下一页，说明这是最后一页
          totalCount.value = Math.max(totalCount.value, page * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page);
        }
      }

      currentPage.value = page;

      // 缓存结果
      setCache(cacheKey, {
        artworks: response.data.artworks,
        totalCount: totalCount.value,
        totalPages: totalPages.value
      });
    } else {
      throw new Error(response.error || '获取作品列表失败');
    }
  } catch (err) {
    console.error('获取作品列表失败:', err);

    // 只有在跳转到指定页面失败时才显示错误
    if (isJumpToPage) {
      error.value = `跳转失败：无法跳转到第 ${page} 页`;
    } else {
      error.value = err instanceof Error ? err.message : '获取作品列表失败';
    }
  } finally {
    artworksLoading.value = false;
  }
};

// 处理类型切换
const handleTypeChange = () => {
  currentPage.value = 1;

  // 清除URL中的页码参数
  router.push({
    query: {
      ...route.query,
      page: undefined
    }
  });

  fetchArtworks(1);
};

// 跳转到指定页面
const goToPage = (page: number) => {
  if (page < 1 || page === currentPage.value) return;

  // 更新URL参数
  router.push({
    query: {
      ...route.query,
      page: page.toString()
    }
  });

  fetchArtworks(page);
};

// 关注/取消关注
const handleFollow = async () => {
  if (!artist.value) return;

  try {
    const action = artist.value.is_followed ? 'unfollow' : 'follow';
    const response = await artistService.followArtist(artist.value.id, action);

    if (response.success) {
      artist.value.is_followed = !artist.value.is_followed;
      // 更新缓存
      const cacheKey = `artist_${artist.value.id}`;
      setCache(cacheKey, artist.value);
    } else {
      throw new Error(response.error || '操作失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败';
    console.error('关注操作失败:', err);
  }
};

// 下载作品
const handleDownloadAll = async () => {
  if (!artist.value) return;

  try {
    downloading.value = true;
    const response = await downloadService.downloadArtistArtworks(artist.value.id, {
      type: artworkType.value,
      limit: parseInt(downloadLimit.value)
    });

    if (response.success) {
      console.log('下载任务已创建:', response.data);
      const limitText = downloadLimit.value === '9999' ? '全部' : downloadLimit.value;
      downloadSuccess.value = `下载任务已创建，将下载 ${limitText} 个作品`;

      // 3秒后清除成功提示
      setTimeout(() => {
        downloadSuccess.value = null;
      }, 3000);
    } else {
      throw new Error(response.error || '下载失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载失败';
    console.error('下载失败:', err);
  } finally {
    downloading.value = false;
  }
};

// 使用统一的图片代理函数
const getImageUrl = getImageProxyUrl;

// 点击作品
const handleArtworkClick = (artwork: Artwork) => {
  // 传递作者ID、作品类型和当前页面信息，用于导航
  router.push({
    path: `/artwork/${artwork.id}`,
    query: {
      artistId: artist.value?.id.toString(),
      artworkType: artworkType.value,
      page: currentPage.value.toString(),
      returnUrl: route.fullPath
    }
  });
};

// 清除错误
const clearError = () => {
  error.value = null;
};

// 跳转到指定页面输入框
const jumpPageInput = ref<string | number>('');
const jumping = ref(false);

// 处理跳转到指定页面
const handleJumpToPage = async () => {
  const page = parseInt(jumpPageInput.value as string);
  if (isNaN(page) || page < 1) {
    error.value = '请输入有效的页码';
    return;
  }

  jumping.value = true;
  jumpPageInput.value = ''; // 清空输入框

  // 更新URL参数
  router.push({
    query: {
      ...route.query,
      page: page.toString()
    }
  });

  try {
    await fetchArtworks(page, true);
  } finally {
    jumping.value = false;
  }
};

// 监听路由变化
watch(() => route.params.id, () => {
  // 清除缓存并重新加载
  clearCache();
  fetchArtistInfo();

  // 检查是否有返回的页面信息或指定的页码
  const returnPage = parseInt(route.query.page as string);
  if (returnPage && returnPage > 0) {
    currentPage.value = returnPage;
    fetchArtworks(returnPage, true);
  } else {
    fetchArtworks(1);
  }
});

// 监听URL查询参数变化
watch(() => route.query.page, (newPage) => {
  if (newPage && artist.value) {
    const page = parseInt(newPage as string);
    if (page > 0 && page !== currentPage.value) {
      currentPage.value = page;
      fetchArtworks(page, true);
    }
  }
});

// 组件卸载时清理缓存
onUnmounted(() => {
  clearCache();
});

onMounted(async () => {
  await fetchArtistInfo();

  // 检查是否有返回的页面信息或指定的页码
  const returnPage = parseInt(route.query.page as string);
  if (returnPage && returnPage > 0) {
    currentPage.value = returnPage;
    await fetchArtworks(returnPage, true);
  } else {
    await fetchArtworks(1);
  }
});
</script>

<style scoped>
.artist-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.loading-section,
.error-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.success-message {
  position: fixed;
  top: 2rem;
  right: 2rem;
  background: #10b981;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

.success-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.success-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.artist-header {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.artist-profile {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.artist-avatar {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  object-fit: cover;
}

.artist-info {
  flex: 1;
}

.artist-name {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.artist-account {
  color: #6b7280;
  font-size: 1.125rem;
  margin: 0 0 1rem 0;
}

.artist-comment {
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.artist-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.download-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.download-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.download-input-group label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
}

.download-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
  min-width: 100px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}



.artworks-section {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.artwork-filters {
  display: flex;
  gap: 1rem;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
}

.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.empty-section {
  text-align: center;
  padding: 4rem 0;
  color: #6b7280;
}

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.page-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.page-numbers {
  display: flex;
  gap: 0.5rem;
}

.page-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.page-number:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-number.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-info {
  display: flex;
  justify-content: center;
  gap: 2rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.jump-to-page {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.jump-input-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.jump-input-group label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
}

.jump-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
  min-width: 80px;
  text-align: center;
  transition: border-color 0.2s;
}

.jump-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.jump-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  background: #3b82f6;
  color: white;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  min-width: 80px;
}

.jump-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

.jump-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .artist-header {
    flex-direction: column;
    align-items: stretch;
  }

  .artist-profile {
    flex-direction: column;
    text-align: center;
  }

  .artist-actions {
    flex-direction: row;
  }

  .download-section {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }

  .download-input-group {
    flex-shrink: 0;
  }

  .btn {
    flex: 1;
  }

  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .artworks-grid {
    grid-template-columns: 1fr;
  }

  .pagination {
    flex-direction: column;
    gap: 1rem;
  }

  .page-numbers {
    order: -1;
  }

  .page-info {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  .jump-to-page {
    flex-direction: column;
    gap: 0.5rem;
  }

  .jump-input-group {
    flex-direction: column;
    align-items: flex-start;
  }

  .jump-input {
    width: 100%;
  }

  .jump-btn {
    width: 100%;
  }
}
</style>