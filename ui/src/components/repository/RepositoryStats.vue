<template>
  <div class="stats-container">
    <div class="stats-header">
      <h3>仓库统计</h3>
      <div class="stats-actions">
        <button @click="refreshStats" :disabled="loading" class="btn btn-secondary btn-sm" title="刷新统计数据">
          <svg v-if="loading" viewBox="0 0 24 24" fill="currentColor" class="refresh-icon spinning">
            <path
              d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="refresh-icon">
            <path
              d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
          刷新
        </button>
      </div>
    </div>

    <div class="stats-grid" v-if="stats">
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalArtworks }}</div>
          <div class="stat-label">总作品数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👤</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalArtists }}</div>
          <div class="stat-label">总作者数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatFileSize(stats.totalSize) }}</div>
          <div class="stat-label">总存储大小</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💿</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.diskUsage.usagePercent }}%</div>
          <div class="stat-label">磁盘使用率</div>
          <div v-if="stats.diskUsage.note" class="stat-note">{{ stats.diskUsage.note }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RepositoryStats } from '@/stores/repository.ts'
import { useRepositoryStore } from '@/stores/repository'

interface Props {
  stats: RepositoryStats | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  refresh: []
}>()

const loading = ref(false)
const repositoryStore = useRepositoryStore()

const refreshStats = async () => {
  loading.value = true
  try {
    await repositoryStore.getStats(true) // 强制刷新
    emit('refresh')
  } catch (error) {
    console.error('刷新统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

import { formatFileSize } from '@/utils/formatters'
</script>

<style scoped>
.stats-container {
  margin-bottom: 2rem;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stats-header h3 {
  margin: 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
}

.stats-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.refresh-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.25rem;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.stat-note {
  color: #9ca3af;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  font-style: italic;
}
</style>