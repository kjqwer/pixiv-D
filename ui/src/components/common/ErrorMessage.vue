<template>
  <div v-if="error" class="error-message" :class="type">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </div>
    <div class="error-content">
      <div class="error-title">{{ title }}</div>
      <div class="error-text">{{ error }}</div>
    </div>
    <button v-if="dismissible" @click="$emit('dismiss')" class="error-close">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  error: string | null;
  title?: string;
  type?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
}

interface Emits {
  (e: 'dismiss'): void;
}

const props = withDefaults(defineProps<Props>(), {
  title: '错误',
  type: 'error',
  dismissible: false
});

defineEmits<Emits>();
</script>

<style scoped>
.error-message {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  position: relative;
}

.error-message.error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.error-message.warning {
  background-color: #fffbeb;
  border: 1px solid #fed7aa;
  color: #d97706;
}

.error-message.info {
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
}

.error-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.error-content {
  flex: 1;
  min-width: 0;
}

.error-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.error-text {
  font-size: 0.875rem;
  line-height: 1.4;
}

.error-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.error-close:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.error-close svg {
  width: 1rem;
  height: 1rem;
}
</style> 