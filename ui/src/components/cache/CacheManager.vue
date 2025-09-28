<template>
  <div class="cache-manager">
    <div class="cache-header">
      <h3>图片缓存管理</h3>
      <div class="cache-actions">
        <button @click="refreshStats" class="btn btn-secondary" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
        <button @click="clearExpiredCache" class="btn btn-warning" :disabled="loading">
          清理过期缓存
        </button>
        <button @click="clearAllCache" class="btn btn-danger" :disabled="loading">
          清理所有缓存
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="stats" class="cache-stats">
      <div class="stat-item">
        <div class="stat-label">缓存文件数</div>
        <div class="stat-value">{{ stats.fileCount }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">缓存大小</div>
        <div class="stat-value">{{ formatFileSize(stats.totalSize) }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">最大缓存大小</div>
        <div class="stat-value">{{ formatFileSize(stats.maxSize) }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">缓存有效期</div>
        <div class="stat-value">{{ formatDuration(stats.maxAge) }}</div>
      </div>
      
      <div class="stat-item">
        <div class="stat-label">使用率</div>
        <div class="stat-value">
          <div class="usage-bar">
            <div 
              class="usage-fill" 
              :style="{ width: `${usagePercentage}%` }"
              :class="{ 'usage-high': usagePercentage > 80 }"
            ></div>
          </div>
          <span class="usage-text">{{ usagePercentage.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <div v-if="loading && !stats" class="loading">
      加载缓存信息中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import apiService from '@/services/api';

interface CacheStats {
  fileCount: number;
  totalSize: number;
  maxSize: number;
  maxAge: number;
}

const stats = ref<CacheStats | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// 计算使用率百分比
const usagePercentage = computed(() => {
  if (!stats.value) return 0;
  return (stats.value.totalSize / stats.value.maxSize) * 100;
});

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化持续时间
const formatDuration = (milliseconds: number): string => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} 天`;
  } else if (hours > 0) {
    return `${hours} 小时`;
  } else {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    return `${minutes} 分钟`;
  }
};

// 获取缓存统计信息
const fetchCacheStats = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const response = await apiService.get<CacheStats>('/api/proxy/cache/stats');
    
    if (response.success && response.data) {
      stats.value = response.data;
    } else {
      throw new Error(response.error || '获取缓存统计失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取缓存统计失败';
    console.error('获取缓存统计失败:', err);
  } finally {
    loading.value = false;
  }
};

// 刷新统计信息
const refreshStats = () => {
  fetchCacheStats();
};

// 清理过期缓存
const clearExpiredCache = async () => {
  if (!confirm('确定要清理过期的缓存文件吗？')) return;
  
  try {
    loading.value = true;
    error.value = null;
    
    const response = await apiService.delete('/api/proxy/cache/expired');
    
    if (response.success) {
      alert('过期缓存已清理');
      await fetchCacheStats(); // 刷新统计信息
    } else {
      throw new Error(response.error || '清理过期缓存失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '清理过期缓存失败';
    console.error('清理过期缓存失败:', err);
  } finally {
    loading.value = false;
  }
};

// 清理所有缓存
const clearAllCache = async () => {
  if (!confirm('确定要清理所有缓存文件吗？这将删除所有缓存的图片。')) return;
  
  try {
    loading.value = true;
    error.value = null;
    
    const response = await apiService.delete('/api/proxy/cache');
    
    if (response.success) {
      alert('所有缓存已清理');
      await fetchCacheStats(); // 刷新统计信息
    } else {
      throw new Error(response.error || '清理所有缓存失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '清理所有缓存失败';
    console.error('清理所有缓存失败:', err);
  } finally {
    loading.value = false;
  }
};

// 组件挂载时获取统计信息
onMounted(() => {
  fetchCacheStats();
});
</script>

<style scoped>
.cache-manager {
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
}

.cache-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
}

.cache-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.cache-actions {
  display: flex;
  gap: var(--spacing-md);
}

.error-message {
  background: var(--color-danger-light);
  color: var(--color-danger-dark);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
  border: 1px solid var(--color-danger);
}

.cache-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.stat-item {
  background: var(--color-bg-secondary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
  font-weight: 500;
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.usage-bar {
  flex: 1;
  height: 0.5rem;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: var(--color-success);
  transition: width 0.3s ease;
}

.usage-fill.usage-high {
  background: var(--color-danger);
}

.usage-text {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  min-width: 3rem;
  text-align: right;
}

.loading {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-2xl);
}

@media (max-width: 768px) {
  .cache-header {
    flex-direction: column;
    gap: var(--spacing-lg);
    align-items: stretch;
  }

  .cache-actions {
    flex-direction: column;
  }

  .cache-stats {
    grid-template-columns: 1fr;
  }
}
</style>