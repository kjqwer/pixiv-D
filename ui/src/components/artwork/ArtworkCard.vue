<template>
  <div class="artwork-card" @click="handleClick">
    <div class="artwork-image">
      <img 
        :src="artwork.image_urls.medium" 
        :alt="artwork.title"
        @load="imageLoaded = true"
        @error="imageError = true"
        :class="{ loaded: imageLoaded, error: imageError }"
      />
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
          <img 
            :src="artwork.user.profile_image_urls.medium" 
            :alt="artwork.user.name"
            class="artist-avatar"
          />
          <span class="artist-name">{{ artwork.user.name }}</span>
        </div>
        
        <div class="artwork-stats">
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {{ artwork.total_bookmarks }}
          </span>
          <span class="stat">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            {{ artwork.total_view }}
          </span>
        </div>
      </div>
      
      <div class="artwork-tags">
        <span 
          v-for="tag in artwork.tags.slice(0, 3)" 
          :key="tag.name"
          class="tag"
        >
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
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
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