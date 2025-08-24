<template>
  <div class="artists-page">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">作者管理</h1>
        <div class="header-actions">
          <button @click="handleRefresh" class="btn btn-secondary" :disabled="artistStore.loading">
            <svg viewBox="0 0 24 24" fill="currentColor" class="refresh-icon">
              <path
                d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
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
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                数据已过期
              </span>
              <span v-else class="cache-status fresh">
                <svg viewBox="0 0 24 24" fill="currentColor" class="cache-icon">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                数据已缓存
              </span>
            </div>
          </div>

          <div v-if="artistStore.followingArtists.length > 0" class="artists-grid">
            <ArtistCard v-for="artist in artistStore.followingArtists" :key="artist.id" :artist="artist"
              :show-follow-button="false" :show-unfollow-button="true" @unfollow="handleUnfollow"
              @download="openDownloadDialog" />
          </div>

          <div v-else class="empty-section">
            <div class="empty-content">
              <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                <path
                  d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              <h3>暂无关注的作者</h3>
              <p>关注喜欢的作者，在这里管理他们</p>
              <div v-if="!artistStore.loading && artistStore.hasFollowingArtists" class="cache-note">
                <small>💡 提示：数据已缓存，点击刷新按钮获取最新数据</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 下载弹出框 -->
    <div v-if="showDownloadDialog" class="modal-overlay" @click="closeDownloadDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>下载作品</h3>
          <button @click="closeDownloadDialog" class="modal-close">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="artist-info-modal">
            <img :src="selectedArtist?.profile_image_urls.medium" :alt="selectedArtist?.name"
              class="artist-avatar-modal" crossorigin="anonymous" />
            <div>
              <h4>{{ selectedArtist?.name }}</h4>
              <p>@{{ selectedArtist?.account }}</p>
            </div>
          </div>

          <div class="download-options">
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
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeDownloadDialog" class="btn btn-secondary">
            取消
          </button>
          <button @click="handleDownloadArtist" class="btn btn-primary" :disabled="downloading">
            {{ downloading ? '下载中...' : '开始下载' }}
          </button>
        </div>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useArtistStore } from '@/stores/artist';
import downloadService from '@/services/download';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import ArtistCard from '@/components/artist/ArtistCard.vue';

const router = useRouter();
const authStore = useAuthStore();
const artistStore = useArtistStore();

// 下载弹出框相关
const showDownloadDialog = ref(false);
const selectedArtist = ref<any>(null);
const downloadLimit = ref('50');
const downloading = ref(false);
const downloadSuccess = ref<string | null>(null);

// 获取关注的作者
const fetchFollowingArtists = async () => {
  try {
    await artistStore.fetchFollowingArtists();
  } catch (err) {
    console.error('获取关注列表失败:', err);
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

// 打开下载弹出框
const openDownloadDialog = (artist: any) => {
  selectedArtist.value = artist;
  showDownloadDialog.value = true;
};

// 关闭下载弹出框
const closeDownloadDialog = () => {
  showDownloadDialog.value = false;
  selectedArtist.value = null;
  downloadLimit.value = '50';
  downloading.value = false;
};

// 处理下载
const handleDownloadArtist = async () => {
  if (!selectedArtist.value) return;

  try {
    downloading.value = true;
    const response = await downloadService.downloadArtistArtworks(selectedArtist.value.id, {
      limit: parseInt(downloadLimit.value)
    });

    if (response.success) {
      console.log('下载任务已创建:', response.data);
      const limitText = downloadLimit.value === '9999' ? '全部' : downloadLimit.value;
      downloadSuccess.value = `下载任务已创建，将下载 ${limitText} 个作品`;

      // 关闭弹出框
      closeDownloadDialog();

      // 3秒后清除成功提示
      setTimeout(() => {
        downloadSuccess.value = null;
      }, 3000);

      router.push('/downloads');
    } else {
      throw new Error(response.error || '下载失败');
    }
  } catch (err) {
    artistStore.error = err instanceof Error ? err.message : '下载失败';
    console.error('下载失败:', err);
  } finally {
    downloading.value = false;
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
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

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: #6b7280;
  transition: color 0.2s;
}

.modal-close:hover {
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex-grow: 1;
}

.artist-info-modal {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.artist-avatar-modal {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  object-fit: cover;
}

.artist-info-modal h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.artist-info-modal p {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.download-options {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.download-input-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.download-input-group label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

.download-select {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #1f2937;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.download-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.success-message {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #d1fae5;
  color: #065f46;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 999;
}

.success-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.success-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.success-message span {
  font-size: 0.875rem;
  font-weight: 500;
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

  .artists-grid {
    grid-template-columns: 1fr;
  }
}
</style>