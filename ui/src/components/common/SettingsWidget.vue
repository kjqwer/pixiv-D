<template>
  <div class="settings-widget">
    <!-- 设置按钮 -->
    <button @click="toggleSettings" class="settings-toggle" :class="{ active: isOpen }" title="设置">
      <SvgIcon name="settings" class="settings-icon" />
    </button>

    <!-- 设置面板 -->
    <div v-if="isOpen" class="settings-panel">
      <div class="settings-header">
        <h3>设置</h3>
        <button @click="toggleSettings" class="close-btn" title="关闭">
          <SvgIcon name="close" class="close-icon" />
        </button>
      </div> 

      <div class="settings-content">
        <!-- 缓存设置 -->
        <div class="settings-section">
          <h4>缓存设置</h4>

          <div v-if="loading" class="loading">
            <LoadingSpinner text="加载中..." />
          </div>

          <div v-else-if="error" class="error">
            <ErrorMessage :error="error" @dismiss="clearError" />
          </div>

          <!-- 成功提示 -->
          <div v-if="successMessage" class="success-message">
            <div class="success-content">
              <SvgIcon name="success" class="success-icon" />
              <span>{{ successMessage }}</span>
            </div>
          </div>

          <div v-else class="cache-settings">
            <!-- 缓存统计 -->
            <div class="cache-stats">
              <div class="stat-item">
                <span class="stat-label">缓存文件数:</span>
                <span class="stat-value">{{ stats?.fileCount || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">缓存大小:</span>
                <span class="stat-value">{{ formatFileSize(stats?.totalSize || 0) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">使用率:</span>
                <span class="stat-value">{{ Math.round((stats?.usagePercentage || 0) * 100) }}%</span>
              </div>
            </div>

            <!-- 缓存配置 -->
            <div class="config-form">
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="config.enabled" />
                  启用缓存
                </label>
              </div>

              <div class="form-group">
                <label>最大缓存大小 (MB)</label>
                <input type="number" v-model.number="maxSizeMB" min="10" max="10000" />
              </div>

              <div class="form-group">
                <label>缓存过期时间 (小时)</label>
                <input type="number" v-model.number="maxAgeHours" min="1" max="720" />
              </div>

              <div class="form-group">
                <label>清理间隔 (小时)</label>
                <input type="number" v-model.number="cleanupIntervalHours" min="1" max="24" />
              </div>

              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="config.proxy.enabled" />
                  启用代理
                </label>
              </div>

              <div class="form-group">
                <label>代理超时 (秒)</label>
                <input type="number" v-model.number="timeoutSeconds" min="5" max="300" />
              </div>

              <div class="form-group">
                <label>重试次数</label>
                <input type="number" v-model.number="config.proxy.retryCount" min="0" max="10" />
              </div>
            </div>

            <!-- 下载配置 -->
            <div class="config-section">
              <h5>下载配置</h5>

              <div class="form-group">
                <label>同时下载任务数</label>
                <input type="number" v-model.number="concurrentDownloads" min="1" max="10" />
                <span class="form-help">建议值: 3-5</span>
              </div>

              <div class="form-group">
                <label>单任务最大并发文件数</label>
                <input type="number" v-model.number="maxConcurrentFiles" min="1" max="20" />
                <span class="form-help">建议值: 3-8</span>
              </div>

              <div class="form-group">
                <label>线程池大小</label>
                <input type="number" v-model.number="threadPoolSize" min="4" max="64" />
                <span class="form-help">建议值: 16-32，需要重启生效</span>
              </div>

              <div class="form-group">
                <label>下载超时 (分钟)</label>
                <input type="number" v-model.number="downloadTimeoutMinutes" min="1" max="30" />
              </div>

              <div class="form-group">
                <label>重试延迟 (秒)</label>
                <input type="number" v-model.number="retryDelaySeconds" min="1" max="30" />
              </div>

              <div class="form-group">
                <label>最大文件大小 (MB)</label>
                <input type="number" v-model.number="maxFileSizeMB" min="1" max="500" />
              </div>
            </div>

            <!-- 缓存操作 -->
            <div class="cache-actions">
              <button @click="saveConfig" class="btn btn-primary" :disabled="saving">
                {{ saving ? '保存中...' : '保存配置' }}
              </button>
              <button @click="clearExpiredCache" class="btn btn-secondary" :disabled="clearing">
                {{ clearing ? '清理中...' : '清理过期缓存' }}
              </button>
              <button @click="clearAllCache" class="btn btn-danger" :disabled="clearing">
                {{ clearing ? '清理中...' : '清理所有缓存' }}
              </button>
              <button @click="resetConfig" class="btn btn-warning" :disabled="resetting">
                {{ resetting ? '重置中...' : '重置配置' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import cacheService, { type CacheConfig, type CacheStats } from '@/services/cache';
import LoadingSpinner from './LoadingSpinner.vue';
import ErrorMessage from './ErrorMessage.vue';

// 状态
const isOpen = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const clearing = ref(false);
const resetting = ref(false);
const saving = ref(false);
const successMessage = ref<string | null>(null);

// 数据
const stats = ref<CacheStats | null>(null);
const config = ref<CacheConfig>({
  maxAge: 24 * 60 * 60 * 1000,
  maxSize: 100 * 1024 * 1024,
  cleanupInterval: 60 * 60 * 1000,
  enabled: true,
  proxy: {
    enabled: true,
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
  },
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
  download: {
    concurrentDownloads: 3,
    maxConcurrentFiles: 5,
    threadPoolSize: 16,
    downloadTimeout: 300000,
    chunkSize: 1024 * 1024,
    retryAttempts: 3,
    retryDelay: 2000,
    maxFileSize: 50 * 1024 * 1024,
  },
  lastUpdated: new Date().toISOString()
});

// 计算属性 - 转换为用户友好的单位
const maxSizeMB = computed({
  get: () => Math.round(config.value.maxSize / (1024 * 1024)),
  set: (value) => {
    config.value.maxSize = value * 1024 * 1024;
  }
});

const maxAgeHours = computed({
  get: () => Math.round(config.value.maxAge / (1000 * 60 * 60)),
  set: (value) => {
    config.value.maxAge = value * 1000 * 60 * 60;
  }
});

const cleanupIntervalHours = computed({
  get: () => Math.round(config.value.cleanupInterval / (1000 * 60 * 60)),
  set: (value) => {
    config.value.cleanupInterval = value * 1000 * 60 * 60;
  }
});

const timeoutSeconds = computed({
  get: () => Math.round(config.value.proxy.timeout / 1000),
  set: (value) => {
    config.value.proxy.timeout = value * 1000;
  }
});

// 下载配置相关的计算属性
const concurrentDownloads = computed({
  get: () => config.value.download?.concurrentDownloads || 3,
  set: (value) => {
    if (!config.value.download) {
      config.value.download = {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
        threadPoolSize: 16,
        downloadTimeout: 300000,
        chunkSize: 1024 * 1024,
        retryAttempts: 3,
        retryDelay: 2000,
        maxFileSize: 50 * 1024 * 1024,
      };
    }
    config.value.download.concurrentDownloads = value;
  }
});

const maxConcurrentFiles = computed({
  get: () => config.value.download?.maxConcurrentFiles || 5,
  set: (value) => {
    if (!config.value.download) {
      config.value.download = {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
        threadPoolSize: 16,
        downloadTimeout: 300000,
        chunkSize: 1024 * 1024,
        retryAttempts: 3,
        retryDelay: 2000,
        maxFileSize: 50 * 1024 * 1024,
      };
    }
    config.value.download.maxConcurrentFiles = value;
  }
});

const threadPoolSize = computed({
  get: () => config.value.download?.threadPoolSize || 16,
  set: (value) => {
    if (!config.value.download) {
      config.value.download = {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
        threadPoolSize: 16,
        downloadTimeout: 300000,
        chunkSize: 1024 * 1024,
        retryAttempts: 3,
        retryDelay: 2000,
        maxFileSize: 50 * 1024 * 1024,
      };
    }
    config.value.download.threadPoolSize = value;
  }
});

const downloadTimeoutMinutes = computed({
  get: () => Math.round((config.value.download?.downloadTimeout || 300000) / (1000 * 60)),
  set: (value) => {
    if (!config.value.download) {
      config.value.download = {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
        threadPoolSize: 16,
        downloadTimeout: 300000,
        chunkSize: 1024 * 1024,
        retryAttempts: 3,
        retryDelay: 2000,
        maxFileSize: 50 * 1024 * 1024,
      };
    }
    config.value.download.downloadTimeout = value * 1000 * 60;
  }
});

const retryDelaySeconds = computed({
  get: () => Math.round((config.value.download?.retryDelay || 2000) / 1000),
  set: (value) => {
    if (!config.value.download) {
      config.value.download = {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
        threadPoolSize: 16,
        downloadTimeout: 300000,
        chunkSize: 1024 * 1024,
        retryAttempts: 3,
        retryDelay: 2000,
        maxFileSize: 50 * 1024 * 1024,
      };
    }
    config.value.download.retryDelay = value * 1000;
  }
});

const maxFileSizeMB = computed({
  get: () => Math.round((config.value.download?.maxFileSize || 50 * 1024 * 1024) / (1024 * 1024)),
  set: (value) => {
    if (!config.value.download) {
      config.value.download = {
        concurrentDownloads: 3,
        maxConcurrentFiles: 5,
        threadPoolSize: 16,
        downloadTimeout: 300000,
        chunkSize: 1024 * 1024,
        retryAttempts: 3,
        retryDelay: 2000,
        maxFileSize: 50 * 1024 * 1024,
      };
    }
    config.value.download.maxFileSize = value * 1024 * 1024;
  }
});

// 方法
const toggleSettings = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    loadData();
  }
};

const loadData = async () => {
  try {
    loading.value = true;
    error.value = null;

    // 并行加载配置和统计信息
    const [configResponse, statsResponse] = await Promise.all([
      cacheService.getCacheConfig(),
      cacheService.getCacheStats()
    ]);

    if (configResponse.success && configResponse.data) {
      config.value = configResponse.data;
    }

    if (statsResponse.success && statsResponse.data) {
      stats.value = statsResponse.data;
    }

    // 标记初始加载完成
    isInitialLoad.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载设置失败';
    console.error('加载设置失败:', err);
  } finally {
    loading.value = false;
  }
};

const saveConfig = async () => {
  try {
    saving.value = true;
    const response = await cacheService.updateCacheConfig(config.value);
    if (response.success && response.data) {
      config.value = response.data;
      showSuccess('配置已保存');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存配置失败';
    console.error('保存配置失败:', err);
  } finally {
    saving.value = false;
  }
};

const clearExpiredCache = async () => {
  try {
    clearing.value = true;
    const response = await cacheService.clearExpiredCache();
    if (response.success) {
      // 重新加载统计信息
      await loadData();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '清理过期缓存失败';
    console.error('清理过期缓存失败:', err);
  } finally {
    clearing.value = false;
  }
};

const clearAllCache = async () => {
  if (!confirm('确定要清理所有缓存吗？这将删除所有缓存的图片文件。')) {
    return;
  }

  try {
    clearing.value = true;
    const response = await cacheService.clearAllCache();
    if (response.success) {
      // 重新加载统计信息
      await loadData();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '清理所有缓存失败';
    console.error('清理所有缓存失败:', err);
  } finally {
    clearing.value = false;
  }
};

const resetConfig = async () => {
  if (!confirm('确定要重置缓存配置为默认值吗？')) {
    return;
  }

  try {
    resetting.value = true;
    const response = await cacheService.resetCacheConfig();
    if (response.success && response.data) {
      config.value = response.data;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '重置配置失败';
    console.error('重置配置失败:', err);
  } finally {
    resetting.value = false;
  }
};

const clearError = () => {
  error.value = null;
};

const showSuccess = (message: string) => {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = null;
  }, 3000);
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 是否正在加载初始数据
const isInitialLoad = ref(true);

onMounted(() => {
  // 初始加载数据
  loadData();
});
</script>

<style scoped>
.settings-widget {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
}

.settings-toggle {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
  position: relative;
}

.settings-toggle:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.settings-toggle.active {
  background: #1d4ed8;
}

.settings-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.settings-panel {
  position: absolute;
  bottom: 4rem;
  right: 0;
  width: 400px;
  max-height: 600px;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.settings-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: #6b7280;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.settings-content {
  padding: 1.5rem;
  max-height: 500px;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.error {
  margin-bottom: 1rem;
}

.success-message {
  background: #10b981;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  animation: slideIn 0.3s ease-out;
}

.success-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.success-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
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

.cache-stats {
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.stat-value {
  font-weight: 600;
  color: #1f2937;
}

.config-form {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-group input[type="number"],
.form-group input[type="text"] {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-group input[type="number"]:focus,
.form-group input[type="text"]:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input[type="checkbox"] {
  margin-right: 0.5rem;
}

.config-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.config-section h5 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
}

.form-help {
  display: block;
  font-size: 0.75rem;
  color: #718096;
  margin-top: 0.25rem;
}

.cache-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  text-align: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

@media (max-width: 768px) {
  .settings-widget {
    bottom: 1rem;
    right: 1rem;
  }

  .settings-panel {
    width: calc(100vw - 2rem);
    max-width: 400px;
    bottom: 3.5rem;
  }

  .settings-content {
    padding: 1rem;
  }

  .cache-actions {
    flex-direction: column;
  }
}
</style>