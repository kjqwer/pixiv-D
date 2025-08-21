<template>
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RepositoryStats } from '@/stores/repository.ts'

interface Props {
  stats: RepositoryStats | null
}

defineProps<Props>()

import { formatFileSize } from '@/utils/formatters'
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
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

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
}
</style> 