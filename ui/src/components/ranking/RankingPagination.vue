<template>
  <div class="pagination">
    <button 
      @click="$emit('page-change', currentPage - 1)" 
      class="page-btn"
      :disabled="currentPage <= 1"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="page-icon">
        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
      </svg>
      上一页
    </button>
    
    <div class="page-numbers">
      <button 
        v-for="page in visiblePages" 
        :key="page"
        @click="$emit('page-change', page)"
        class="page-number"
        :class="{ active: page === currentPage }"
      >
        {{ page }}
      </button>
    </div>
    
    <button 
      @click="$emit('page-change', currentPage + 1)" 
      class="page-btn"
      :disabled="currentPage >= totalPages"
    >
      下一页
      <svg viewBox="0 0 24 24" fill="currentColor" class="page-icon">
        <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
}

interface Emits {
  (e: 'page-change', page: number): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.page-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.page-numbers {
  display: flex;
  gap: 0.5rem;
}

.page-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.page-number:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-number.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    gap: 1rem;
  }
  
  .page-numbers {
    order: -1;
  }
}
</style> 