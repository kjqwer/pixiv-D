<template>
  <div class="artworks-view">
    <!-- 无作品提示 -->
    <div v-if="artworks.length === 0" class="empty-state">
      <div class="empty-icon">🎨</div>
      <h3>暂无作品</h3>
      <p>这里还没有任何作品，快去下载一些吧！</p>
    </div>

    <!-- 作品网格 -->
    <div v-else class="artworks-grid">
      <div v-for="artwork in artworks" :key="artwork.id" class="artwork-card">
        <!-- 图片容器 - 点击预览大图 -->
        <div class="artwork-image-wrapper" @click="$emit('open-image-viewer', artwork, 0)">
          <div v-if="artwork.files.length > 0" class="artwork-image-container">
            <img 
              :src="getPreviewUrl(artwork.files[0].path)" 
              :alt="artwork.title" 
              class="artwork-image"
              loading="lazy"
            />
            <!-- 多图标识 -->
            <div v-if="artwork.files.length > 1" class="multi-image-badge">
              <svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>{{ artwork.files.length }}</span>
            </div>
            <!-- 悬浮遮罩 -->
            <div class="artwork-hover-overlay">
              <button class="quick-view-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span>查看大图</span>
              </button>
            </div>
          </div>
          <div v-else class="artwork-no-image">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>暂无预览</span>
          </div>
        </div>

        <!-- 作品信息 -->
        <div class="artwork-content">
          <h3 class="artwork-title" :title="artwork.title">{{ artwork.title }}</h3>
          
          <!-- 作者信息 -->
          <div class="artwork-artist" @click.stop="$emit('select-artist', artwork.artist)">
            <div class="artist-avatar">
              <span>{{ artwork.artist.charAt(0).toUpperCase() }}</span>
            </div>
            <span class="artist-name">{{ artwork.artist }}</span>
          </div>

          <!-- 元数据 -->
          <div class="artwork-meta">
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>{{ formatFileSize(artwork.size) }}</span>
            </div>
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <span>{{ artwork.files.length }} 个文件</span>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="artwork-actions">
            <button @click.stop="$emit('view-artwork', artwork)" class="action-btn action-btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              查看详情
            </button>
            <button @click.stop="$emit('open-image-viewer', artwork, 0)" class="action-btn action-btn-secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Artwork } from '@/stores/repository.ts'
import { formatFileSize, getPreviewUrl } from '@/utils/formatters'

interface Props {
  artworks: Artwork[]
}

interface Emits {
  (e: 'view-artwork', artwork: Artwork): void
  (e: 'select-artist', artistName: string): void
  (e: 'open-image-viewer', artwork: Artwork, index: number): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.artworks-view {
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

/* 作品网格 - 响应式布局 */
.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

/* 作品卡片 */
.artwork-card {
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.artwork-card:hover {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  transform: translateY(-4px);
}

/* 图片容器 */
.artwork-image-wrapper {
  position: relative;
  width: 100%;
  cursor: pointer;
  background: #f9fafb;
}

.artwork-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.artwork-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s ease;
  background: white;
}

.artwork-card:hover .artwork-image {
  transform: scale(1.02);
}

/* 多图标识 */
.multi-image-badge {
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
  z-index: 2;
}

.badge-icon {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
}

/* 悬浮遮罩 */
.artwork-hover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
}

.artwork-image-wrapper:hover .artwork-hover-overlay {
  opacity: 1;
}

.quick-view-btn {
  background: white;
  color: #1f2937;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.quick-view-btn:hover {
  background: #3b82f6;
  color: white;
  transform: scale(1.05);
}

.quick-view-btn svg {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2;
}

/* 无图片状态 */
.artwork-no-image {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  color: #9ca3af;
  gap: 0.75rem;
}

.artwork-no-image svg {
  width: 3rem;
  height: 3rem;
  stroke-width: 1.5;
}

.artwork-no-image span {
  font-size: 0.875rem;
  font-weight: 500;
}

/* 作品内容 */
.artwork-content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
}

.artwork-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
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

/* 作者信息 */
.artwork-artist {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.5rem;
  margin: -0.5rem;
  border-radius: 0.5rem;
}

.artwork-artist:hover {
  background: #f3f4f6;
}

.artist-avatar {
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
}

.artist-name {
  color: #4b5563;
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}

.artwork-artist:hover .artist-name {
  color: #3b82f6;
}

/* 元数据 */
.artwork-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #6b7280;
  font-size: 0.8125rem;
}

.meta-item svg {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
  flex-shrink: 0;
}

/* 操作按钮 */
.artwork-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.action-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.action-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.action-btn-primary {
  background: #3b82f6;
  color: white;
}

.action-btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
}

.action-btn-secondary {
  background: #f3f4f6;
  color: #4b5563;
}

.action-btn-secondary:hover {
  background: #e5e7eb;
  color: #1f2937;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .artworks-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.25rem;
  }
}

@media (max-width: 768px) {
  .artworks-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1rem;
  }

  .artwork-content {
    padding: 1rem;
  }

  .artwork-title {
    font-size: 0.9375rem;
  }

  .action-btn span {
    display: none;
  }

  .action-btn svg {
    margin: 0;
  }
}

@media (max-width: 480px) {
  .artworks-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.75rem;
  }

  .multi-image-badge {
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .badge-icon {
    width: 0.875rem;
    height: 0.875rem;
  }
}
</style>