<template>
    <div class="watchlist-buttons">
        <!-- 待看名单按钮 -->
        <button @click="$emit('toggle')" class="watchlist-toggle" :class="{ active: isOpen }" title="待看名单">
            <SvgIcon name="watchlist" class="watchlist-icon" />
            <div v-if="itemCount > 0" class="item-count">{{ itemCount }}</div>
        </button>

        <!-- 添加当前页面按钮 -->
        <button @click="$emit('addCurrent')" class="add-current-toggle" :class="{
            added: isCurrentPageAdded,
            loading: addLoading,
            update: hasSameAuthorDifferentPage && !isCurrentPageAdded
        }" :disabled="addLoading" :title="addButtonTitle">
            <!-- 加载状态：显示加载图标 -->
            <SvgIcon v-if="addLoading" name="loading" class="loading-icon" />
            <!-- 非加载状态：根据条件显示不同图标 -->
            <template v-else>
                <!-- 已添加：显示勾选图标 -->
                <SvgIcon v-if="isCurrentPageAdded" name="success" class="add-icon" />
                <!-- 更新模式：显示更新图标 -->
                <SvgIcon v-else-if="hasSameAuthorDifferentPage" name="watchlist-update" class="add-icon" />
                <!-- 添加模式：显示加号图标 -->
                <SvgIcon v-else name="add" class="add-icon" />
            </template>
        </button>
    </div>
</template>

<script setup lang="ts">
interface Props {
    isOpen: boolean;
    itemCount: number;
    addLoading: boolean;
    isCurrentPageAdded: boolean;
    hasSameAuthorDifferentPage: boolean;
    addButtonTitle: string;
}

defineProps<Props>();

defineEmits<{
    toggle: [];
    addCurrent: [];
}>();
</script>

<style scoped>
.watchlist-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.watchlist-toggle,
.add-current-toggle {
    position: relative;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.watchlist-toggle:hover,
.add-current-toggle:hover:not(:disabled) {
    background: var(--color-primary-light);
    color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(59, 130, 246, 0.3);
    border: 1px solid var(--color-primary);
}

.watchlist-toggle.active {
    background: var(--color-primary);
    color: white;
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
}

.watchlist-toggle.active:hover {
    background: var(--color-primary-dark);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(59, 130, 246, 0.5);
}

.add-current-toggle.added {
    background: var(--color-success);
    color: white;
    box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

.add-current-toggle.added:hover {
    background: #059669;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(16, 185, 129, 0.5);
}

.add-current-toggle.update {
    background: var(--color-warning);
    color: white;
    box-shadow: 0 4px 8px rgba(245, 158, 11, 0.4);
}

.add-current-toggle.update:hover {
    background: #d97706;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(245, 158, 11, 0.5);
}

.add-current-toggle.loading {
    cursor: not-allowed;
    opacity: 0.7;
}

.add-current-toggle:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.watchlist-icon,
.add-icon {
    width: 20px;
    height: 20px;
}

.loading-icon {
    width: 16px;
    height: 16px;
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

.item-count {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--color-danger);
    color: white;
    font-size: 10px;
    font-weight: bold;
    padding: 2px 5px;
    border-radius: 10px;
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}
</style>