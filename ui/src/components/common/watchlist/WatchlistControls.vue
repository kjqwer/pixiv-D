<template>
  <div class="watchlist-controls">
    <div class="search-box">
      <SvgIcon name="search" class="search-icon" />
      <input :value="searchQuery" @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="text" placeholder="搜索标题或URL..." class="search-input" />
      <button v-if="searchQuery" @click="$emit('clearSearch')" class="clear-search-btn" title="清除搜索">
        <SvgIcon name="close" class="close-icon" />
      </button>
    </div>
    <div class="sort-controls">
      <button @click="$emit('toggleSort')" class="sort-btn" :title="sortOrder === 'desc' ? '切换为升序' : '切换为降序'">
        <SvgIcon v-if="sortOrder === 'desc'" name="sort-desc" class="sort-icon" />
        <SvgIcon v-else name="sort-asc" class="sort-icon" />
        <span class="sort-text">{{ sortOrder === 'desc' ? '最新' : '最旧' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  searchQuery: string;
  sortOrder: 'asc' | 'desc';
}

defineProps<Props>();

defineEmits<{
  'update:searchQuery': [value: string];
  clearSearch: [];
  toggleSort: [];
}>();
</script>

<style scoped>
.watchlist-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--color-text-tertiary);
  z-index: 1;
}

.search-input {
  width: 100%;
  height: 36px;
  padding: 0 40px 0 36px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.close-icon {
  width: 12px;
  height: 12px;
}

.sort-controls {
  flex-shrink: 0;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.sort-btn:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.sort-icon {
  width: 14px;
  height: 14px;
}

.sort-text {
  font-weight: 500;
}

@media (max-width: 480px) {
  .watchlist-controls {
    flex-direction: column;
    gap: 8px;
  }

  .search-box {
    width: 100%;
  }

  .sort-controls {
    width: 100%;
  }

  .sort-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>