<template>
  <div class="view-toggle">
    <button class="view-btn" :class="{ active: modelValue === 'artists' }"
      @click="$emit('update:modelValue', 'artists')">
      <span class="btn-icon">👥</span>
      按作者浏览
    </button>
    <button class="view-btn" :class="{ active: modelValue === 'artworks' }"
      @click="$emit('update:modelValue', 'artworks')">
      <span class="btn-icon">🖼️</span>
      所有作品
    </button>
    <button class="view-btn" :class="{ active: modelValue === 'gallery' }"
      @click="$emit('update:modelValue', 'gallery')">
      <span class="btn-icon">🎨</span>
      画廊模式
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
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.view-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-icon {
  font-size: 1rem;
}

@media (max-width: 768px) {
  .view-toggle {
    width: 100%;
    justify-content: center;
  }
}
</style>