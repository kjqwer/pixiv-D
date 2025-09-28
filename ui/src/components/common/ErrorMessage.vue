<template>
  <div v-if="error" class="error-message" :class="type">
    <div class="error-icon">
      <SvgIcon name="bookmark-empty" />
    </div>
    <div class="error-content">
      <div class="error-title">{{ title }}</div>
      <div class="error-text">{{ error }}</div>
    </div>
    <button v-if="dismissible" @click="$emit('dismiss')" class="error-close">
      <SvgIcon name="close" />
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