<template>
  <div class="artists-view">
    <!-- 空状态 -->
    <div v-if="artists.length === 0" class="empty-state">
      <div class="empty-icon">👤</div>
      <h3>暂无作者</h3>
      <p>这里还没有任何作者信息</p>
    </div>

    <!-- 作者网格 -->
    <div v-else class="artists-grid">
      <div v-for="artist in artists" :key="artist.name" class="artist-card">
        <!-- 卡片内容 -->
        <div class="card-content" @click="$emit('view-artist-works', artist.name)">
          <!-- 头像和背景 -->
          <div class="artist-header">
            <div class="artist-avatar">
              <span class="avatar-text">{{ artist.name.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="artist-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>

          <!-- 作者信息 -->
          <div class="artist-details">
            <h3 class="artist-name" :title="artist.name">{{ artist.name }}</h3>
            
            <!-- 统计信息 -->
            <div class="artist-stats">
              <div class="stat-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                <span class="stat-value">{{ artist.artworkCount }}</span>
                <span class="stat-label">作品</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span class="stat-value">{{ formatFileSize(artist.totalSize) }}</span>
                <span class="stat-label">大小</span>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="artist-actions">
            <button @click.stop="$emit('view-artist-works', artist.name)" class="action-btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>查看作品</span>
            </button>
            <button @click.stop="$emit('select-artist', artist.name)" class="action-btn secondary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </div>
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
.artists-view {
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

/* 作者网格 */
.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

/* 作者卡片 */
.artist-card {
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.artist-card:hover {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  transform: translateY(-4px);
}

.card-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  cursor: pointer;
}

/* 作者头部 */
.artist-header {
  position: relative;
  height: 120px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.artist-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
  opacity: 0.3;
}

.artist-avatar {
  position: relative;
  width: 80px;
  height: 80px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1;
}

.avatar-text {
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.artist-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2rem;
  height: 2rem;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 1;
}

.artist-badge svg {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2;
}

/* 作者详情 */
.artist-details {
  padding: 1.25rem;
  flex: 1;
}

.artist-name {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 统计信息 */
.artist-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.stat-item svg {
  width: 1.25rem;
  height: 1.25rem;
  color: #6b7280;
  stroke-width: 2;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.stat-divider {
  width: 1px;
  height: 2.5rem;
  background: #e5e7eb;
}

/* 操作按钮 */
.artist-actions {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.25rem 1.25rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.action-btn.primary {
  flex: 1;
  background: #3b82f6;
  color: white;
}

.action-btn.primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
}

.action-btn.secondary {
  background: #f3f4f6;
  color: #4b5563;
  padding: 0.75rem;
}

.action-btn.secondary:hover {
  background: #e5e7eb;
  color: #1f2937;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .artists-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }
}

@media (max-width: 768px) {
  .artists-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }

  .artist-header {
    height: 100px;
  }

  .artist-avatar {
    width: 64px;
    height: 64px;
  }

  .avatar-text {
    font-size: 1.5rem;
  }

  .artist-details {
    padding: 1rem;
  }

  .artist-name {
    font-size: 1rem;
  }

  .action-btn.primary span {
    display: none;
  }

  .action-btn.primary {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .artists-grid {
    grid-template-columns: 1fr;
  }

  .stat-value {
    font-size: 0.875rem;
  }

  .stat-label {
    font-size: 0.6875rem;
  }
}
</style>