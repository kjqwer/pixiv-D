<template>
  <div class="watchlist-item" :class="{
    current: isCurrent,
    duplicate: isDuplicate,
    'pinned-artist': isPinned
  }">
    <div class="item-main" @click="$emit('navigate', item)">
      <div class="item-title" :title="item.title">
        {{ item.title }}
        <span v-if="isDuplicate" class="duplicate-badge" title="该作者有多个页面">重复</span>
      </div>
      <div class="item-url" :title="item.url">{{ formatUrl(item.url) }}</div>
      <div class="item-time">{{ formatTime(item.createdAt) }}</div>
    </div>

    <div class="item-actions">
      <button @click="$emit('edit', item)" class="action-btn edit-btn" title="编辑">
        <SvgIcon name="edit" class="edit-icon" />
      </button>
      <button @click="$emit('delete', item.id)" class="action-btn delete-btn" title="删除">
        <SvgIcon name="delete" class="delete-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WatchlistItem } from '@/services/watchlist';

interface Props {
  item: WatchlistItem;
  isCurrent: boolean;
  isDuplicate: boolean;
  isPinned: boolean;
}

defineProps<Props>();

defineEmits<{
  navigate: [item: WatchlistItem];
  edit: [item: WatchlistItem];
  delete: [id: string];
}>();

// 格式化URL显示
const formatUrl = (url: string) => {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    }
    return url;
  } catch {
    return url;
  }
};

// 格式化时间显示
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style scoped>
.watchlist-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
  margin-bottom: 8px;
}

.watchlist-item:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.watchlist-item.current {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  border-width: 2px;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.watchlist-item.current .item-title {
  color: var(--color-primary);
  font-weight: 600;
}

.watchlist-item.current .item-url {
  color: var(--color-primary);
}

.watchlist-item.duplicate {
  border-left: 3px solid var(--color-warning);
}

.watchlist-item.pinned-artist {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

.item-main {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.item-title {
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duplicate-badge {
  background: var(--color-warning);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
  flex-shrink: 0;
}

.item-url {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.item-actions {
  display: flex;
  gap: 4px;
  margin-left: 12px;
}

.action-btn {
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

.action-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.edit-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.delete-btn:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.edit-icon,
.delete-icon {
  width: 14px;
  height: 14px;
}
</style>