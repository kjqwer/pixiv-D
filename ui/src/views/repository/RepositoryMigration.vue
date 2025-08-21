<template>
  <div class="migrate-section">
    <h3>数据迁移</h3>
    <p class="migrate-description">
      将旧项目中的作品文件迁移到当前仓库中。系统会自动识别作品ID并避免重复迁移。
    </p>
    
    <div class="migrate-form">
      <div class="form-group">
        <label>源目录路径</label>
        <div class="path-input-group">
          <input 
            v-model="migrateSourceDir" 
            type="text" 
            placeholder="选择要迁移的目录路径，例如: D:\old-downloads"
            class="form-input"
          />
          <button type="button" @click="selectMigrateDir" class="btn btn-secondary">
            选择目录
          </button>
          <button type="button" @click="testMigrateDir" class="btn btn-outline">
            测试
          </button>
        </div>
        <small class="form-help">
          <strong>迁移说明：</strong><br>
          • 选择要迁移的源目录，系统会将整个目录结构移动到目标位置<br>
          • 如果目标位置已存在同名目录，将跳过迁移<br>
          • 迁移完成后，源文件会被移动到新位置（移动操作）
        </small>
      </div>
      <div class="form-actions">
        <button 
          @click="startMigration" 
          class="btn btn-primary" 
          :disabled="migrating"
        >
          {{ migrating ? '迁移中...' : '开始迁移' }}
        </button>
      </div>
    </div>

    <!-- 迁移结果 -->
    <div v-if="migrationResult" class="migration-result">
      <h4>迁移结果</h4>
      <div class="result-stats">
        <p>成功迁移: {{ migrationResult.totalMigrated }} 个作品</p>
        <p>跳过: {{ migrationResult.log.filter((item: any) => item.status === 'skipped').length }} 个作品</p>
      </div>
      <div class="migration-log">
        <h5>详细日志</h5>
        <div 
          v-for="(item, index) in migrationResult.log" 
          :key="index"
          class="log-item"
          :class="(item as any).status"
        >
          <span class="log-status">{{ (item as any).status === 'success' ? '✅' : '⏭️' }}</span>
          <span class="log-text">{{ (item as any).title }} (ID: {{ (item as any).id }})</span>
          <span v-if="(item as any).reason" class="log-reason">{{ (item as any).reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  migrating: boolean
  migrationResult: any
}

interface Emits {
  (e: 'update:migrateSourceDir', dir: string): void
  (e: 'select-migrate-dir'): void
  (e: 'test-migrate-dir'): void
  (e: 'start-migration'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const migrateSourceDir = ref('')

// 选择迁移目录
const selectMigrateDir = () => {
  emit('select-migrate-dir')
}

// 测试迁移目录
const testMigrateDir = () => {
  emit('test-migrate-dir')
}

// 开始迁移
const startMigration = () => {
  emit('start-migration')
}
</script>

<style scoped>
.migrate-section h3 {
  margin: 0 0 1.5rem 0;
  color: #1f2937;
}

.migrate-description {
  color: #6b7280;
  margin-bottom: 2rem;
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

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.form-input:focus {
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

.form-actions {
  margin-top: 2rem;
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
</style> 