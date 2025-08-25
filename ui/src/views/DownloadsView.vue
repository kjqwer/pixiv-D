<template>
  <div class="downloads-page">
    <div class="container">
      <div class="page-header">
        <h1>下载管理</h1>
        <div class="header-actions">
          <button @click="refreshData" class="btn btn-primary" :disabled="loading">
            <svg viewBox="0 0 24 24" fill="currentColor" class="btn-icon">
              <path
                d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            刷新
          </button>
          <button @click="cleanupTasks" class="btn btn-secondary" :disabled="loading">
            <svg viewBox="0 0 24 24" fill="currentColor" class="btn-icon">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            清理任务
          </button>
          <button @click="cleanupHistory" class="btn btn-secondary" :disabled="loading">
            <svg viewBox="0 0 24 24" fill="currentColor" class="btn-icon">
              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
            </svg>
            清理历史
          </button>
        </div>
      </div>

      <div v-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <!-- 标签页 -->
      <div class="tabs">
        <button @click="activeTab = 'tasks'" class="tab-btn" :class="{ active: activeTab === 'tasks' }">
          下载任务
        </button>
        <button @click="activeTab = 'history'" class="tab-btn" :class="{ active: activeTab === 'history' }">
          下载历史
        </button>
      </div>

      <!-- 下载任务 -->
      <div v-if="activeTab === 'tasks'" class="tab-content">
        <div v-if="loading" class="loading-section">
          <LoadingSpinner text="加载中..." />
        </div>

        <div v-else-if="activeTasks.length === 0" class="empty-section">
          <div class="empty-content">
            <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
              <path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
            </svg>
            <h3>暂无下载任务</h3>
            <p>开始下载作品后，任务将显示在这里</p>
          </div>
        </div>

        <div v-else class="tasks-list">
          <div v-for="task in activeTasks" :key="task.id" class="task-card">
            <div class="task-header">
              <div class="task-info">
                <h3 class="task-title">
                  {{ getTaskTitle(task) }}
                </h3>
                <span class="task-status" :class="task.status">
                  {{ getStatusText(task.status) }}
                </span>
              </div>
              <div class="task-actions">
                <button v-if="task.status === 'downloading'" @click="cancelTask(task.id)" class="btn btn-danger btn-sm">
                  取消
                </button>
              </div>
            </div>

            <div class="task-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${task.progress}%` }"></div>
              </div>
              <div class="progress-text">
                {{ task.completed_files }}/{{ task.total_files }} ({{ task.progress }}%)
              </div>
            </div>

            <!-- 批量下载的详细进度 -->
            <div v-if="task.type === 'batch' || task.type === 'artist'" class="batch-progress">
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
                  <div v-for="item in task.recent_completed.slice(0, 5)" :key="item.artwork_id" class="completed-item">
                    <span class="artwork-id">#{{ item.artwork_id }}</span>
                    <span v-if="item.artwork_title" class="artwork-title">{{ item.artwork_title }}</span>
                    <span v-if="item.artist_name" class="artist-name">by {{ item.artist_name }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="task-details">
              <div class="detail-item">
                <span class="label">类型:</span>
                <span class="value">{{ getTypeText(task.type) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">开始时间:</span>
                <span class="value">{{ formatDate(task.start_time) }}</span>
              </div>
              <div v-if="task.end_time" class="detail-item">
                <span class="label">完成时间:</span>
                <span class="value">{{ formatDate(task.end_time) }}</span>
              </div>
              <div v-if="task.error" class="detail-item">
                <span class="label">错误:</span>
                <span class="value error">{{ task.error }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 下载历史 -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <div v-if="loading" class="loading-section">
          <LoadingSpinner text="加载中..." />
        </div>

        <div v-else-if="history.length === 0" class="empty-section">
          <div class="empty-content">
            <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
              <path
                d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
            </svg>
            <h3>暂无下载历史</h3>
            <p>下载完成后，历史记录将显示在这里</p>
          </div>
        </div>

        <div v-else class="history-list">
          <div v-for="item in history" :key="item.id" class="history-card">
            <div class="history-header">
              <div class="history-info">
                <h3 class="history-title">
                  {{ getHistoryTitle(item) }}
                </h3>
                <span class="history-status" :class="item.status">
                  {{ getStatusText(item.status) }}
                </span>
              </div>
            </div>

            <div class="history-details">
              <div class="detail-item">
                <span class="label">类型:</span>
                <span class="value">{{ getTypeText(item.type) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">文件数:</span>
                <span class="value">{{ item.completed_files }}/{{ item.total_files }}</span>
              </div>
              <div class="detail-item">
                <span class="label">完成时间:</span>
                <span class="value">{{ formatDate(item.end_time) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import downloadService from '@/services/download';
import type { DownloadTask } from '@/types';

const authStore = useAuthStore();

// 状态
const activeTab = ref<'tasks' | 'history'>('tasks');
const loading = ref(false);
const error = ref<string | null>(null);
const tasks = ref<DownloadTask[]>([]);
const history = ref<any[]>([]);

// SSE连接管理
const sseConnections = ref<Map<string, () => void>>(new Map());

// 计算属性：只显示活跃任务
const activeTasks = computed(() => {
  return tasks.value.filter(task =>
    ['downloading', 'paused'].includes(task.status)
  );
});

// 获取任务标题
const getTaskTitle = (task: DownloadTask) => {
  if (task.type === 'artwork') {
    return task.artwork_title || `作品 ${task.artwork_id}`;
  } else if (task.type === 'artist') {
    return `作者作品 - ${task.artist_name || '未知作者'}`;
  } else if (task.type === 'batch') {
    return `批量下载 (${task.total_files} 个作品)`;
  }
  return '未知任务';
};

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    'downloading': '下载中',
    'completed': '已完成',
    'failed': '失败',
    'cancelled': '已取消',
    'partial': '部分完成',
    'paused': '已暂停'
  };
  return statusMap[status] || status;
};

// 获取类型文本
const getTypeText = (type: string) => {
  const typeMap: Record<string, string> = {
    'artwork': '单个作品',
    'artist': '作者作品',
    'batch': '批量下载',
    'ranking': '排行榜下载'
  };
  return typeMap[type] || type;
};

// 获取历史记录标题
const getHistoryTitle = (item: any) => {
  if (item.type === 'artwork') {
    const title = item.artwork_title || '未知作品';
    const artist = item.artist_name || '未知作者';
    return `${title} (${artist})`;
  } else if (item.type === 'artist') {
    const artist = item.artist_name || '未知作者';
    return `作者作品 (${artist})`;
  } else if (item.type === 'batch') {
    return `批量下载 (${item.total_files || 0} 个作品)`;
  } else if (item.type === 'ranking') {
    return `排行榜下载 (${item.total_files || 0} 个作品)`;
  }
  return '未知下载任务';
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '未知时间';

  try {
    // 处理不同的日期格式
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('无效的日期格式:', dateString);
      return '时间格式错误';
    }
    return date.toLocaleString('zh-CN');
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '时间解析失败';
  }
};

// 刷新数据
const refreshData = async () => {
  await Promise.all([
    fetchTasks(),
    fetchHistory()
  ]);
};

// 获取任务列表
const fetchTasks = async () => {
  try {
    const response = await downloadService.getAllTasks();
    if (response.success) {
      tasks.value = response.data || [];

      // 为活跃任务建立SSE连接
      activeTasks.value.forEach(task => {
        if (!sseConnections.value.has(task.id)) {
          startTaskStreaming(task.id);
        }
      });
    } else {
      throw new Error(response.error || '获取任务列表失败');
    }
  } catch (err) {
    console.error('获取任务列表失败:', err);
  }
};

// 获取历史记录（只获取最近200条）
const fetchHistory = async () => {
  try {
    const response = await downloadService.getDownloadHistory(0, 200);
    if (response.success && response.data) {
      // 后端返回的结构是 { history: [], total: number, offset: number, limit: number }
      history.value = response.data.history || [];
      console.log('历史记录获取成功:', history.value.length, '条记录');
    } else {
      throw new Error(response.error || '获取历史记录失败');
    }
  } catch (err) {
    console.error('获取历史记录失败:', err);
  }
};

// 开始SSE监听任务进度
const startTaskStreaming = (taskId: string) => {
  // 如果已经有连接，先关闭
  if (sseConnections.value.has(taskId)) {
    sseConnections.value.get(taskId)!();
  }

  console.log('开始SSE监听任务进度:', taskId);

  const closeConnection = downloadService.streamTaskProgress(
    taskId,
    (task) => {
      console.log('收到SSE进度更新:', {
        taskId,
        status: task.status,
        progress: task.progress,
        completed: task.completed_files,
        total: task.total_files
      });

      // 更新任务状态
      const index = tasks.value.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks.value[index] = task;
      }

      // 如果任务完成，清理连接
      if (['completed', 'failed', 'cancelled', 'partial'].includes(task.status)) {
        console.log('任务完成，关闭SSE连接:', taskId);
        stopTaskStreaming(taskId);

        // 延迟刷新历史记录
        setTimeout(() => {
          fetchHistory();
        }, 1000);
      }
    },
    () => {
      console.log('SSE连接完成:', taskId);
      stopTaskStreaming(taskId);
    }
  );

  sseConnections.value.set(taskId, closeConnection);
};

// 停止SSE监听
const stopTaskStreaming = (taskId: string) => {
  if (sseConnections.value.has(taskId)) {
    sseConnections.value.get(taskId)!();
    sseConnections.value.delete(taskId);
  }
};

// 取消任务
const cancelTask = async (taskId: string) => {
  try {
    const response = await downloadService.cancelTask(taskId);
    if (response.success) {
      await fetchTasks();
    } else {
      throw new Error(response.error || '取消任务失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '取消任务失败';
    console.error('取消任务失败:', err);
  }
};

// 清理历史记录
const cleanupHistory = async () => {
  if (confirm('确定要清理下载历史吗？这将保留最新的500条记录。')) {
    try {
      loading.value = true;
      const response = await downloadService.cleanupHistory(500);
      if (response.success) {
        await fetchHistory(); // 重新获取历史记录
        alert('下载历史已清理！');
      } else {
        throw new Error(response.error || '清理历史失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清理历史失败';
      console.error('清理历史失败:', err);
    } finally {
      loading.value = false;
    }
  }
};

// 清理任务
const cleanupTasks = async () => {
  if (confirm('确定要清理已完成的任务吗？这将保留活跃任务和最新的100个已完成任务。')) {
    try {
      loading.value = true;
      const response = await downloadService.cleanupTasks(true, 100);
      if (response.success) {
        await fetchTasks(); // 重新获取任务列表
        alert('下载任务已清理！');
      } else {
        throw new Error(response.error || '清理任务失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清理任务失败';
      console.error('清理任务失败:', err);
    } finally {
      loading.value = false;
    }
  }
};

// 清除错误
const clearError = () => {
  error.value = null;
};

// 清理所有SSE连接
const cleanupSSEConnections = () => {
  sseConnections.value.forEach(closeConnection => {
    closeConnection();
  });
  sseConnections.value.clear();
};

onMounted(async () => {
  loading.value = true;
  try {
    await refreshData();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  cleanupSSEConnections();
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

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.btn-primary {
  background: #3b82f6;
  color: white;
  border: 1px solid #3b82f6;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  color: #6b7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 500;
}

.tab-btn:hover {
  color: #374151;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-content {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-top: 1rem;
}

.loading-section,
.error-section,
.empty-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 2rem;
}

.empty-content {
  text-align: center;
  color: #6b7280;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.empty-content p {
  margin: 0;
  font-size: 0.875rem;
}

.tasks-list,
.history-list {
  padding: 1.5rem;
}

.task-card,
.history-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  background: white;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.task-card:hover,
.history-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: #d1d5db;
}

.task-header,
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.task-title,
.history-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.task-status,
.history-status {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.task-status.downloading,
.history-status.downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.task-status.completed,
.history-status.completed {
  background: #dcfce7;
  color: #15803d;
}

.task-status.failed,
.history-status.failed {
  background: #fee2e2;
  color: #dc2626;
}

.task-status.cancelled,
.history-status.cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.task-status.partial,
.history-status.partial {
  background: #fef3c7;
  color: #d97706;
}

.task-status.paused {
  background: #fef3c7;
  color: #d97706;
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

/* 批量下载进度样式 */
.batch-progress {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.batch-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 600;
}

.stat-value.success {
  color: #059669;
}

.stat-value.error {
  color: #dc2626;
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

.task-details,
.history-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-item .label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  min-width: 80px;
}

.detail-item .value {
  font-size: 0.875rem;
  color: #374151;
}

.detail-item .value.error {
  color: #dc2626;
}

.btn-sm {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
}

.btn-danger {
  background: #dc2626;
  color: white;
  border: 1px solid #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.3);
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }

  .page-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
  }

  .batch-stats {
    flex-direction: column;
    gap: 0.5rem;
  }

  .task-details,
  .history-details {
    grid-template-columns: 1fr;
  }
}
</style>