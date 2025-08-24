<template>
  <div class="artist-card">
    <div class="artist-header">
      <img :src="getImageUrl(artist.profile_image_urls.medium)" :alt="artist.name" class="artist-avatar"
        crossorigin="anonymous" />
      <div class="artist-info">
        <h3 class="artist-name">{{ artist.name }}</h3>
        <p class="artist-account">@{{ artist.account }}</p>
      </div>
      <div class="artist-actions">
        <button v-if="showFollowButton" @click="handleFollowClick" class="btn btn-primary btn-small"
          :disabled="artist.is_followed">
          {{ artist.is_followed ? '已关注' : '关注' }}
        </button>
        <button v-if="showUnfollowButton" @click="handleUnfollowClick" class="btn btn-danger btn-small">
          取消关注
        </button>
      </div>
    </div>

    <div class="artist-actions-bottom">
      <router-link :to="`/artist/${artist.id}`" class="btn btn-primary btn-small">
        查看作品
      </router-link>
      <button @click="handleDownloadClick" class="btn btn-secondary btn-small">
        下载作品
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getImageProxyUrl } from '@/services/api';

interface Artist {
  id: number
  name: string
  account: string
  profile_image_urls: {
    medium: string
  }
  is_followed?: boolean
}

interface Props {
  artist: Artist
  showFollowButton?: boolean
  showUnfollowButton?: boolean
}

interface Emits {
  (e: 'follow', artistId: number): void
  (e: 'unfollow', artistId: number): void
  (e: 'download', artist: Artist): void
}

const props = withDefaults(defineProps<Props>(), {
  showFollowButton: false,
  showUnfollowButton: true
})

const emit = defineEmits<Emits>()

// 处理关注点击
const handleFollowClick = () => {
  emit('follow', props.artist.id)
}

// 处理取消关注点击
const handleUnfollowClick = () => {
  emit('unfollow', props.artist.id)
}

// 处理下载点击
const handleDownloadClick = () => {
  emit('download', props.artist)
}

// 使用统一的图片代理函数
const getImageUrl = getImageProxyUrl
</script>

<style scoped>
.artist-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.artist-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.artist-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex: 1;
}

.artist-avatar {
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.artist-info {
  flex: 1;
  min-width: 0;
  /* 防止文本溢出 */
}

.artist-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-account {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-actions {
  flex-shrink: 0;
}

.artist-actions-bottom {
  display: flex;
  gap: 0.75rem;
  margin-top: auto;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  flex: 1;
  min-height: 2.5rem;
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
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  min-height: 2rem;
}

@media (max-width: 768px) {
  .artist-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .artist-actions-bottom {
    flex-direction: column;
  }

  .artist-avatar {
    width: 5rem;
    height: 5rem;
  }
}
</style>