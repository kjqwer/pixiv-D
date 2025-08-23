<template>
  <div class="ranking-header">
    <div class="ranking-info">
      <div class="ranking-title">
        <h1 class="title">排行榜</h1>
        <p class="subtitle">发现最受欢迎的作品</p>
      </div>
      
      <div class="ranking-controls">
        <!-- 时间模式切换 -->
        <div class="mode-selector">
          <label class="control-label">时间范围:</label>
          <div class="mode-buttons">
            <button 
              @click="$emit('mode-change', 'day')"
              class="mode-btn"
              :class="{ active: currentMode === 'day' }"
            >
              日榜
            </button>
            <button 
              @click="$emit('mode-change', 'week')"
              class="mode-btn"
              :class="{ active: currentMode === 'week' }"
            >
              周榜
            </button>
            <button 
              @click="$emit('mode-change', 'month')"
              class="mode-btn"
              :class="{ active: currentMode === 'month' }"
            >
              月榜
            </button>
          </div>
        </div>

        <!-- 作品类型筛选 -->
        <div class="type-selector">
          <label class="control-label">作品类型:</label>
          <select 
            :value="currentType" 
            @change="(e) => $emit('type-change', (e.target as HTMLSelectElement).value as 'art' | 'manga' | 'novel')"
            class="type-select"
          >
            <option value="art">插画</option>
            <option value="manga">漫画</option>
            <option value="novel">小说</option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="ranking-actions">
      <div class="download-section">
        <div class="download-input-group">
          <label for="downloadLimit">下载数量:</label>
          <input 
            v-model="downloadLimit"
            type="number"
            id="downloadLimit"
            class="download-input"
            min="1"
            max="9999"
            placeholder="输入数量"
          />
        </div>
        <button @click="handleDownloadAll" class="btn btn-secondary" :disabled="downloading">
          {{ downloading ? '下载中...' : '下载作品' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import downloadService from '@/services/download';

interface Props {
  currentMode: 'day' | 'week' | 'month';
  currentType: 'art' | 'manga' | 'novel';
}

interface Emits {
  (e: 'mode-change', mode: 'day' | 'week' | 'month'): void;
  (e: 'type-change', type: 'art' | 'manga' | 'novel'): void;
  (e: 'download-success', message: string): void;
  (e: 'download-error', error: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 下载相关状态
const downloadLimit = ref('50');
const downloading = ref(false);

// 下载作品
const handleDownloadAll = async () => {
  const limit = parseInt(downloadLimit.value);
  if (isNaN(limit) || limit < 1) {
    emit('download-error', '请输入有效的下载数量');
    return;
  }

  try {
    downloading.value = true;
    const response = await downloadService.downloadRankingArtworks({
      mode: props.currentMode,
      type: props.currentType,
      limit: limit
    });
    
    if (response.success) {
      console.log('下载任务已创建:', response.data);
      const limitText = limit >= 9999 ? '全部' : limit.toString();
      emit('download-success', `下载任务已创建，将下载 ${limitText} 个作品`);
    } else {
      throw new Error(response.error || '下载失败');
    }
  } catch (err) {
    emit('download-error', err instanceof Error ? err.message : '下载失败');
    console.error('下载失败:', err);
  } finally {
    downloading.value = false;
  }
};
</script>

<style scoped>
.ranking-header {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.ranking-info {
  flex: 1;
}

.ranking-title {
  margin-bottom: 1.5rem;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #6b7280;
  font-size: 1.125rem;
  margin: 0;
}

.ranking-controls {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.mode-selector,
.type-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
}

.mode-buttons {
  display: flex;
  gap: 0.25rem;
}

.mode-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 0.375rem;
}

.mode-btn:first-child {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.mode-btn:last-child {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.mode-btn:not(:first-child):not(:last-child) {
  border-radius: 0;
}

.mode-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.mode-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.type-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
  min-width: 100px;
}

.ranking-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.download-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.download-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.download-input-group label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
}

.download-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
  color: #374151;
  min-width: 120px;
}

.download-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

@media (max-width: 768px) {
  .ranking-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .ranking-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .mode-selector,
  .type-selector {
    justify-content: space-between;
  }
  
  .download-section {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }
  
  .download-input-group {
    flex-shrink: 0;
  }
  
  .btn {
    flex: 1;
  }
}
</style> 