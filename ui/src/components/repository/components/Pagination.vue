<template>
  <div class="pagination" v-if="totalPages > 1">
    <!-- 首页 -->
    <button 
      @click="$emit('change-page', 1)" 
      :disabled="currentPage <= 1" 
      class="page-btn nav-btn"
      title="首页"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="11 17 6 12 11 7"/>
        <polyline points="18 17 13 12 18 7"/>
      </svg>
    </button>

    <!-- 上一页 -->
    <button 
      @click="$emit('change-page', currentPage - 1)" 
      :disabled="currentPage <= 1" 
      class="page-btn nav-btn"
      title="上一页"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>

    <!-- 页码 -->
    <div class="page-numbers">
      <button 
        v-for="page in visiblePages" 
        :key="page" 
        @click="$emit('change-page', page)"
        :class="['page-btn', 'number-btn', { active: page === currentPage }]"
        :title="`第 ${page} 页`"
      >
        {{ page }}
      </button>
    </div>

    <!-- 下一页 -->
    <button 
      @click="$emit('change-page', currentPage + 1)" 
      :disabled="currentPage >= totalPages" 
      class="page-btn nav-btn"
      title="下一页"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>

    <!-- 末页 -->
    <button 
      @click="$emit('change-page', totalPages)" 
      :disabled="currentPage >= totalPages" 
      class="page-btn nav-btn"
      title="末页"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="13 17 18 12 13 7"/>
        <polyline points="6 17 11 12 6 7"/>
      </svg>
    </button>

    <!-- 页码信息 -->
    <div class="page-info">
      <span class="current-page">{{ currentPage }}</span>
      <span class="divider">/</span>
      <span class="total-pages">{{ totalPages }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
}

interface Emits {
  (e: 'change-page', page: number): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(props.totalPages, start + maxVisible - 1)

  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
  padding: 1.5rem 0;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  border: none;
  background: white;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4b5563;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.page-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.page-btn:hover:not(:disabled):not(.active) {
  background: #f3f4f6;
  color: #1f2937;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.page-btn:active:not(:disabled) {
  transform: translateY(0);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* 导航按钮 */
.nav-btn {
  min-width: 2.5rem;
}

/* 页码按钮 */
.number-btn {
  min-width: 2.5rem;
  font-weight: 600;
}

.number-btn.active {
  background: #3b82f6;
  color: white;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
}

.number-btn.active:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.page-numbers {
  display: flex;
  gap: 0.375rem;
}

/* 页码信息 */
.page-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.current-page {
  color: #3b82f6;
  font-weight: 600;
}

.divider {
  color: #d1d5db;
  margin: 0 0.125rem;
}

.total-pages {
  color: #9ca3af;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .pagination {
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 1rem 0;
  }

  .page-btn {
    min-width: 2.25rem;
    height: 2.25rem;
  }

  .page-numbers {
    order: -1;
    width: 100%;
    justify-content: center;
    margin-bottom: 0.5rem;
    gap: 0.25rem;
  }

  .page-info {
    order: -2;
    width: 100%;
    justify-content: center;
    margin: 0 0 0.75rem 0;
  }

  .nav-btn {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .page-btn {
    min-width: 2rem;
    height: 2rem;
    font-size: 0.8125rem;
  }

  .page-btn svg {
    width: 1rem;
    height: 1rem;
  }
}
</style>