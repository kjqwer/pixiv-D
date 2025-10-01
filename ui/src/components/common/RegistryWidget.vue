<template>
  <div class="registry-widget">
    <!-- 注册表管理按钮 -->
    <button @click="togglePanel" class="registry-toggle" :class="{ active: isOpen }" title="下载注册表管理">
      <SvgIcon name="down" class="registry-icon" />
    </button>

    <!-- 注册表管理面板 -->
    <div v-if="isOpen" class="registry-panel">
      <div class="registry-header">
        <h3>下载注册表管理</h3>
        <button @click="togglePanel" class="close-btn" title="关闭">
          <SvgIcon name="close" class="close-icon" />
        </button>
      </div>

      <div class="registry-content">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading">
          <LoadingSpinner text="处理中..." />
        </div>

        <!-- 错误信息 -->
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

        <!-- 统计信息 -->
        <div class="registry-stats">
          <h4>统计信息</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">作者数量:</span>
              <span class="stat-value">{{ stats?.totalArtists || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">作品数量:</span>
              <span class="stat-value">{{ stats?.totalArtworks || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最后更新:</span>
              <span class="stat-value">{{ formatDate(stats?.lastUpdated) }}</span>
            </div>
          </div>
        </div>

        <!-- 配置选项 -->
        <div class="registry-config">
          <h4>配置选项</h4>
          <div class="config-form">
            <div class="form-group">
              <label>
                <input type="radio" v-model="detectionMethod" value="registry" @change="updateDetectionMethod" />
                使用注册表检测
              </label>
              <small>优先使用JSON注册表检测作品是否已下载</small>
            </div>
            <div class="form-group">
              <label>
                <input type="radio" v-model="detectionMethod" value="scan" @change="updateDetectionMethod" />
                使用扫盘检测
              </label>
              <small>直接扫描文件系统检测作品是否已下载</small>
            </div>
            <div class="form-group">
              <label>
                <input type="radio" v-model="detectionMethod" value="hybrid" @change="updateDetectionMethod" />
                混合检测模式
              </label>
              <small>优先使用注册表检测，失败时回退到扫盘检测</small>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="registry-actions">
          <h4>管理操作</h4>
          <div class="action-buttons">
            <button @click="refreshStats" class="btn btn-secondary" :disabled="loading">
              <SvgIcon name="refresh" class="btn-icon" />
              刷新统计
            </button>
            
            <button @click="exportRegistry" class="btn btn-primary" :disabled="loading">
              <SvgIcon name="download" class="btn-icon" />
              导出注册表
            </button>
            
            <label class="btn btn-primary" :class="{ disabled: loading }">
              <SvgIcon name="upload" class="btn-icon" />
              导入注册表
              <input type="file" @change="handleFileImport" accept=".json" style="display: none;" :disabled="loading" />
            </label>
            
            <button @click="rebuildRegistry" class="btn btn-warning" :disabled="loading">
              <SvgIcon name="rebuild" class="btn-icon" />
              同步文件系统
            </button>
            
            <button @click="cleanupRegistry" class="btn btn-danger" :disabled="loading">
              <SvgIcon name="trash" class="btn-icon" />
              清理注册表
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRegistryStore } from '@/stores/registry';
import SvgIcon from './SvgIcon.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import ErrorMessage from './ErrorMessage.vue';

const registryStore = useRegistryStore();
const isOpen = ref(false);
const successMessage = ref<string | null>(null);

// 从store中获取响应式数据
const { stats, loading, error, config } = storeToRefs(registryStore);

// 检测方法选择 - 不设置默认值，等待从后端配置初始化
const detectionMethod = ref<'registry' | 'scan' | 'hybrid'>();

// 切换面板显示
const togglePanel = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    refreshStats();
  }
};

// 刷新统计信息
const refreshStats = async () => {
  await registryStore.fetchStats();
};

// 导出注册表
const exportRegistry = async () => {
  const result = await registryStore.exportRegistry();
  if (result.success) {
    showSuccess('注册表导出成功');
  }
};

// 处理文件导入
const handleFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const result = await registryStore.importRegistry(file);
  if (result.success) {
    showSuccess(`注册表导入成功，处理了 ${result.data?.imported || 0} 条记录`);
  }
  
  // 清空文件输入
  target.value = '';
};

// 重建注册表
const rebuildRegistry = async () => {
  if (!confirm('确定要同步文件系统到注册表吗？这将扫描整个下载目录并添加新发现的作品，可能需要一些时间。')) {
    return;
  }
  
  const result = await registryStore.rebuildRegistry();
  if (result.success) {
    showSuccess(`文件系统同步完成，新增 ${result.data?.addedArtworks || 0} 个作品，跳过 ${result.data?.skippedArtworks || 0} 个已存在作品`);
  }
};

// 清理注册表
const cleanupRegistry = async () => {
  if (!confirm('确定要清理注册表吗？这将移除不存在的文件记录。')) {
    return;
  }
  
  const result = await registryStore.cleanupRegistry();
  if (result.success) {
    showSuccess(`注册表清理完成，移除了 ${result.data?.removedArtworks || 0} 条无效记录`);
  }
};

// 更新检测方法配置
const updateDetectionMethod = async () => {
  let useRegistryCheck = false;
  let fallbackToScan = false;
  
  switch (detectionMethod.value) {
    case 'registry':
      useRegistryCheck = true;
      fallbackToScan = false;
      break;
    case 'scan':
      useRegistryCheck = false;
      fallbackToScan = false;
      break;
    case 'hybrid':
      useRegistryCheck = true;
      fallbackToScan = true;
      break;
  }
  
  const result = await registryStore.updateConfig({
    useRegistryCheck,
    fallbackToScan
  });
  
  if (result.success) {
    showSuccess('配置更新成功');
  }
};

// 更新配置（保留原方法以防其他地方调用）
const updateConfig = async () => {
  const result = await registryStore.updateConfig({
    useRegistryCheck: config.value.useRegistryCheck,
    fallbackToScan: config.value.fallbackToScan
  });
  
  if (result.success) {
    showSuccess('配置更新成功');
  }
};

// 清除错误
const clearError = () => {
  registryStore.clearError();
};

// 显示成功消息
const showSuccess = (message: string) => {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = null;
  }, 3000);
};

// 格式化日期
const formatDate = (dateString?: string): string => {
  if (!dateString) return '未知';
  return new Date(dateString).toLocaleString('zh-CN');
};

// 初始化检测方法
const initDetectionMethod = () => {
  if (config.value.useRegistryCheck && config.value.fallbackToScan) {
    detectionMethod.value = 'hybrid';
  } else if (config.value.useRegistryCheck && !config.value.fallbackToScan) {
    detectionMethod.value = 'registry';
  } else {
    detectionMethod.value = 'scan';
  }
};

// 组件挂载时初始化
onMounted(async () => {
  // 从后端获取配置并初始化检测方法
  try {
    await registryStore.fetchConfig();
    initDetectionMethod();
  } catch (error) {
    console.error('获取配置失败:', error);
    // 如果获取配置失败，使用默认值
    detectionMethod.value = 'hybrid';
  }
  
  // 初始化时加载统计数据
  refreshStats();
});

// 监听配置变化，自动更新检测方法
watch(config, () => {
  initDetectionMethod();
}, { deep: true });
</script>

<style scoped>
.registry-widget {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  z-index: 1000;
}

.registry-toggle {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: #3b82f6;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.registry-toggle:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.registry-toggle.active {
  background: #1d4ed8;
}

.registry-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.registry-panel {
  position: absolute;
  bottom: 4rem;
  left: 0;
  width: 400px;
  max-height: 600px;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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

.registry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.registry-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
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

.registry-content {
  padding: 1.5rem;
  max-height: 500px;
  overflow-y: auto;
}

.loading, .error {
  margin-bottom: 1rem;
}

.success-message {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  border-radius: 0.5rem;
}

.success-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #166534;
  font-size: 0.875rem;
}

.success-icon {
  width: 1rem;
  height: 1rem;
  color: #16a34a;
}

.registry-stats, .registry-config, .registry-actions {
  margin-bottom: 1.5rem;
}

.registry-stats h4, .registry-config h4, .registry-actions h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.stat-value {
  font-weight: 600;
  color: #1f2937;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.form-group small {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 1.5rem;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled, .btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .registry-panel {
    width: calc(100vw - 2rem);
    max-width: 400px;
  }
}
</style>