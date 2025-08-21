<template>
  <div class="artist-page">
    <div class="container">
      <div v-if="loading" class="loading-section">
        <LoadingSpinner text="加载中..." />
      </div>

      <div v-else-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <div v-else-if="artist" class="artist-content">
        <!-- 作者信息卡片 -->
        <div class="artist-header">
          <div class="artist-profile">
            <img 
              :src="artist.profile_image_urls.medium" 
              :alt="artist.name"
              class="artist-avatar"
            />
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
            <button @click="handleDownloadAll" class="btn btn-secondary" :disabled="downloading">
              {{ downloading ? '下载中...' : '下载所有作品' }}
            </button>
          </div>
        </div>

        <!-- 作者统计 -->
        <div class="artist-stats">
          <div class="stat-card">
            <div class="stat-number">{{ artist.total_illusts }}</div>
            <div class="stat-label">插画</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ artist.total_manga }}</div>
            <div class="stat-label">漫画</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ artist.total_novels }}</div>
            <div class="stat-label">小说</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ artist.total_followers }}</div>
            <div class="stat-label">粉丝</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ artist.total_following }}</div>
            <div class="stat-label">关注</div>
          </div>
        </div>

        <!-- 作品列表 -->
        <div class="artworks-section">
          <div class="section-header">
            <h2>作品列表</h2>
            <div class="artwork-filters">
              <select v-model="artworkType" @change="fetchArtworks" class="filter-select">
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
            <ArtworkCard
              v-for="artwork in artworks"
              :key="artwork.id"
              :artwork="artwork"
              @click="handleArtworkClick"
            />
          </div>

          <div v-else class="empty-section">
            <p>暂无作品</p>
          </div>

          <div v-if="hasMore" class="load-more">
            <button @click="loadMore" class="btn btn-secondary" :disabled="loadingMore">
              {{ loadingMore ? '加载中...' : '加载更多' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import artistService from '@/services/artist';
import downloadService from '@/services/download';
import type { Artist, Artwork } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import ArtworkCard from '@/components/artwork/ArtworkCard.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// 状态
const artist = ref<Artist | null>(null);
const artworks = ref<Artwork[]>([]);
const loading = ref(false);
const artworksLoading = ref(false);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const downloading = ref(false);

// 筛选状态
const artworkType = ref<'art' | 'manga' | 'novel'>('art');
const offset = ref(0);
const hasMore = ref(true);

// 获取作者信息
const fetchArtistInfo = async () => {
  const artistId = parseInt(route.params.id as string);
  if (isNaN(artistId)) {
    error.value = '无效的作者ID';
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    
    const response = await artistService.getArtistInfo(artistId);
    
    if (response.success && response.data) {
      artist.value = response.data;
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
const fetchArtworks = async (reset = true) => {
  if (!artist.value) return;

  try {
    artworksLoading.value = true;
    if (reset) {
      offset.value = 0;
      artworks.value = [];
    }
    
    const response = await artistService.getArtistArtworks(artist.value.id, {
      type: artworkType.value,
      offset: offset.value,
      limit: 30
    });
    
    if (response.success && response.data) {
      if (reset) {
        artworks.value = response.data.artworks;
      } else {
        artworks.value.push(...response.data.artworks);
      }
      hasMore.value = response.data.artworks.length === 30;
      offset.value += response.data.artworks.length;
    } else {
      throw new Error(response.error || '获取作品列表失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取作品列表失败';
    console.error('获取作品列表失败:', err);
  } finally {
    artworksLoading.value = false;
  }
};

// 加载更多
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return;
  
  loadingMore.value = true;
  await fetchArtworks(false);
  loadingMore.value = false;
};

// 关注/取消关注
const handleFollow = async () => {
  if (!artist.value) return;

  try {
    const action = artist.value.is_followed ? 'unfollow' : 'follow';
    const response = await artistService.followArtist(artist.value.id, action);
    
    if (response.success) {
      artist.value.is_followed = !artist.value.is_followed;
    } else {
      throw new Error(response.error || '操作失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败';
    console.error('关注操作失败:', err);
  }
};

// 下载所有作品
const handleDownloadAll = async () => {
  if (!artist.value) return;

  try {
    downloading.value = true;
    const response = await downloadService.downloadArtistArtworks(artist.value.id, {
      type: artworkType.value,
      limit: 50
    });
    
    if (response.success) {
      console.log('下载任务已创建:', response.data);
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

// 点击作品
const handleArtworkClick = (artwork: Artwork) => {
  router.push(`/artwork/${artwork.id}`);
};

// 清除错误
const clearError = () => {
  error.value = null;
};

onMounted(async () => {
  await fetchArtistInfo();
  await fetchArtworks();
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

.artist-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
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

.load-more {
  text-align: center;
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
}
</style> 