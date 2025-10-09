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
          <SvgIcon name="success" class="success-icon" />
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
            <button @click="handleFollow" class="btn btn-primary artist-follow-btn">
              {{ artist.is_followed ? '取消关注' : '关注' }}
            </button>
            <div class="download-section">
              <div class="download-controls">
                <div class="download-input-group">
                  <label for="downloadType" class="download-label">下载方式:</label>
                  <select v-model="downloadType" id="downloadType" class="download-select"
                    @change="handleDownloadTypeChange">
                    <option value="custom">自定义数量</option>
                    <option value="pages">按页数选择</option>
                    <option value="all">全部下载</option>
                  </select>
                </div>

                <!-- 自定义数量输入 -->
                <div v-if="downloadType === 'custom'" class="download-input-group">
                  <label for="customLimit" class="download-label">数量:</label>
                  <input v-model="customLimit" type="number" id="customLimit" class="download-input" :min="1" :max="9999"
                    placeholder="输入数量" />
                </div>

                <!-- 按页数选择 -->
                <div v-if="downloadType === 'pages'" class="download-input-group">
                  <label for="pageLimit" class="download-label">页数:</label>
                  <select v-model="pageLimit" id="pageLimit" class="download-select">
                    <option value="1">1页 (30个)</option>
                    <option value="2">2页 (60个)</option>
                    <option value="3">3页 (90个)</option>
                    <option value="5">5页 (150个)</option>
                    <option value="10">10页 (300个)</option>
                    <option value="20">20页 (600个)</option>
                    <option value="50">50页 (1500个)</option>
                  </select>
                </div>
              </div>

              <button @click="handleDownloadAll" class="btn btn-secondary download-btn" :disabled="downloading || !isDownloadValid">
                {{ downloading ? '下载中...' : '下载作品' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 作品列表 -->
        <div class="artworks-section">
          <div class="section-header">
            <h2>作品列表</h2>
            <div class="header-controls">
              <div class="artwork-filters">
                <select v-model="artworkType" @change="handleTypeChange" class="filter-select">
                  <option value="art">插画</option>
                  <option value="manga">漫画</option>
                  <option value="novel">小说</option>
                </select>
              </div>

              <!-- 顶部分页导航 -->
              <div v-if="totalPages > 1 && artworks.length > 0" class="simple-pagination">
                <button @click="goToPage(currentPage - 1)" class="simple-page-btn" :disabled="currentPage <= 1">
                  <SvgIcon name="arrow-left2" class="simple-page-icon" />
                </button>
                <span class="simple-page-info">{{ currentPage }} / {{ totalPages }}</span>
                <button @click="goToPage(currentPage + 1)" class="simple-page-btn"
                  :disabled="currentPage >= totalPages">
                  <SvgIcon name="arrow-right" class="simple-page-icon" />
                </button>
              </div>
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
            <button @click="goToPage(currentPage - 1)" class="page-btn" :disabled="currentPage <= 1"
              :title="`上一页(快捷键: ←)`">
              <SvgIcon name="arrow-left2" class="page-icon" />
              上一页
            </button>

            <div class="page-numbers">
              <button v-for="page in visiblePages" :key="page" @click="goToPage(page)" class="page-number"
                :class="{ active: page === currentPage }">
                {{ page }}
              </button>
            </div>

            <button @click="goToPage(currentPage + 1)" class="page-btn" :disabled="currentPage >= totalPages"
              :title="`下一页(快捷键: →)`">
              下一页
              <SvgIcon name="arrow-right" class="page-icon" />
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
import { saveScrollPosition, restoreScrollPosition } from '@/utils/scrollManager';
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
const downloadType = ref<'custom' | 'pages' | 'all'>('custom');
const customLimit = ref('50');
const pageLimit = ref('1');
const downloadLimit = ref('50'); // 保留用于兼容性

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

// 下载验证
const isDownloadValid = computed(() => {
  if (downloadType.value === 'custom') {
    const limit = parseInt(customLimit.value);
    return !isNaN(limit) && limit > 0 && limit <= 9999;
  }
  return true;
});

// 获取实际下载数量
const getActualDownloadLimit = () => {
  switch (downloadType.value) {
    case 'custom':
      return parseInt(customLimit.value) || 50;
    case 'pages':
      return parseInt(pageLimit.value) * 30;
    case 'all':
      return 9999;
    default:
      return 50;
  }
};

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
    return false;
  }

  // 检查缓存
  const cacheKey = `artist_${artistId}`;
  const cached = getCache(cacheKey);
  if (cached) {
    artist.value = cached;
    return true;
  }

  try {
    loading.value = true;
    error.value = null;

    const response = await artistService.getArtistInfo(artistId);

    if (response.success && response.data) {
      artist.value = response.data;
      setCache(cacheKey, response.data);
      return true;
    } else {
      throw new Error(response.error || '获取作者信息失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取作者信息失败';
    console.error('获取作者信息失败:', err);
    return false;
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

// 处理下载类型切换
const handleDownloadTypeChange = () => {
  // 重置相关值
  if (downloadType.value === 'custom') {
    customLimit.value = '50';
  } else if (downloadType.value === 'pages') {
    pageLimit.value = '1';
  }
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

  // 由于路由监听器会自动处理页面变化，这里不需要手动调用fetchArtworks
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
    const actualLimit = getActualDownloadLimit();

    const response = await downloadService.downloadArtistArtworks(artist.value.id, {
      type: artworkType.value,
      limit: actualLimit
    });

    if (response.success) {
      console.log('下载任务已创建:', response.data);

      let limitText = '';
      switch (downloadType.value) {
        case 'custom':
          limitText = `${actualLimit} 个`;
          break;
        case 'pages':
          limitText = `${pageLimit.value} 页 (${actualLimit} 个)`;
          break;
        case 'all':
          limitText = '全部';
          break;
      }

      downloadSuccess.value = `下载任务已创建，将下载 ${limitText} 作品`;

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
  // 保存当前页面的滚动位置
  saveScrollPosition(route.fullPath);

  // 传递作者ID、作品类型和当前页面信息，用于导航
  router.push({
    path: `/artwork/${artwork.id}`,
    query: {
      artistId: artist.value?.id.toString(),
      artworkType: artworkType.value,
      page: currentPage.value.toString(),
      returnUrl: route.fullPath,
      scrollTop: (window.scrollY || document.documentElement.scrollTop).toString()
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

  // 等待页面变化处理完成
  setTimeout(() => {
    jumping.value = false;
  }, 500);
};

// 监听路由变化
watch(() => route.params.id, async (newId, oldId) => {
  // 只有当作者ID真正变化时才重新加载
  if (newId !== oldId) {
    // 清除缓存并重新加载
    clearCache();
    artworks.value = []; // 立即清空作品列表
    currentPage.value = 1; // 重置页码
    totalPages.value = 0; // 重置总页数
    artworkType.value = 'art'; // 重置作品类型

    // 先获取作者信息
    const success = await fetchArtistInfo();

    // 只有成功获取作者信息后才获取作品
    if (success && artist.value) {
      // 检查是否有返回的页面信息或指定的页码
      const returnPage = parseInt(route.query.page as string);
      if (returnPage && returnPage > 0) {
        currentPage.value = returnPage;
        await fetchArtworks(returnPage, true);
      } else {
        await fetchArtworks(1);
      }
    }
  }
}, { immediate: false });

// 防止重复处理的标志
const isProcessingPageChange = ref(false);

// 统一的页面变化处理函数
const handlePageChange = async (page: number, isJumpToPage = false) => {
  if (isProcessingPageChange.value || page === currentPage.value) return;

  isProcessingPageChange.value = true;
  try {
    // 如果artist还没加载完成，等待加载完成
    if (!artist.value) {
      const waitForArtist = () => {
        return new Promise<void>((resolve) => {
          const unwatch = watch(() => artist.value, (newArtist) => {
            if (newArtist) {
              unwatch();
              resolve();
            }
          }, { immediate: true });
        });
      };
      await waitForArtist();
    }

    if (artist.value) {
      currentPage.value = page;
      await fetchArtworks(page, isJumpToPage);
    }
  } finally {
    isProcessingPageChange.value = false;
  }
};

// 监听URL查询参数变化
watch(() => route.query.page, async (newPage) => {
  if (newPage && artist.value) {
    const page = parseInt(newPage as string);
    if (page > 0) {
      await handlePageChange(page, true);
    }
  }
});

// 监听作者变化，确保作品列表与当前作者同步
watch(() => artist.value?.id, (newArtistId, oldArtistId) => {
  if (newArtistId && newArtistId !== oldArtistId) {
    // 作者变化时重新获取作品列表
    artworks.value = [];
    currentPage.value = 1;
    totalPages.value = 0;

    // 检查是否有页面参数
    const pageParam = route.query.page;
    if (pageParam) {
      const page = parseInt(pageParam as string);
      if (page > 0) {
        handlePageChange(page, true);
      } else {
        fetchArtworks(1);
      }
    } else {
      fetchArtworks(1);
    }
  }
}, { immediate: false });

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // 检查是否在输入框中，如果是则不处理
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  // 只有在有多页且有作品时才处理键盘事件
  if (totalPages.value <= 1 || artworks.value.length === 0) {
    return;
  }

  if (event.key === 'ArrowLeft' && currentPage.value > 1) {
    event.preventDefault();
    goToPage(currentPage.value - 1);
  } else if (event.key === 'ArrowRight' && currentPage.value < totalPages.value) {
    event.preventDefault();
    goToPage(currentPage.value + 1);
  }
};

// 组件卸载时清理缓存和事件监听器
onUnmounted(() => {
  clearCache();
  window.removeEventListener('keydown', handleKeyDown);
});

onMounted(async () => {
  const success = await fetchArtistInfo();

  // 只有成功获取作者信息后才获取作品
  if (success && artist.value) {
    // 检查是否有返回的页面信息或指定的页码
    const returnPage = parseInt(route.query.page as string);
    if (returnPage && returnPage > 0) {
      currentPage.value = returnPage;
      await fetchArtworks(returnPage, true);
    } else {
      await fetchArtworks(1);
    }
  }

  // 添加键盘事件监听器
  window.addEventListener('keydown', handleKeyDown);

  // 恢复滚动位置（延迟执行确保页面内容完全加载）
  setTimeout(() => {
    restoreScrollPosition(route.fullPath);
  }, 200);
});
</script>

<style scoped>
.artist-page {
  min-height: 100vh;
  background: var(--color-bg-secondary);
  padding: var(--spacing-2xl) 0;
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
  top: var(--spacing-2xl);
  right: var(--spacing-2xl);
  background: var(--color-success);
  color: white;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

.success-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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

/* 作者信息卡片 */
.artist-header {
  background: var(--color-bg-primary);
  border-radius: var(--radius-2xl);
  padding: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-2xl);
}

.artist-profile {
  display: flex;
  gap: var(--spacing-xl);
  align-items: flex-start;
  flex: 1;
  min-width: 0; /* 允许内容收缩 */
}

.artist-avatar {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.artist-info {
  flex: 1;
  min-width: 0; /* 允许文本截断 */
}

.artist-name {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--spacing-sm) 0;
  word-break: break-word;
}

.artist-account {
  color: var(--color-text-secondary);
  font-size: 1.125rem;
  margin: 0 0 var(--spacing-lg) 0;
  word-break: break-word;
}

.artist-comment {
  color: var(--color-text-primary);
  line-height: 1.6;
  margin: 0;
  word-break: break-word;
}

/* 作者操作区域 */
.artist-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  flex-shrink: 0;
  min-width: 200px;
}

.artist-follow-btn {
  white-space: nowrap;
}

/* 下载区域 */
.download-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.download-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.download-input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.download-label {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.download-select,
.download-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  min-width: 100px;
  transition: border-color var(--transition-normal);
}

.download-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.download-btn {
  white-space: nowrap;
}

/* 作品区域 */
.artworks-section {
  background: var(--color-bg-primary);
  border-radius: var(--radius-2xl);
  padding: var(--spacing-2xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.artwork-filters {
  display: flex;
  gap: var(--spacing-lg);
}

.filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

/* 顶部分页导航 */
.simple-pagination {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  box-shadow: var(--shadow-sm);
}

.simple-page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-normal);
  padding: 0;
}

.simple-page-btn:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

.simple-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.simple-page-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.simple-page-info {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  min-width: 3rem;
  text-align: center;
}

.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-2xl);
  margin-bottom: var(--spacing-2xl);
}

.empty-section {
  text-align: center;
  padding: 4rem 0;
  color: var(--color-text-secondary);
}

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.page-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.page-btn:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
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
  gap: var(--spacing-sm);
}

.page-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.page-number:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
}

.page-number.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.page-info {
  display: flex;
  justify-content: center;
  gap: var(--spacing-2xl);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.jump-to-page {
  display: flex;
  justify-content: center;
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.jump-input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.jump-input-group label {
  font-size: 0.875rem;
  color: var(--color-text-primary);
  font-weight: 500;
  white-space: nowrap;
}

.jump-input {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  min-width: 80px;
  text-align: center;
  transition: border-color var(--transition-normal);
}

.jump-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.jump-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  text-decoration: none;
  transition: all var(--transition-normal);
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  min-width: 80px;
}

.jump-btn:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.jump-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .artist-page {
    padding: var(--spacing-lg) 0;
  }

  .artist-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-xl);
    padding: var(--spacing-xl);
  }

  .artist-profile {
    flex-direction: column;
    text-align: center;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .artist-info {
    text-align: center;
  }

  .artist-name {
    font-size: 1.5rem;
  }

  .artist-account {
    font-size: 1rem;
  }

  .artist-actions {
    flex-direction: column;
    gap: var(--spacing-lg);
    min-width: auto;
  }

  .download-section {
    gap: var(--spacing-lg);
  }

  .download-controls {
    gap: var(--spacing-lg);
  }

  .download-input-group {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  .download-label {
    text-align: left;
  }

  .download-select,
  .download-input {
    width: 100%;
    min-width: auto;
  }

  .section-header {
    flex-direction: column;
    gap: var(--spacing-lg);
    align-items: stretch;
  }

  .header-controls {
    flex-direction: column;
    gap: var(--spacing-lg);
    align-items: stretch;
  }

  .simple-pagination {
    justify-content: center;
  }

  .artworks-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-xl);
  }

  .pagination {
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .page-numbers {
    order: -1;
  }

  .page-info {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }

  .jump-to-page {
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .jump-input-group {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  .jump-input,
  .jump-btn {
    width: 100%;
  }

  .success-message {
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    left: var(--spacing-lg);
    padding: var(--spacing-lg);
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  .artist-header {
    padding: var(--spacing-lg);
  }

  .artworks-section {
    padding: var(--spacing-lg);
  }

  .artist-name {
    font-size: 1.25rem;
  }

  .artist-account {
    font-size: 0.875rem;
  }
}
</style>