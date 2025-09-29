<template>
  <div class="downloads-page">
    <div class="container">
      <div class="page-header">
        <h1>下载管理</h1>
        <div class="header-actions">
          <button @click="refreshData" class="btn btn-primary" :disabled="loading">
            <SvgIcon name="refresh" class="btn-icon" />
            刷新
          </button>
          <button @click="cleanupTasks" class="btn btn-secondary" :disabled="loading">
            <SvgIcon name="cleanup" class="btn-icon" />
            清理任务
          </button>
          <button @click="cleanupHistory" class="btn btn-secondary" :disabled="loading">
            <SvgIcon name="cleanup-history2" class="btn-icon" />
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
            <SvgIcon name="empty" class="empty-icon" />
            <h3>暂无下载任务</h3>
            <p>开始下载作品后，任务将显示在这里</p>
          </div>
        </div>

        <div v-else class="tasks-list">
          <div v-for="task in activeTasks" :key="task.id" class="task-card">
            <div class="task-header">
              <div class="task-info">
                <h3 class="task-title">
                  <a v-if="task.artwork_id" :href="`/artwork/${task.artwork_id}`" class="task-link">
                    {{ getTaskTitle(task) }}
                  </a>
                  <span v-else>{{ getTaskTitle(task) }}</span>
                </h3>
                <span class="task-status" :class="task.status">
                  {{ getStatusText(task.status) }}
                </span>
              </div>
              <div class="task-actions">
                <button v-if="task.status === 'downloading'" @click="cancelTask(task.id)" class="btn btn-danger btn-sm">
                  取消
                </button>
                <button v-if="task.status === 'paused'" @click="resumeTask(task.id)" class="btn btn-primary btn-sm">
                  恢复
                </button>
                <button v-if="task.status === 'paused'" @click="cancelTask(task.id)" class="btn btn-danger btn-sm">
                  删除
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
            <SvgIcon name="cleanup-history" class="empty-icon" />
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDownloadStore } from '@/stores/download';
import downloadService from '@/services/download';
import type { DownloadTask } from '@/types';

const authStore = useAuthStore();
const downloadStore = useDownloadStore();

// 状态
const activeTab = ref<'tasks' | 'history'>('tasks');
const loading = ref(false);
const error = ref<string | null>(null);
const history = ref<any[]>([]);

// 使用store中的任务数据
const tasks = computed(() => downloadStore.tasks);

// 计算属性：显示活跃任务和暂停任务
const activeTasks = computed(() => {
  return tasks.value.filter(task =>
    ['downloading', 'paused'].includes(task.status)
  );
});

// 获取任务标题
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
    'art': '作者作品',
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
  } else if (item.type === 'artist' || item.type === 'art') {
    const artist = item.artist_name || '未知作者';
    const count = item.total_files || 0;
    // 如果有任务描述，优先使用任务描述
    if (item.task_description) {
      return `${item.task_description} - ${count} 个作品`;
    }
    return `作者作品 (${artist}) - ${count} 个作品`;
  } else if (item.type === 'batch') {
    const count = item.total_files || 0;
    // 如果有任务描述，使用任务描述
    if (item.task_description) {
      return `${item.task_description} - ${count} 个作品`;
    }
    return `批量下载 - ${count} 个作品`;
  } else if (item.type === 'ranking') {
    const count = item.total_files || 0;
    let title = '排行榜下载';
    if (item.mode && item.ranking_type) {
      const modeText = item.mode === 'daily' ? '日榜' : 
                      item.mode === 'weekly' ? '周榜' : 
                      item.mode === 'monthly' ? '月榜' : item.mode;
      const typeText = item.ranking_type === 'illust' ? '插画' : 
                      item.ranking_type === 'manga' ? '漫画' : item.ranking_type;
      title = `${modeText}${typeText}`;
    }
    return `${title} - ${count} 个作品`;
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
    downloadStore.fetchTasks(),
    fetchHistory()
  ]);
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

// 监听任务完成，刷新历史记录
watch(tasks, (newTasks, oldTasks) => {
  // 检查是否有任务完成
  const completedTasks = newTasks.filter(task =>
    ['completed', 'failed', 'cancelled', 'partial'].includes(task.status)
  );

  if (completedTasks.length > 0) {
    // 延迟刷新历史记录
    setTimeout(() => {
      fetchHistory();
    }, 1000);
  }
}, { deep: true });

// 取消任务
const cancelTask = async (taskId: string) => {
  try {
    await downloadStore.cancelTask(taskId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '取消任务失败';
    console.error('取消任务失败:', err);
  }
};

// 恢复任务
const resumeTask = async (taskId: string) => {
  try {
    await downloadStore.resumeTask(taskId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '恢复任务失败';
    console.error('恢复任务失败:', err);
  }
};

// 清理历史记录
const cleanupHistory = async () => {
  if (confirm('确定要清理下载历史吗？这将保留最新的500条记录。')) {
    try {
      loading.value = true;
      await downloadStore.cleanupHistory(500);
      await fetchHistory(); // 重新获取历史记录
      alert('下载历史已清理！');
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
      await downloadStore.cleanupCompletedTasks(100);
      alert('下载任务已清理！');
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

onMounted(async () => {
  loading.value = true;
  try {
    // 先获取数据，不阻塞页面渲染
    await Promise.all([
      downloadStore.fetchTasks(),
      fetchHistory()
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  // 组件卸载时不需要清理SSE连接，因为store会统一管理
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

.task-title .task-link {
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s ease;
}

.task-title .task-link:hover {
  color: #2563eb;
  text-decoration: underline;
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

.task-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
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