<template>
    <div class="search-page">
      <div class="search-header">
        <div class="container">
          <h1 class="page-title">搜索作品</h1>
          
                  <div class="search-form">
          <!-- 搜索类型选择 -->
          <div class="search-type-tabs">
            <button 
              @click="searchMode = 'keyword'" 
              class="tab-btn"
              :class="{ active: searchMode === 'keyword' }"
            >
              关键词搜索
            </button>
            <button 
              @click="searchMode = 'artwork'" 
              class="tab-btn"
              :class="{ active: searchMode === 'artwork' }"
            >
              作品ID
            </button>
            <button 
              @click="searchMode = 'artist'" 
              class="tab-btn"
              :class="{ active: searchMode === 'artist' }"
            >
              作者ID
            </button>
          </div>

          <!-- 关键词搜索 -->
          <div v-if="searchMode === 'keyword'" class="search-input-group">
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="输入关键词搜索作品..."
              class="search-input"
              @keyup.enter="handleSearch"
            />
            <button @click="handleSearch" class="search-btn" :disabled="loading">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          </div>

          <!-- 作品ID搜索 -->
          <div v-if="searchMode === 'artwork'" class="search-input-group">
            <input
              v-model="artworkId"
              type="text"
              placeholder="输入作品ID..."
              class="search-input"
              @keyup.enter="handleArtworkSearch"
            />
            <button @click="handleArtworkSearch" class="search-btn" :disabled="loading">
              查看作品
            </button>
          </div>

          <!-- 作者ID搜索 -->
          <div v-if="searchMode === 'artist'" class="search-input-group">
            <input
              v-model="artistId"
              type="text"
              placeholder="输入作者ID..."
              class="search-input"
              @keyup.enter="handleArtistSearch"
            />
            <button @click="handleArtistSearch" class="search-btn" :disabled="loading">
              查看作者
            </button>
          </div>
            
            <div class="search-filters">
              <select v-model="searchType" class="filter-select">
                <option value="all">全部类型</option>
                <option value="art">插画</option>
                <option value="manga">漫画</option>
                <option value="novel">小说</option>
              </select>
              
              <select v-model="searchSort" class="filter-select">
                <option value="date_desc">最新</option>
                <option value="date_asc">最旧</option>
                <option value="popular_desc">最受欢迎</option>
              </select>
              
              <select v-model="searchDuration" class="filter-select">
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
  
          <div v-if="loading" class="loading-section">
            <LoadingSpinner text="搜索中..." />
          </div>
  
          <div v-else-if="searchResults.length > 0" class="results-section">
            <div class="results-header">
              <h2>搜索结果 ({{ totalResults }})</h2>
              <div class="results-actions">
                <button @click="loadMore" class="btn btn-secondary" :disabled="loadingMore">
                  {{ loadingMore ? '加载中...' : '加载更多' }}
                </button>
              </div>
            </div>
            
            <div class="artworks-grid">
              <ArtworkCard
                v-for="artwork in searchResults"
                :key="artwork.id"
                :artwork="artwork"
                @click="handleArtworkClick"
              />
            </div>
          </div>
  
          <div v-else-if="hasSearched" class="empty-section">
            <div class="empty-content">
              <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
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
  </template>
  
  <script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';
  import artworkService from '@/services/artwork';
  import type { Artwork, SearchParams } from '@/types';
  import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
  import ErrorMessage from '@/components/common/ErrorMessage.vue';
  import ArtworkCard from '@/components/artwork/ArtworkCard.vue';
  
  const router = useRouter();
  const authStore = useAuthStore();
  
  // 搜索状态
  const searchKeyword = ref('');
  const searchMode = ref<'keyword' | 'artwork' | 'artist'>('keyword');
  const artworkId = ref('');
  const artistId = ref('');
  
  // 关键词搜索参数
  const searchType = ref<'all' | 'art' | 'manga' | 'novel'>('all');
  const searchSort = ref<'date_desc' | 'date_asc' | 'popular_desc'>('date_desc');
  const searchDuration = ref<'all' | 'within_last_day' | 'within_last_week' | 'within_last_month'>('all');
  
  // 结果状态
  const searchResults = ref<Artwork[]>([]);
  const totalResults = ref(0);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const hasSearched = ref(false);
  const offset = ref(0);
  
  const handleSearch = async () => {
    if (!searchKeyword.value.trim()) {
      return;
    }
  
    try {
      loading.value = true;
      error.value = null;
      offset.value = 0;
      hasSearched.value = true;
  
      const params: SearchParams = {
        keyword: searchKeyword.value.trim(),
        type: searchType.value,
        sort: searchSort.value,
        duration: searchDuration.value,
        offset: 0,
        limit: 30
      };
  
      const response = await artworkService.searchArtworks(params);
      
      if (response.success && response.data) {
        searchResults.value = response.data.artworks;
        totalResults.value = response.data.total;
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
  
  const loadMore = async () => {
    if (!searchKeyword.value.trim() || loadingMore.value) {
      return;
    }
  
    try {
      loadingMore.value = true;
      offset.value += 30;
  
      const params: SearchParams = {
        keyword: searchKeyword.value.trim(),
        type: searchType.value,
        sort: searchSort.value,
        duration: searchDuration.value,
        offset: offset.value,
        limit: 30
      };
  
      const response = await artworkService.searchArtworks(params);
      
      if (response.success && response.data) {
        searchResults.value.push(...response.data.artworks);
      } else {
        throw new Error(response.error || '加载更多失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载更多失败';
      console.error('加载更多失败:', err);
    } finally {
      loadingMore.value = false;
    }
  };
  
  const handleArtworkClick = (artwork: Artwork) => {
    router.push(`/artwork/${artwork.id}`);
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
  
  router.push(`/artist/${id}`);
};

const clearError = () => {
  error.value = null;
};
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
  
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }
  
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .artworks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 2rem;
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
  }
  </style>