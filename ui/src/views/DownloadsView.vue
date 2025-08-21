<template>
  <div class="downloads-page">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">下载管理</h1>
        <div class="header-actions">
          <button @click="refreshHistory" class="btn btn-secondary" :disabled="loading">
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <div v-if="loading" class="loading-section">
        <LoadingSpinner text="加载中..." />
      </div>

      <div v-else class="downloads-content">
        <!-- 活跃任务 -->
        <div v-if="activeTasks.length > 0" class="section">
          <h2 class="section-title">活跃任务</h2>
          <div class="tasks-grid">
            <div 
              v-for="task in activeTasks" 
              :key="task.id"
              class="task-card active"
            >
              <div class="task-header">
                <div class="task-info">
                  <h3 class="task-title">{{ getTaskTitle(task) }}</h3>
                  <p class="task-type">{{ getTaskTypeLabel(task.type) }}</p>
                </div>
                <div class="task-status">
                  <span class="status-badge downloading">下载中</span>
                </div>
              </div>
              
              <div class="task-progress">
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    :style="{ width: `${task.progress}%` }"
                  ></div>
                </div>
                <div class="progress-text">
                  {{ task.completed }}/{{ task.total }} ({{ task.progress }}%)
                </div>
              </div>
              
              <div class="task-actions">
                <button @click="cancelTask(task.id)" class="btn btn-danger">
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 历史记录 -->
        <div class="section">
          <h2 class="section-title">下载历史</h2>
          
          <div v-if="completedTasks.length > 0" class="tasks-grid">
            <div 
              v-for="task in completedTasks" 
              :key="task.id"
              class="task-card completed"
            >
              <div class="task-header">
                <div class="task-info">
                  <h3 class="task-title">{{ getTaskTitle(task) }}</h3>
                  <p class="task-type">{{ getTaskTypeLabel(task.type) }}</p>
                </div>
                <div class="task-status">
                  <span class="status-badge" :class="task.status">
                    {{ getStatusLabel(task.status) }}
                  </span>
                </div>
              </div>
              
              <div class="task-details">
                <div class="detail-item">
                  <span class="detail-label">完成时间:</span>
                  <span class="detail-value">{{ formatDate(task.end_time) }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">文件数量:</span>
                  <span class="detail-value">{{ task.completed }}/{{ task.total }}</span>
                </div>
                <div v-if="task.failed > 0" class="detail-item">
                  <span class="detail-label">失败数量:</span>
                  <span class="detail-value error">{{ task.failed }}</span>
                </div>
              </div>
              
              <div v-if="task.files && task.files.length > 0" class="task-files">
                <h4>下载的文件:</h4>
                <div class="files-list">
                  <div 
                    v-for="file in task.files.slice(0, 3)" 
                    :key="file.path"
                    class="file-item"
                  >
                    <span class="file-name">{{ getFileName(file.path) }}</span>
                    <span class="file-size">{{ file.size }}</span>
                  </div>
                  <div v-if="task.files.length > 3" class="file-more">
                    还有 {{ task.files.length - 3 }} 个文件...
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-section">
            <div class="empty-content">
              <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              <h3>暂无下载记录</h3>
              <p>开始下载作品后，这里会显示下载历史</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import downloadService from '@/services/download';
import type { DownloadTask } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const authStore = useAuthStore();

// 状态
const tasks = ref<DownloadTask[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// 计算属性
const activeTasks = computed(() => 
  tasks.value.filter(task => task.status === 'downloading')
);

const completedTasks = computed(() => 
  tasks.value.filter(task => 
    task.status === 'completed' || 
    task.status === 'partial' || 
    task.status === 'failed' || 
    task.status === 'cancelled'
  ).sort((a, b) => new Date(b.end_time || '').getTime() - new Date(a.end_time || '').getTime())
);

// 获取下载历史
const fetchDownloadHistory = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const response = await downloadService.getDownloadHistory();
    
    if (response.success && response.data) {
      tasks.value = response.data.tasks;
    } else {
      throw new Error(response.error || '获取下载历史失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取下载历史失败';
    console.error('获取下载历史失败:', err);
  } finally {
    loading.value = false;
  }
};

// 取消任务
const cancelTask = async (taskId: string) => {
  try {
    const response = await downloadService.cancelDownload(taskId);
    
    if (response.success) {
      // 更新任务状态
      const task = tasks.value.find(t => t.id === taskId);
      if (task) {
        task.status = 'cancelled';
        task.end_time = new Date().toISOString();
      }
    } else {
      throw new Error(response.error || '取消任务失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '取消任务失败';
    console.error('取消任务失败:', err);
  }
};

// 刷新历史
const refreshHistory = async () => {
  await fetchDownloadHistory();
};

// 获取任务标题
const getTaskTitle = (task: DownloadTask) => {
  switch (task.type) {
    case 'artwork':
      return `作品 #${task.artwork_id}`;
    case 'artist':
      return `作者作品`;
    case 'batch':
      return `批量下载 (${task.total} 个作品)`;
    default:
      return '下载任务';
  }
};

// 获取任务类型标签
const getTaskTypeLabel = (type: string) => {
  switch (type) {
    case 'artwork':
      return '单个作品';
    case 'artist':
      return '作者作品';
    case 'batch':
      return '批量下载';
    default:
      return type;
  }
};

// 获取状态标签
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'partial':
      return '部分完成';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
};

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN');
};

// 获取文件名
const getFileName = (filePath: string) => {
  return filePath.split('/').pop() || filePath;
};

// 清除错误
const clearError = () => {
  error.value = null;
};

onMounted(() => {
  fetchDownloadHistory();
});
</script>

<style scoped>
.downloads-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.btn-danger:hover {
  background: #dc2626;
}

.error-section,
.loading-section {
  margin-bottom: 2rem;
}

.loading-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.section {
  margin-bottom: 3rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
}

.tasks-grid {
  display: grid;
  gap: 1.5rem;
}

.task-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #e5e7eb;
}

.task-card.active {
  border-left-color: #3b82f6;
}

.task-card.completed {
  border-left-color: #10b981;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.task-info {
  flex: 1;
}

.task-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.task-type {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.task-status {
  flex-shrink: 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-badge.completed {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.partial {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.failed {
  background: #fee2e2;
  color: #dc2626;
}

.status-badge.cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.task-progress {
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
}

.task-details {
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.detail-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.detail-value {
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
}

.detail-value.error {
  color: #dc2626;
}

.task-files {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.task-files h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.file-name {
  font-size: 0.875rem;
  color: #374151;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.75rem;
  color: #6b7280;
  flex-shrink: 0;
  margin-left: 1rem;
}

.file-more {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
  font-style: italic;
}

.empty-section {
  text-align: center;
  padding: 4rem 0;
}

.empty-content {
  max-width: 400px;
  margin: 0 auto;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.empty-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.empty-content p {
  color: #6b7280;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .task-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .task-actions {
    justify-content: stretch;
  }
  
  .btn {
    width: 100%;
  }
}
</style> 