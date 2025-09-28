<template>
  <div v-if="visible" class="edit-modal-overlay" @click.self="$emit('cancel')">
    <div class="edit-modal" @click.stop>
      <div class="modal-header">
        <h4>添加待看项目</h4>
        <button @click="$emit('cancel')" class="close-btn">
          <SvgIcon name="close" class="close-icon" />
        </button>
      </div>
      <div class="modal-content">
        <!-- 添加模式选择 -->
        <div class="form-group">
          <label>添加模式</label>
          <div class="mode-selector">
            <button @click="$emit('update:mode', 'single')" :class="['mode-btn', { active: mode === 'single' }]"
              type="button">
              单个添加
            </button>
            <button @click="$emit('update:mode', 'batch')" :class="['mode-btn', { active: mode === 'batch' }]"
              type="button">
              批量添加
            </button>
          </div>
        </div>

        <!-- 单个添加模式 -->
        <template v-if="mode === 'single'">
          <div class="form-group">
            <label>标题</label>
            <input :value="title" @input="$emit('update:title', ($event.target as HTMLInputElement).value)" type="text"
              class="form-input" placeholder="请输入标题（可选，留空则自动生成）" @keyup.enter="handleSave">
          </div>
          <div class="form-group">
            <label>URL或路由路径</label>
            <input :value="url" @input="$emit('update:url', ($event.target as HTMLInputElement).value)" type="text"
              class="form-input" placeholder="例如: /artist/12345?page=2 或 http://localhost:3001/artwork/98765"
              @keyup.enter="handleSave">
            <small class="form-help">
              支持完整URL或相对路径，如：/artist/12345、/search?keyword=插画 等
            </small>
          </div>
          <div class="form-group">
            <label>快速添加</label>
            <div class="quick-add-buttons">
              <button @click="$emit('quickAdd', '/search', '搜索页面')" class="quick-btn" type="button">搜索页面</button>
              <button @click="$emit('quickAdd', '/ranking', '排行榜')" class="quick-btn" type="button">排行榜</button>
              <button @click="$emit('quickAdd', '/bookmarks', '我的收藏')" class="quick-btn" type="button">我的收藏</button>
              <button @click="$emit('quickAdd', '/artists', '作者管理')" class="quick-btn" type="button">作者管理</button>
            </div>
          </div>
        </template>

        <!-- 批量添加模式 -->
        <template v-else>
          <div class="form-group">
            <label>批量URL列表</label>
            <textarea :value="batchUrls"
              @input="$emit('update:batchUrls', ($event.target as HTMLTextAreaElement).value)" class="form-textarea"
              rows="8" placeholder="请输入多个URL，每行一个，例如：
http://localhost:3001/artist/72143697
http://localhost:3001/artist/103047332
/artist/113088709
/artwork/98765?page=2

支持完整URL和相对路径混合输入"></textarea>
            <small class="form-help">
              每行一个URL，支持完整URL和相对路径，自动提取路径并去重
            </small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" :checked="autoGenerateTitle"
                @change="$emit('update:autoGenerateTitle', ($event.target as HTMLInputElement).checked)"
                class="form-checkbox">
              自动生成标题
            </label>
            <small class="form-help">
              勾选后将自动为每个URL生成合适的标题
            </small>
          </div>
          <div v-if="parsedUrls.length > 0" class="form-group">
            <label>预览 ({{ parsedUrls.length }} 个有效URL，已去重)</label>
            <div class="preview-list">
              <div v-for="(item, index) in parsedUrls" :key="index" class="preview-item">
                <div class="preview-url">{{ item.path }}</div>
                <div v-if="item.isDuplicate" class="preview-status duplicate">已存在</div>
                <div v-else class="preview-status new">新增</div>
              </div>
            </div>
          </div>
        </template>
      </div>
      <div class="modal-actions">
        <button @click="$emit('cancel')" class="btn btn-secondary">取消</button>
        <button @click="handleSave" class="btn btn-primary"
          :disabled="mode === 'single' ? !url.trim() : parsedUrls.filter(item => !item.isDuplicate).length === 0">
          {{mode === 'single' ? '添加' : `批量添加 (${parsedUrls.filter(item => !item.isDuplicate).length} 个)`}}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ParsedUrl {
  path: string;
  fullUrl: string;
  isDuplicate: boolean;
}

interface Props {
  visible: boolean;
  mode: 'single' | 'batch';
  title: string;
  url: string;
  batchUrls: string;
  autoGenerateTitle: boolean;
  parsedUrls: ParsedUrl[];
}

defineProps<Props>();

const emit = defineEmits<{
  cancel: [];
  save: [];
  'update:mode': [value: 'single' | 'batch'];
  'update:title': [value: string];
  'update:url': [value: string];
  'update:batchUrls': [value: string];
  'update:autoGenerateTitle': [value: boolean];
  quickAdd: [path: string, title: string];
}>();

const handleSave = () => {
  emit('save');
};
</script>

<style scoped>
.edit-modal-overlay {
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

.edit-modal {
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
}

.modal-header h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
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
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.close-icon {
  width: 16px;
  height: 16px;
}

.modal-content {
  padding: 24px;
  max-height: calc(90vh - 140px);
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
  font-family: inherit;
}

.form-input {
  height: 40px;
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--color-text-tertiary);
}

.form-help {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.form-checkbox {
  margin-right: 8px;
}

.mode-selector {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.mode-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.quick-add-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
}

.quick-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.quick-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.preview-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
}

.preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-url {
  flex: 1;
  font-size: 12px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}

.preview-status.new {
  background: var(--color-success);
  color: white;
}

.preview-status.duplicate {
  background: var(--color-warning);
  color: white;
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .edit-modal {
    width: 95%;
    margin: 20px;
  }

  .modal-header,
  .modal-content,
  .modal-actions {
    padding-left: 16px;
    padding-right: 16px;
  }

  .modal-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .quick-add-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>