<template>
  <div v-if="visible" class="watchlist-panel">
    <div class="watchlist-header">
      <h3>待看名单</h3>
      <div class="header-actions">
        <span class="item-count-text">{{ itemCount }} 项</span>
        <button @click="$emit('showAddModal')" class="add-btn" title="手动添加">
          <SvgIcon name="add" class="add-icon" />
        </button>
        <button @click="$emit('close')" class="close-btn" title="关闭">
          <SvgIcon name="close" class="close-icon" />
        </button>
      </div>
    </div>

    <!-- 搜索和排序控制区域 -->
    <WatchlistControls :search-query="searchQuery" :sort-order="sortOrder"
      @update:search-query="$emit('update:searchQuery', $event)" @clear-search="$emit('clearSearch')"
      @toggle-sort="$emit('toggleSort')" />

    <!-- 内容区域 -->
    <WatchlistContent :loading="loading" :error="error" :items="items" :filtered-items="filteredItems"
      :search-query="searchQuery" :is-current-url="isCurrentUrl" :is-duplicate-author="isDuplicateAuthor"
      :is-pinned-current-artist="isPinnedCurrentArtist" @retry="$emit('retry')" @navigate="$emit('navigate', $event)"
      @edit="$emit('edit', $event)" @delete="$emit('delete', $event)" />
  </div>
</template>

<script setup lang="ts">
import WatchlistControls from './WatchlistControls.vue';
import WatchlistContent from './WatchlistContent.vue';
import type { WatchlistItem } from '@/services/watchlist';

interface Props {
  visible: boolean;
  itemCount: number;
  loading: boolean;
  error: string | null;
  items: WatchlistItem[];
  filteredItems: WatchlistItem[];
  searchQuery: string;
  sortOrder: 'asc' | 'desc';
  isCurrentUrl: (url: string) => boolean;
  isDuplicateAuthor: (item: WatchlistItem) => boolean;
  isPinnedCurrentArtist: (item: WatchlistItem) => boolean;
}

defineProps<Props>();

defineEmits<{
  close: [];
  showAddModal: [];
  'update:searchQuery': [value: string];
  clearSearch: [];
  toggleSort: [];
  retry: [];
  navigate: [item: WatchlistItem];
  edit: [item: WatchlistItem];
  delete: [id: string];
}>();
</script>

<style scoped>
.watchlist-panel {
  position: absolute;
  top: 50px;
  left: 0;
  width: 400px;
  max-height: 600px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: panelSlideIn 0.3s ease-out;
}

@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.watchlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  border-radius: 12px 12px 0 0;
}

.watchlist-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-count-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.add-btn,
.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.add-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.close-btn:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.add-icon,
.close-icon {
  width: 14px;
  height: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .watchlist-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
    animation: panelSlideUp 0.3s ease-out;
  }

  @keyframes panelSlideUp {
    from {
      opacity: 0;
      transform: translateY(100%);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .watchlist-header {
    border-radius: 0;
  }
}

@media (max-width: 480px) {
  .watchlist-header {
    padding: 12px 16px;
  }

  .watchlist-header h3 {
    font-size: 14px;
  }

  .item-count-text {
    font-size: 11px;
  }
}
</style>