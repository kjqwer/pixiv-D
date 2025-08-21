<template>
  <div v-if="show" class="image-viewer-overlay" @click="close">
    <div class="image-viewer-content" @click.stop>
      <div class="viewer-header">
        <h3>{{ artwork?.title }}</h3>
        <div class="viewer-controls">
          <div class="viewer-zoom-controls">
            <button @click="zoomOut" class="zoom-btn" :disabled="zoomLevel <= 0.5">
              🔍-
            </button>
            <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
            <button @click="zoomIn" class="zoom-btn" :disabled="zoomLevel >= 3">
              🔍+
            </button>
            <button @click="resetZoom" class="reset-btn">重置</button>
          </div>
          <button @click="close" class="close-btn">×</button>
        </div>
      </div>
      
      <div class="viewer-main">
        <button @click="previousImage" class="nav-btn prev-btn" :disabled="currentIndex <= 0">
          ‹
        </button>
        
        <div class="image-container">
          <img 
            :src="getPreviewUrl(currentImagePath)" 
            :alt="currentImageName"
            class="viewer-image"
            :style="{ transform: `scale(${zoomLevel})` }"
          />
        </div>
        
        <button @click="nextImage" class="nav-btn next-btn" :disabled="currentIndex >= (artwork?.files?.length || 0) - 1">
          ›
        </button>
      </div>
      
      <div class="viewer-footer">
        <div class="image-info">
          <p>{{ currentImageName }}</p>
          <p>{{ formatFileSize(currentImageSize) }}</p>
        </div>
        <div class="image-counter">
          {{ currentIndex + 1 }} / {{ artwork?.files?.length || 0 }}
        </div>
      </div>
      
      <div class="thumbnail-strip">
        <div 
          v-for="(file, index) in (artwork?.files || [])" 
          :key="index"
          :class="['thumbnail', { active: index === currentIndex }]"
          @click="goToImage(index)"
        >
          <img 
            :src="getPreviewUrl(file.path)" 
            :alt="file.name"
            class="thumbnail-img"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Artwork } from '@/stores/repository.ts'
import { formatFileSize, getPreviewUrl } from '@/utils/formatters'

interface Props {
  show: boolean
  artwork: Artwork | null
  currentIndex: number
}

interface Emits {
  (e: 'close'): void
  (e: 'update:currentIndex', index: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 缩放相关
const zoomLevel = ref(1)

const currentImagePath = computed(() => {
  if (!props.artwork || !props.artwork.files[props.currentIndex]) {
    return ''
  }
  return props.artwork.files[props.currentIndex].path
})

const currentImageName = computed(() => {
  if (!props.artwork || !props.artwork.files[props.currentIndex]) {
    return ''
  }
  return props.artwork.files[props.currentIndex].name
})

const currentImageSize = computed(() => {
  if (!props.artwork || !props.artwork.files[props.currentIndex]) {
    return 0
  }
  return props.artwork.files[props.currentIndex].size
})

const close = () => {
  emit('close')
}

const previousImage = () => {
  if (props.currentIndex > 0) {
    emit('update:currentIndex', props.currentIndex - 1)
  }
}

const nextImage = () => {
  if (props.artwork && props.currentIndex < props.artwork.files.length - 1) {
    emit('update:currentIndex', props.currentIndex + 1)
  }
}

const goToImage = (index: number) => {
  emit('update:currentIndex', index)
}

// 缩放控制
const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value + 0.1, 3)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value - 0.1, 0.5)
}

const resetZoom = () => {
  zoomLevel.value = 1
}

// 键盘快捷键支持
const handleKeydown = (event: KeyboardEvent) => {
  if (props.show) {
    switch (event.key) {
      case 'Escape':
        close()
        break
      case 'ArrowLeft':
        previousImage()
        break
      case 'ArrowRight':
        nextImage()
        break
      case '=':
      case '+':
        event.preventDefault()
        zoomIn()
        break
      case '-':
        event.preventDefault()
        zoomOut()
        break
      case '0':
        event.preventDefault()
        resetZoom()
        break
    }
  }
}

// 监听键盘事件
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.image-viewer-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.viewer-header h3 {
  margin: 0;
  color: #1f2937;
}

.viewer-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.viewer-zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
}

.reset-btn {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #4b5563;
}

.zoom-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.zoom-btn:hover:not(:disabled) {
  background: #2563eb;
}

.zoom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-level {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.viewer-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  flex: 1;
  min-height: 400px;
}

.nav-btn {
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.7);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 70vh;
  overflow: auto;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.viewer-image {
  max-width: none;
  max-height: none;
  object-fit: contain;
  transition: transform 0.2s ease;
  cursor: zoom-in;
}

.viewer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.image-info p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.image-counter {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.thumbnail-strip {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  overflow-x: auto;
}

.thumbnail {
  width: 80px;
  height: 60px;
  border: 2px solid transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
  flex-shrink: 0;
}

.thumbnail.active {
  border-color: #3b82f6;
}

.thumbnail:hover {
  border-color: #3b82f6;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 768px) {
  .image-viewer-content {
    width: 95%;
    max-height: 95vh;
  }
  
  .viewer-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .viewer-controls {
    justify-content: space-between;
  }
  
  .viewer-zoom-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .viewer-main {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .nav-btn {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }
  
  .thumbnail-strip {
    padding: 0.5rem;
  }
  
  .thumbnail {
    width: 60px;
    height: 45px;
  }
}
</style> 