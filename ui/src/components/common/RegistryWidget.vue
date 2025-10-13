<template>
  <div class="registry-widget" :class="{ 'panel-open': isOpen }">
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
          <div class="stats-header">
            <h4>统计信息</h4>
            <div class="last-updated">
              <span class="update-label">最后更新：</span>
              <span class="update-time">{{ formatDate(stats?.lastUpdated) }}</span>
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-icon">👥</div>
              <span class="stat-label">作者数量</span>
              <span class="stat-value">{{ stats?.totalArtists || 0 }}</span>
            </div>
            <div class="stat-item">
              <div class="stat-icon">🎨</div>
              <span class="stat-label">作品数量</span>
              <span class="stat-value">{{ stats?.totalArtworks || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 配置选项 -->
        <div class="registry-config">
          <h4>配置选项</h4>
          <div class="config-form">
            <!-- 存储模式配置 -->
            <div class="config-section">
              <div class="config-section-title">
                <SvgIcon name="database" class="section-icon" />
                存储模式配置
              </div>
              <div class="storage-mode-section">
                <div class="storage-options">
                  <div class="storage-option" :class="{ active: selectedStorageMode === 'json' }">
                    <label>
                      <input type="radio" v-model="selectedStorageMode" value="json" :disabled="migrationLoading" />
                      <div class="option-content">
                        <div class="option-header">
                          <SvgIcon name="file" class="option-icon" />
                          <span class="option-title">JSON文件存储</span>
                          <span class="option-badge basic">默认</span>
                        </div>
                        <small class="option-description">使用本地JSON文件存储注册表数据，简单可靠</small>
                      </div>
                    </label>
                  </div>

                  <div class="storage-option"
                    :class="{ active: selectedStorageMode === 'database', disabled: !databaseConnected }">
                    <label>
                      <input type="radio" v-model="selectedStorageMode" value="database"
                        :disabled="migrationLoading || !databaseConnected" />
                      <div class="option-content">
                        <div class="option-header">
                          <SvgIcon name="database" class="option-icon" />
                          <span class="option-title">MySQL数据库存储</span>
                          <span class="option-badge advanced" :class="{ connected: databaseConnected }">
                            {{ databaseConnected ? '已连接' : '未连接' }}
                          </span>
                        </div>
                        <small class="option-description">使用MySQL数据库存储注册表数据，支持高并发和大数据量</small>
                      </div>
                    </label>
                  </div>
                </div>

                <div class="storage-config-actions">
                  <div class="config-status">
                    <span v-if="hasStorageModeChanges" class="config-indicator unsaved">
                      <SvgIcon name="warning" class="indicator-icon" />
                      配置已修改，需要保存
                    </span>
                    <span v-else class="config-indicator saved">
                      <SvgIcon name="check" class="indicator-icon" />
                      当前模式: {{ storageMode === 'json' ? 'JSON文件存储' : 'MySQL数据库存储' }}
                    </span>
                  </div>

                  <!-- 迁移选项 -->
                  <div v-if="hasStorageModeChanges" class="migration-options">
                    <div class="migration-option-title">切换方式选择：</div>
                    <div class="migration-option-group">
                      <div class="migration-option" :class="{ active: migrationMode === 'switch-only' }">
                        <label>
                          <input type="radio" v-model="migrationMode" value="switch-only" />
                          <div class="option-content">
                            <div class="option-header">
                              <SvgIcon name="switch" class="option-icon" />
                              <span class="option-title">仅切换读取方式</span>
                              <span class="option-badge safe">安全</span>
                            </div>
                            <small class="option-description">只改变数据读取方式，不迁移数据，保持两边数据独立</small>
                          </div>
                        </label>
                      </div>

                      <div class="migration-option" :class="{ active: migrationMode === 'migrate-data' }">
                        <label>
                          <input type="radio" v-model="migrationMode" value="migrate-data" />
                          <div class="option-content">
                            <div class="option-header">
                              <SvgIcon name="transfer" class="option-icon" />
                              <span class="option-title">迁移数据并切换</span>
                              <span class="option-badge warning">覆盖</span>
                            </div>
                            <small class="option-description">将当前数据迁移到目标存储并切换，会覆盖目标存储的现有数据</small>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="action-buttons">
                    <button @click="applyStorageModeConfig" class="btn btn-enhanced btn-primary"
                      :disabled="migrationLoading || !hasStorageModeChanges || (selectedStorageMode === 'database' && !databaseConnected)">
                      <SvgIcon name="save" class="btn-icon" />
                      {{ migrationLoading ? '应用中...' : getApplyButtonText() }}
                    </button>

                    <button @click="resetStorageModeConfig" class="btn btn-enhanced btn-secondary"
                      :disabled="migrationLoading || !hasStorageModeChanges">
                      <SvgIcon name="refresh" class="btn-icon" />
                      重置
                    </button>
                  </div>
                </div>

                <div class="database-actions">
                  <button @click="openDatabaseConfig" class="btn btn-enhanced btn-secondary"
                    :disabled="migrationLoading">
                    <SvgIcon name="settings" class="btn-icon" />
                    数据库配置
                  </button>

                  <div v-if="migrationLoading" class="migration-status">
                    <LoadingSpinner text="数据迁移中..." />
                  </div>
                </div>
              </div>
            </div>

            <!-- 检测模式配置 -->
            <div class="config-section">
              <div class="config-section-title">
                <SvgIcon name="settings" class="section-icon" />
                检测模式选择
              </div>
              <div class="config-options">
                <div class="config-option" :class="{ active: detectionMethod === 'registry' }">
                  <label>
                    <input type="radio" v-model="detectionMethod" value="registry" @change="updateDetectionMethod" />
                    <div class="option-content">
                      <div class="option-header">
                        <SvgIcon name="database" class="option-icon" />
                        <span class="option-title">注册表检测</span>
                        <span class="option-badge recommended">推荐</span>
                      </div>
                      <small class="option-description">优先使用注册表检测作品是否已下载，速度最快</small>
                    </div>
                  </label>
                </div>

                <div class="config-option" :class="{ active: detectionMethod === 'scan' }">
                  <label>
                    <input type="radio" v-model="detectionMethod" value="scan" @change="updateDetectionMethod" />
                    <div class="option-content">
                      <div class="option-header">
                        <SvgIcon name="folder-search" class="option-icon" />
                        <span class="option-title">扫盘检测</span>
                        <span class="option-badge basic">基础</span>
                      </div>
                      <small class="option-description">直接扫描文件系统检测作品是否已下载，准确度最高</small>
                    </div>
                  </label>
                </div>

                <div class="config-option" :class="{ active: detectionMethod === 'hybrid' }">
                  <label>
                    <input type="radio" v-model="detectionMethod" value="hybrid" @change="updateDetectionMethod" />
                    <div class="option-content">
                      <div class="option-header">
                        <SvgIcon name="layers" class="option-icon" />
                        <span class="option-title">混合检测模式</span>
                        <span class="option-badge smart">智能</span>
                      </div>
                      <small class="option-description">优先使用注册表检测，失败时自动回退到扫盘检测</small>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="registry-actions">
          <h4>管理操作</h4>

          <!-- 基础操作组 -->
          <div class="action-group">
            <div class="action-group-title">基础操作</div>
            <div class="action-buttons basic-actions">
              <button @click="refreshStats" class="btn btn-enhanced btn-secondary"
                :disabled="loading || isRebuildingRegistry">
                <SvgIcon name="refresh" class="btn-icon" />
                刷新统计
              </button>

              <button @click="exportRegistry" class="btn btn-enhanced btn-primary"
                :disabled="loading || isRebuildingRegistry">
                <SvgIcon name="download" class="btn-icon" />
                导出注册表
              </button>

              <label class="btn btn-enhanced btn-primary" :class="{ disabled: loading || isRebuildingRegistry }">
                <SvgIcon name="upload" class="btn-icon" />
                导入注册表
                <input type="file" @change="handleFileImport" accept=".json" style="display: none;"
                  :disabled="loading || isRebuildingRegistry" />
              </label>
            </div>
          </div>

          <!-- 高级操作组 -->
          <div class="action-group">
            <div class="action-group-title">高级操作</div>
            <div class="action-buttons advanced-actions">
              <button @click="rebuildRegistry" class="btn btn-enhanced btn-warning"
                :disabled="loading || isRebuildingRegistry">
                <SvgIcon name="rebuild" class="btn-icon" />
                {{ isRebuildingRegistry ? '同步中...' : '同步文件系统' }}
              </button>

              <button @click="cleanupRegistry" class="btn btn-enhanced btn-danger"
                :disabled="loading || isRebuildingRegistry">
                <SvgIcon name="clean" class="btn-icon" />
                清理注册表
              </button>
            </div>
          </div>

          <!-- 注册表重建进度显示 -->
          <div v-if="isRebuildingRegistry" class="rebuild-progress">
            <div class="progress-header">
              <h4>文件系统同步进度</h4>
              <button @click="cancelRebuild" class="btn btn-small btn-danger" title="取消同步">
                <SvgIcon name="close" class="btn-icon" />
                取消
              </button>
            </div>

            <div class="progress-content">
              <div class="progress-stats">
                <div class="progress-stat">
                  <span class="stat-label">已扫描艺术家:</span>
                  <span class="stat-value">{{ rebuildProgress.scannedArtists || 0 }}</span>
                </div>
                <div class="progress-stat">
                  <span class="stat-label">已扫描作品:</span>
                  <span class="stat-value">{{ rebuildProgress.scannedArtworks || 0 }}</span>
                </div>
                <div class="progress-stat">
                  <span class="stat-label">新增作品:</span>
                  <span class="stat-value">{{ rebuildProgress.addedArtworks || 0 }}</span>
                </div>
                <div class="progress-stat">
                  <span class="stat-label">跳过作品:</span>
                  <span class="stat-value">{{ rebuildProgress.skippedArtworks || 0 }}</span>
                </div>
              </div>

              <div v-if="rebuildProgress.currentArtist" class="current-status">
                <span class="status-label">当前处理:</span>
                <span class="status-value">{{ rebuildProgress.currentArtist }}</span>
              </div>

              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
                </div>
                <span class="progress-text">{{ progressPercentage.toFixed(1) }}%</span>
              </div>

              <div class="time-info">
                <span class="elapsed-time">已用时: {{ formatElapsedTime(rebuildStartTime) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据库配置模态框 -->
    <DatabaseConfigModal :visible="showDatabaseConfig" @close="closeDatabaseConfig"
      @saved="handleDatabaseConfigSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRegistryStore } from '@/stores/registry';
import downloadService from '@/services/download';
import databaseService from '@/services/database';
import SvgIcon from './SvgIcon.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import ErrorMessage from './ErrorMessage.vue';
import DatabaseConfigModal from './DatabaseConfigModal.vue';

const registryStore = useRegistryStore();
const isOpen = ref(false);
const successMessage = ref<string | null>(null);

// 数据库配置相关状态
const showDatabaseConfig = ref(false);
const databaseConnected = ref(false);
const storageMode = ref<'json' | 'database'>('json');
const selectedStorageMode = ref<'json' | 'database'>('json'); // 用户选择的存储模式
const migrationLoading = ref(false);
const migrationMode = ref<'switch-only' | 'migrate-data'>('switch-only'); // 迁移模式选择

// 计算属性：检查存储模式是否有变更
const hasStorageModeChanges = computed(() => {
  return selectedStorageMode.value !== storageMode.value;
});

// 计算应用按钮文本
const getApplyButtonText = () => {
  if (migrationMode.value === 'switch-only') {
    return '仅切换读取方式';
  } else {
    return '迁移数据并切换';
  }
};

// 从store中获取响应式数据
const { stats, loading, error, config } = storeToRefs(registryStore);

// 检测方法选择 - 不设置默认值，等待从后端配置初始化
const detectionMethod = ref<'registry' | 'scan' | 'hybrid'>();

// 重建进度相关状态
const isRebuildingRegistry = ref(false);
const rebuildTaskId = ref<string | null>(null);
const rebuildProgress = ref({
  scannedArtists: 0,
  scannedArtworks: 0,
  addedArtworks: 0,
  skippedArtworks: 0,
  currentArtist: ''
});
const rebuildStartTime = ref<number>(0);
const progressPollingInterval = ref<number | null>(null);

// 计算进度百分比
const progressPercentage = computed(() => {
  const total = rebuildProgress.value.scannedArtworks;
  const processed = rebuildProgress.value.addedArtworks + rebuildProgress.value.skippedArtworks;
  if (total === 0) return 0;
  return Math.min((processed / total) * 100, 100);
});

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
  const useDatabase = storageMode.value === 'database';
  const result = await registryStore.exportRegistry(useDatabase);
  if (result.success) {
    const modeText = useDatabase ? '数据库' : 'JSON文件';
    showSuccess(`注册表导出成功（${modeText}模式）`);

    // 创建下载链接
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = useDatabase ? 'database-registry.json' : 'download-registry.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// 处理文件导入
const handleFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    // 读取文件内容
    const fileContent = await file.text();
    const registryData = JSON.parse(fileContent);

    const useDatabase = storageMode.value === 'database';
    const result = await registryStore.importRegistry(registryData, useDatabase);
    if (result.success) {
      const modeText = useDatabase ? '数据库' : 'JSON文件';
      showSuccess(`注册表导入成功（${modeText}模式），处理了 ${result.data?.imported || result.data?.addedArtworks || 0} 条记录`);
    }
  } catch (error: any) {
    showError(`导入失败: ${error.message}`);
  }

  // 清空文件输入
  target.value = '';
};

// 重建注册表 - 使用新的异步API
const rebuildRegistry = async () => {
  if (!confirm('确定要同步文件系统到注册表吗？这将扫描整个下载目录并添加新发现的作品，可能需要一些时间。')) {
    return;
  }

  try {
    // 启动异步重建任务
    const result = await downloadService.rebuildRegistry();
    if (result.success && result.data?.taskId) {
      rebuildTaskId.value = result.data.taskId;
      isRebuildingRegistry.value = true;
      rebuildStartTime.value = Date.now();

      // 重置进度
      rebuildProgress.value = {
        scannedArtists: 0,
        scannedArtworks: 0,
        addedArtworks: 0,
        skippedArtworks: 0,
        currentArtist: ''
      };

      // 开始轮询进度
      startProgressPolling();
      showSuccess('文件系统同步已开始，请等待完成...');
    } else {
      throw new Error(result.error || '启动同步任务失败');
    }
  } catch (error) {
    console.error('启动重建任务失败:', error);
    showError('启动文件系统同步失败: ' + (error as Error).message);
  }
};

// 开始轮询进度
const startProgressPolling = () => {
  if (progressPollingInterval.value) {
    clearInterval(progressPollingInterval.value);
  }

  progressPollingInterval.value = setInterval(async () => {
    if (!rebuildTaskId.value) return;

    try {
      const statusResult = await downloadService.getRegistryRebuildStatus(rebuildTaskId.value);
      if (statusResult.success && statusResult.data) {
        const status = statusResult.data;

        // 更新进度信息
        if (status.progress) {
          rebuildProgress.value = {
            scannedArtists: status.progress.scannedArtists || 0,
            scannedArtworks: status.progress.scannedArtworks || 0,
            addedArtworks: status.progress.addedArtworks || 0,
            skippedArtworks: status.progress.skippedArtworks || 0,
            currentArtist: status.progress.currentArtist || ''
          };
        }

        // 检查任务状态
        if (status.status === 'completed') {
          stopProgressPolling();
          isRebuildingRegistry.value = false;
          rebuildTaskId.value = null;

          const addedCount = rebuildProgress.value.addedArtworks;
          const skippedCount = rebuildProgress.value.skippedArtworks;
          showSuccess(`文件系统同步完成！新增 ${addedCount} 个作品，跳过 ${skippedCount} 个已存在作品`);

          // 刷新统计信息
          refreshStats();
        } else if (status.status === 'failed') {
          stopProgressPolling();
          isRebuildingRegistry.value = false;
          rebuildTaskId.value = null;
          showError('文件系统同步失败: ' + (status.error || '未知错误'));
        } else if (status.status === 'cancelled') {
          stopProgressPolling();
          isRebuildingRegistry.value = false;
          rebuildTaskId.value = null;
          showSuccess('文件系统同步已取消');
        }
      }
    } catch (error) {
      console.error('获取重建进度失败:', error);
      // 不立即停止轮询，可能是临时网络问题
    }
  }, 2000); // 每2秒轮询一次
};

// 停止轮询进度
const stopProgressPolling = () => {
  if (progressPollingInterval.value) {
    clearInterval(progressPollingInterval.value);
    progressPollingInterval.value = null;
  }
};

// 取消重建任务
const cancelRebuild = async () => {
  if (!rebuildTaskId.value) return;

  if (!confirm('确定要取消文件系统同步吗？')) {
    return;
  }

  try {
    const result = await downloadService.cancelRegistryRebuild(rebuildTaskId.value);
    if (result.success) {
      stopProgressPolling();
      isRebuildingRegistry.value = false;
      rebuildTaskId.value = null;
      showSuccess('文件系统同步已取消');
    } else {
      showError('取消同步失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    console.error('取消重建任务失败:', error);
    showError('取消同步失败: ' + (error as Error).message);
  }
};

// 格式化已用时间
const formatElapsedTime = (startTime: number): string => {
  if (!startTime) return '00:00';

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

// 保存存储模式配置
const saveStorageModeConfig = async (mode: 'json' | 'database') => {
  try {
    const result = await registryStore.updateConfig({
      useRegistryCheck: config.value.useRegistryCheck,
      fallbackToScan: config.value.fallbackToScan,
      storageMode: mode
    });

    if (result.success) {
      console.log('存储模式配置已保存:', mode);
    } else {
      console.warn('保存存储模式配置失败:', result.error);
    }
  } catch (error) {
    console.error('保存存储模式配置时出错:', error);
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

// 显示错误消息
const showError = (message: string) => {
  registryStore.error = message;
};

// 数据库配置相关方法
const openDatabaseConfig = () => {
  showDatabaseConfig.value = true;
};

const closeDatabaseConfig = () => {
  showDatabaseConfig.value = false;
};

const handleDatabaseConfigSaved = async () => {
  showDatabaseConfig.value = false;
  await checkDatabaseConnection();
  showSuccess('数据库配置已保存');
};

const checkDatabaseConnection = async () => {
  try {
    const result = await databaseService.getConnectionStatus();
    databaseConnected.value = result.success && (result.data?.connected || false);
  } catch (error) {
    console.error('检查数据库连接失败:', error);
    databaseConnected.value = false;
  }
};

// 应用存储模式配置
const applyStorageModeConfig = async () => {
  if (selectedStorageMode.value === 'database' && !databaseConnected.value) {
    showError('请先配置并连接数据库');
    return;
  }

  if (selectedStorageMode.value === storageMode.value) {
    return;
  }

  // 根据迁移模式生成不同的确认消息
  let confirmMessage = '';
  if (migrationMode.value === 'switch-only') {
    confirmMessage = selectedStorageMode.value === 'database'
      ? '确定要切换到数据库存储模式吗？这将仅改变读取方式，不会迁移现有数据。'
      : '确定要切换到JSON文件存储模式吗？这将仅改变读取方式，不会迁移现有数据。';
  } else {
    confirmMessage = selectedStorageMode.value === 'database'
      ? '确定要迁移数据并切换到数据库存储模式吗？这将把JSON数据迁移到数据库并覆盖数据库中的现有数据。'
      : '确定要迁移数据并切换到JSON文件存储模式吗？这将把数据库数据迁移到JSON文件并覆盖JSON文件中的现有数据。';
  }

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    migrationLoading.value = true;

    if (migrationMode.value === 'migrate-data') {
      // 执行数据迁移
      if (selectedStorageMode.value === 'database') {
        // 从JSON迁移到数据库
        const result = await databaseService.migrateData('json-to-db');
        if (result.success) {
          storageMode.value = 'database';
          showSuccess(`成功迁移到数据库存储，处理了 ${result.data?.recordsProcessed || 0} 条记录`);
        } else {
          throw new Error(result.error || '迁移到数据库失败');
        }
      } else {
        // 从数据库迁移到JSON
        const result = await databaseService.migrateData('db-to-json');
        if (result.success) {
          storageMode.value = 'json';
          showSuccess(`成功迁移到JSON存储，处理了 ${result.data?.recordsProcessed || 0} 条记录`);
        } else {
          throw new Error(result.error || '迁移到JSON失败');
        }
      }
    } else {
      // 仅切换存储模式，不迁移数据
      storageMode.value = selectedStorageMode.value;
      const modeText = selectedStorageMode.value === 'database' ? '数据库存储' : 'JSON文件存储';
      showSuccess(`已切换到${modeText}模式，数据读取方式已更改`);
    }

    // 保存存储模式配置到后端
    await saveStorageModeConfig(selectedStorageMode.value);

    // 刷新统计信息
    await refreshStats();
  } catch (error) {
    console.error('存储模式切换失败:', error);
    showError(`存储模式切换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    // 恢复选择状态
    selectedStorageMode.value = storageMode.value;
  } finally {
    migrationLoading.value = false;
  }
};

// 重置存储模式配置
const resetStorageModeConfig = () => {
  selectedStorageMode.value = storageMode.value;
};

const switchStorageMode = async (mode: 'json' | 'database') => {
  // 保留原函数以防其他地方调用，但现在只是更新选择状态
  selectedStorageMode.value = mode;
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

// 初始化存储模式
const initStorageMode = () => {
  if (config.value.storageMode) {
    storageMode.value = config.value.storageMode;
    selectedStorageMode.value = config.value.storageMode; // 同时更新选择状态
  } else {
    storageMode.value = 'json'; // 默认值
    selectedStorageMode.value = 'json';
  }
};

// 组件挂载时初始化
onMounted(async () => {
  // 从后端获取配置并初始化检测方法和存储模式
  try {
    await registryStore.fetchConfig();
    initDetectionMethod();
    initStorageMode();
  } catch (error) {
    console.error('获取配置失败:', error);
    // 如果获取配置失败，使用默认值
    detectionMethod.value = 'hybrid';
    storageMode.value = 'json';
    selectedStorageMode.value = 'json';
  }

  // 检查数据库连接状态
  await checkDatabaseConnection();

  // 初始化时加载统计数据
  refreshStats();
});

// 组件卸载时清理
onUnmounted(() => {
  stopProgressPolling();
});

// 监听配置变化，自动更新检测方法和存储模式
watch(config, () => {
  initDetectionMethod();
  initStorageMode();
}, { deep: true });
</script>

<style scoped>
.registry-widget {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  z-index: 1000;
  transition: z-index 0.1s ease;
}

.registry-widget.panel-open {
  z-index: 1002;
}

.registry-toggle {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--color-info, #06b6d4);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg, 0 4px 12px rgba(6, 182, 212, 0.3));
  transition: all var(--transition-normal, 0.3s ease);
  position: relative;
}

.registry-toggle:hover {
  background: var(--color-info-hover, #0891b2);
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl, 0 6px 16px rgba(6, 182, 212, 0.4));
}

.registry-toggle.active {
  background: var(--color-info-active, #0e7490);
  box-shadow: var(--shadow-inner, inset 0 2px 4px rgba(0, 0, 0, 0.1));
}

.registry-icon {
  width: 1.5rem;
  height: 1.5rem;
  transition: transform var(--transition-normal);
}

.registry-toggle.active .registry-icon {
  transform: rotate(180deg);
}

.registry-panel {
  position: absolute;
  bottom: 4rem;
  left: 0;
  width: 420px;
  max-height: 650px;
  background: var(--color-bg-primary, white);
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-2xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04));
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

.registry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xl, 1.5rem);
  background: var(--color-bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  position: relative;
}

.registry-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-info), var(--color-success), var(--color-warning));
}

.registry-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.registry-header h3::before {
  content: '📋';
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

.registry-content {
  padding: var(--spacing-xl, 1.5rem);
  max-height: 550px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.registry-content::-webkit-scrollbar {
  width: 6px;
}

.registry-content::-webkit-scrollbar-track {
  background: transparent;
}

.registry-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.registry-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-hover);
}

.loading,
.error {
  margin-bottom: var(--spacing-lg, 1rem);
}

.success-message {
  margin-bottom: var(--spacing-lg, 1rem);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-success-light, #dcfce7);
  border: 1px solid var(--color-success-border, #bbf7d0);
  border-radius: var(--radius-md, 0.5rem);
  position: relative;
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

.success-message::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
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

.success-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
  color: var(--color-success-text, #166534);
  font-size: 0.875rem;
  font-weight: 500;
}

.success-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-success, #16a34a);
  flex-shrink: 0;
}

.registry-stats,
.registry-config,
.registry-actions {
  margin-bottom: var(--spacing-xl, 1.5rem);
}

.registry-stats h4,
.registry-config h4,
.registry-actions h4 {
  margin: 0 0 var(--spacing-lg) 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #1f2937);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.registry-stats h4::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--color-info);
  border-radius: 2px;
}

.registry-config h4::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--color-warning);
  border-radius: 2px;
}

.registry-actions h4::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--color-success);
  border-radius: 2px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--spacing-xl, 1.5rem);
  background: linear-gradient(135deg, var(--color-bg-secondary, #f8fafc), var(--color-bg-tertiary, #f1f5f9));
  padding: var(--spacing-xl, 1.5rem);
  border-radius: var(--radius-xl, 1rem);
  border: 1px solid var(--color-border, #e5e7eb);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
}

.stats-grid::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-info), var(--color-success), var(--color-warning));
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.stats-grid::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.03), transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.03), transparent 50%);
  pointer-events: none;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 0.5rem);
  text-align: center;
  padding: var(--spacing-lg, 1rem);
  background: var(--color-bg-primary, white);
  border-radius: var(--radius-lg, 0.5rem);
  border: 1px solid var(--color-border-light, #f3f4f6);
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05));
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.stat-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05));
  border-color: var(--color-border-hover);
}

.stat-item:hover::before {
  opacity: 1;
}

.stat-icon {
  font-size: 2rem;
  margin-bottom: var(--spacing-sm, 0.5rem);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  transition: transform var(--transition-normal);
}

.stat-item:hover .stat-icon {
  transform: scale(1.1);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #6b7280);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--spacing-xs, 0.25rem);
}

.stat-value {
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
  font-size: 1.5rem;
  font-family: var(--font-mono, 'Courier New', monospace);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  background: linear-gradient(135deg, var(--color-primary-light, #eff6ff), var(--color-bg-primary, white));
  border-radius: var(--radius-md, 0.375rem);
  margin: var(--spacing-xs, 0.25rem) 0;
  padding: var(--spacing-sm, 0.5rem);
  border: 1px solid var(--color-primary-light, #dbeafe);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-normal);
}

.stat-item:hover .stat-value {
  color: var(--color-primary-hover, #2563eb);
  background: linear-gradient(135deg, var(--color-primary-light, #eff6ff), var(--color-primary-lighter, #f0f9ff));
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 0.75rem);
  background: var(--color-bg-tertiary, #f8fafc);
  padding: var(--spacing-lg, 1rem);
  border-radius: var(--radius-lg, 0.5rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
  position: relative;
}

.config-form::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--color-warning);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 0.25rem);
  padding: var(--spacing-sm, 0.5rem);
  background: var(--color-bg-primary, white);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #f3f4f6);
  transition: all var(--transition-normal);
}

.form-group:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-xs);
}

.form-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary, #374151);
  cursor: pointer;
  padding: var(--spacing-xs, 0.25rem) 0;
}

.form-group input[type="radio"] {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--color-warning);
  cursor: pointer;
}

.form-group small {
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #6b7280);
  margin-left: var(--spacing-xl, 1.5rem);
  font-style: italic;
  line-height: 1.4;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-md, 0.75rem);
}

.action-group {
  margin-bottom: var(--spacing-lg, 1rem);
  background: var(--color-bg-secondary, #f8fafc);
  border-radius: var(--radius-lg, 0.5rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
  overflow: hidden;
  position: relative;
}

.action-group::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
}

.action-group-title {
  padding: var(--spacing-md, 0.75rem) var(--spacing-lg, 1rem);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #374151);
  background: var(--color-bg-tertiary, #f1f5f9);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
}

.action-group-title::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.basic-actions {
  padding: var(--spacing-lg, 1rem);
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.advanced-actions {
  padding: var(--spacing-lg, 1rem);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.btn-enhanced {
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
  background-clip: padding-box;
  box-shadow: var(--shadow-sm);
}

.btn-enhanced::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.btn-enhanced:hover::after {
  opacity: 1;
}

.btn-enhanced:hover:not(:disabled):not(.disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn-enhanced:active:not(:disabled):not(.disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm, 0.5rem);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md, 0.375rem);
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal);
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.btn:hover::before {
  left: 100%;
}

.btn:disabled,
.btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:hover:not(:disabled):not(.disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn:active:not(:disabled):not(.disabled) {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.btn-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
  border: 1px solid var(--color-primary);
}

.btn-primary:hover:not(:disabled):not(.disabled) {
  background: var(--color-primary-hover, #2563eb);
  border-color: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-secondary, #6b7280);
  color: white;
  border: 1px solid var(--color-secondary);
}

.btn-secondary:hover:not(:disabled):not(.disabled) {
  background: var(--color-secondary-hover, #4b5563);
  border-color: var(--color-secondary-hover);
}

.btn-warning {
  background: var(--color-warning, #f59e0b);
  color: white;
  border: 1px solid var(--color-warning);
}

.btn-warning:hover:not(:disabled):not(.disabled) {
  background: var(--color-warning-hover, #d97706);
  border-color: var(--color-warning-hover);
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  color: white;
  border: 1px solid var(--color-danger);
}

.btn-danger:hover:not(:disabled):not(.disabled) {
  background: var(--color-danger-hover, #dc2626);
  border-color: var(--color-danger-hover);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .registry-widget {
    bottom: 1rem;
    left: 1rem;
  }

  .registry-panel {
    width: calc(100vw - 2rem);
    max-width: 420px;
  }

  .registry-content {
    padding: var(--spacing-lg, 1rem);
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .action-buttons {
    grid-template-columns: 1fr;
  }

  .btn {
    padding: var(--spacing-md);
    font-size: 0.8rem;
  }

  .btn-icon {
    width: 0.875rem;
    height: 0.875rem;
  }
}

@media (max-width: 480px) {
  .registry-toggle {
    width: 3rem;
    height: 3rem;
  }

  .registry-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .registry-header {
    padding: var(--spacing-lg, 1rem);
  }

  .registry-header h3 {
    font-size: 1rem;
  }

  .stats-grid {
    padding: var(--spacing-md);
  }

  .config-form {
    padding: var(--spacing-md);
  }
}

/* 统计信息增强样式 */
.stat-icon {
  font-size: 1.5rem;
  margin-bottom: var(--spacing-xs);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.stat-trend {
  margin-top: var(--spacing-xs);
  opacity: 0.7;
}

.trend-icon {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-success);
}

/* 配置选项增强样式 */
.config-section {
  background: var(--color-bg-primary, white);
  border-radius: var(--radius-lg, 0.5rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
  overflow: hidden;
  position: relative;
}

.config-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-warning), var(--color-info));
}

.config-section-title {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #374151);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-warning);
}

.config-options {
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.config-option {
  background: var(--color-bg-tertiary, #f8fafc);
  border: 2px solid var(--color-border-light, #e2e8f0);
  border-radius: var(--radius-lg, 0.5rem);
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.config-option::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: transparent;
  transition: background var(--transition-normal);
}

.config-option:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.config-option.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light, #eff6ff);
  box-shadow: var(--shadow-md);
}

.config-option.active::before {
  background: var(--color-primary);
}

.config-option label {
  display: block;
  cursor: pointer;
  padding: var(--spacing-lg);
  margin: 0;
}

.config-option input[type="radio"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.option-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.option-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-text-secondary);
  transition: color var(--transition-normal);
}

.config-option.active .option-icon {
  color: var(--color-primary);
}

.option-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
}

.option-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full, 9999px);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
}

.option-badge.recommended {
  background: var(--color-success-light, #dcfce7);
  color: var(--color-success-text, #166534);
  border: 1px solid var(--color-success-border, #bbf7d0);
}

.option-badge.basic {
  background: var(--color-info-light, #e0f2fe);
  color: var(--color-info-text, #0c4a6e);
  border: 1px solid var(--color-info-border, #7dd3fc);
}

.option-badge.smart {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-text, #92400e);
  border: 1px solid var(--color-warning-border, #fcd34d);
}

.option-description {
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #6b7280);
  line-height: 1.4;
  margin: 0;
  font-style: normal;
}

.config-option.active .option-description {
  color: var(--color-text-secondary);
}

/* 统计信息样式 */
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg, 1rem);
}

.last-updated {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 0.25rem);
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #6b7280);
}

.update-label {
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.update-time {
  font-family: var(--font-mono, 'Courier New', monospace);
  color: var(--color-text-tertiary, #9ca3af);
  font-weight: 400;
}

/* 重建进度样式 */
.rebuild-progress {
  background: var(--color-bg-secondary, #f8fafc);
  border: 2px solid var(--color-warning-border, #fcd34d);
  border-radius: var(--radius-lg, 0.5rem);
  padding: var(--spacing-lg, 1rem);
  margin-top: var(--spacing-lg, 1rem);
  position: relative;
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

.rebuild-progress::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-warning), var(--color-info), var(--color-success));
  animation: progressGlow 2s ease-in-out infinite alternate;
}

@keyframes progressGlow {
  0% {
    opacity: 0.6;
  }

  100% {
    opacity: 1;
  }
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg, 1rem);
  padding-bottom: var(--spacing-sm, 0.5rem);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
}

.progress-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary, #374151);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
}

.progress-header h4::before {
  content: '⚡';
  font-size: 1.125rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }
}

.btn-small {
  padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
  font-size: 0.75rem;
  border-radius: var(--radius-sm, 0.25rem);
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 0.75rem);
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--spacing-sm, 0.5rem);
  background: var(--color-bg-primary, white);
  padding: var(--spacing-md, 0.75rem);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.progress-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--spacing-xs, 0.25rem);
}

.progress-stat .stat-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #6b7280);
  font-weight: 500;
  margin-bottom: var(--spacing-xs, 0.25rem);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-stat .stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
  font-family: var(--font-mono, 'Courier New', monospace);
  background: linear-gradient(135deg, var(--color-primary-light, #eff6ff), transparent);
  padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
  border-radius: var(--radius-sm, 0.25rem);
  border: 1px solid var(--color-primary-light, #dbeafe);
  min-width: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.current-status {
  background: var(--color-bg-primary, white);
  padding: var(--spacing-md, 0.75rem);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
}

.status-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  flex-shrink: 0;
}

.status-value {
  font-size: 0.875rem;
  color: var(--color-text-primary, #374151);
  font-family: var(--font-mono, 'Courier New', monospace);
  background: var(--color-bg-tertiary, #f8fafc);
  padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
  border-radius: var(--radius-sm, 0.25rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-bar-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 0.75rem);
  background: var(--color-bg-primary, white);
  padding: var(--spacing-md, 0.75rem);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.progress-bar {
  flex: 1;
  height: 1rem;
  background: var(--color-bg-tertiary, #f1f5f9);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
  position: relative;
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.progress-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0.1) 100%);
  animation: shimmer 2s infinite;
  pointer-events: none;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg,
      var(--color-success, #16a34a) 0%,
      var(--color-info, #06b6d4) 50%,
      var(--color-warning, #f59e0b) 100%);
  border-radius: var(--radius-full, 9999px);
  transition: width 0.5s ease-out;
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 50%,
      transparent 100%);
  animation: progressShine 1.5s ease-in-out infinite;
}

@keyframes progressShine {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #374151);
  font-family: var(--font-mono, 'Courier New', monospace);
  min-width: 3rem;
  text-align: right;
  background: var(--color-bg-tertiary, #f8fafc);
  padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
  border-radius: var(--radius-sm, 0.25rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.time-info {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary, white);
  padding: var(--spacing-sm, 0.5rem) var(--spacing-md, 0.75rem);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.elapsed-time {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  font-family: var(--font-mono, 'Courier New', monospace);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 0.25rem);
}

.elapsed-time::before {
  content: '⏱️';
  font-size: 1rem;
}

/* 存储模式配置样式 */
.storage-mode-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg, 1rem);
}

.storage-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 0.75rem);
}

.storage-option {
  background: var(--color-bg-primary, white);
  border: 2px solid var(--color-border-light, #e2e8f0);
  border-radius: var(--radius-lg, 0.5rem);
  padding: var(--spacing-md, 0.75rem);
  transition: all var(--transition-normal);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.storage-option:hover {
  border-color: var(--color-border-hover, #cbd5e1);
  box-shadow: var(--shadow-sm);
}

.storage-option.active {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.storage-option.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-bg-tertiary, #f8fafc);
}

.storage-option.disabled:hover {
  border-color: var(--color-border-light, #e2e8f0);
  box-shadow: none;
}

.storage-option label {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md, 0.75rem);
  cursor: pointer;
  width: 100%;
}

.storage-option.disabled label {
  cursor: not-allowed;
}

.storage-option input[type="radio"] {
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.125rem;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.storage-option.disabled input[type="radio"] {
  cursor: not-allowed;
}

.option-badge.advanced {
  background: var(--color-info-light, #e0f2fe);
  color: var(--color-info-text, #0c4a6e);
  border: 1px solid var(--color-info-border, #7dd3fc);
}

.option-badge.advanced.connected {
  background: var(--color-success-light, #dcfce7);
  color: var(--color-success-text, #166534);
  border: 1px solid var(--color-success-border, #bbf7d0);
}

.database-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 0.75rem);
  padding: var(--spacing-md, 0.75rem);
  background: var(--color-bg-secondary, #f8fafc);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.migration-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
  color: var(--color-text-secondary, #6b7280);
  font-size: 0.875rem;
}

/* 存储配置操作样式 */
.storage-config-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 0.75rem);
  padding: var(--spacing-md, 0.75rem);
  background: var(--color-bg-secondary, #f8fafc);
  border-radius: var(--radius-md, 0.375rem);
  border: 1px solid var(--color-border-light, #e2e8f0);
}

.config-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm, 0.5rem);
}

.config-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 0.25rem);
  font-size: 0.875rem;
  font-weight: 500;
  padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
  border-radius: var(--radius-sm, 0.25rem);
  transition: all var(--transition-normal);
}

.config-indicator.saved {
  color: var(--color-success-text, #166534);
  background: var(--color-success-light, #dcfce7);
  border: 1px solid var(--color-success-border, #bbf7d0);
}

.config-indicator.unsaved {
  color: var(--color-warning-text, #92400e);
  background: var(--color-warning-light, #fef3c7);
  border: 1px solid var(--color-warning-border, #fbbf24);
  animation: pulse 2s ease-in-out infinite;
}

.indicator-icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

.storage-config-actions .action-buttons {
  display: flex;
  gap: var(--spacing-sm, 0.5rem);
  justify-content: center;
}

.storage-config-actions .btn {
  flex: 1;
  min-width: 0;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.7;
  }
}

/* 配置节样式增强 */
.config-section {
  margin-bottom: var(--spacing-xl, 1.5rem);
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border-light, #e2e8f0);
  border-radius: var(--radius-lg, 0.5rem);
  overflow: hidden;
  position: relative;
}

.config-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
}

.config-section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 0.5rem);
  padding: var(--spacing-lg, 1rem);
  background: var(--color-bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
  font-weight: 600;
  color: var(--color-text-primary, #374151);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-primary);
}

.config-options,
.storage-options {
  padding: var(--spacing-lg, 1rem);
}

/* 响应式设计 - 存储配置 */
@media (max-width: 768px) {
  .database-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .migration-status {
    justify-content: center;
  }

  .storage-config-actions .action-buttons {
    flex-direction: column;
  }

  .storage-config-actions .btn {
    flex: none;
  }
}

/* 原有的配置选项样式保持不变 */
@media (max-width: 768px) {
  .progress-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-xs, 0.25rem);
  }

  .progress-stat {
    font-size: 0.65rem;
  }

  .progress-stat .stat-label {
    font-size: 0.65rem;
  }

  .progress-stat .stat-value {
    font-size: 1rem;
  }

  .current-status {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs, 0.25rem);
  }

  .status-value {
    width: 100%;
  }

  .progress-bar-container {
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
  }

  .progress-text {
    align-self: center;
  }
}

@media (max-width: 480px) {
  .rebuild-progress {
    padding: var(--spacing-md, 0.75rem);
  }

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm, 0.5rem);
  }

  .progress-stats {
    grid-template-columns: 1fr;
  }

  .btn-small {
    align-self: flex-end;
  }
}
</style>