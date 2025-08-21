<template>
  <div class="artwork-page">
    <div class="container">
      <div v-if="loading" class="loading-section">
        <LoadingSpinner text="加载中..." />
      </div>

      <div v-else-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <div v-else-if="artwork" class="artwork-content">
        <!-- 作品图片 -->
        <div class="artwork-gallery">
          <div class="main-image">
            <img 
              :src="getImageUrl(currentImageUrl)" 
              :alt="artwork.title"
              @load="imageLoaded = true"
              @error="imageError = true"
              :class="{ loaded: imageLoaded, error: imageError }"
              crossorigin="anonymous"
            />
            <div v-if="!imageLoaded && !imageError" class="image-placeholder">
              <LoadingSpinner text="加载中..." />
            </div>
            <div v-if="imageError" class="image-error">
              <span>图片加载失败</span>
            </div>
          </div>

          <!-- 多页作品缩略图 -->
          <div v-if="artwork.page_count > 1" class="thumbnails">
            <button
              v-for="(page, index) in artwork.meta_pages"
              :key="index"
              @click="currentPage = index"
              class="thumbnail"
              :class="{ active: currentPage === index }"
            >
              <img :src="getImageUrl(page.image_urls.square_medium)" :alt="`第 ${index + 1} 页`" crossorigin="anonymous" />
            </button>
          </div>
        </div>

        <!-- 作品信息 -->
        <div class="artwork-info">
          <div class="artwork-header">
            <h1 class="artwork-title">{{ artwork.title }}</h1>
            <div class="artwork-actions">
              <button @click="handleDownload" class="btn btn-primary" :disabled="downloading">
                {{ downloading ? '下载中...' : (isDownloaded ? '重新下载' : '下载') }}
              </button>
              <button @click="handleBookmark" class="btn btn-secondary">
                {{ artwork.is_bookmarked ? '取消收藏' : '收藏' }}
              </button>
            </div>
            <!-- 下载状态提示 -->
            <div v-if="isDownloaded" class="download-status">
              <div class="status-indicator">
                <svg viewBox="0 0 24 24" fill="currentColor" class="status-icon">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                <span>已下载到本地</span>
              </div>
            </div>
          </div>

          <!-- 作者信息 -->
          <div class="artist-info">
            <img 
              :src="getImageUrl(artwork.user.profile_image_urls.medium)" 
              :alt="artwork.user.name"
              class="artist-avatar"
              crossorigin="anonymous"
            />
            <div class="artist-details">
              <h3 class="artist-name">{{ artwork.user.name }}</h3>
              <p class="artist-account">@{{ artwork.user.account }}</p>
            </div>
            <router-link :to="`/artist/${artwork.user.id}`" class="btn btn-text">
              查看作者
            </router-link>
          </div>

          <!-- 作品导航 -->
          <div v-if="showNavigation" class="artwork-navigation">
            <button 
              @click="navigateToPrevious" 
              class="nav-btn nav-prev" 
              :disabled="!previousArtwork"
              :title="previousArtwork ? `上一个: ${previousArtwork.title}` : '没有上一个作品'"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
              <span>上一个</span>
            </button>
            <button 
              @click="navigateToNext" 
              class="nav-btn nav-next" 
              :disabled="!nextArtwork"
              :title="nextArtwork ? `下一个: ${nextArtwork.title}` : '没有下一个作品'"
            >
              <span>下一个</span>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
              </svg>
            </button>
          </div>

          <!-- 作品统计 -->
          <div class="artwork-stats">
            <div class="stat">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span>{{ artwork.total_bookmarks }}</span>
            </div>
            <div class="stat">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              <span>{{ artwork.total_view }}</span>
            </div>
            <div class="stat">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
              </svg>
              <span>{{ artwork.width }} × {{ artwork.height }}</span>
            </div>
          </div>

          <!-- 标签 -->
          <div class="artwork-tags">
            <h3>标签</h3>
            <div class="tags-list">
              <span 
                v-for="tag in artwork.tags" 
                :key="tag.name"
                class="tag"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>

          <!-- 描述 -->
          <div v-if="artwork.description" class="artwork-description">
            <h3>描述</h3>
            <div class="description-content" v-html="artwork.description"></div>
          </div>

          <!-- 创建时间 -->
          <div class="artwork-meta">
            <p>创建时间: {{ formatDate(artwork.create_date) }}</p>
            <p v-if="artwork.update_date !== artwork.create_date">
              更新时间: {{ formatDate(artwork.update_date) }}
            </p>
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
import artworkService from '@/services/artwork';
import artistService from '@/services/artist';
import downloadService from '@/services/download';
import { useRepositoryStore } from '@/stores/repository';
import type { Artwork } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const repositoryStore = useRepositoryStore();

// 状态
const artwork = ref<Artwork | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const currentPage = ref(0);
const imageLoaded = ref(false);
const imageError = ref(false);
const downloading = ref(false);
const isDownloaded = ref(false);
const checkingDownloadStatus = ref(false);

// 导航相关状态
const artistArtworks = ref<Artwork[]>([]);
const currentArtworkIndex = ref(-1);
const navigationLoading = ref(false);

// 计算属性
const currentImageUrl = computed(() => {
  if (!artwork.value) return '';
  
  if (artwork.value.page_count === 1) {
    return artwork.value.image_urls.large;
  } else if (artwork.value.meta_pages && artwork.value.meta_pages[currentPage.value]) {
    return artwork.value.meta_pages[currentPage.value].image_urls.large;
  }
  
  return artwork.value.image_urls.large;
});

// 导航相关计算属性
const showNavigation = computed(() => {
  return route.query.artistId && route.query.artworkType;
});

const previousArtwork = computed(() => {
  if (currentArtworkIndex.value > 0) {
    return artistArtworks.value[currentArtworkIndex.value - 1];
  }
  return null;
});

const nextArtwork = computed(() => {
  if (currentArtworkIndex.value >= 0 && currentArtworkIndex.value < artistArtworks.value.length - 1) {
    return artistArtworks.value[currentArtworkIndex.value + 1];
  }
  return null;
});

// 获取作品详情
const fetchArtworkDetail = async () => {
  const artworkId = parseInt(route.params.id as string);
  if (isNaN(artworkId)) {
    error.value = '无效的作品ID';
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    // 重置图片加载状态
    imageLoaded.value = false;
    imageError.value = false;
    currentPage.value = 0;
    
    const response = await artworkService.getArtworkDetail(artworkId);
    
    if (response.success && response.data) {
      artwork.value = response.data;
      // 检查下载状态
      await checkDownloadStatus(artworkId);
    } else {
      throw new Error(response.error || '获取作品详情失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取作品详情失败';
    console.error('获取作品详情失败:', err);
  } finally {
    loading.value = false;
  }
};

// 检查下载状态
const checkDownloadStatus = async (artworkId: number) => {
  try {
    checkingDownloadStatus.value = true;
    const response = await repositoryStore.checkArtworkDownloaded(artworkId);
    
    console.log('下载状态检查响应:', response);
    
    // repository store的apiCall返回的是data.data，所以response直接是数据对象
    if (response && typeof response === 'object') {
      isDownloaded.value = response.is_downloaded || false;
      console.log('作品下载状态:', isDownloaded.value);
    }
  } catch (err) {
    console.error('检查下载状态失败:', err);
    isDownloaded.value = false;
  } finally {
    checkingDownloadStatus.value = false;
  }
};

// 下载作品
const handleDownload = async () => {
  if (!artwork.value) return;

  try {
    downloading.value = true;
    const response = await downloadService.downloadArtwork(artwork.value.id);
    
    if (response.success) {
      // 可以显示下载成功提示
      console.log('下载任务已创建:', response.data);
      // 下载完成后重新检查下载状态
      setTimeout(() => {
        checkDownloadStatus(artwork.value!.id);
      }, 2000); // 等待2秒让下载完成
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

// 收藏/取消收藏
const handleBookmark = () => {
  // 这里可以添加收藏功能
  console.log('收藏功能待实现');
};

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN');
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

// 清除错误
const clearError = () => {
  error.value = null;
};

// 获取作者作品列表用于导航
const fetchArtistArtworks = async () => {
  const artistId = route.query.artistId;
  const artworkType = route.query.artworkType;
  
  if (!artistId || !artworkType) return;

  try {
    navigationLoading.value = true;
    const response = await artistService.getArtistArtworks(parseInt(artistId as string), {
      type: artworkType as 'art' | 'manga' | 'novel',
      limit: 100 // 获取更多作品以便导航
    });
    
    if (response.success && response.data) {
      artistArtworks.value = response.data.artworks;
      // 找到当前作品在列表中的位置
      const currentId = parseInt(route.params.id as string);
      currentArtworkIndex.value = artistArtworks.value.findIndex(art => art.id === currentId);
    }
  } catch (err) {
    console.error('获取作者作品列表失败:', err);
  } finally {
    navigationLoading.value = false;
  }
};

// 导航到上一个作品
const navigateToPrevious = () => {
  if (previousArtwork.value) {
    router.push({
      path: `/artwork/${previousArtwork.value.id}`,
      query: {
        artistId: route.query.artistId,
        artworkType: route.query.artworkType
      }
    });
  }
};

// 导航到下一个作品
const navigateToNext = () => {
  if (nextArtwork.value) {
    router.push({
      path: `/artwork/${nextArtwork.value.id}`,
      query: {
        artistId: route.query.artistId,
        artworkType: route.query.artworkType
      }
    });
  }
};

// 监听路由变化，重新获取作品详情和导航数据
watch(() => route.params.id, () => {
  // 重新获取作品详情
  fetchArtworkDetail();
  
  // 如果是从作者页面来的，重新获取导航数据
  if (showNavigation.value) {
    fetchArtistArtworks();
  }
});

// 键盘快捷键支持
const handleKeydown = (event: KeyboardEvent) => {
  if (!showNavigation.value) return;
  
  if (event.key === 'ArrowLeft' && previousArtwork.value) {
    event.preventDefault();
    navigateToPrevious();
  } else if (event.key === 'ArrowRight' && nextArtwork.value) {
    event.preventDefault();
    navigateToNext();
  }
};

onMounted(() => {
  fetchArtworkDetail();
  if (showNavigation.value) {
    fetchArtistArtworks();
  }
  
  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeydown);
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.artwork-page {
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

.artwork-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 3rem;
  align-items: start;
}

.artwork-gallery {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.main-image {
  position: relative;
  aspect-ratio: 1;
  background: #f3f4f6;
  overflow: hidden;
}

.main-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.3s;
}

.main-image img.loaded {
  opacity: 1;
}

.main-image img.error {
  opacity: 0.5;
}

.image-placeholder,
.image-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
}

.image-error {
  color: #6b7280;
  font-size: 0.875rem;
}

.thumbnails {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

.thumbnail {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
  background: none;
  padding: 0;
}

.thumbnail.active {
  border-color: #3b82f6;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-info {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.artwork-header {
  margin-bottom: 2rem;
}

.artwork-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1rem 0;
  line-height: 1.3;
}

.artwork-actions {
  display: flex;
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

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-text {
  background: none;
  color: #3b82f6;
  padding: 0.5rem 1rem;
}

.btn-text:hover {
  background: #f3f4f6;
}

.artist-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 0.75rem;
  margin-bottom: 2rem;
}

.artist-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  object-fit: cover;
}

.artist-details {
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
  margin: 0;
  font-size: 0.875rem;
}

.artwork-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.stat svg {
  width: 1rem;
  height: 1rem;
}

.artwork-tags {
  margin-bottom: 2rem;
}

.artwork-tags h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: #f3f4f6;
  color: #374151;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  line-height: 1;
}

.artwork-description {
  margin-bottom: 2rem;
}

.artwork-description h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.description-content {
  color: #374151;
  line-height: 1.6;
}

.artwork-meta {
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.artwork-meta p {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0.25rem 0;
}

.artwork-navigation {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.75rem;
}

.nav-btn {
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
  flex: 1;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.nav-prev {
  justify-content: flex-start;
}

.nav-next {
  justify-content: flex-end;
}

.download-status {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #0369a1;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #059669;
}

@media (max-width: 1024px) {
  .artwork-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .artwork-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
  
  .artwork-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .thumbnails {
    padding: 0.5rem;
  }
  
  .thumbnail {
    width: 50px;
    height: 50px;
  }
}
</style> 