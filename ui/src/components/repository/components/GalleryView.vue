<template>
  <div class="gallery-view">
    <!-- 空状态 -->
    <div v-if="artworks.length === 0" class="empty-state">
      <div class="empty-icon">🖼️</div>
      <h3>暂无作品</h3>
      <p>这里还没有任何作品</p>
    </div>

    <template v-else>
      <!-- 画廊控制栏 -->
      <div class="gallery-controls">
        <div class="controls-section">
          <label class="control-label">网格大小</label>
          <div class="control-buttons">
            <button @click="setGridSize('small')" :class="['control-btn', { active: gridSize === 'small' }]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span>小</span>
            </button>
            <button @click="setGridSize('medium')" :class="['control-btn', { active: gridSize === 'medium' }]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="8" height="8"/>
                <rect x="3" y="13" width="8" height="8"/>
                <rect x="13" y="3" width="8" height="8"/>
                <rect x="13" y="13" width="8" height="8"/>
              </svg>
              <span>中</span>
            </button>
            <button @click="setGridSize('large')" :class="['control-btn', { active: gridSize === 'large' }]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="7"/>
                <rect x="3" y="14" width="18" height="7"/>
              </svg>
              <span>大</span>
            </button>
          </div>
        </div>

        <div class="controls-section">
          <label class="control-label">图片适应</label>
          <div class="control-buttons">
            <button @click="setFitMode('contain')" :class="['control-btn', { active: fitMode === 'contain' }]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <rect x="7" y="7" width="10" height="10"/>
              </svg>
              <span>完整</span>
            </button>
            <button @click="setFitMode('cover')" :class="['control-btn', { active: fitMode === 'cover' }]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <rect x="2" y="2" width="20" height="20"/>
              </svg>
              <span>填充</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 画廊网格 -->
      <div class="gallery-grid" :class="`grid-${gridSize}`">
        <div v-for="artwork in artworks" :key="artwork.id" class="gallery-item">
          <div class="gallery-card" @click="$emit('open-image-viewer', artwork, 0)">
            <!-- 图片容器 -->
            <div class="image-container" :class="`fit-${fitMode}`">
              <img 
                :src="getPreviewUrl(artwork.files[0].path)" 
                :alt="artwork.title" 
                class="gallery-image"
                loading="lazy"
                @load="onImageLoad"
                @error="onImageError"
              />
              
              <!-- 多图徽章 -->
              <div v-if="artwork.files.length > 1" class="image-count-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>{{ artwork.files.length }}</span>
              </div>

              <!-- 悬浮信息遮罩 -->
              <div class="image-overlay">
                <div class="overlay-top">
                  <h4 class="overlay-title">{{ artwork.title }}</h4>
                  <p class="overlay-artist">{{ artwork.artist }}</p>
                </div>
                <div class="overlay-bottom">
                  <button @click.stop="$emit('open-image-viewer', artwork, 0)" class="overlay-action-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    查看大图
                  </button>
                  <button @click.stop="$emit('view-artwork', artwork)" class="overlay-action-btn secondary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    详情
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
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
const gridSize = ref<'small' | 'medium' | 'large'>('medium')
const fitMode = ref<'contain' | 'cover'>('contain')

// 设置网格大小
const setGridSize = (size: 'small' | 'medium' | 'large') => {
  gridSize.value = size
}

// 设置图片适应模式
const setFitMode = (mode: 'contain' | 'cover') => {
  fitMode.value = mode
}

// 图片加载成功
const onImageLoad = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.classList.add('loaded')
}

// 图片加载失败
const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  console.error('图片加载失败:', img.src)
  img.classList.add('error')
  
  // 显示占位图
  img.style.display = 'none'
  const container = img.parentElement
  if (container) {
    container.classList.add('has-error')
  }
}
</script>

<style scoped>
.gallery-view {
  width: 100%;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #6b7280;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.5rem;
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
}

/* 画廊控制栏 */
.gallery-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.controls-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  white-space: nowrap;
}

.control-buttons {
  display: flex;
  gap: 0.5rem;
  background: #f3f4f6;
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.control-btn:hover {
  color: #1f2937;
  background: #e5e7eb;
}

.control-btn.active {
  background: #3b82f6;
  color: white;
}

.control-btn.active:hover {
  background: #2563eb;
}

/* 画廊网格 */
.gallery-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

.gallery-grid.grid-small {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.gallery-grid.grid-medium {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

.gallery-grid.grid-large {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

/* 画廊项目 */
.gallery-item {
  position: relative;
}

.gallery-card {
  position: relative;
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.gallery-card:hover {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  transform: translateY(-4px);
}

/* 图片容器 */
.image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.image-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 0;
}

.gallery-image {
  position: relative;
  width: 100%;
  height: 100%;
  transition: all 0.3s ease;
  opacity: 0;
  z-index: 1;
}

.gallery-image.loaded {
  opacity: 1;
}

/* 图片适应模式 */
.image-container.fit-contain .gallery-image {
  object-fit: contain;
}

.image-container.fit-cover .gallery-image {
  object-fit: cover;
}

.gallery-card:hover .gallery-image {
  transform: scale(1.05);
}

/* 错误状态 */
.image-container.has-error::after {
  content: '图片加载失败';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #9ca3af;
  font-size: 0.875rem;
  text-align: center;
  z-index: 2;
}

/* 多图徽章 */
.image-count-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  color: white;
  padding: 0.375rem 0.625rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 3;
}

.image-count-badge svg {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
}

/* 悬浮遮罩 */
.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.6) 0%,
    rgba(0, 0, 0, 0) 30%,
    rgba(0, 0, 0, 0) 70%,
    rgba(0, 0, 0, 0.8) 100%
  );
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 2;
}

.gallery-card:hover .image-overlay {
  opacity: 1;
}

.overlay-top {
  color: white;
}

.overlay-title {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  display: box;
  box-orient: vertical;
}

.overlay-artist {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.9;
}

.overlay-bottom {
  display: flex;
  gap: 0.5rem;
}

.overlay-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background: white;
  color: #1f2937;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.overlay-action-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.overlay-action-btn:hover {
  background: #3b82f6;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.overlay-action-btn.secondary {
  background: rgba(255, 255, 255, 0.9);
}

.overlay-action-btn.secondary:hover {
  background: rgba(255, 255, 255, 1);
  color: #3b82f6;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .gallery-grid.grid-small {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .gallery-grid.grid-medium {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .gallery-grid.grid-large {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .gallery-controls {
    flex-direction: column;
    gap: 1rem;
  }

  .controls-section {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .control-buttons {
    justify-content: stretch;
  }

  .control-btn {
    flex: 1;
    justify-content: center;
  }

  .gallery-grid.grid-small {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .gallery-grid.grid-medium {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  .gallery-grid.grid-large {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }

  .overlay-action-btn span {
    display: none;
  }

  .overlay-action-btn svg {
    margin: 0;
  }
}

@media (max-width: 480px) {
  .image-count-badge {
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .image-count-badge svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .overlay-top {
    display: none;
  }

  .image-overlay {
    justify-content: flex-end;
  }
}
</style>