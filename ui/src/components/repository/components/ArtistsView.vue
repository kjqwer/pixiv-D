<template>
  <div class="artists-view">
    <div class="artists-grid">
      <div v-for="artist in artists" :key="artist.name" class="artist-card"
        @click="$emit('select-artist', artist.name)">
        <div class="artist-avatar">
          <span class="avatar-text">{{ artist.name.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="artist-info">
          <h4>{{ artist.name }}</h4>
          <p>{{ artist.artworkCount }} 个作品</p>
          <p>{{ formatFileSize(artist.totalSize) }}</p>
        </div>
        <div class="artist-actions">
          <button @click.stop="$emit('view-artist-works', artist.name)" class="action-btn">
            查看作品
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Artist } from '@/stores/repository.ts'
import { formatFileSize } from '@/utils/formatters'

interface Props {
  artists: Artist[]
}

interface Emits {
  (e: 'select-artist', artistName: string): void
  (e: 'view-artist-works', artistName: string): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.artist-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.artist-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.artist-avatar {
  width: 60px;
  height: 60px;
  background: #3b82f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.artist-info {
  flex: 1;
}

.artist-info h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.artist-info p {
  margin: 0.25rem 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.artist-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #3b82f6;
}

@media (max-width: 768px) {
  .artists-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .artist-card {
    flex-direction: column;
    text-align: center;
  }
}
</style>