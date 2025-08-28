<template>
  <div class="search-panel">
    <div class="search-filters">
      <div class="search-box">
        <input v-model="searchQuery" type="text" placeholder="搜索作品标题、作者名称..." class="search-input"
          @input="debounceSearch" />
        <button @click="clearSearch" class="clear-btn" v-if="searchQuery">
          ✕
        </button>
      </div>

      <div class="filter-controls">
        <select v-model="sortBy" @change="handleSortChange" class="filter-select">
          <option value="date">按日期排序</option>
          <option value="name">按名称排序</option>
          <option value="size">按大小排序</option>
        </select>

        <select v-model="filterBy" @change="handleFilterChange" class="filter-select">
          <option value="all">全部</option>
          <option value="images">仅图片</option>
          <option value="videos">仅视频</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  initialQuery?: string
  initialSort?: string
  initialFilter?: string
}

interface Emits {
  (e: 'search', query: string): void
  (e: 'sort', sortBy: string): void
  (e: 'filter', filterBy: string): void
  (e: 'clear'): void
}

const props = withDefaults(defineProps<Props>(), {
  initialQuery: '',
  initialSort: 'date',
  initialFilter: 'all'
})

const emit = defineEmits<Emits>()

// 响应式数据
const searchQuery = ref(props.initialQuery)
const sortBy = ref(props.initialSort)
const filterBy = ref(props.initialFilter)

// 防抖搜索
let searchTimeout: number
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    emit('search', searchQuery.value)
  }, 300)
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('clear')
}

const handleSortChange = () => {
  emit('sort', sortBy.value)
}

const handleFilterChange = () => {
  emit('filter', filterBy.value)
}

// 监听外部查询变化
watch(() => props.initialQuery, (newQuery) => {
  searchQuery.value = newQuery
})
</script>

<style scoped>
.search-panel {
  margin-bottom: 2rem;
}

.search-filters {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.clear-btn:hover {
  background: #f3f4f6;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .search-filters {
    flex-direction: column;
    width: 100%;
  }

  .search-box {
    max-width: none;
  }

  .filter-controls {
    width: 100%;
  }

  .filter-select {
    flex: 1;
  }
}
</style>