<template>
  <div class="watchlist-widget">
    <!-- 待看名单按钮 -->
    <button @click="toggleWatchlist" class="watchlist-toggle" :class="{ active: isOpen }" title="待看名单">
      <svg viewBox="0 0 24 24" fill="currentColor" class="watchlist-icon">
        <path
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
      <div v-if="itemCount > 0" class="item-count">{{ itemCount }}</div>
    </button>

    <!-- 添加当前页面按钮 -->
    <button @click="addCurrentPage" class="add-current-toggle"
      :class="{ added: isCurrentPageAdded, loading: addLoading }" :disabled="addLoading" title="添加当前页面到待看名单">
      <svg v-if="!addLoading" viewBox="0 0 24 24" fill="currentColor" class="add-icon">
        <path v-if="!isCurrentPageAdded" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        <path v-else d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" class="loading-icon">
        <path
          d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
      </svg>
    </button>

    <!-- 待看名单面板 -->
    <div v-if="isOpen" class="watchlist-panel">
      <div class="watchlist-header">
        <h3>待看名单</h3>
        <div class="header-actions">
          <span class="item-count-text">{{ itemCount }} 项</span>
          <button @click="showAddModal" class="add-btn" title="手动添加">
            <svg viewBox="0 0 24 24" fill="currentColor" class="add-icon">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
          <button @click="toggleWatchlist" class="close-btn" title="关闭">
            <svg viewBox="0 0 24 24" fill="currentColor" class="close-icon">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      <div class="watchlist-content">
        <div v-if="loading && items.length === 0" class="loading">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="error" class="error">
          <svg viewBox="0 0 24 24" fill="currentColor" class="error-icon">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <span>{{ error }}</span>
          <button @click="fetchItems" class="retry-btn">重试</button>
        </div>

        <div v-else-if="items.length === 0" class="empty">
          <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
            <path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          <span>暂无待看项目</span>
          <p>点击右侧的 + 按钮添加当前页面</p>
        </div>

        <div v-else class="items-list">
          <div v-for="item in items" :key="item.id" class="watchlist-item" :class="{ current: isCurrentUrl(item.url) }">
            <div class="item-main" @click="navigateToItem(item)">
              <div class="item-title" :title="item.title">{{ item.title }}</div>
              <div class="item-url" :title="item.url">{{ formatUrl(item.url) }}</div>
              <div class="item-time">{{ formatTime(item.createdAt) }}</div>
            </div>

            <div class="item-actions">
              <button @click="editItem(item)" class="action-btn edit-btn" title="编辑">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>
              <button @click="deleteItemById(item.id)" class="action-btn delete-btn" title="删除">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <div v-if="editingItem" class="edit-modal-overlay" @click.self="cancelEdit">
      <div class="edit-modal" @click.stop>
        <div class="modal-header">
          <h4>编辑待看项目</h4>
          <button @click="cancelEdit" class="close-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div class="modal-content">
          <div class="form-group">
            <label>标题</label>
            <input v-model="editTitle" type="text" class="form-input" placeholder="请输入标题" @keyup.enter="saveEdit">
          </div>
          <div class="form-group">
            <label>URL</label>
            <input :value="editingItem.url" type="text" class="form-input" readonly disabled>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="cancelEdit" class="btn btn-secondary">取消</button>
          <button @click="saveEdit" class="btn btn-primary" :disabled="!editTitle.trim()">保存</button>
        </div>
      </div>
    </div>

    <!-- 手动添加对话框 -->
    <div v-if="showingAddModal" class="edit-modal-overlay" @click.self="cancelAdd">
      <div class="edit-modal" @click.stop>
        <div class="modal-header">
          <h4>添加待看项目</h4>
          <button @click="cancelAdd" class="close-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div class="modal-content">
          <!-- 添加模式选择 -->
          <div class="form-group">
            <label>添加模式</label>
            <div class="mode-selector">
              <button @click="addMode = 'single'" :class="['mode-btn', { active: addMode === 'single' }]" type="button">
                单个添加
              </button>
              <button @click="addMode = 'batch'" :class="['mode-btn', { active: addMode === 'batch' }]" type="button">
                批量添加
              </button>
            </div>
          </div>

          <!-- 单个添加模式 -->
          <template v-if="addMode === 'single'">
            <div class="form-group">
              <label>标题</label>
              <input v-model="addTitle" type="text" class="form-input" placeholder="请输入标题（可选，留空则自动生成）"
                @keyup.enter="saveAdd">
            </div>
            <div class="form-group">
              <label>URL或路由路径</label>
              <input v-model="addUrl" type="text" class="form-input"
                placeholder="例如: /artist/12345?page=2 或 http://localhost:3001/artwork/98765" @keyup.enter="saveAdd">
              <small class="form-help">
                支持完整URL或相对路径，如：/artist/12345、/search?keyword=插画 等
              </small>
            </div>
            <div class="form-group">
              <label>快速添加</label>
              <div class="quick-add-buttons">
                <button @click="fillQuickAdd('/search', '搜索页面')" class="quick-btn" type="button">搜索页面</button>
                <button @click="fillQuickAdd('/ranking', '排行榜')" class="quick-btn" type="button">排行榜</button>
                <button @click="fillQuickAdd('/bookmarks', '我的收藏')" class="quick-btn" type="button">我的收藏</button>
                <button @click="fillQuickAdd('/artists', '作者管理')" class="quick-btn" type="button">作者管理</button>
              </div>
            </div>
          </template>

          <!-- 批量添加模式 -->
          <template v-else>
            <div class="form-group">
              <label>批量URL列表</label>
              <textarea v-model="batchUrls" class="form-textarea" rows="8" placeholder="请输入多个URL，每行一个，例如：
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
                <input type="checkbox" v-model="autoGenerateTitle" class="form-checkbox">
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
          <button @click="cancelAdd" class="btn btn-secondary">取消</button>
          <button @click="saveAdd" class="btn btn-primary"
            :disabled="addMode === 'single' ? !addUrl.trim() : parsedUrls.filter(item => !item.isDuplicate).length === 0">
            {{addMode === 'single' ? '添加' : `批量添加 (${parsedUrls.filter(item => !item.isDuplicate).length} 个)`}}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWatchlistStore } from '@/stores/watchlist';
import type { WatchlistItem } from '@/services/watchlist';

// 状态
const isOpen = ref(false);
const addLoading = ref(false);
const editingItem = ref<WatchlistItem | null>(null);
const editTitle = ref('');
const showingAddModal = ref(false);
const addTitle = ref('');
const addUrl = ref('');
const addMode = ref<'single' | 'batch'>('single');
const batchUrls = ref('');
const autoGenerateTitle = ref(true);

// Store和Router
const watchlistStore = useWatchlistStore();
const route = useRoute();
const router = useRouter();

// 计算属性
const items = computed(() => watchlistStore.items);
const itemCount = computed(() => watchlistStore.itemCount);
const loading = computed(() => watchlistStore.loading);
const error = computed(() => watchlistStore.error);

// 获取当前页面完整URL
const getCurrentPageUrl = () => {
  return window.location.href;
};

// 检查当前页面是否已添加
const isCurrentPageAdded = computed(() => {
  const currentUrl = getCurrentPageUrl();
  return watchlistStore.hasUrl(currentUrl);
});

// 检查是否为当前URL
const isCurrentUrl = (url: string) => {
  const currentUrl = getCurrentPageUrl();

  // 直接比较完整URL
  if (currentUrl === url) {
    return true;
  }

  // 比较路径部分
  try {
    const currentUrlObj = new URL(currentUrl);
    const currentPath = currentUrlObj.pathname + currentUrlObj.search;

    // 如果是完整URL，提取路径部分比较
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname + urlObj.search;
      return currentPath === urlPath;
    }

    // 如果是相对路径，直接比较
    let relativePath = url;
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath;
    }

    return currentPath === relativePath;
  } catch {
    return false;
  }
};

// 解析批量URL
const parsedUrls = computed(() => {
  if (!batchUrls.value.trim()) return [];

  const lines = batchUrls.value.split('\n');
  const validUrls: Array<{ path: string; fullUrl: string; isDuplicate: boolean }> = [];
  const seenPaths = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      let fullUrl = trimmed;
      let path = '';

      // 处理完整URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const urlObj = new URL(trimmed);
        path = urlObj.pathname + urlObj.search;
        fullUrl = trimmed;
      } else {
        // 处理相对路径
        path = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
        fullUrl = window.location.origin + path;
      }

      // 检查是否重复（在当前输入中）
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);

      // 检查是否已存在于待看名单中
      const isDuplicate = watchlistStore.hasUrl(fullUrl);

      validUrls.push({ path, fullUrl, isDuplicate });
    } catch (error) {
      // 忽略无效的URL
      continue;
    }
  }

  return validUrls;
});

// 方法
const toggleWatchlist = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    fetchItems();
  }
};

const fetchItems = async () => {
  await watchlistStore.fetchItems();
};

const addCurrentPage = async () => {
  if (addLoading.value || isCurrentPageAdded.value) return;

  addLoading.value = true;
  const currentUrl = getCurrentPageUrl();

  try {
    const success = await watchlistStore.addItem({ url: currentUrl });
    if (success) {
      // 可以添加一个成功提示
      console.log('页面已添加到待看名单');
    }
  } finally {
    addLoading.value = false;
  }
};

const navigateToItem = (item: WatchlistItem) => {
  // 支持相对路径和完整URL
  try {
    let targetPath = item.url;

    // 如果是完整URL，提取路径部分
    if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
      const url = new URL(item.url);
      targetPath = url.pathname + url.search + url.hash;
    }

    // 确保路径以 / 开头
    if (!targetPath.startsWith('/')) {
      targetPath = '/' + targetPath;
    }

    router.push(targetPath);
    isOpen.value = false;
  } catch (error) {
    console.error('导航失败:', item.url, error);
    // 如果路由导航失败，尝试直接打开URL
    try {
      window.open(item.url, '_self');
    } catch (openError) {
      console.error('无法打开URL:', item.url, openError);
    }
  }
};

const editItem = (item: WatchlistItem) => {
  editingItem.value = item;
  editTitle.value = item.title;
};

const cancelEdit = () => {
  editingItem.value = null;
  editTitle.value = '';
};

const saveEdit = async () => {
  if (!editingItem.value || !editTitle.value.trim()) return;

  const success = await watchlistStore.updateItem(editingItem.value.id, {
    title: editTitle.value.trim()
  });

  if (success) {
    cancelEdit();
  }
};

const deleteItemById = async (id: string) => {
  if (confirm('确定要删除这个待看项目吗？')) {
    await watchlistStore.deleteItem(id);
  }
};

// 手动添加相关方法
const showAddModal = () => {
  showingAddModal.value = true;
  addTitle.value = '';
  addUrl.value = '';
  batchUrls.value = '';
  addMode.value = 'single';
  autoGenerateTitle.value = true;
};

const cancelAdd = () => {
  showingAddModal.value = false;
  addTitle.value = '';
  addUrl.value = '';
  batchUrls.value = '';
  addMode.value = 'single';
  autoGenerateTitle.value = true;
};

const fillQuickAdd = (path: string, title: string) => {
  addUrl.value = path;
  addTitle.value = title;
};

const saveAdd = async () => {
  if (addMode.value === 'single') {
    // 单个添加模式
    if (!addUrl.value.trim()) return;

    let finalUrl = addUrl.value.trim();

    // 如果是相对路径，转换为完整URL
    if (finalUrl.startsWith('/')) {
      finalUrl = window.location.origin + finalUrl;
    } else if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      // 如果不是完整URL且不以/开头，添加前缀
      finalUrl = window.location.origin + '/' + finalUrl;
    }

    const params: any = { url: finalUrl };
    if (addTitle.value.trim()) {
      params.title = addTitle.value.trim();
    }

    const success = await watchlistStore.addItem(params);
    if (success) {
      cancelAdd();
    }
  } else {
    // 批量添加模式
    const urlsToAdd = parsedUrls.value.filter(item => !item.isDuplicate);
    if (urlsToAdd.length === 0) return;

    // 依次添加每个URL
    let successCount = 0;
    for (const urlItem of urlsToAdd) {
      const params: any = { url: urlItem.fullUrl };

      // 如果启用自动生成标题，不传title让后端生成
      if (!autoGenerateTitle.value) {
        params.title = `页面 ${successCount + 1}`;
      }

      const success = await watchlistStore.addItem(params);
      if (success) {
        successCount++;
      }
    }

    if (successCount > 0) {
      cancelAdd();
      console.log(`成功添加 ${successCount} 个项目`);
    }
  }
};

// 格式化URL显示
const formatUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    let display = urlObj.pathname + urlObj.search;

    // 移除开头的斜杠使显示更清晰
    if (display.startsWith('/')) {
      display = display.substring(1);
    }

    // 如果是首页，显示特殊标记
    if (!display || display === '/') {
      return '首页';
    }

    return display;
  } catch {
    // 如果不是完整URL，直接返回
    return url.startsWith('/') ? url.substring(1) : url;
  }
};

// 格式化时间显示
const formatTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString('zh-CN');
  } catch {
    return '未知时间';
  }
};

// 组件挂载时获取数据
onMounted(() => {
  fetchItems();
});

// 监听路由变化，更新当前页面状态
watch(() => route.fullPath, () => {
  // 路由变化时可能需要更新当前页面的状态
});
</script>

<style scoped>
.watchlist-widget {
  position: fixed;
  top: 4.5rem;
  left: 1rem;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 按钮样式 */
.watchlist-toggle,
.add-current-toggle {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid #e5e7eb;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.watchlist-toggle:hover,
.add-current-toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.watchlist-toggle.active {
  border-color: #3b82f6;
  color: #3b82f6;
}

.add-current-toggle.added {
  border-color: #10b981;
  color: #10b981;
}

.add-current-toggle.loading {
  border-color: #f59e0b;
  color: #f59e0b;
}

.add-current-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.watchlist-icon,
.add-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.loading-icon {
  width: 1.5rem;
  height: 1.5rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.item-count {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  width: 1.2rem;
  height: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
}

/* 面板样式 */
.watchlist-panel {
  position: absolute;
  top: 0;
  left: 4rem;
  width: 24rem;
  max-height: 32rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.watchlist-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
}

.watchlist-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item-count-text {
  font-size: 0.875rem;
  color: #6b7280;
}

.close-btn,
.add-btn {
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.close-btn:hover,
.add-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.add-btn:hover {
  color: #3b82f6;
}

.close-icon {
  width: 1rem;
  height: 1rem;
}

/* 内容样式 */
.watchlist-content {
  max-height: 28rem;
  overflow-y: auto;
}

.loading,
.error,
.empty {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  text-align: center;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-icon,
.empty-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: #9ca3af;
}

.retry-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.retry-btn:hover {
  background: #2563eb;
}

/* 项目列表样式 */
.items-list {
  padding: 0.5rem;
}

.watchlist-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.2s;
  border: 1px solid transparent;
  margin-bottom: 0.25rem;
}

.watchlist-item:hover {
  background: #f8fafc;
  border-color: #e5e7eb;
}

.watchlist-item.current {
  background: #eff6ff;
  border-color: #3b82f6;
}

.item-main {
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.item-title {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-url {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-time {
  font-size: 0.7rem;
  color: #9ca3af;
}

.item-actions {
  display: flex;
  gap: 0.25rem;
  margin-left: 0.5rem;
}

.action-btn {
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.action-btn svg {
  width: 0.875rem;
  height: 0.875rem;
}

.edit-btn {
  color: #6b7280;
}

.edit-btn:hover {
  background: #f3f4f6;
  color: #3b82f6;
}

.delete-btn {
  color: #6b7280;
}

.delete-btn:hover {
  background: #fef2f2;
  color: #ef4444;
}

/* 编辑模态框样式 */
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
  z-index: 2000;
}

.edit-modal {
  background: white;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.modal-content {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.modal-actions {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 表单帮助文本样式 */
.form-help {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.4;
}

/* 快速添加按钮样式 */
.quick-add-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.quick-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

/* 模式选择器样式 */
.mode-selector {
  display: flex;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  overflow: hidden;
}

.mode-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.mode-btn:first-child {
  border-right: 1px solid #d1d5db;
}

.mode-btn:hover {
  background: #f9fafb;
}

.mode-btn.active {
  background: #3b82f6;
  color: white;
}

/* 文本域样式 */
.form-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: monospace;
  line-height: 1.4;
  resize: vertical;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 复选框样式 */
.form-checkbox {
  margin-right: 0.5rem;
  accent-color: #3b82f6;
}

/* 预览列表样式 */
.preview-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: #f9fafb;
}

.preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.875rem;
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-url {
  flex: 1;
  font-family: monospace;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-status {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.preview-status.new {
  background: #dcfce7;
  color: #166534;
}

.preview-status.duplicate {
  background: #fef3c7;
  color: #92400e;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .watchlist-widget {
    left: 0.5rem;
  }

  .watchlist-panel {
    width: calc(100vw - 5rem);
    max-width: 20rem;
  }
}
</style>