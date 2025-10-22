<template>
  <div class="search-panel">
    <div class="search-container">
      <!-- 搜索框 -->
      <div class="search-box">
        <div class="search-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="搜索作品标题、作者名称..." 
          class="search-input"
          @input="debounceSearch"
          @keyup.enter="emit('search', searchQuery)"
        />
        <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- 筛选控制 -->
      <div class="filter-controls">
        <div class="filter-group">
          <label class="filter-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="4" y1="21" x2="4" y2="14"/>
              <line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/>
              <line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
          </label>
          <select v-model="sortBy" @change="handleSortChange" class="filter-select">
            <option value="date">按日期</option>
            <option value="name">按名称</option>
            <option value="size">按大小</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </label>
          <select v-model="filterBy" @change="handleFilterChange" class="filter-select">
            <option value="all">全部类型</option>
            <option value="images">仅图片</option>
            <option value="videos">仅视频</option>
          </select>
        </div>
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
  window.clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
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
  margin-bottom: 1.5rem;
}

.search-container {
  display: flex;
  gap: 1rem;
  align-items: stretch;
  background: white;
  padding: 1rem;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 搜索框 */
.search-box {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.search-box:focus-within {
  background: white;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  color: #6b7280;
}

.search-icon svg {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2;
}

.search-input {
  flex: 1;
  padding: 0.75rem 0;
  border: none;
  background: transparent;
  font-size: 0.9375rem;
  outline: none;
  color: #1f2937;
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin-right: 0.5rem;
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.clear-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.clear-btn:hover {
  background: #e5e7eb;
  color: #1f2937;
}

/* 筛选控制 */
.filter-controls {
  display: flex;
  gap: 0.75rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.filter-group:focus-within {
  background: white;
  border-color: #3b82f6;
}

.filter-label {
  display: flex;
  align-items: center;
  color: #6b7280;
  padding: 0 0.25rem;
}

.filter-label svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.filter-select {
  padding: 0.375rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  outline: none;
  appearance: none;
  padding-right: 1.5rem;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.25rem center;
}

.filter-select:hover {
  color: #3b82f6;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .search-container {
    flex-wrap: wrap;
  }

  .search-box {
    min-width: 100%;
  }

  .filter-controls {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .search-container {
    flex-direction: column;
    gap: 0.75rem;
  }

  .filter-controls {
    width: 100%;
    flex-wrap: wrap;
  }

  .filter-group {
    flex: 1;
    min-width: calc(50% - 0.375rem);
  }
}

@media (max-width: 480px) {
  .filter-controls {
    flex-direction: column;
  }

  .filter-group {
    min-width: 100%;
  }
}
</style>