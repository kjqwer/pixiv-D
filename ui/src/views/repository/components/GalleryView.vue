<template>
  <div class="gallery-view">
    <div class="gallery-controls">
      <div class="zoom-controls">
        <button @click="zoomOut" class="zoom-btn" :disabled="zoomLevel <= 0.5">
          🔍-
        </button>
        <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
        <button @click="zoomIn" class="zoom-btn" :disabled="zoomLevel >= 3">
          🔍+
        </button>
      </div>
      <div class="view-controls">
        <button @click="setGridSize('small')" :class="['size-btn', { active: gridSize === 'small' }]">
          小
        </button>
        <button @click="setGridSize('medium')" :class="['size-btn', { active: gridSize === 'medium' }]">
          中
        </button>
        <button @click="setGridSize('large')" :class="['size-btn', { active: gridSize === 'large' }]">
          大
        </button>
      </div>
    </div>
    
    <div class="gallery-grid" :class="`grid-${gridSize}`">
      <div 
        v-for="artwork in artworks" 
        :key="artwork.id"
        class="gallery-item"
        @click="$emit('open-image-viewer', artwork, 0)"
      >
        <div class="gallery-image-container">
          <img 
            :src="getPreviewUrl(artwork.files[0].path)" 
            :alt="artwork.title"
            class="gallery-image"
            @load="onImageLoad"
            @error="onImageError"
          />
          <div class="gallery-overlay">
            <div class="overlay-content">
              <h4>{{ artwork.title }}</h4>
              <p>{{ artwork.artist }}</p>
              <div class="overlay-actions">
                <button @click.stop="$emit('open-image-viewer', artwork, 0)" class="overlay-btn">
                  👁️ 查看大图
                </button>
                <button @click.stop="$emit('view-artwork', artwork)" class="overlay-btn">
                  📋 详情
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
import { ref } from 'vue'
import type { Artwork } from '@/stores/repository.ts'
import { getPreviewUrl } from '@/utils/formatters'

interface Props {
  artworks: Artwork[]
}

interface Emits {
  (e: 'view-artwork', artwork: Artwork): void
  (e: 'open-image-viewer', artwork: Artwork, index: number): void
}

defineProps<Props>()
defineEmits<Emits>()

// 画廊模式相关
const zoomLevel = ref(1)
const gridSize = ref('medium')

// 画廊模式图片缩放
const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value + 0.1, 3)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value - 0.1, 0.5)
}

// 画廊模式网格大小
const setGridSize = (size: 'small' | 'medium' | 'large') => {
  gridSize.value = size
}

// 画廊模式图片加载和错误处理
const onImageLoad = () => {
  // 图片加载成功后可以进行一些操作，例如调整布局
}

const onImageError = (event: Event) => {
  console.error('图片加载失败:', (event.target as HTMLImageElement).src)
  // 可以显示一个错误提示或替换图片
}
</script>

<style scoped>
.gallery-view {
  position: relative;
  margin-top: 2rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.gallery-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zoom-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
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

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.size-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.size-btn:hover:not(:disabled) {
  background: #2563eb;
}

.size-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gallery-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

.grid-small .gallery-grid {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.grid-medium .gallery-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.grid-large .gallery-grid {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.gallery-item {
  position: relative;
  height: 250px;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  background: white;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.gallery-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.gallery-image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  overflow: hidden;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s ease;
  transform: scale(v-bind(zoomLevel));
}

.gallery-item:hover .gallery-image {
  transform: scale(v-bind(zoomLevel) * 1.05);
}

.gallery-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.gallery-item:hover .gallery-overlay {
  opacity: 1;
}

.overlay-content {
  text-align: center;
  color: white;
  padding: 1rem;
}

.overlay-content h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
}

.overlay-content p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.8;
}

.overlay-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.overlay-btn {
  background: white;
  color: #1f2937;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.overlay-btn:hover {
  background: #f3f4f6;
  color: #3b82f6;
}

@media (max-width: 768px) {
  .gallery-controls {
    flex-direction: column;
    gap: 1rem;
  }
  
  .zoom-controls,
  .view-controls {
    justify-content: center;
  }
  
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style> 