<template>
  <div class="download-progress" v-if="task">
    <div class="progress-header">
      <h4 class="progress-title">{{ task.artwork_title || '下载中...' }}</h4>
      <div class="progress-actions">
        <button 
          v-if="task.status === 'downloading'" 
          @click="pauseTask" 
          class="btn btn-sm btn-secondary"
          :disabled="loading"
        >
          暂停
        </button>
        <button 
          v-if="task.status === 'paused'" 
          @click="resumeTask" 
          class="btn btn-sm btn-primary"
          :disabled="loading"
        >
          恢复
        </button>
        <button 
          @click="cancelTask" 
          class="btn btn-sm btn-danger"
          :disabled="loading"
        >
          取消
        </button>
      </div>
    </div>

    <div class="progress-overview">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${task.progress}%` }"
          :class="progressClass"
        ></div>
      </div>
      <div class="progress-text">
        {{ task.progress }}% ({{ task.completed_files }}/{{ task.total_files }})
      </div>
    </div>

    <div class="task-status">
      <span class="status-badge" :class="statusClass">
        {{ getStatusText(task.status) }}
      </span>
      <span class="task-time">{{ formatTime(task.start_time) }}</span>
    </div>



    <!-- 错误信息 -->
    <div v-if="task.error" class="task-error">
      <span class="error-icon">⚠️</span>
      {{ task.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import downloadService from '@/services/download';
import type { DownloadTask } from '@/types';

interface Props {
  task: DownloadTask;
  loading?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  update: [task: DownloadTask];
  remove: [taskId: string];
}>();

// 计算属性
const progressClass = computed(() => {
  if (props.task.status === 'completed') return 'completed';
  if (props.task.status === 'failed') return 'failed';
  if (props.task.status === 'paused') return 'paused';
  return 'downloading';
});

const statusClass = computed(() => {
  return `status-${props.task.status}`;
});

// 方法
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    partial: '部分完成',
    cancelled: '已取消',
    paused: '已暂停'
  };
  return statusMap[status] || status;
};



const formatTime = (timeString: string) => {
  const date = new Date(timeString);
  return date.toLocaleString('zh-CN');
};

const pauseTask = async () => {
  try {
    const response = await downloadService.pauseTask(props.task.id);
    if (response.success) {
      emit('update', { ...props.task, status: 'paused' });
    }
  } catch (error) {
    console.error('暂停任务失败:', error);
  }
};

const resumeTask = async () => {
  try {
    const response = await downloadService.resumeTask(props.task.id);
    if (response.success) {
      emit('update', { ...props.task, status: 'downloading' });
    }
  } catch (error) {
    console.error('恢复任务失败:', error);
  }
};

const cancelTask = async () => {
  try {
    const response = await downloadService.cancelTask(props.task.id);
    if (response.success) {
      emit('remove', props.task.id);
    }
  } catch (error) {
    console.error('取消任务失败:', error);
  }
};
</script>

<style scoped>
.download-progress {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  margin-bottom: 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.progress-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  min-width: 60px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.progress-overview {
  margin-bottom: 0.75rem;
}

.progress-bar {
  width: 100%;
  height: 0.375rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.downloading {
  background: #3b82f6;
}

.progress-fill.completed {
  background: #10b981;
}

.progress-fill.failed {
  background: #ef4444;
}

.progress-fill.paused {
  background: #f59e0b;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

.task-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-partial {
  background: #fef3c7;
  color: #d97706;
}

.status-cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.status-paused {
  background: #fef3c7;
  color: #d97706;
}

.task-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.files-progress {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.file-item {
  margin-bottom: 0.75rem;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.file-name {
  font-size: 0.875rem;
  color: #374151;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.file-status {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
}

.file-status-pending {
  background: #f3f4f6;
  color: #6b7280;
}

.file-status-downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.file-status-completed {
  background: #d1fae5;
  color: #065f46;
}

.file-status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.file-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-progress-bar {
  flex: 1;
  height: 0.25rem;
  background: #f3f4f6;
  border-radius: 0.125rem;
  overflow: hidden;
}

.file-progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.file-progress-text {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 2.5rem;
  text-align: right;
}

.file-error {
  font-size: 0.75rem;
  color: #dc2626;
  margin-top: 0.25rem;
}

.task-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;
}

.error-icon {
  font-size: 1rem;
}
</style> 