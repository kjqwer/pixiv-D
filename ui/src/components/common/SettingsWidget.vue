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
              <!-- 主要操作按钮组 -->
              <div class="action-group primary-actions">
                <h6 class="action-group-title">配置管理</h6>
                <div class="action-buttons grid grid-cols-2">
                  <button @click="saveConfig" class="btn btn-primary btn-enhanced" :disabled="saving">
                    <SvgIcon name="save" class="btn-icon" />
                    {{ saving ? '保存中...' : '保存配置' }}
                  </button>
                  <button @click="refreshToken" class="btn btn-info btn-enhanced" :disabled="refreshing">
                    <SvgIcon name="refresh" class="btn-icon" />
                    {{ refreshing ? '刷新中...' : '刷新Token' }}
                  </button>
                </div>
              </div>

              <!-- 缓存管理按钮组 -->
              <div class="action-group secondary-actions">
                <h6 class="action-group-title">缓存管理</h6>
                <div class="action-buttons grid grid-cols-2">
                  <button @click="clearExpiredCache" class="btn btn-secondary btn-enhanced hover-primary"
                    :disabled="clearing">
                    <SvgIcon name="clean" class="btn-icon" />
                    {{ clearing ? '清理中...' : '清理过期' }}
                  </button>
                  <button @click="clearAllCache" class="btn btn-warning btn-enhanced hover-danger" :disabled="clearing">
                    <SvgIcon name="delete" class="btn-icon" />
                    {{ clearing ? '清理中...' : '清理全部' }}
                  </button>
                </div>
              </div>

              <!-- 危险操作按钮组 -->
              <div class="action-group danger-actions">
                <h6 class="action-group-title">重置操作</h6>
                <div class="action-buttons">
                  <button @click="resetConfig" class="btn btn-danger btn-enhanced" :disabled="resetting">
                    <SvgIcon name="reset" class="btn-icon" />
                    {{ resetting ? '重置中...' : '重置为默认配置' }}
                  </button>
                </div>
              </div>
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
import authService from '@/services/auth';
import LoadingSpinner from './LoadingSpinner.vue';
import ErrorMessage from './ErrorMessage.vue';

// 状态
const isOpen = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const clearing = ref(false);
const resetting = ref(false);
const saving = ref(false);
const refreshing = ref(false);
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

const refreshToken = async () => {
  try {
    refreshing.value = true;
    error.value = null;
    const response = await authService.refreshToken();
    if (response.success) {
      showSuccess('Token刷新成功');
    } else {
      error.value = response.error || 'Token刷新失败';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Token刷新失败';
    console.error('Token刷新失败:', err);
  } finally {
    refreshing.value = false;
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
  background: var(--color-primary, #3b82f6);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg, 0 4px 12px rgba(59, 130, 246, 0.3));
  transition: all var(--transition-normal, 0.3s ease);
  position: relative;
}

.settings-toggle:hover {
  background: var(--color-primary-hover, #2563eb);
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl, 0 6px 16px rgba(59, 130, 246, 0.4));
}

.settings-toggle.active {
  background: var(--color-primary-active, #1d4ed8);
  box-shadow: var(--shadow-inner, inset 0 2px 4px rgba(0, 0, 0, 0.1));
}

.settings-icon {
  width: 1.5rem;
  height: 1.5rem;
  transition: transform var(--transition-normal);
}

.settings-toggle.active .settings-icon {
  transform: rotate(45deg);
}

.settings-panel {
  position: absolute;
  bottom: 4rem;
  right: 0;
  width: 420px;
  max-height: 650px;
  background: var(--color-bg-primary, white);
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-2xl, 0 10px 25px rgba(0, 0, 0, 0.15));
  border: 1px solid var(--color-border, #e5e7eb);
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
  backdrop-filter: blur(10px);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl, 1.5rem);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  background: var(--color-bg-secondary, #f9fafb);
  position: relative;
}

.settings-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-info), var(--color-success));
}

.settings-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.settings-header h3::before {
  content: '⚙️';
  font-size: 1.125rem;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--spacing-sm, 0.5rem);
  border-radius: var(--radius-md, 0.375rem);
  color: var(--color-text-secondary, #6b7280);
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--color-bg-hover, #e5e7eb);
  color: var(--color-text-primary, #374151);
  transform: scale(1.1);
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.settings-content {
  padding: var(--spacing-xl, 1.5rem);
  max-height: 550px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}

.settings-section {
  margin-bottom: var(--spacing-2xl, 2rem);
}

.settings-section h4 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.settings-section h4::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--color-primary);
  border-radius: 2px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl, 2rem);
}

.error {
  margin-bottom: var(--spacing-lg, 1rem);
}

.success-message {
  background: var(--color-success, #10b981);
  color: white;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md, 0.5rem);
  margin-bottom: var(--spacing-lg, 1rem);
  animation: slideIn 0.3s ease-out;
  position: relative;
  overflow: hidden;
}

.success-message::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }

  100% {
    left: 100%;
  }
}

.success-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
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
  background: var(--color-bg-secondary, #f9fafb);
  border-radius: var(--radius-lg, 0.5rem);
  padding: var(--spacing-lg, 1rem);
  margin-bottom: var(--spacing-xl, 1.5rem);
  border: 1px solid var(--color-border, #e5e7eb);
  position: relative;
  overflow: hidden;
}

.cache-stats::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-info), var(--color-success));
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm, 0.5rem);
  padding: var(--spacing-xs, 0.25rem) 0;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-label {
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.875rem;
  font-weight: 500;
}

.stat-value {
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
  font-family: var(--font-mono, 'Courier New', monospace);
  text-align: center;
  justify-content: center;
}

.config-form {
  margin-bottom: var(--spacing-xl, 1.5rem);
}

.form-group {
  margin-bottom: var(--spacing-lg, 1rem);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm, 0.5rem);
  font-weight: 500;
  color: var(--color-text-primary, #374151);
  font-size: 0.875rem;
}

.form-group input[type="number"],
.form-group input[type="text"] {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-md, 0.375rem);
  font-size: 0.875rem;
  transition: all var(--transition-normal);
  background: var(--color-bg-primary, white);
}

.form-group input[type="number"]:focus,
.form-group input[type="text"]:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(59, 130, 246, 0.1));
  transform: translateY(-1px);
}

.form-group input[type="checkbox"] {
  margin-right: var(--spacing-sm, 0.5rem);
  transform: scale(1.1);
}

.config-section {
  margin-bottom: var(--spacing-xl, 1.5rem);
  padding: var(--spacing-lg, 1rem);
  background: var(--color-bg-tertiary, #f8fafc);
  border-radius: var(--radius-lg, 0.5rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
  position: relative;
}

.config-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--color-info);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.config-section h5 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary, #2d3748);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.config-section h5::before {
  content: '📊';
  font-size: 0.875rem;
}

.form-help {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #718096);
  margin-top: var(--spacing-xs, 0.25rem);
  font-style: italic;
}

.cache-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  margin-top: var(--spacing-xl);
}

.action-group {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  transition: all var(--transition-normal);
}

.action-group:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--color-border-hover);
}

.action-group-title {
  margin: 0 0 var(--spacing-md) 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.action-group-title::before {
  content: '';
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--color-primary);
}

.primary-actions .action-group-title::before {
  background: var(--color-primary);
}

.secondary-actions .action-group-title::before {
  background: var(--color-info);
}

.danger-actions .action-group-title::before {
  background: var(--color-danger);
}

.action-buttons {
  gap: var(--spacing-md);
}

.btn-icon {
  width: 1rem;
  height: 1rem;
  margin-right: var(--spacing-sm);
  flex-shrink: 0;
}

/* 使用主题中的按钮增强样式 */
.btn-enhanced {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.btn-enhanced::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn-enhanced:hover::before {
  left: 100%;
}

.btn-enhanced:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-enhanced:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

/* 特殊悬停效果 */
.hover-primary:hover:not(:disabled) {
  background: var(--color-primary) !important;
  color: white !important;
  border-color: var(--color-primary) !important;
}

.hover-danger:hover:not(:disabled) {
  background: var(--color-danger) !important;
  color: white !important;
  border-color: var(--color-danger) !important;
}

/* 网格布局适配 */
.grid {
  display: grid;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* 响应式优化 */
@media (max-width: 768px) {
  .action-buttons.grid-cols-2 {
    grid-template-columns: 1fr;
  }

  .action-group {
    padding: var(--spacing-md);
  }

  .btn-enhanced {
    padding: var(--spacing-md);
    font-size: 0.8rem;
  }

  .btn-icon {
    width: 0.875rem;
    height: 0.875rem;
  }
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

.btn-info {
  background: #06b6d4;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background: #0891b2;
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