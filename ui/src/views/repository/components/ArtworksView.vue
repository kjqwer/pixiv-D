<template>
  <div class="artworks-view">
    <div class="artworks-grid">
      <div 
        v-for="artwork in artworks" 
        :key="artwork.id"
        class="artwork-card"
        @click="$emit('view-artwork', artwork)"
      >
        <div class="artwork-preview" v-if="artwork.files.length > 0">
          <img 
            :src="getPreviewUrl(artwork.files[0].path)" 
            :alt="artwork.title"
            class="preview-image"
            @click.stop="$emit('open-image-viewer', artwork, 0)"
          />
          <div class="artwork-overlay">
            <button @click.stop="$emit('open-image-viewer', artwork, 0)" class="view-btn-overlay">
              👁️ 查看大图
            </button>
          </div>
        </div>
        <div class="artwork-info">
          <h4>{{ artwork.title }}</h4>
          <p class="artist-name" @click.stop="$emit('select-artist', artwork.artist)">
            👤 {{ artwork.artist }}
          </p>
          <p>{{ formatFileSize(artwork.size) }}</p>
          <p class="file-count">{{ artwork.files.length }} 个文件</p>
        </div>
        <div class="artwork-actions">
          <button @click.stop="$emit('view-artwork', artwork)" class="action-btn">
            详情
          </button>
          <button @click.stop="$emit('open-image-viewer', artwork, 0)" class="action-btn">
            预览
          </button>
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
.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.artwork-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.artwork-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.artwork-preview {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.artwork-card:hover .preview-image {
  transform: scale(1.05);
}

.artwork-overlay {
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

.artwork-card:hover .artwork-overlay {
  opacity: 1;
}

.view-btn-overlay {
  background: white;
  color: #1f2937;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.artwork-info {
  padding: 1rem;
}

.artwork-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: #1f2937;
}

.artist-name {
  color: #3b82f6 !important;
  cursor: pointer;
  font-weight: 500;
}

.artist-name:hover {
  text-decoration: underline;
}

.artwork-info p {
  margin: 0.25rem 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.file-count {
  font-weight: 500;
  color: #6b5563 !important;
}

.artwork-actions {
  padding: 0 1rem 1rem;
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #3b82f6;
}

@media (max-width: 768px) {
  .artworks-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style> 