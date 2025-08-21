<template>
  <div class="artists-page">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">作者管理</h1>
        <div class="header-actions">
          <div class="search-box">
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="搜索作者..."
              class="search-input"
              @keyup.enter="handleSearch"
            />
            <button @click="handleSearch" class="search-btn">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          </div>
          <button @click="handleRefresh" class="btn btn-secondary" :disabled="artistStore.loading">
            <svg viewBox="0 0 24 24" fill="currentColor" class="refresh-icon">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            刷新
          </button>
        </div>
      </div>

      <div v-if="artistStore.error" class="error-section">
        <ErrorMessage :error="artistStore.error" @dismiss="artistStore.clearError" />
      </div>

      <div v-if="artistStore.loading" class="loading-section">
        <LoadingSpinner text="正在获取最新数据..." />
      </div>

      <div v-else class="artists-content">
        <!-- 关注列表 -->
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">关注的作者</h2>
            <div v-if="artistStore.hasFollowingArtists" class="cache-indicator">
              <span v-if="artistStore.isDataStale" class="cache-status stale">
                <svg viewBox="0 0 24 24" fill="currentColor" class="cache-icon">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                数据已过期
              </span>
              <span v-else class="cache-status fresh">
                <svg viewBox="0 0 24 24" fill="currentColor" class="cache-icon">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                数据已缓存
              </span>
            </div>
          </div>
          
          <div v-if="artistStore.followingArtists.length > 0" class="artists-grid">
            <div 
              v-for="artist in artistStore.followingArtists" 
              :key="artist.id"
              class="artist-card"
            >
              <div class="artist-header">
                <img 
                  :src="getImageUrl(artist.profile_image_urls.medium)" 
                  :alt="artist.name"
                  class="artist-avatar"
                  crossorigin="anonymous"
                />
                <div class="artist-info">
                  <h3 class="artist-name">{{ artist.name }}</h3>
                  <p class="artist-account">@{{ artist.account }}</p>
                </div>
                <div class="artist-actions">
                  <button @click="handleUnfollow(artist.id)" class="btn btn-danger btn-small">
                    取消关注
                  </button>
                </div>
              </div>
              
              <div class="artist-stats">
                <div class="stat">
                  <span class="stat-number">{{ artist.total_illusts }}</span>
                  <span class="stat-label">插画</span>
                </div>
                <div class="stat">
                  <span class="stat-number">{{ artist.total_manga }}</span>
                  <span class="stat-label">漫画</span>
                </div>
                <div class="stat">
                  <span class="stat-number">{{ artist.total_followers }}</span>
                  <span class="stat-label">粉丝</span>
                </div>
              </div>
              
              <div class="artist-actions-bottom">
                <router-link :to="`/artist/${artist.id}`" class="btn btn-primary btn-small">
                  查看作品
                </router-link>
                <button @click="handleDownloadArtist(artist.id)" class="btn btn-secondary btn-small">
                  下载作品
                </button>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-section">
            <div class="empty-content">
              <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <h3>暂无关注的作者</h3>
              <p>关注喜欢的作者，在这里管理他们</p>
              <div v-if="!artistStore.loading && artistStore.hasFollowingArtists" class="cache-note">
                <small>💡 提示：数据已缓存，点击刷新按钮获取最新数据</small>
              </div>
            </div>
          </div>
        </div>

        <!-- 搜索建议 -->
        <div v-if="artistStore.searchResults.length > 0" class="section">
          <h2 class="section-title">搜索结果</h2>
          <div class="artists-grid">
            <div 
              v-for="artist in artistStore.searchResults" 
              :key="artist.id"
              class="artist-card"
            >
              <div class="artist-header">
                <img 
                  :src="getImageUrl(artist.profile_image_urls.medium)" 
                  :alt="artist.name"
                  class="artist-avatar"
                  crossorigin="anonymous"
                />
                <div class="artist-info">
                  <h3 class="artist-name">{{ artist.name }}</h3>
                  <p class="artist-account">@{{ artist.account }}</p>
                </div>
                <div class="artist-actions">
                  <button 
                    @click="handleFollow(artist.id)" 
                    class="btn btn-primary btn-small"
                    :disabled="artist.is_followed"
                  >
                    {{ artist.is_followed ? '已关注' : '关注' }}
                  </button>
                </div>
              </div>
              
              <div class="artist-stats">
                <div class="stat">
                  <span class="stat-number">{{ artist.total_illusts }}</span>
                  <span class="stat-label">插画</span>
                </div>
                <div class="stat">
                  <span class="stat-number">{{ artist.total_manga }}</span>
                  <span class="stat-label">漫画</span>
                </div>
                <div class="stat">
                  <span class="stat-number">{{ artist.total_followers }}</span>
                  <span class="stat-label">粉丝</span>
                </div>
              </div>
              
              <div class="artist-actions-bottom">
                <router-link :to="`/artist/${artist.id}`" class="btn btn-primary btn-small">
                  查看作品
                </router-link>
                <button @click="handleDownloadArtist(artist.id)" class="btn btn-secondary btn-small">
                  下载作品
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useArtistStore } from '@/stores/artist';
import downloadService from '@/services/download';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const router = useRouter();
const authStore = useAuthStore();
const artistStore = useArtistStore();

// 本地状态
const searchKeyword = ref('');

// 获取关注的作者
const fetchFollowingArtists = async () => {
  try {
    await artistStore.fetchFollowingArtists();
  } catch (err) {
    console.error('获取关注列表失败:', err);
  }
};

// 搜索作者
const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    artistStore.clearSearchResults();
    return;
  }

  try {
    await artistStore.searchArtists(searchKeyword.value);
  } catch (err) {
    console.error('搜索失败:', err);
  }
};

// 关注作者
const handleFollow = async (artistId: number) => {
  try {
    await artistStore.followArtist(artistId);
  } catch (err) {
    console.error('关注失败:', err);
  }
};

// 取消关注
const handleUnfollow = async (artistId: number) => {
  try {
    await artistStore.unfollowArtist(artistId);
  } catch (err) {
    console.error('取消关注失败:', err);
  }
};

// 下载作者作品
const handleDownloadArtist = async (artistId: number) => {
  try {
    const response = await downloadService.downloadArtistArtworks(artistId, {
      limit: 50
    });
    
    if (response.success) {
      console.log('下载任务已创建:', response.data);
      router.push('/downloads');
    } else {
      throw new Error(response.error || '下载失败');
    }
  } catch (err) {
    artistStore.error = err instanceof Error ? err.message : '下载失败';
    console.error('下载失败:', err);
  }
};

// 刷新数据
const handleRefresh = async () => {
  try {
    await artistStore.refreshData();
  } catch (err) {
    console.error('刷新失败:', err);
  }
};

// 处理图片URL，通过后端代理
const getImageUrl = (originalUrl: string) => {
  if (!originalUrl) return '';
  
  // 如果是Pixiv的图片URL，通过后端代理
  if (originalUrl.includes('i.pximg.net')) {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `http://localhost:3000/api/proxy/image?url=${encodedUrl}`;
  }
  
  return originalUrl;
};

// 监听数据过期状态，自动刷新
watch(() => artistStore.isDataStale, (isStale) => {
  if (isStale && artistStore.hasFollowingArtists) {
    console.log('数据已过期，自动刷新...');
    fetchFollowingArtists();
  }
});

onMounted(() => {
  fetchFollowingArtists();
});
</script>

<style scoped>
.artists-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  overflow: hidden;
}

.search-input {
  padding: 0.75rem 1rem;
  border: none;
  outline: none;
  font-size: 1rem;
  min-width: 300px;
}

.search-btn {
  padding: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-btn:hover {
  background: #2563eb;
}

.search-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.refresh-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.5rem;
}

.error-section,
.loading-section {
  margin-bottom: 2rem;
}

.loading-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.section {
  margin-bottom: 3rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.cache-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cache-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.cache-status.fresh {
  background: #dcfce7;
  color: #166534;
}

.cache-status.stale {
  background: #fef3c7;
  color: #92400e;
}

.cache-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.artist-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.artist-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.artist-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.artist-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
}

.artist-info {
  flex: 1;
}

.artist-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.artist-account {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.artist-actions {
  flex-shrink: 0;
}

.artist-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 1rem;
  padding: 1rem 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #3b82f6;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
}

.artist-actions-bottom {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  flex: 1;
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

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.empty-section {
  text-align: center;
  padding: 4rem 0;
}

.empty-content {
  max-width: 400px;
  margin: 0 auto;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.empty-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.empty-content p {
  color: #6b7280;
  line-height: 1.6;
}

.cache-note {
  margin-top: 1rem;
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 0.375rem;
  text-align: center;
}

.cache-note small {
  color: #6b7280;
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .search-input {
    min-width: auto;
    flex: 1;
  }
  
  .artists-grid {
    grid-template-columns: 1fr;
  }
  
  .artist-header {
    flex-direction: column;
    text-align: center;
  }
  
  .artist-actions-bottom {
    flex-direction: column;
  }
}
</style> 