<template>
  <div v-if="visible" class="modal-overlay" @click="handleOverlayClick">
    <div class="database-config-modal" @click.stop>
      <div class="modal-header">
        <h3>数据库配置</h3>
        <button @click="$emit('close')" class="close-btn" title="关闭">
          <SvgIcon name="close" class="close-icon" />
        </button>
      </div>

      <div class="modal-content">
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

        <!-- 配置表单 -->
        <div class="config-form">
          <div class="form-section">
            <h4>连接设置</h4>
            
            <div class="form-group">
              <label for="db-host">主机地址</label>
              <input
                id="db-host"
                v-model="config.host"
                type="text"
                class="form-input"
                placeholder="localhost"
                :disabled="loading"
              />
              <small class="form-help">MySQL服务器的主机地址</small>
            </div>

            <div class="form-group">
              <label for="db-port">端口</label>
              <input
                id="db-port"
                v-model.number="config.port"
                type="number"
                class="form-input"
                placeholder="3306"
                min="1"
                max="65535"
                :disabled="loading"
              />
              <small class="form-help">MySQL服务器端口，默认为3306</small>
            </div>

            <div class="form-group">
              <label for="db-user">用户名</label>
              <input
                id="db-user"
                v-model="config.user"
                type="text"
                class="form-input"
                placeholder="root"
                :disabled="loading"
              />
              <small class="form-help">数据库用户名</small>
            </div>

            <div class="form-group">
              <label for="db-password">密码</label>
              <div class="password-input-group">
                <input
                  id="db-password"
                  v-model="config.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-input"
                  placeholder="请输入密码"
                  :disabled="loading"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="password-toggle"
                  :title="showPassword ? '隐藏密码' : '显示密码'"
                >
                  <SvgIcon :name="showPassword ? 'eye-off' : 'eye'" class="toggle-icon" />
                </button>
              </div>
              <small class="form-help">数据库密码</small>
            </div>

            <div class="form-group">
              <label for="db-database">数据库名</label>
              <input
                id="db-database"
                v-model="config.database"
                type="text"
                class="form-input"
                placeholder="pixiv_d"
                :disabled="loading"
              />
              <small class="form-help">要使用的数据库名称，如果不存在将自动创建</small>
            </div>
          </div>

          <div class="form-section">
            <h4>连接选项</h4>
            
            <div class="form-group">
              <label for="db-connection-limit">连接池大小</label>
              <input
                id="db-connection-limit"
                v-model.number="config.connectionLimit"
                type="number"
                class="form-input"
                placeholder="10"
                min="1"
                max="100"
                :disabled="loading"
              />
              <small class="form-help">连接池最大连接数，建议5-20之间</small>
            </div>

            <div class="form-group">
              <label for="db-timeout">连接超时 (秒)</label>
              <input
                id="db-timeout"
                v-model.number="config.acquireTimeout"
                type="number"
                class="form-input"
                placeholder="60"
                min="5"
                max="300"
                :disabled="loading"
              />
              <small class="form-help">获取连接的超时时间</small>
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input
                  v-model="config.ssl"
                  type="checkbox"
                  class="form-checkbox"
                  :disabled="loading"
                />
                启用SSL连接
              </label>
              <small class="form-help">是否使用SSL加密连接到数据库</small>
            </div>
          </div>
        </div>

        <!-- 连接测试结果 -->
        <div v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
          <div class="test-result-header">
            <SvgIcon :name="testResult.success ? 'success' : 'error'" class="result-icon" />
            <span class="result-title">{{ testResult.success ? '连接成功' : '连接失败' }}</span>
          </div>
          <div v-if="testResult.message" class="result-message">{{ testResult.message }}</div>
          <div v-if="testResult.details" class="result-details">
            <div v-for="(value, key) in testResult.details" :key="key" class="detail-item">
              <span class="detail-key">{{ key }}:</span>
              <span class="detail-value">{{ value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          @click="testConnection"
          class="btn btn-secondary"
          :disabled="loading || !isConfigValid"
        >
          <SvgIcon name="test-connect" class="btn-icon" />
          {{ loading ? '测试中...' : '测试连接' }}
        </button>
        
        <button
          @click="saveConfig"
          class="btn btn-primary"
          :disabled="loading || !isConfigValid"
        >
          <SvgIcon name="save" class="btn-icon" />
          {{ loading ? '保存中...' : '保存配置' }}
        </button>
        
        <button
          @click="$emit('close')"
          class="btn btn-outline"
          :disabled="loading"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import SvgIcon from './SvgIcon.vue';
import LoadingSpinner from './LoadingSpinner.vue';
import ErrorMessage from './ErrorMessage.vue';
import databaseService from '@/services/database';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  ssl: boolean;
}

interface TestResult {
  success: boolean;
  message?: string;
  details?: Record<string, any>;
}

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  saved: [config: DatabaseConfig];
}>();

// 响应式数据
const loading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const showPassword = ref(false);
const testResult = ref<TestResult | null>(null);

// 默认配置
const defaultConfig: DatabaseConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'pixiv_d',
  connectionLimit: 10,
  acquireTimeout: 60,
  ssl: false
};

const config = ref<DatabaseConfig>({ ...defaultConfig });

// 计算属性
const isConfigValid = computed(() => {
  return config.value.host.trim() !== '' &&
         config.value.port > 0 &&
         config.value.user.trim() !== '' &&
         config.value.database.trim() !== '';
});

// 方法
const clearError = () => {
  error.value = null;
};

const clearSuccess = () => {
  successMessage.value = null;
};

const showSuccess = (message: string) => {
  successMessage.value = message;
  setTimeout(() => {
    successMessage.value = null;
  }, 3000);
};

const handleOverlayClick = (event: MouseEvent) => {
  // 移除点击外部自动关闭功能，用户需要手动点击关闭按钮
  // if (event.target === event.currentTarget) {
  //   emit('close');
  // }
};

// 测试数据库连接
const testConnection = async () => {
  if (!isConfigValid.value) {
    error.value = '请填写完整的数据库配置信息';
    return;
  }

  loading.value = true;
  error.value = null;
  testResult.value = null;

  try {
    const result = await databaseService.testConnection(config.value);
    
    if (result.success) {
      testResult.value = {
        success: true,
        message: '数据库连接测试成功',
        details: result.data
      };
      showSuccess('数据库连接测试成功');
    } else {
      testResult.value = {
        success: false,
        message: result.error || '连接测试失败'
      };
      error.value = result.error || '连接测试失败';
    }
  } catch (err: any) {
    const errorMessage = err.message || '连接测试失败';
    testResult.value = {
      success: false,
      message: errorMessage
    };
    error.value = errorMessage;
  } finally {
    loading.value = false;
  }
};

// 保存配置
const saveConfig = async () => {
  if (!isConfigValid.value) {
    error.value = '请填写完整的数据库配置信息';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const result = await databaseService.saveConfig(config.value);
    
    if (result.success) {
      showSuccess('数据库配置保存成功');
      emit('saved', config.value);
      
      // 延迟关闭模态框
      setTimeout(() => {
        emit('close');
      }, 1500);
    } else {
      error.value = result.error || '保存配置失败';
    }
  } catch (err: any) {
    error.value = err.message || '保存配置失败';
  } finally {
    loading.value = false;
  }
};

// 加载现有配置
const loadConfig = async () => {
  loading.value = true;
  error.value = null;

  try {
    const result = await databaseService.getConfig();
    
    if (result.success && result.data) {
      config.value = { ...defaultConfig, ...result.data };
    }
  } catch (err: any) {
    console.warn('加载数据库配置失败:', err.message);
    // 不显示错误，使用默认配置
  } finally {
    loading.value = false;
  }
};

// 监听模态框显示状态
watch(() => props.visible, (visible) => {
  if (visible) {
    // 重置状态
    error.value = null;
    successMessage.value = null;
    testResult.value = null;
    
    // 加载现有配置
    loadConfig();
  }
});

// 清除成功消息的定时器
watch(successMessage, (message) => {
  if (message) {
    setTimeout(() => {
      if (successMessage.value === message) {
        successMessage.value = null;
      }
    }, 3000);
  }
});

onMounted(() => {
  if (props.visible) {
    loadConfig();
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.database-config-modal {
  background: var(--color-bg-primary);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-header h3::before {
  content: '🗄️';
  font-size: 16px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.close-icon {
  width: 16px;
  height: 16px;
}

.modal-content {
  padding: 24px;
  max-height: calc(90vh - 200px);
  overflow-y: auto;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
}

.error {
  margin-bottom: 20px;
}

.success-message {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: var(--color-success-light, #f0f9ff);
  border: 1px solid var(--color-success, #10b981);
  border-radius: 8px;
  color: var(--color-success-dark, #065f46);
}

.success-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-icon {
  width: 16px;
  height: 16px;
  color: var(--color-success);
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  background: var(--color-bg-secondary);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section h4::before {
  content: '';
  width: 3px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 2px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.form-input:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--color-text-tertiary);
}

.password-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.password-toggle {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.password-toggle:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.toggle-icon {
  width: 14px;
  height: 14px;
}

.form-help {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.4;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.test-result {
  margin-top: 20px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid;
}

.test-result.success {
  background: var(--color-success-light, #f0f9ff);
  border-color: var(--color-success, #10b981);
  color: var(--color-success-dark, #065f46);
}

.test-result.error {
  background: var(--color-danger-light, #fef2f2);
  border-color: var(--color-danger, #ef4444);
  color: var(--color-danger-dark, #991b1b);
}

.test-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.result-icon {
  width: 16px;
  height: 16px;
}

.result-title {
  font-weight: 600;
  font-size: 14px;
}

.result-message {
  font-size: 14px;
  margin-bottom: 8px;
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  opacity: 0.8;
}

.detail-item {
  display: flex;
  gap: 8px;
}

.detail-key {
  font-weight: 500;
  min-width: 80px;
}

.detail-value {
  flex: 1;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
  background: var(--color-bg-secondary);
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--color-info);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-info-hover);
  transform: translateY(-1px);
}

.btn-outline {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .database-config-modal {
    width: 95%;
    max-height: 95vh;
  }

  .modal-content {
    padding: 16px;
    max-height: calc(95vh - 160px);
  }

  .modal-header,
  .modal-footer {
    padding: 16px;
  }

  .form-section {
    padding: 16px;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>