<template>
  <div class="download-widget" :class="{ expanded: isExpanded }">
    <!-- 小圆点指示器 -->
    <div class="widget-indicator" @click="toggleExpanded" :class="indicatorClass">
      <div class="indicator-icon">
        <SvgIcon v-if="activeTasks.length === 0" name="bookmark-empty" />
        <SvgIcon v-else name="bookmark-empty" />
      </div>
      <div v-if="activeTasks.length > 0" class="task-count">{{ activeTasks.length }}</div>
    </div>

    <!-- 展开的进度面板 -->
    <div v-if="isExpanded" class="widget-panel">
      <div class="panel-header">
        <h3>下载进度</h3>
        <button @click="toggleExpanded" class="close-btn">
          <SvgIcon name="close" />
        </button>
      </div>

      <div class="panel-content">
        <div v-if="downloadStore.loading" class="loading-section">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="activeTasks.length === 0" class="empty-section">
          <SvgIcon name="bookmark-empty" class="empty-icon" />
          <span>暂无下载任务</span>
        </div>

        <div v-else class="tasks-list">
          <div v-for="task in activeTasks" :key="task.id" class="task-item">
            <div class="task-header">
              <div class="task-info">
                <h4 class="task-title">{{ getTaskTitle(task) }}</h4>
                <span class="task-status" :class="task.status">
                  {{ getStatusText(task.status) }}
                </span>
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
                <h5>最近完成:</h5>
                <div class="completed-list">
                  <div v-for="item in task.recent_completed.slice(0, 3)" :key="item.artwork_id" class="completed-item">
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
              <div v-if="task.error" class="detail-item">
                <span class="label">错误:</span>
                <span class="value error">{{ task.error }}</span>
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
import { useDownloadStore } from '@/stores/download';
import type { DownloadTask } from '@/types';

// 使用Pinia store
const downloadStore = useDownloadStore();

// 状态
const isExpanded = ref(false);

// 计算属性：显示活跃任务和暂停任务
const activeTasks = computed(() => downloadStore.activeTasks);

// 指示器样式类
const indicatorClass = computed(() => {
  if (activeTasks.value.length === 0) return 'idle';
  const hasDownloading = activeTasks.value.some(task => task.status === 'downloading');
  return hasDownloading ? 'downloading' : 'paused';
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

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '未知时间';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '时间格式错误';
    }
    return date.toLocaleString('zh-CN');
  } catch (error) {
    return '时间解析失败';
  }
};

// 切换展开状态
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
  if (isExpanded.value) {
    // 展开时刷新任务列表
    downloadStore.fetchTasks();
  }
};

onMounted(async () => {
  // 初始获取任务列表
  await downloadStore.fetchTasks();
});

onUnmounted(() => {
  // 组件卸载时不需要清理SSE连接，因为store会统一管理
});
</script>

<style scoped>
.download-widget {
  position: fixed;
  top: 4.5rem;
  right: 1rem;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 指示器样式 */
.widget-indicator {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.widget-indicator:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.widget-indicator.idle {
  border-color: #e5e7eb;
  color: #6b7280;
}

.widget-indicator.downloading {
  border-color: #3b82f6;
  color: #3b82f6;
  animation: pulse 2s infinite;
}

.widget-indicator.paused {
  border-color: #f59e0b;
  color: #f59e0b;
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }

  50% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  100% {
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }
}

.indicator-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.task-count {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  border: 2px solid white;
}

/* 面板样式 */
.widget-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 400px;
  max-height: 600px;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: #6b7280;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.panel-content {
  max-height: 500px;
  overflow-y: auto;
}

.loading-section,
.empty-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #6b7280;
  gap: 0.5rem;
}

.loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-icon {
  width: 2rem;
  height: 2rem;
  opacity: 0.5;
}

.tasks-list {
  padding: 1rem;
}

.task-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f9fafb;
}

.task-item:last-child {
  margin-bottom: 0;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.task-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
}

.task-status {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.task-status.downloading {
  background: #dbeafe;
  color: #1d4ed8;
}

.task-status.completed {
  background: #dcfce7;
  color: #15803d;
}

.task-status.failed {
  background: #fee2e2;
  color: #dc2626;
}

.task-status.cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.task-status.partial {
  background: #fef3c7;
  color: #d97706;
}

.task-status.paused {
  background: #fef3c7;
  color: #d97706;
}

.task-progress {
  margin-bottom: 0.75rem;
}

.progress-bar {
  width: 100%;
  height: 0.375rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.25rem;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

/* 批量下载进度样式 */
.batch-progress {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
}

.batch-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-value {
  font-size: 0.75rem;
  font-weight: 600;
}

.stat-value.success {
  color: #059669;
}

.stat-value.error {
  color: #dc2626;
}

.recent-completed h5 {
  font-size: 0.75rem;
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
  gap: 0.25rem;
  font-size: 0.6875rem;
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

.task-details {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.25rem;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-item .label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  min-width: 60px;
}

.detail-item .value {
  font-size: 0.75rem;
  color: #374151;
}

.detail-item .value.error {
  color: #dc2626;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .widget-panel {
    width: calc(100vw - 2rem);
    right: -1rem;
  }

  .batch-stats {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>