<template>
  <div class="view-toggle">
    <button 
      class="view-btn" 
      :class="{ active: modelValue === 'artists' }"
      @click="$emit('update:modelValue', 'artists')"
      :title="'按作者浏览'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span class="btn-text">作者</span>
    </button>
    
    <button 
      class="view-btn" 
      :class="{ active: modelValue === 'artworks' }"
      @click="$emit('update:modelValue', 'artworks')"
      :title="'作品列表'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
      <span class="btn-text">列表</span>
    </button>
    
    <button 
      class="view-btn" 
      :class="{ active: modelValue === 'gallery' }"
      @click="$emit('update:modelValue', 'gallery')"
      :title="'画廊模式'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span class="btn-text">画廊</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.view-toggle {
  display: inline-flex;
  gap: 0;
  background: #f3f4f6;
  padding: 0.25rem;
  border-radius: 0.625rem;
  margin-bottom: 1.5rem;
}

.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.125rem;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.view-btn svg {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.view-btn:hover:not(.active) {
  color: #1f2937;
  background: rgba(255, 255, 255, 0.6);
}

.view-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn-text {
  font-weight: 500;
}

@media (max-width: 768px) {
  .view-toggle {
    width: 100%;
    display: flex;
  }

  .view-btn {
    flex: 1;
    padding: 0.75rem 0.875rem;
  }

  .btn-text {
    display: none;
  }
}

@media (max-width: 480px) {
  .view-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }
}
</style>