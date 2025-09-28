<template>
    <div class="watchlist-content">
        <!-- 加载状态 -->
        <div v-if="loading && items.length === 0" class="loading">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="error">
            <SvgIcon name="bookmark-empty" class="error-icon" />
            <span>{{ error }}</span>
            <button @click="$emit('retry')" class="retry-btn">重试</button>
        </div>

        <!-- 搜索无结果 -->
        <div v-else-if="filteredItems.length === 0 && searchQuery" class="empty">
            <SvgIcon name="search" class="empty-icon" />
            <span>没有找到匹配的项目</span>
            <p>尝试调整搜索词或清除搜索条件</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="items.length === 0" class="empty">
            <SvgIcon name="empty" class="empty-icon" />
            <span>暂无待看项目</span>
            <p>点击右侧的 + 按钮添加当前页面</p>
        </div>

        <!-- 项目列表 -->
        <div v-else class="items-list">
            <WatchlistItem v-for="item in filteredItems" :key="item.id" :item="item"
                :is-current="isCurrentUrl(item.url)" :is-duplicate="isDuplicateAuthor(item)"
                :is-pinned="isPinnedCurrentArtist(item)" @navigate="$emit('navigate', $event)"
                @edit="$emit('edit', $event)" @delete="$emit('delete', $event)" />
        </div>
    </div>
</template>

<script setup lang="ts">
import WatchlistItem from './WatchlistItem.vue';
import type { WatchlistItem as WatchlistItemType } from '@/services/watchlist';

interface Props {
    loading: boolean;
    error: string | null;
    items: WatchlistItemType[];
    filteredItems: WatchlistItemType[];
    searchQuery: string;
    isCurrentUrl: (url: string) => boolean;
    isDuplicateAuthor: (item: WatchlistItemType) => boolean;
    isPinnedCurrentArtist: (item: WatchlistItemType) => boolean;
}

defineProps<Props>();

defineEmits<{
    retry: [];
    navigate: [item: WatchlistItemType];
    edit: [item: WatchlistItemType];
    delete: [id: string];
}>();
</script>

<style scoped>
.watchlist-content {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
}

.loading,
.error,
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--color-text-secondary);
}

.loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top: 3px solid var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.error-icon,
.empty-icon {
    width: 48px;
    height: 48px;
    color: var(--color-text-tertiary);
    margin-bottom: 12px;
}

.error span,
.empty span {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 8px;
}

.error p,
.empty p {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0;
}

.retry-btn {
    margin-top: 16px;
    padding: 8px 16px;
    border: 1px solid var(--color-primary);
    border-radius: 6px;
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}

.retry-btn:hover {
    background: var(--color-primary);
    color: white;
}

.items-list {
    padding: 8px 0;
}

/* 滚动条样式 */
.watchlist-content::-webkit-scrollbar {
    width: 6px;
}

.watchlist-content::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
    border-radius: 3px;
}

.watchlist-content::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
}

.watchlist-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-border-hover);
}
</style>