<template>
  <div class="ranking-page">
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

      <div v-else class="ranking-content">
        <!-- 排行榜头部信息 -->
        <RankingHeader :currentMode="currentMode" :currentType="currentType" @mode-change="handleModeChange"
          @type-change="handleTypeChange" @download-success="handleDownloadSuccess"
          @download-error="handleDownloadError" />

        <!-- 排行榜统计信息 -->
        <RankingStats :totalCount="totalCount" :currentPage="currentPage" :totalPages="totalPages" />

        <!-- 作品列表 -->
        <div class="artworks-section">
          <div v-if="artworksLoading" class="loading-section">
            <LoadingSpinner text="加载作品中..." />
          </div>

          <div v-else-if="artworks && artworks.length > 0" class="artworks-grid">
            <ArtworkCard v-for="artwork in artworks" :key="artwork.id" :artwork="artwork" @click="handleArtworkClick" />
          </div>

          <div v-else class="empty-section">
            <p>暂无作品</p>
          </div>

          <!-- 分页导航 -->
          <RankingPagination v-if="totalPages > 1 && artworks && artworks.length > 0" :currentPage="currentPage"
            :totalPages="totalPages" :visiblePages="visiblePages" @page-change="goToPage" />

          <!-- 跳转到指定页面 -->
          <div v-if="totalPages > 1 && artworks && artworks.length > 0" class="jump-to-page">
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
          <div v-if="totalPages > 1 && artworks && artworks.length > 0" class="page-info">
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
import rankingService from '@/services/ranking';
import downloadService from '@/services/download';
import { saveScrollPosition, restoreScrollPosition } from '@/utils/scrollManager';
import type { Artwork } from '@/types';

import ArtworkCard from '@/components/artwork/ArtworkCard.vue';
import RankingHeader from '@/components/ranking/RankingHeader.vue';
import RankingStats from '@/components/ranking/RankingStats.vue';
import RankingPagination from '@/components/ranking/RankingPagination.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// 状态
const artworks = ref<Artwork[]>([]);
const loading = ref(false);
const artworksLoading = ref(false);
const error = ref<string | null>(null);
const downloadSuccess = ref<string | null>(null);

// 筛选和分页状态
const currentMode = ref<'day' | 'week' | 'month'>('day');
const currentType = ref<'art' | 'manga' | 'novel'>('art');
const currentPage = ref(1);
const pageSize = ref(30);
const totalCount = ref(0);
const totalPages = ref(0);

// 跳转到指定页面相关
const jumpPageInput = ref<string | number>('');
const jumping = ref(false);

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
const getCacheKey = (mode: string, type: string, page: number) => {
  return `${mode}_${type}_${page}`;
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

// 获取排行榜数据
const fetchRankingData = async (page = 1) => {
  const cacheKey = getCacheKey(currentMode.value, currentType.value, page);
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
    error.value = null;

    const offset = (page - 1) * pageSize.value;
    const response = await rankingService.getRanking({
      mode: currentMode.value,
      type: currentType.value,
      offset: offset,
      limit: pageSize.value
    });

    if (response.success && response.data) {
      // 根据后端返回的数据结构，artworks在 response.data.data.artworks
      const rankingData = response.data.data || response.data;
      artworks.value = rankingData.artworks || [];

      // 基于 next_url 来判断是否还有更多页面
      const hasMore = !!rankingData.next_url;

      if (page === 1) {
        // 第一页，基于是否有下一页来判断总数
        if (hasMore) {
          // 如果有下一页，至少说明有2页
          totalCount.value = pageSize.value * 2;
          totalPages.value = 2;
        } else {
          // 没有下一页，说明只有1页
          totalCount.value = rankingData.artworks?.length || 0;
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
        artworks: rankingData.artworks || [],
        totalCount: totalCount.value,
        totalPages: totalPages.value
      });
    } else {
      throw new Error(response.error || '获取排行榜失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取排行榜失败';
    console.error('获取排行榜失败:', err);
  } finally {
    artworksLoading.value = false;
  }
};

// 处理模式切换
const handleModeChange = (mode: 'day' | 'week' | 'month') => {
  currentMode.value = mode;
  currentPage.value = 1;

  // 更新URL参数
  router.push({
    query: {
      mode: mode,
      type: currentType.value,
      page: undefined
    }
  });

  fetchRankingData(1);
};

// 处理类型切换
const handleTypeChange = (type: 'art' | 'manga' | 'novel') => {
  currentType.value = type;
  currentPage.value = 1;

  // 更新URL参数
  router.push({
    query: {
      mode: currentMode.value,
      type: type,
      page: undefined
    }
  });

  fetchRankingData(1);
};

// 跳转到指定页面
const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;

  // 更新URL参数
  router.push({
    query: {
      mode: currentMode.value,
      type: currentType.value,
      page: page.toString()
    }
  });

  fetchRankingData(page);
};

// 点击作品
const handleArtworkClick = (artwork: Artwork) => {
  // 保存当前页面的滚动位置
  saveScrollPosition(route.fullPath);

  router.push({
    path: `/artwork/${artwork.id}`,
    query: {
      rankingMode: currentMode.value,
      rankingType: currentType.value,
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

// 处理下载成功
const handleDownloadSuccess = (message: string) => {
  downloadSuccess.value = message;
  // 3秒后清除成功提示
  setTimeout(() => {
    downloadSuccess.value = null;
  }, 3000);
};

// 处理下载错误
const handleDownloadError = (errorMessage: string) => {
  error.value = errorMessage;
};

// 跳转到指定页面
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
      mode: currentMode.value,
      type: currentType.value,
      page: page.toString()
    }
  });

  try {
    await fetchRankingData(page);
  } finally {
    jumping.value = false;
  }
};

// 监听路由变化
watch(() => route.query, () => {
  // 恢复模式、类型和页码状态
  const urlMode = route.query.mode as string;
  const urlType = route.query.type as string;
  const urlPage = route.query.page as string;

  let hasChanges = false;

  // 恢复模式
  if (urlMode && ['day', 'week', 'month'].includes(urlMode) && urlMode !== currentMode.value) {
    currentMode.value = urlMode as 'day' | 'week' | 'month';
    hasChanges = true;
  }

  // 恢复类型
  if (urlType && ['art', 'manga', 'novel'].includes(urlType) && urlType !== currentType.value) {
    currentType.value = urlType as 'art' | 'manga' | 'novel';
    hasChanges = true;
  }

  // 恢复页码
  const returnPage = parseInt(urlPage);
  if (returnPage && returnPage > 0 && returnPage !== currentPage.value) {
    currentPage.value = returnPage;
    hasChanges = true;
  }

  // 如果有变化，重新获取数据
  if (hasChanges) {
    fetchRankingData(currentPage.value);
  }
});

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // 检查是否在输入框中，如果是则不处理
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  // 只有在有多页且有作品时才处理键盘事件
  if (totalPages.value <= 1 || !artworks.value || artworks.value.length === 0) {
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
  // 检查URL参数并恢复状态
  const urlMode = route.query.mode as string;
  const urlType = route.query.type as string;
  const urlPage = route.query.page as string;

  // 恢复模式
  if (urlMode && ['day', 'week', 'month'].includes(urlMode)) {
    currentMode.value = urlMode as 'day' | 'week' | 'month';
  }

  // 恢复类型
  if (urlType && ['art', 'manga', 'novel'].includes(urlType)) {
    currentType.value = urlType as 'art' | 'manga' | 'novel';
  }

  // 恢复页码
  const returnPage = parseInt(urlPage);
  if (returnPage && returnPage > 0) {
    currentPage.value = returnPage;
    await fetchRankingData(returnPage);
  } else {
    await fetchRankingData(1);
  }

  // 添加键盘事件监听器
  window.addEventListener('keydown', handleKeyDown);

  // 恢复滚动位置
  setTimeout(() => {
    restoreScrollPosition(route.fullPath);
  }, 200);
});
</script>

<style scoped>
.ranking-page {
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

.ranking-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.artworks-section {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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
}

.jump-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  width: fit-content;
}

.jump-input {
  border: none;
  background: transparent;
  padding: 0.5rem 0.25rem;
  font-size: 0.875rem;
  width: 50px;
  text-align: center;
}

.jump-input:focus {
  outline: none;
}

.jump-btn {
  background: #4f46e5;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s ease;
}

.jump-btn:hover:not(:disabled) {
  background: #4338ca;
}

.jump-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  color: #6b7280;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .artworks-grid {
    grid-template-columns: 1fr;
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