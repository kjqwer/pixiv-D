<template>
  <div class="download-progress" v-if="task">
    <div class="progress-header">
      <h4 class="progress-title">{{ getTaskTitle(task) }}</h4>
      <div class="progress-actions">
        <button v-if="task.status === 'downloading' || task.status === 'pausing'" @click="pauseTask"
          class="btn btn-sm btn-secondary" :disabled="loading || task.status === 'pausing'">
          {{ task.status === 'pausing' ? '暂停中...' : '暂停' }}
        </button>
        <button v-if="task.status === 'paused' || task.status === 'resuming'" @click="resumeTask"
          class="btn btn-sm btn-primary" :disabled="loading || task.status === 'resuming'">
          {{ task.status === 'resuming' ? '恢复中...' : '恢复' }}
        </button>
        <button @click="cancelTask" class="btn btn-sm btn-danger" :disabled="loading || task.status === 'cancelling'">
          {{ task.status === 'cancelling' ? '取消中...' : '取消' }}
        </button>
      </div>
    </div>

    <div class="progress-overview">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${task.progress}%` }" :class="progressClass"></div>
      </div>
      <div class="progress-text">
        {{ task.progress }}% ({{ task.completed_files }}/{{ task.total_files }})
      </div>
    </div>

    <!-- 批量下载的详细进度 -->
    <div v-if="task.type === 'batch' || task.type === 'artist' || task.type === 'art'" class="batch-progress">
      <div class="batch-stats">
        <div class="stat-item">
          <span class="stat-label">已完成:</span>
          <span class="stat-value success">{{ task.completed_files }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">失败:</span>
          <span class="stat-value error">{{ task.failed_files }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">剩余:</span>
          <span class="stat-value">{{ task.total_files - task.completed_files - task.failed_files }}</span>
        </div>
      </div>

      <!-- 最近完成的作品列表 -->
      <div v-if="task.recent_completed && task.recent_completed.length > 0" class="recent-completed">
        <h4>最近完成:</h4>
        <div class="completed-list">
          <div v-for="item in task.recent_completed.slice(0, 3)" :key="item.artwork_id" class="completed-item">
            <span class="artwork-id">#{{ item.artwork_id }}</span>
            <span v-if="item.artwork_title" class="artwork-title">{{ item.artwork_title }}</span>
            <span v-if="item.artist_name" class="artist-name">by {{ item.artist_name }}</span>
          </div>
        </div>
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
import { useDownloadStore } from '@/stores/download';
import type { DownloadTask } from '@/types';

interface Props {
  task: DownloadTask;
  loading?: boolean;
}

const props = defineProps<Props>();
const downloadStore = useDownloadStore();

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
const getTaskTitle = (task: DownloadTask) => {
  // 优先使用后端生成的任务标题
  if (task.task_title) {
    return task.task_title;
  }

  // 兼容旧版本的任务标题生成逻辑
  if (task.type === 'artwork') {
    return task.artwork_title || `作品 ${task.artwork_id}`;
  } else if (task.type === 'artist') {
    return `作者作品 - ${task.artist_name || '未知作者'}`;
  } else if (task.type === 'batch') {
    // 如果有任务描述，使用任务描述
    if (task.task_description) {
      return `${task.task_description} (${task.total_files} 个作品)`;
    }
    return `批量下载 (${task.total_files} 个作品)`;
  }
  return '下载中...';
};

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    partial: '部分完成',
    cancelled: '已取消',
    paused: '已暂停',
    pausing: '暂停中',
    resuming: '恢复中',
    cancelling: '取消中'
  };
  return statusMap[status] || status;
};



const formatTime = (timeString: string) => {
  const date = new Date(timeString);
  return date.toLocaleString('zh-CN');
};

const pauseTask = async () => {
  try {
    await downloadStore.pauseTask(props.task.id);
  } catch (error) {
    console.error('暂停任务失败:', error);
    // 显示用户友好的错误提示
    if (error instanceof Error) {
      alert(`暂停失败: ${error.message}`);
    }
  }
};

const resumeTask = async () => {
  try {
    await downloadStore.resumeTask(props.task.id);
  } catch (error) {
    console.error('恢复任务失败:', error);
    // 显示用户友好的错误提示
    if (error instanceof Error) {
      alert(`恢复失败: ${error.message}`);
    }
  }
};

const cancelTask = async () => {
  try {
    await downloadStore.cancelTask(props.task.id);
  } catch (error) {
    console.error('取消任务失败:', error);
    // 显示用户友好的错误提示
    if (error instanceof Error) {
      alert(`取消失败: ${error.message}`);
    }
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
  z-index: 1002;
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

/* 批量下载进度样式 */
.batch-progress {
  margin: 1rem 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}

.batch-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.75rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(226, 232, 240, 0.8);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #e2e8f0, #cbd5e1);
  transition: all 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stat-item:hover::before {
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value.success {
  color: #059669;
  background: linear-gradient(135deg, #059669, #047857);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-value.success+.stat-label {
  color: #047857;
}

.stat-item:has(.stat-value.success)::before {
  background: linear-gradient(90deg, #10b981, #059669);
}

.stat-value.error {
  color: #dc2626;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-value.error+.stat-label {
  color: #b91c1c;
}

.stat-item:has(.stat-value.error)::before {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.stat-item:has(.stat-value:not(.success):not(.error))::before {
  background: linear-gradient(90deg, #6366f1, #4f46e5);
}

.stat-item:has(.stat-value:not(.success):not(.error)) .stat-value {
  color: #4f46e5;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-item:has(.stat-value:not(.success):not(.error)) .stat-label {
  color: #4f46e5;
}

.recent-completed h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.completed-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.completed-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.artwork-id {
  font-weight: 600;
  color: #3b82f6;
}

.artwork-title {
  color: #374151;
  font-weight: 500;
}

.artist-name {
  color: #6b7280;
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

@media (max-width: 768px) {
  .batch-stats {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>