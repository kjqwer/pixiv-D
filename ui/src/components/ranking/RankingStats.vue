<template>
  <div class="ranking-stats">
    <div class="stat-card">
      <div class="stat-number">{{ totalCount }}</div>
      <div class="stat-label">作品总数</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ currentPage }}</div>
      <div class="stat-label">当前页面</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">{{ totalPages }}</div>
      <div class="stat-label">总页数</div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

defineProps<Props>();
</script>

<style scoped>
.ranking-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #3b82f6;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
}
</style> 