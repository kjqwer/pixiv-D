<template>
  <div v-if="artwork" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>{{ artwork.title }}</h3>
        <button @click="closeModal" class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="artwork-details">
          <p><strong>作者:</strong> {{ artwork.artist }}</p>
          <p><strong>作品ID:</strong> {{ artwork.id }}</p>
          <p><strong>文件大小:</strong> {{ formatFileSize(artwork.size) }}</p>
          <p><strong>文件数量:</strong> {{ artwork.files.length }}</p>
        </div>
        <div class="artwork-files">
          <h4>文件列表</h4>
          <div class="files-grid">
            <div v-for="file in artwork.files" :key="file.path" class="file-item">
              <img :src="getPreviewUrl(file.path)" :alt="file.name" class="file-preview" />
              <div class="file-info">
                <p>{{ file.name }}</p>
                <p>{{ formatFileSize(file.size) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="deleteArtwork" class="btn btn-danger">
          删除作品
        </button>
        <button @click="closeModal" class="btn btn-secondary">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Artwork } from '@/stores/repository.ts'

interface Props {
  artwork: Artwork | null
}

interface Emits {
  (e: 'close'): void
  (e: 'delete-artwork', artworkId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 关闭模态框
const closeModal = () => {
  emit('close')
}

// 删除作品
const deleteArtwork = () => {
  if (props.artwork) {
    emit('delete-artwork', props.artwork.id)
  }
}

import { formatFileSize, getPreviewUrl } from '@/utils/formatters'
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 1.5rem;
}

.artwork-details {
  margin-bottom: 2rem;
}

.artwork-details p {
  margin: 0.5rem 0;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.file-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  overflow: hidden;
}

.file-preview {
  width: 100%;
  height: 100px;
  object-fit: cover;
}

.file-info {
  padding: 0.5rem;
}

.file-info p {
  margin: 0.25rem 0;
  font-size: 0.75rem;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}
</style>