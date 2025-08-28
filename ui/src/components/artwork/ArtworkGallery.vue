<template>
  <div class="artwork-gallery">
    <div class="main-image">
      <img :src="getImageUrl(currentImageUrl)" :alt="artwork.title" @load="imageLoaded = true"
        @error="imageError = true" :class="{ loaded: imageLoaded, error: imageError }" crossorigin="anonymous" />
      <div v-if="!imageLoaded && !imageError" class="image-placeholder">
        <LoadingSpinner text="图片加载中..." />
      </div>
      <div v-if="imageError" class="image-error">
        <span>图片加载失败</span>
      </div>
      <!-- 页面切换时的遮罩层 -->
      <div v-if="loading" class="image-overlay">
        <LoadingSpinner text="切换中..." />
      </div>
    </div>

    <!-- 多页作品缩略图 -->
    <div v-if="artwork.page_count > 1" class="thumbnails">
      <button v-for="(page, index) in artwork.meta_pages" :key="index" @click="$emit('pageChange', index)"
        class="thumbnail" :class="{ active: currentPage === index }">
        <img :src="getImageUrl(page.image_urls.square_medium)" :alt="`第 ${index + 1} 页`" crossorigin="anonymous" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { getImageProxyUrl } from '@/services/api';
import type { Artwork } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

interface Props {
  artwork: Artwork;
  currentPage: number;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  pageChange: [page: number];
}>();

// 图片加载状态
const imageLoaded = ref(false);
const imageError = ref(false);

// 计算当前图片URL
const currentImageUrl = computed(() => {
  if (!props.artwork) return '';

  if (props.artwork.page_count === 1) {
    return props.artwork.image_urls.large;
  } else if (props.artwork.meta_pages && props.artwork.meta_pages[props.currentPage]) {
    return props.artwork.meta_pages[props.currentPage].image_urls.large;
  }

  return props.artwork.image_urls.large;
});

// 使用统一的图片代理函数
const getImageUrl = getImageProxyUrl;

// 监听页面变化，重置图片加载状态
watch(() => props.currentPage, () => {
  imageLoaded.value = false;
  imageError.value = false;
});

// 监听作品变化，重置图片加载状态
watch(() => props.artwork.id, () => {
  imageLoaded.value = false;
  imageError.value = false;
});
</script>

<style scoped>
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

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(2px);
  z-index: 10;
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

@media (max-width: 768px) {
  .thumbnails {
    padding: 0.5rem;
  }

  .thumbnail {
    width: 50px;
    height: 50px;
  }
}
</style>