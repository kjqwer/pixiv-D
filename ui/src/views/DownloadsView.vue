<template>
  <div class="downloads-page">
    <div class="container">
      <div class="page-header">
        <h1>下载管理</h1>
        <div class="header-actions">
          <button @click="refreshData" class="btn btn-secondary" :disabled="loading">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            刷新
          </button>
        </div>
      </div>

      <div v-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <!-- 标签页 -->
      <div class="tabs">
        <button 
          @click="activeTab = 'tasks'" 
          class="tab-btn"
          :class="{ active: activeTab === 'tasks' }"
        >
          下载任务
        </button>
        <button 
          @click="activeTab = 'history'" 
          class="tab-btn"
          :class="{ active: activeTab === 'history' }"
        >
          下载历史
        </button>
        <button 
          @click="activeTab = 'files'" 
          class="tab-btn"
          :class="{ active: activeTab === 'files' }"
        >
          文件管理
        </button>
      </div>

      <!-- 下载任务 -->
      <div v-if="activeTab === 'tasks'" class="tab-content">
        <div v-if="loading" class="loading-section">
          <LoadingSpinner text="加载中..." />
        </div>

        <div v-else-if="tasks.length === 0" class="empty-section">
          <div class="empty-content">
            <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <h3>暂无下载任务</h3>
            <p>开始下载作品后，任务将显示在这里</p>
          </div>
        </div>

        <div v-else class="tasks-list">
          <div 
            v-for="task in tasks" 
            :key="task.id"
            class="task-card"
          >
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
                <button 
                  v-if="task.status === 'downloading'"
                  @click="cancelTask(task.id)"
                  class="btn btn-danger btn-sm"
                >
                  取消
                </button>
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
              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
            </svg>
            <h3>暂无下载历史</h3>
            <p>下载完成后，历史记录将显示在这里</p>
          </div>
        </div>

        <div v-else class="history-list">
          <div 
            v-for="item in history" 
            :key="item.id"
            class="history-card"
          >
            <div class="history-header">
              <div class="history-info">
                <h3 class="history-title">
                  {{ getHistoryTitle(item) }}
                </h3>
                <span class="history-status" :class="item.status">
                  {{ getStatusText(item.status) }}
                </span>
              </div>
              <div class="history-actions">
                <button 
                  @click="openFolder(item.download_path)"
                  class="btn btn-text btn-sm"
                >
                  打开文件夹
                </button>
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
                <span class="label">下载路径:</span>
                <span class="value path">{{ item.download_path }}</span>
              </div>
              <div class="detail-item">
                <span class="label">完成时间:</span>
                <span class="value">{{ formatDate(item.end_time) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件管理 -->
      <div v-if="activeTab === 'files'" class="tab-content">
        <div v-if="loading" class="loading-section">
          <LoadingSpinner text="加载中..." />
        </div>

        <div v-else-if="files.length === 0" class="empty-section">
          <div class="empty-content">
            <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
            <h3>暂无下载文件</h3>
            <p>下载完成后，文件将显示在这里</p>
          </div>
        </div>

        <div v-else class="files-list">
          <div 
            v-for="file in files" 
            :key="`${file.artist}_${file.artwork}`"
            class="file-card"
          >
            <div class="file-header">
              <div class="file-info">
                <h3 class="file-title">{{ file.artwork }}</h3>
                <p class="file-artist">{{ file.artist }}</p>
              </div>
              <div class="file-actions">
                <button 
                  @click="openFolder(file.path)"
                  class="btn btn-text btn-sm"
                >
                  打开
                </button>
                <button 
                  @click="deleteFile(file.artist, file.artwork)"
                  class="btn btn-danger btn-sm"
                >
                  删除
                </button>
              </div>
            </div>

            <div class="file-details">
              <div class="detail-item">
                <span class="label">文件数:</span>
                <span class="value">{{ file.files.length }}</span>
              </div>
              <div class="detail-item">
                <span class="label">大小:</span>
                <span class="value">{{ formatFileSize(file.total_size) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">创建时间:</span>
                <span class="value">{{ formatDate(file.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import downloadService from '@/services/download';
import type { DownloadTask } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const authStore = useAuthStore();

// 状态
const activeTab = ref<'tasks' | 'history' | 'files'>('tasks');
const loading = ref(false);
const error = ref<string | null>(null);
const tasks = ref<DownloadTask[]>([]);
const history = ref<any[]>([]);
const files = ref<any[]>([]);

// 定时器
let progressTimer: number | null = null;

// 获取任务标题
const getTaskTitle = (task: DownloadTask) => {
  if (task.type === 'artwork') {
    return `作品 ${task.artwork_id}`;
  } else if (task.type === 'artist') {
    return `作者 ${task.artist_id} 的作品`;
  } else if (task.type === 'batch') {
    return `批量下载 ${task.total} 个作品`;
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
    'partial': '部分完成'
  };
  return statusMap[status] || status;
};

// 获取类型文本
const getTypeText = (type: string) => {
  const typeMap: Record<string, string> = {
    'artwork': '单个作品',
    'artist': '作者作品',
    'batch': '批量下载'
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
  }
  return '未知下载任务';
};

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN');
};

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 刷新数据
const refreshData = async () => {
  await Promise.all([
    fetchTasks(),
    fetchHistory(),
    fetchFiles()
  ]);
};

// 获取任务列表
const fetchTasks = async () => {
  try {
    const response = await downloadService.getAllTasks();
    if (response.success) {
      tasks.value = response.data || [];
    } else {
      throw new Error(response.error || '获取任务列表失败');
    }
  } catch (err) {
    console.error('获取任务列表失败:', err);
  }
};

// 获取历史记录
const fetchHistory = async () => {
  try {
    const response = await downloadService.getDownloadHistory();
    if (response.success) {
      history.value = response.data || [];
    } else {
      throw new Error(response.error || '获取历史记录失败');
    }
  } catch (err) {
    console.error('获取历史记录失败:', err);
  }
};

// 获取文件列表
const fetchFiles = async () => {
  try {
    const response = await downloadService.getDownloadedFiles();
    if (response.success) {
      files.value = response.data || [];
    } else {
      throw new Error(response.error || '获取文件列表失败');
    }
  } catch (err) {
    console.error('获取文件列表失败:', err);
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

// 删除文件
const deleteFile = async (artist: string, artwork: string) => {
  if (!confirm(`确定要删除 "${artist}/${artwork}" 的所有文件吗？`)) {
    return;
  }

  try {
    const response = await downloadService.deleteDownloadedFiles(artist, artwork);
    if (response.success) {
      await fetchFiles();
    } else {
      throw new Error(response.error || '删除文件失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除文件失败';
    console.error('删除文件失败:', err);
  }
};

// 打开文件夹
const openFolder = (path: string) => {
  // 这里可以调用系统API打开文件夹
  console.log('打开文件夹:', path);
  // 在实际应用中，可以通过electron或其他方式打开文件夹
};

// 清除错误
const clearError = () => {
  error.value = null;
};

// 开始进度轮询
const startProgressPolling = () => {
  progressTimer = setInterval(async () => {
    const hasActiveTasks = tasks.value.some(task => task.status === 'downloading');
    if (hasActiveTasks) {
      await fetchTasks();
    }
  }, 2000);
};

// 停止进度轮询
const stopProgressPolling = () => {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
};

onMounted(async () => {
  loading.value = true;
  try {
    await refreshData();
    startProgressPolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载数据失败';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  stopProgressPolling();
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
.history-list,
.files-list {
  padding: 1rem;
}

.task-card,
.history-card,
.file-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: white;
}

.task-header,
.history-header,
.file-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.task-title,
.history-title,
.file-title {
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

.task-details,
.history-details,
.file-details {
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

.detail-item .value.path {
  font-family: monospace;
  font-size: 0.75rem;
  word-break: break-all;
}

.file-artist {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-danger {
  background: #dc2626;
  color: white;
  border: 1px solid #dc2626;
}

.btn-danger:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

.btn-text {
  background: none;
  color: #3b82f6;
  border: none;
}

.btn-text:hover {
  background: #f3f4f6;
}
</style> 