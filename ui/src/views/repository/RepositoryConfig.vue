<template>
  <div class="config-section">
    <h3>仓库配置</h3>
    <div class="config-form">
      <div class="form-group">
        <label>下载目录</label>
        <div class="path-input-group">
          <input 
            v-model="config.downloadDir" 
            type="text" 
            placeholder="设置下载目录路径，例如: ./downloads 或 D:\downloads"
            class="form-input"
          />
          <button type="button" @click="selectDownloadDir" class="btn btn-secondary">
            选择目录
          </button>
          <button type="button" @click="testDownloadDir" class="btn btn-outline">
            测试
          </button>
        </div>
        <small class="form-help">
          <strong>路径示例：</strong><br>
          • 相对路径：<code>./downloads</code>（相对于项目根目录）<br>
          • 绝对路径：<code>D:\downloads</code> 或 <code>/home/user/downloads</code><br>
          • 当前目录：<code>.</code> 或 <code>./</code>
        </small>
      </div>
      
      <!-- 自动迁移选项 -->
      <div class="form-group">
        <label class="checkbox-label">
          <input 
            v-model="config.autoMigration" 
            type="checkbox" 
            class="form-checkbox"
          />
          <span>自动迁移旧下载文件</span>
        </label>
        <small class="form-help">
          启用后，保存配置时会自动将旧下载目录中的文件移动到新目录
        </small>
      </div>
      
      <!-- 迁移进度显示 -->
      <div v-if="migrating" class="migration-progress">
        <div class="progress-header">
          <h4>正在迁移文件...</h4>
          <span class="progress-text">{{ migrationProgress }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: migrationPercent + '%' }"></div>
        </div>
      </div>
      
      <!-- 迁移结果 -->
      <div v-if="migrationResult" class="migration-result">
        <h4>迁移完成</h4>
        <div class="result-stats">
          <p>✅ 成功迁移: {{ migrationResult.totalMigrated }} 个作品</p>
          <p>⏭️ 跳过: {{ migrationResult.log.filter((item: any) => item.status === 'skipped').length }} 个作品</p>
        </div>
        <div class="migration-log">
          <h5>详细日志</h5>
          <div 
            v-for="(item, index) in migrationResult.log.slice(0, 10)" 
            :key="index"
            class="log-item"
            :class="(item as any).status"
          >
            <span class="log-status">{{ (item as any).status === 'success' ? '✅' : '⏭️' }}</span>
            <span class="log-text">{{ (item as any).title }} (ID: {{ (item as any).id }})</span>
            <span v-if="(item as any).reason" class="log-reason">{{ (item as any).reason }}</span>
          </div>
          <div v-if="migrationResult.log.length > 10" class="log-more">
            还有 {{ migrationResult.log.length - 10 }} 个文件...
          </div>
        </div>
      </div>
      
      <div class="form-group">
        <label>文件结构</label>
        <select v-model="config.fileStructure" class="form-select">
          <option value="artist/artwork">作者/作品</option>
          <option value="artwork">仅作品</option>
          <option value="flat">扁平结构</option>
        </select>
      </div>
      <div class="form-group">
        <label>命名模式</label>
        <input 
          v-model="config.namingPattern" 
          type="text" 
          placeholder="{artist_name}/{artwork_id}_{title}"
          class="form-input"
        />
      </div>
      <div class="form-group">
        <label>最大文件大小 (MB)</label>
        <input 
          v-model.number="config.maxFileSize" 
          type="number" 
          placeholder="0表示无限制"
          class="form-input"
        />
      </div>
      <div class="form-group">
        <label>允许的文件扩展名</label>
        <input 
          :value="config.allowedExtensions.join(',')" 
          @input="(e) => config.allowedExtensions = (e.target as HTMLInputElement).value.split(',').map(ext => ext.trim()).filter(ext => ext)"
          type="text" 
          placeholder=".jpg,.png,.gif,.webp"
          class="form-input"
        />
      </div>
      <div class="form-actions">
        <button @click="saveConfig" class="btn btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
        <button @click="resetConfig" class="btn btn-outline" :disabled="saving">
          重置为默认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RepositoryConfig } from '@/stores/repository.ts'

interface Props {
  config: RepositoryConfig
  migrating: boolean
  migrationProgress: string
  migrationPercent: number
  migrationResult: any
}

interface Emits {
  (e: 'update:config', config: RepositoryConfig): void
  (e: 'save-config'): void
  (e: 'reset-config'): void
  (e: 'select-download-dir'): void
  (e: 'test-download-dir'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const saving = ref(false)

// 选择下载目录
const selectDownloadDir = () => {
  emit('select-download-dir')
}

// 测试下载目录
const testDownloadDir = () => {
  emit('test-download-dir')
}

// 保存配置
const saveConfig = async () => {
  saving.value = true
  try {
    emit('save-config')
  } finally {
    saving.value = false
  }
}

// 重置配置
const resetConfig = () => {
  emit('reset-config')
}
</script>

<style scoped>
.config-section h3 {
  margin: 0 0 1.5rem 0;
  color: #1f2937;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.path-input-group {
  display: flex;
  gap: 0.5rem;
}

.path-input-group .form-input {
  flex: 1;
}

.path-input-group .btn {
  white-space: nowrap;
  min-width: 80px;
}

.form-help {
  color: #6b7280;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  line-height: 1.4;
}

.form-help strong {
  color: #374151;
  font-weight: 600;
}

.form-help code {
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: #1f2937;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
}

.form-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
}

.form-actions {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
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

.btn-secondary:hover {
  background: #4b5563;
}

.btn-outline {
  background: white;
  color: #3b82f6;
  border: 1px solid #3b82f6;
}

.btn-outline:hover {
  background: #3b82f6;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.migration-progress {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-header h4 {
  margin: 0;
  color: #1f2937;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
  transition: width 0.3s ease-in-out;
}

.migration-result {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.result-stats {
  margin-bottom: 1rem;
}

.migration-log {
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.log-status {
  font-size: 1.2rem;
}

.log-reason {
  color: #6b7280;
  font-size: 0.875rem;
}

.log-more {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.5rem;
}
</style> 