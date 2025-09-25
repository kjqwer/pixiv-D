<template>
  <div class="search-page">
    <div class="search-header">
      <div class="container">
        <h1 class="page-title">搜索作品</h1>

        <div class="search-form">
          <!-- 搜索类型选择 -->
          <div class="search-type-tabs">
            <button @click="handleSearchModeChange('keyword')" class="tab-btn"
              :class="{ active: searchMode === 'keyword' }">
              关键词搜索
            </button>
            <button @click="handleSearchModeChange('tags')" class="tab-btn" :class="{ active: searchMode === 'tags' }">
              标签搜索
            </button>
            <button @click="handleSearchModeChange('artwork')" class="tab-btn"
              :class="{ active: searchMode === 'artwork' }">
              作品ID
            </button>
            <button @click="handleSearchModeChange('artist')" class="tab-btn"
              :class="{ active: searchMode === 'artist' }">
              作者ID
            </button>
          </div>

          <!-- 关键词搜索 -->
          <div v-if="searchMode === 'keyword'" class="search-input-group">
            <input v-model="searchKeyword" type="text" placeholder="输入关键词搜索作品..." class="search-input"
              @keyup.enter="() => handleSearch()" />
            <button @click="() => handleSearch()" class="search-btn" :disabled="loading">
              <SvgIcon name="search" />
            </button>
          </div>

          <!-- 标签搜索 -->
          <div v-if="searchMode === 'tags'" class="tags-search-section">
            <div class="tags-input-group">
              <input v-model="tagInput" type="text" placeholder="输入标签，按回车或逗号分隔..." class="search-input"
                @keyup.enter="addTag" @keyup.space="addTag" @keyup.comma="addTag" />
              <button @click="addTag" class="search-btn" :disabled="loading">
                添加标签
              </button>
            </div>

            <!-- 已添加的标签 -->
            <div v-if="searchTags.length > 0" class="tags-display">
              <div class="tags-list">
                <span v-for="(tag, index) in searchTags" :key="index" class="tag-item">
                  {{ tag }}
                  <button @click="removeTag(index)" class="tag-remove" title="移除标签">
                    <SvgIcon name="close" />
                  </button>
                </span>
              </div>
              <button @click="() => handleTagSearch()" class="search-btn"
                :disabled="loading || searchTags.length === 0">
                搜索标签
              </button>
            </div>
          </div>

          <!-- 作品ID搜索 -->
          <div v-if="searchMode === 'artwork'" class="search-input-group">
            <input v-model="artworkId" type="text" placeholder="输入作品ID..." class="search-input"
              @keyup.enter="handleArtworkSearch" />
            <button @click="handleArtworkSearch" class="search-btn" :disabled="loading">
              查看作品
            </button>
          </div>

          <!-- 作者ID搜索 -->
          <div v-if="searchMode === 'artist'" class="search-input-group">
            <input v-model="artistId" type="text" placeholder="输入作者ID..." class="search-input"
              @keyup.enter="handleArtistSearch" />
            <button @click="handleArtistSearch" class="search-btn" :disabled="loading">
              查看作者
            </button>
          </div>

          <div class="search-filters">
            <select v-model="searchType" @change="updateFiltersInUrl" class="filter-select">
              <option value="all">全部类型</option>
              <option value="art">插画</option>
              <option value="manga">漫画</option>
              <option value="novel">小说</option>
            </select>

            <select v-model="searchSort" @change="updateFiltersInUrl" class="filter-select">
              <option value="date_desc">最新</option>
              <option value="date_asc">最旧</option>
              <option value="popular_desc">最受欢迎（会员专属，这里不生效）</option>
            </select>

            <select v-model="searchDuration" @change="updateFiltersInUrl" class="filter-select">
              <option value="all">全部时间</option>
              <option value="within_last_day">最近一天</option>
              <option value="within_last_week">最近一周</option>
              <option value="within_last_month">最近一月</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="search-content">
      <div class="container">
        <div v-if="error" class="error-section">
          <ErrorMessage :error="error" @dismiss="clearError" />
        </div>

        <!-- 作者搜索模式 -->
        <div v-if="searchMode === 'artist'" class="artist-search-section">
          <ArtistSearch ref="artistSearchRef" @download="handleArtistDownload" />
        </div>

        <!-- 作品搜索模式 -->
        <div v-else>
          <div v-if="loading" class="loading-section">
            <LoadingSpinner text="搜索中..." />
          </div>

          <div v-else-if="searchResults.length > 0" class="results-section">
            <div class="results-header">
              <h2>搜索结果 ({{ totalResults }})</h2>
            </div>

            <div class="artworks-grid">
              <ArtworkCard v-for="artwork in searchResults" :key="artwork.id" :artwork="artwork"
                @click="handleArtworkClick" />
            </div>

            <!-- 分页导航 -->
            <div v-if="totalPages > 1" class="pagination-section">
              <div class="pagination">
                <button @click="goToPage(currentPage - 1)" class="page-btn" :disabled="currentPage <= 1"
                  :title="`上一页(快捷键: ←)`">
                  上一页
                </button>

                <button v-for="page in visiblePages" :key="page" @click="goToPage(page)" class="page-btn"
                  :class="{ active: page === currentPage }">
                  {{ page }}
                </button>

                <button @click="goToPage(currentPage + 1)" class="page-btn" :disabled="currentPage >= totalPages"
                  :title="`下一页(快捷键: →)`">
                  下一页
                </button>
              </div>

              <!-- 跳转到指定页面 -->
              <div class="jump-to-page">
                <div class="jump-input-group">
                  <label for="jumpPage">跳转到:</label>
                  <input v-model="jumpPageInput" type="number" id="jumpPage" class="jump-input" :min="1"
                    :max="totalPages" placeholder="页码" @keyup.enter="handleJumpToPage" />
                  <button @click="handleJumpToPage" class="jump-btn" :disabled="!jumpPageInput || jumping">
                    {{ jumping ? '跳转中...' : '跳转' }}
                  </button>
                </div>
              </div>

              <!-- 页面信息 -->
              <div class="page-info">
                <span>第 {{ currentPage }} 页，共 {{ totalPages }} 页</span>
                <span>共 {{ totalResults }} 个作品</span>
              </div>
            </div>
          </div>

          <div v-else-if="hasSearched" class="empty-section">
            <div class="empty-content">
              <SvgIcon name="search" class="empty-icon" />
              <h3>未找到相关作品</h3>
              <p>尝试使用不同的关键词或调整搜索条件</p>
            </div>
          </div>

          <div v-else class="welcome-section">
            <div class="welcome-content">
              <h2>开始搜索</h2>
              <p>输入关键词来搜索你喜欢的作品</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import artworkService from '@/services/artwork';
import { saveScrollPosition, restoreScrollPosition } from '@/utils/scrollManager';
import type { Artwork, SearchParams } from '@/types';

import ArtworkCard from '@/components/artwork/ArtworkCard.vue';
import ArtistSearch from '@/components/search/ArtistSearch.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// 搜索状态
const searchKeyword = ref('');
const searchMode = ref<'keyword' | 'tags' | 'artwork' | 'artist'>('keyword');
const artworkId = ref('');
const artistId = ref('');
const searchTags = ref<string[]>([]);
const tagInput = ref('');

// 关键词搜索参数
const searchType = ref<'all' | 'art' | 'manga' | 'novel'>('all');
const searchSort = ref<'date_desc' | 'date_asc' | 'popular_desc'>('date_desc');
const searchDuration = ref<'all' | 'within_last_day' | 'within_last_week' | 'within_last_month'>('all');

// 结果状态
const searchResults = ref<Artwork[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const hasSearched = ref(false);
const artistSearchRef = ref();

// 分页状态
const currentPage = ref(1);
const pageSize = ref(30);
const totalPages = ref(0);
const totalResults = ref(0);

// 跳转到指定页面相关
const jumpPageInput = ref<string | number>('');
const jumping = ref(false);

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

const handleSearch = async (page = 1) => {
  if (!searchKeyword.value.trim()) {
    return;
  }

  // 更新URL参数
  const query: any = { ...route.query };
  query.keyword = searchKeyword.value.trim();
  query.mode = 'keyword';
  query.page = page.toString();
  // 清除标签相关参数
  delete query.tags;
  router.push({ query });

  try {
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    hasSearched.value = true;

    const offset = (page - 1) * pageSize.value;
    const params: SearchParams = {
      keyword: searchKeyword.value.trim(),
      type: searchType.value,
      sort: searchSort.value,
      duration: searchDuration.value,
      offset: offset,
      limit: pageSize.value
    };

    const response = await artworkService.searchArtworks(params);

    if (response.success && response.data) {
      searchResults.value = response.data.artworks;

      // 基于 next_url 来判断是否还有更多页面
      const hasMore = !!response.data.next_url;

      if (page === 1) {
        // 第一页，基于是否有下一页来判断总数
        if (hasMore) {
          // 如果有下一页，至少说明有2页
          totalResults.value = pageSize.value * 2;
          totalPages.value = 2;
        } else {
          // 没有下一页，说明只有1页
          totalResults.value = response.data.artworks?.length || 0;
          totalPages.value = 1;
        }
      } else {
        // 非第一页，基于当前页面位置和是否有下一页来判断
        if (hasMore) {
          // 如果有下一页，说明至少还有1页
          totalResults.value = Math.max(totalResults.value, (page + 1) * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page + 1);
        } else {
          // 没有下一页，说明这是最后一页
          totalResults.value = Math.max(totalResults.value, page * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page);
        }
      }
    } else {
      throw new Error(response.error || '搜索失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索失败';
    console.error('搜索失败:', err);
  } finally {
    loading.value = false;
  }
};

// 跳转到指定页面
const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;

  // 更新URL参数
  const query: any = { ...route.query };
  query.page = page.toString();
  router.push({ query });

  // 根据当前搜索模式执行搜索
  if (searchMode.value === 'keyword' && searchKeyword.value.trim()) {
    handleSearch(page);
  } else if (searchMode.value === 'tags' && searchTags.value.length > 0) {
    handleTagSearch(page);
  }
};

const handleArtworkClick = (artwork: Artwork) => {
  // 保存当前页面的滚动位置
  saveScrollPosition(route.fullPath);

  router.push({
    path: `/artwork/${artwork.id}`,
    query: {
      returnUrl: route.fullPath,
      scrollTop: (window.scrollY || document.documentElement.scrollTop).toString()
    }
  });
};

// 作品ID搜索
const handleArtworkSearch = () => {
  const idStr = artworkId.value?.toString().trim();
  if (!idStr) {
    error.value = '请输入作品ID';
    return;
  }

  const id = parseInt(idStr);
  if (isNaN(id)) {
    error.value = '请输入有效的作品ID';
    return;
  }

  // 更新URL参数
  const query: any = { ...route.query };
  query.artworkId = idStr;
  query.mode = 'artwork';
  // 清除其他搜索参数
  delete query.keyword;
  delete query.tags;
  delete query.page;
  router.push({ query });

  router.push(`/artwork/${id}`);
};

// 作者ID搜索
const handleArtistSearch = () => {
  const idStr = artistId.value?.toString().trim();
  if (!idStr) {
    error.value = '请输入作者ID';
    return;
  }

  const id = parseInt(idStr);
  if (isNaN(id)) {
    error.value = '请输入有效的作者ID';
    return;
  }

  // 更新URL参数
  const query: any = { ...route.query };
  query.artistId = idStr;
  query.mode = 'artist';
  // 清除其他搜索参数
  delete query.keyword;
  delete query.tags;
  delete query.page;
  router.push({ query });

  // 切换到作者搜索模式并跳转
  searchMode.value = 'artist';
  router.push(`/artist/${id}`);
};

// 标签相关方法
const addTag = () => {
  const tag = tagInput.value.trim();
  if (tag && !searchTags.value.includes(tag)) {
    searchTags.value.push(tag);
    tagInput.value = '';

    // 更新URL参数
    updateSearchTagsInUrl();
  }
};

const removeTag = (index: number) => {
  searchTags.value.splice(index, 1);

  // 更新URL参数
  updateSearchTagsInUrl();
};

// 更新URL中的搜索标签参数
const updateSearchTagsInUrl = () => {
  const query: any = { ...route.query };

  if (searchTags.value.length > 0) {
    query.tags = searchTags.value;
    query.mode = 'tags';
    delete query.page; // 重置页码
  } else {
    // 如果没有标签，清除相关参数
    delete query.tags;
    delete query.mode;
    delete query.page;
  }

  router.push({ query });
};

// 更新搜索过滤器到URL
const updateFiltersInUrl = () => {
  const query: any = { ...route.query };

  if (searchType.value !== 'all') query.type = searchType.value;
  else delete query.type;

  if (searchSort.value !== 'date_desc') query.sort = searchSort.value;
  else delete query.sort;

  if (searchDuration.value !== 'all') query.duration = searchDuration.value;
  else delete query.duration;

  router.push({ query });
};

// 处理搜索模式切换
const handleSearchModeChange = (mode: 'keyword' | 'tags' | 'artwork' | 'artist') => {
  searchMode.value = mode;

  // 清除其他模式的输入
  if (mode !== 'keyword') searchKeyword.value = '';
  if (mode !== 'tags') {
    searchTags.value = [];
    tagInput.value = '';
  }
  if (mode !== 'artwork') artworkId.value = '';
  if (mode !== 'artist') artistId.value = '';

  // 更新URL参数，清除不相关的参数
  const query: any = { ...route.query };
  query.mode = mode;
  delete query.page; // 重置页码

  // 根据模式清除不相关的参数
  if (mode !== 'keyword') delete query.keyword;
  if (mode !== 'tags') {
    delete query.tags;
    delete query.tag;
  }
  if (mode !== 'artwork') delete query.artworkId;
  if (mode !== 'artist') delete query.artistId;

  router.push({ query });
};

const handleSingleTagSearch = async (page = 1) => {
  if (searchTags.value.length === 0) {
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    hasSearched.value = true;

    const offset = (page - 1) * pageSize.value;
    const params: SearchParams = {
      tags: searchTags.value,
      type: searchType.value,
      sort: searchSort.value,
      duration: searchDuration.value,
      offset: offset,
      limit: pageSize.value
    };

    const response = await artworkService.searchArtworks(params);

    if (response.success && response.data) {
      searchResults.value = response.data.artworks;

      // 基于 next_url 来判断是否还有更多页面
      const hasMore = !!response.data.next_url;

      if (page === 1) {
        // 第一页，基于是否有下一页来判断总数
        if (hasMore) {
          // 如果有下一页，至少说明有2页
          totalResults.value = pageSize.value * 2;
          totalPages.value = 2;
        } else {
          // 没有下一页，说明只有1页
          totalResults.value = response.data.artworks?.length || 0;
          totalPages.value = 1;
        }
      } else {
        // 非第一页，基于当前页面位置和是否有下一页来判断
        if (hasMore) {
          // 如果有下一页，说明至少还有1页
          totalResults.value = Math.max(totalResults.value, (page + 1) * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page + 1);
        } else {
          // 没有下一页，说明这是最后一页
          totalResults.value = Math.max(totalResults.value, page * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page);
        }
      }
    } else {
      throw new Error(response.error || '标签搜索失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '标签搜索失败';
    console.error('标签搜索失败:', err);
  } finally {
    loading.value = false;
  }
};

const handleTagSearch = async (page = 1) => {
  if (searchTags.value.length === 0) {
    return;
  }

  // 更新URL参数
  const query: any = { ...route.query };
  query.tags = searchTags.value;
  query.mode = 'tags';
  query.page = page.toString();
  // 清除关键词相关参数
  delete query.keyword;
  router.push({ query });

  try {
    loading.value = true;
    error.value = null;
    currentPage.value = page;
    hasSearched.value = true;

    const offset = (page - 1) * pageSize.value;
    const params: SearchParams = {
      tags: searchTags.value,
      type: searchType.value,
      sort: searchSort.value,
      duration: searchDuration.value,
      offset: offset,
      limit: pageSize.value
    };

    const response = await artworkService.searchArtworks(params);

    if (response.success && response.data) {
      searchResults.value = response.data.artworks;

      // 基于 next_url 来判断是否还有更多页面
      const hasMore = !!response.data.next_url;

      if (page === 1) {
        // 第一页，基于是否有下一页来判断总数
        if (hasMore) {
          // 如果有下一页，至少说明有2页
          totalResults.value = pageSize.value * 2;
          totalPages.value = 2;
        } else {
          // 没有下一页，说明只有1页
          totalResults.value = response.data.artworks?.length || 0;
          totalPages.value = 1;
        }
      } else {
        // 非第一页，基于当前页面位置和是否有下一页来判断
        if (hasMore) {
          // 如果有下一页，说明至少还有1页
          totalResults.value = Math.max(totalResults.value, (page + 1) * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page + 1);
        } else {
          // 没有下一页，说明这是最后一页
          totalResults.value = Math.max(totalResults.value, page * pageSize.value);
          totalPages.value = Math.max(totalPages.value, page);
        }
      }
    } else {
      throw new Error(response.error || '标签搜索失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '标签搜索失败';
    console.error('标签搜索失败:', err);
  } finally {
    loading.value = false;
  }
};

const clearError = () => {
  error.value = null;
};

// 处理作者下载
const handleArtistDownload = (artist: any) => {
  // 这里可以添加下载作者的逻辑
  // 暂时跳转到作者页面
  router.push(`/artist/${artist.id}`);
};

// 跳转到指定页面
const handleJumpToPage = async () => {
  const page = parseInt(jumpPageInput.value as string);
  if (isNaN(page) || page < 1 || page > totalPages.value) {
    error.value = '请输入有效的页码';
    return;
  }

  jumping.value = true;
  jumpPageInput.value = ''; // 清空输入框

  // 更新URL参数
  const query: any = { ...route.query };
  query.page = page.toString();
  router.push({ query });

  try {
    // 根据当前搜索模式执行搜索
    if (searchMode.value === 'keyword' && searchKeyword.value.trim()) {
      await handleSearch(page);
    } else if (searchMode.value === 'tags' && searchTags.value.length > 0) {
      await handleTagSearch(page);
    }
  } finally {
    jumping.value = false;
  }
};

// 监听路由变化，处理URL参数
watch(() => route.query, () => {
  const urlMode = route.query.mode as string;
  const urlKeyword = route.query.keyword as string;
  const urlTag = route.query.tag as string;
  const urlTags = route.query.tags;
  const urlType = route.query.type as string;
  const urlSort = route.query.sort as string;
  const urlDuration = route.query.duration as string;
  const urlArtworkId = route.query.artworkId as string;
  const urlArtistId = route.query.artistId as string;
  const urlPage = route.query.page as string;

  // 恢复搜索模式
  if (urlMode) {
    searchMode.value = urlMode as 'keyword' | 'tags' | 'artwork' | 'artist';
  }

  // 恢复关键词
  if (urlKeyword) {
    searchKeyword.value = urlKeyword;
  }

  // 恢复作品ID
  if (urlArtworkId) {
    artworkId.value = urlArtworkId;
  }

  // 恢复作者ID
  if (urlArtistId) {
    artistId.value = urlArtistId;
  }

  // 恢复页码
  const returnPage = parseInt(urlPage);
  if (returnPage && returnPage > 0) {
    currentPage.value = returnPage;
  }

  // 恢复标签
  if (urlMode === 'tags') {
    if (urlTags) {
      // 处理多个标签
      if (Array.isArray(urlTags)) {
        searchTags.value = urlTags.filter(tag => tag !== null) as string[];
      } else {
        searchTags.value = urlTags ? [urlTags] : [];
      }
      // 保存到sessionStorage
      sessionStorage.setItem('currentSearchTags', JSON.stringify(searchTags.value));

      // 如果有多个标签，自动执行搜索
      if (searchTags.value.length > 0) {
        handleTagSearch(returnPage || 1);
      }
    } else if (urlTag) {
      // 处理单个标签
      searchTags.value = [urlTag];
      // 清除sessionStorage中的多标签选择
      sessionStorage.removeItem('currentSearchTags');

      // 对于单个标签，直接执行搜索而不更新URL
      if (searchTags.value.length > 0) {
        handleSingleTagSearch(returnPage || 1);
      }
    }
  } else if (urlMode === 'keyword' && urlKeyword) {
    // 如果是关键词搜索模式且有关键词，自动执行搜索
    handleSearch(returnPage || 1);
  }

  // 恢复过滤器
  if (urlType) searchType.value = urlType as 'all' | 'art' | 'manga' | 'novel';
  if (urlSort) searchSort.value = urlSort as 'date_desc' | 'date_asc' | 'popular_desc';
  if (urlDuration) searchDuration.value = urlDuration as 'all' | 'within_last_day' | 'within_last_week' | 'within_last_month';
}, { immediate: true });

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // 检查是否在输入框中，如果是则不处理
  const target = event.target as HTMLElement;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  // 只有在有搜索结果且有多页时才处理键盘事件
  if (totalPages.value <= 1 || searchResults.value.length === 0 || searchMode.value === 'artist') {
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

// 组件挂载时恢复滚动位置
onMounted(() => {
  // 添加键盘事件监听器
  window.addEventListener('keydown', handleKeyDown);

  setTimeout(() => {
    restoreScrollPosition(route.fullPath);
  }, 200);
});

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.search-page {
  min-height: 100vh;
  background: #f8fafc;
}

.search-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 2rem;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-type-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #6b7280;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.tab-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.search-btn {
  padding: 0.75rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-btn:hover:not(:disabled) {
  background: #2563eb;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* 标签搜索样式 */
.tags-search-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tags-input-group {
  display: flex;
  gap: 0.5rem;
}

.tags-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  background: none;
  border: none;
  color: #0369a1;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.tag-remove:hover {
  background: #0369a1;
  color: white;
}

.tag-remove svg {
  width: 0.75rem;
  height: 0.75rem;
}

.search-filters {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
}

.search-content {
  padding: 2rem 0;
}

.artist-search-section {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.error-section,
.loading-section {
  margin-bottom: 2rem;
}

.results-section {
  margin-bottom: 2rem;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.results-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

/* 分页样式 */
.pagination-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  margin-top: 2rem;
}

.pagination {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  min-width: 2.5rem;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.page-info {
  display: flex;
  justify-content: center;
  gap: 2rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.empty-section,
.welcome-section {
  text-align: center;
  padding: 4rem 0;
}

.empty-content,
.welcome-content {
  max-width: 400px;
  margin: 0 auto;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.empty-content h3,
.welcome-content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.empty-content p,
.welcome-content p {
  color: #6b7280;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .search-filters {
    flex-direction: column;
  }

  .filter-select {
    width: 100%;
  }

  .results-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .artworks-grid {
    grid-template-columns: 1fr;
  }

  .tags-input-group {
    flex-direction: column;
  }

  .tags-list {
    justify-content: flex-start;
  }

  .tag-item {
    font-size: 0.75rem;
    padding: 0.375rem 0.625rem;
  }

  .pagination {
    flex-wrap: wrap;
    justify-content: center;
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