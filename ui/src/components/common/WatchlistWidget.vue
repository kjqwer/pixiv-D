<template>
  <div class="watchlist-widget">
    <!-- 待看名单按钮 -->
    <button @click="toggleWatchlist" class="watchlist-toggle" :class="{ active: isOpen }" title="待看名单">
      <SvgIcon name="watchlist" class="watchlist-icon" />
      <div v-if="itemCount > 0" class="item-count">{{ itemCount }}</div>
    </button>

    <!-- 添加当前页面按钮 -->
    <button @click="addOrUpdateCurrentPage" class="add-current-toggle" :class="{
      added: isCurrentPageAdded,
      loading: addLoading,
      update: hasSameAuthorDifferentPage && !isCurrentPageAdded
    }" :disabled="addLoading" :title="getAddButtonTitle()">
      <!-- 加载状态：显示加载图标 -->
      <SvgIcon v-if="addLoading" name="loading" class="loading-icon" />
      <!-- 非加载状态：根据条件显示不同图标 -->
      <template v-else>
        <!-- 已添加：显示勾选图标 -->
        <SvgIcon v-if="isCurrentPageAdded" name="success" class="add-icon" />
        <!-- 更新模式：显示更新图标 -->
        <SvgIcon v-else-if="hasSameAuthorDifferentPage" name="watchlist-update" class="add-icon" />
        <!-- 添加模式：显示加号图标 -->
        <SvgIcon v-else name="add" class="add-icon" />
      </template>
    </button>

    <!-- 待看名单面板 -->
    <div v-if="isOpen" class="watchlist-panel">
      <div class="watchlist-header">
        <h3>待看名单</h3>
        <div class="header-actions">
          <span class="item-count-text">{{ itemCount }} 项</span>
          <button @click="showAddModal" class="add-btn" title="手动添加">
            <SvgIcon name="add" class="add-icon" />
          </button>
          <button @click="toggleWatchlist" class="close-btn" title="关闭">
            <SvgIcon name="close" class="close-icon" />
          </button>
        </div>
      </div>

      <!-- 搜索和排序控制区域 -->
      <div class="watchlist-controls">
        <div class="search-box">
          <SvgIcon name="search" class="search-icon" />
          <input v-model="searchQuery" type="text" placeholder="搜索标题或URL..." class="search-input" />
          <button v-if="searchQuery" @click="clearSearch" class="clear-search-btn" title="清除搜索">
            <SvgIcon name="close" class="close-icon" />
          </button>
        </div>
        <div class="sort-controls">
          <button @click="toggleSortOrder" class="sort-btn" :title="sortOrder === 'desc' ? '切换为升序' : '切换为降序'">
            <SvgIcon v-if="sortOrder === 'desc'" name="sort-desc" class="sort-icon" />
            <SvgIcon v-else name="sort-asc" class="sort-icon" />
            <span class="sort-text">{{ sortOrder === 'desc' ? '最新' : '最旧' }}</span>
          </button>
        </div>
      </div>

      <div class="watchlist-content">
        <div v-if="loading && items.length === 0" class="loading">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="error" class="error">
          <SvgIcon name="bookmark-empty" class="error-icon" />
          <span>{{ error }}</span>
          <button @click="fetchItems" class="retry-btn">重试</button>
        </div>

        <div v-else-if="filteredAndSortedItems.length === 0 && searchQuery" class="empty">
          <SvgIcon name="search" class="empty-icon" />
          <span>没有找到匹配的项目</span>
          <p>尝试调整搜索词或清除搜索条件</p>
        </div>

        <div v-else-if="items.length === 0" class="empty">
          <SvgIcon name="empty" class="empty-icon" />
          <span>暂无待看项目</span>
          <p>点击右侧的 + 按钮添加当前页面</p>
        </div>

        <div v-else class="items-list">
          <div v-for="item in filteredAndSortedItems" :key="item.id" class="watchlist-item" :class="{
            current: isCurrentUrl(item.url),
            duplicate: isDuplicateAuthor(item),
            'pinned-artist': isPinnedCurrentArtist(item)
          }">
            <div class="item-main" @click="navigateToItem(item)">
              <div class="item-title" :title="item.title">
                {{ item.title }}
                <span v-if="isDuplicateAuthor(item)" class="duplicate-badge" title="该作者有多个页面">重复</span>
              </div>
              <div class="item-url" :title="item.url">{{ formatUrl(item.url) }}</div>
              <div class="item-time">{{ formatTime(item.createdAt) }}</div>
            </div>

            <div class="item-actions">
              <button @click="editItem(item)" class="action-btn edit-btn" title="编辑">
                <SvgIcon name="edit" class="edit-icon" />
              </button>
              <button @click="deleteItemById(item.id)" class="action-btn delete-btn" title="删除">
                <SvgIcon name="delete" class="delete-icon" />
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
            <SvgIcon name="close" class="close-icon" />
          </button>
        </div>
        <div class="modal-content">
          <div class="form-group">
            <label>标题</label>
            <input v-model="editTitle" type="text" class="form-input" placeholder="请输入标题" @keyup.enter="saveEdit">
          </div>
          <div class="form-group">
            <label>URL</label>
            <input v-model="editUrl" type="text" class="form-input" placeholder="请输入URL" @keyup.enter="saveEdit">
          </div>
        </div>
        <div class="modal-actions">
          <button @click="cancelEdit" class="btn btn-secondary">取消</button>
          <button @click="saveEdit" class="btn btn-primary" :disabled="!editTitle.trim() || !editUrl.trim()">保存</button>
        </div>
      </div>
    </div>

    <!-- 手动添加对话框 -->
    <div v-if="showingAddModal" class="edit-modal-overlay" @click.self="cancelAdd">
      <div class="edit-modal" @click.stop>
        <div class="modal-header">
          <h4>添加待看项目</h4>
          <button @click="cancelAdd" class="close-btn">
            <SvgIcon name="close" class="close-icon" />
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
const editUrl = ref('');
const showingAddModal = ref(false);
const addTitle = ref('');
const addUrl = ref('');
const addMode = ref<'single' | 'batch'>('single');
const batchUrls = ref('');
const autoGenerateTitle = ref(true);

// 搜索和排序
const searchQuery = ref('');
const sortOrder = ref<'asc' | 'desc'>('desc'); // 'desc' 表示最新，'asc' 表示最旧

// Store和Router
const watchlistStore = useWatchlistStore();
const route = useRoute();
const router = useRouter();

// 计算属性
const items = computed(() => watchlistStore.items);
const itemCount = computed(() => watchlistStore.itemCount);
const loading = computed(() => watchlistStore.loading);
const error = computed(() => watchlistStore.error);

// 过滤和排序后的待看项目
const filteredAndSortedItems = computed(() => {
  let filteredItems = [...items.value];

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filteredItems = filteredItems.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.url.toLowerCase().includes(query)
    );
  }

  // 获取当前页面的作者ID
  const currentAuthorId = watchlistStore.extractAuthorId(currentPageUrl.value);
  let pinnedItem: WatchlistItem | null = null;
  let otherItems: WatchlistItem[] = [];

  // 如果当前页面是artist页面，找到对应的待看项目进行置顶
  if (currentAuthorId) {
    const currentArtistItems = filteredItems.filter(item => {
      const itemAuthorId = watchlistStore.extractAuthorId(item.url);
      return itemAuthorId === currentAuthorId;
    });

    // 取第一个匹配的项目作为置顶项目
    if (currentArtistItems.length > 0) {
      pinnedItem = currentArtistItems[0];
      otherItems = filteredItems.filter(item => item.id !== pinnedItem!.id);
    } else {
      otherItems = filteredItems;
    }
  } else {
    otherItems = filteredItems;
  }

  // 对其他项目进行排序
  otherItems.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder.value === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // 返回置顶项目在前，其他项目在后的数组
  return pinnedItem ? [pinnedItem, ...otherItems] : otherItems;
});

// 获取当前页面完整URL
const getCurrentPageUrl = () => {
  return window.location.href;
};

// 当前页面URL的响应式变量
const currentPageUrl = ref(getCurrentPageUrl());

// 检查当前页面是否已添加
const isCurrentPageAdded = computed(() => {
  return watchlistStore.hasUrl(currentPageUrl.value);
});

// 检查是否有相同作者但不同页面的项目
const hasSameAuthorDifferentPage = computed(() => {
  if (isCurrentPageAdded.value) return false;

  const currentUrl = currentPageUrl.value;
  const sameAuthorItem = watchlistStore.findSameAuthor(currentUrl);
  return !!sameAuthorItem;
});

// 获取相同作者的项目
const sameAuthorItem = computed(() => {
  if (isCurrentPageAdded.value) return null;
  return watchlistStore.findSameAuthor(currentPageUrl.value);
});

// 获取添加按钮的标题
const getAddButtonTitle = () => {
  if (isCurrentPageAdded.value) {
    return '当前页面已在待看名单中';
  } else if (hasSameAuthorDifferentPage.value) {
    return '更新相同作者的页面';
  } else {
    return '添加当前页面到待看名单';
  }
};

// 检查是否为当前URL
const isCurrentUrl = (url: string) => {
  const currentUrl = currentPageUrl.value;

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
  // 数据加载完成后检查重复作者
  checkDuplicateAuthors();
};

const addOrUpdateCurrentPage = async () => {
  if (addLoading.value || isCurrentPageAdded.value) return;

  addLoading.value = true;
  const currentUrl = currentPageUrl.value;

  try {
    // 检查是否有相同作者的项目需要更新
    if (hasSameAuthorDifferentPage.value && sameAuthorItem.value) {
      // 更新现有项目的URL为当前页面
      const success = await watchlistStore.updateItem(sameAuthorItem.value.id, {
        url: currentUrl
      });
      if (success) {
        console.log('已更新相同作者的页面到当前页面');
      }
    } else {
      // 添加新项目
      const success = await watchlistStore.addItem({ url: currentUrl });
      if (success) {
        console.log('页面已添加到待看名单');
      }
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
  editUrl.value = item.url;
};

const cancelEdit = () => {
  editingItem.value = null;
  editTitle.value = '';
  editUrl.value = '';
};

const saveEdit = async () => {
  if (!editingItem.value || !editTitle.value.trim() || !editUrl.value.trim()) return;

  const success = await watchlistStore.updateItem(editingItem.value.id, {
    title: editTitle.value.trim(),
    url: editUrl.value.trim()
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

// 切换排序顺序
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
};

// 清除搜索
const clearSearch = () => {
  searchQuery.value = '';
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

// 检查重复作者的方法
const checkDuplicateAuthors = () => {
  const authorMap = new Map<string, WatchlistItem[]>();

  // 按作者ID分组
  items.value.forEach(item => {
    const authorId = watchlistStore.extractAuthorId(item.url);
    if (authorId) {
      if (!authorMap.has(authorId)) {
        authorMap.set(authorId, []);
      }
      authorMap.get(authorId)!.push(item);
    }
  });

  // 找出有重复的作者
  const duplicateAuthors: string[] = [];
  authorMap.forEach((items, authorId) => {
    if (items.length > 1) {
      duplicateAuthors.push(authorId);
      console.warn(`检测到作者 ${authorId} 有 ${items.length} 个重复项目:`, items.map(item => item.url));
    }
  });

  if (duplicateAuthors.length > 0) {
    console.log(`发现 ${duplicateAuthors.length} 个作者有重复项目，建议清理`);
  }
};

// 检查是否为重复作者
const isDuplicateAuthor = (item: WatchlistItem) => {
  const authorId = watchlistStore.extractAuthorId(item.url);
  if (!authorId) return false;

  const itemsByAuthor = watchlistStore.findItemsByAuthor(authorId);
  return itemsByAuthor.length > 1;
};

// 检查是否为当前置顶的artist项目
const isPinnedCurrentArtist = (item: WatchlistItem) => {
  const currentAuthorId = watchlistStore.extractAuthorId(currentPageUrl.value);
  if (!currentAuthorId) return false;

  const itemAuthorId = watchlistStore.extractAuthorId(item.url);
  return itemAuthorId === currentAuthorId;
};

// 监听路由变化，更新当前页面URL
watch(() => route.fullPath, () => {
  // 路由变化时更新当前页面URL
  currentPageUrl.value = getCurrentPageUrl();
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

.add-current-toggle.update {
  border-color: #f59e0b;
  color: #f59e0b;
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

/* 搜索和排序控制区域样式 */
.watchlist-controls {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  gap: 0.5rem;
}

.search-icon {
  width: 1.125rem;
  height: 1.125rem;
  color: #6b7280;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 0.875rem;
  color: #374151;
  outline: none;
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-search-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.clear-search-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.clear-search-btn svg {
  width: 0.875rem;
  height: 0.875rem;
}

.sort-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-btn:hover {
  background: #e5e7eb;
}

.sort-icon {
  width: 1rem;
  height: 1rem;
  color: #6b7280;
}

.sort-text {
  font-size: 0.875rem;
  color: #374151;
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

.watchlist-item.duplicate {
  background: #fef3c7;
  /* 浅黄色背景 */
  border-color: #f59e0b;
  /* 橙色边框 */
}

.watchlist-item.pinned-artist {
  background: #f0f9ff;
  /* 浅蓝色背景 */
  border-color: #0ea5e9;
  /* 蓝色边框 */
  position: relative;
}

.watchlist-item.pinned-artist::before {
  content: '📌';
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.7;
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

.item-title .duplicate-badge {
  margin-left: 0.5rem;
  background-color: #f59e0b;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
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