<template>
  <div class="pagination" v-if="totalPages > 1">
    <button 
      @click="$emit('change-page', 1)" 
      :disabled="currentPage <= 1"
      class="page-btn"
    >
      首页
    </button>
    <button 
      @click="$emit('change-page', currentPage - 1)" 
      :disabled="currentPage <= 1"
      class="page-btn"
    >
      上一页
    </button>
    
    <div class="page-numbers">
      <button 
        v-for="page in visiblePages" 
        :key="page"
        @click="$emit('change-page', page)"
        :class="['page-btn', { active: page === currentPage }]"
      >
        {{ page }}
      </button>
    </div>
    
    <button 
      @click="$emit('change-page', currentPage + 1)" 
      :disabled="currentPage >= totalPages"
      class="page-btn"
    >
      下一页
    </button>
    <button 
      @click="$emit('change-page', totalPages)" 
      :disabled="currentPage >= totalPages"
      class="page-btn"
    >
      末页
    </button>
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
}

.page-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #3b82f6;
}

.page-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

@media (max-width: 768px) {
  .pagination {
    flex-wrap: wrap;
  }
  
  .page-numbers {
    order: 3;
    width: 100%;
    justify-content: center;
    margin-top: 0.5rem;
  }
}
</style> 