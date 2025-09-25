<template>
  <div class="artwork-card" @click="handleClick">
    <div class="artwork-image">
      <img :src="getImageUrl(artwork.image_urls.medium)" :alt="artwork.title" @load="imageLoaded = true"
        @error="imageError = true" :class="{ loaded: imageLoaded, error: imageError }" crossorigin="anonymous" />
      <div v-if="!imageLoaded && !imageError" class="image-placeholder">
        <LoadingSpinner text="加载中..." />
      </div>
      <div v-if="imageError" class="image-error">
        <span>图片加载失败</span>
      </div>
    </div>

    <div class="artwork-info">
      <h3 class="artwork-title" :title="artwork.title">
        {{ artwork.title }}
      </h3>

      <div class="artwork-meta">
        <div class="artist-info">
          <img :src="getImageUrl(artwork.user.profile_image_urls.medium)" :alt="artwork.user.name" class="artist-avatar"
            crossorigin="anonymous" />
          <span class="artist-name">{{ artwork.user.name }}</span>
        </div>

        <div class="artwork-stats">
          <span class="stat">
            <SvgIcon name="bookmark" />
            {{ artwork.total_bookmarks }}
          </span>
          <span class="stat">
            <SvgIcon name="eye" />
            {{ artwork.total_view }}
          </span>
        </div>
      </div>

      <div class="artwork-tags">
        <span v-for="tag in artwork.tags.slice(0, 3)" :key="tag.name" class="tag">
          {{ tag.name }}
        </span>
        <span v-if="artwork.tags.length > 3" class="tag-more">
          +{{ artwork.tags.length - 3 }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { getImageProxyUrl } from '@/services/api';
import type { Artwork } from '@/types';

interface Props {
  artwork: Artwork;
}

interface Emits {
  (e: 'click', artwork: Artwork): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const imageLoaded = ref(false);
const imageError = ref(false);

const handleClick = () => {
  emit('click', props.artwork);
};

// 使用统一的图片代理函数
const getImageUrl = getImageProxyUrl;
</script>

<style scoped>
.artwork-card {
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.artwork-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.artwork-image {
  position: relative;
  aspect-ratio: 1;
  background: #f3f4f6;
  overflow: hidden;
}

.artwork-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s;
}

.artwork-image img.loaded {
  opacity: 1;
}

.artwork-image img.error {
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

.artwork-info {
  padding: 1rem;
}

.artwork-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artwork-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.artist-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.artist-avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  object-fit: cover;
}

.artist-name {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.artwork-stats {
  display: flex;
  gap: 0.75rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.stat svg {
  width: 0.875rem;
  height: 0.875rem;
}

.artwork-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tag {
  background: #f3f4f6;
  color: #374151;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  line-height: 1;
}

.tag-more {
  background: #e5e7eb;
  color: #6b7280;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  line-height: 1;
}
</style>