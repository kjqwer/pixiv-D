<template>
  <div class="watchlist-widget">
    <!-- 待看名单按钮和添加按钮 -->
    <WatchlistButton
      :is-open="isOpen"
      :item-count="itemCount"
      :is-current-page-added="isCurrentPageAdded"
      :has-same-author-different-page="hasSameAuthorDifferentPage"
      :add-loading="addLoading"
      :add-button-title="getAddButtonTitle()"
      @toggle="toggleWatchlist"
      @addCurrent="addOrUpdateCurrentPage"
    />

    <!-- 待看名单面板 -->
    <WatchlistPanel
      :visible="isOpen"
      :item-count="itemCount"
      :loading="loading"
      :error="error"
      :items="items"
      :filtered-items="filteredAndSortedItems"
      :search-query="searchQuery"
      :sort-order="sortOrder"
      :is-current-url="isCurrentUrl"
      :is-duplicate-author="isDuplicateAuthor"
      :is-pinned-current-artist="isPinnedCurrentArtist"
      @close="toggleWatchlist"
      @show-add-modal="showAddModal"
      @update:search-query="searchQuery = $event"
      @clear-search="clearSearch"
      @toggle-sort="toggleSortOrder"
      @retry="fetchItems"
      @navigate="navigateToItem"
      @edit="editItem"
      @delete="deleteItemById"
    />

    <!-- 编辑对话框 -->
    <EditModal
      :visible="!!editingItem"
      :title="editTitle"
      :url="editUrl"
      @update:title="editTitle = $event"
      @update:url="editUrl = $event"
      @save="saveEdit"
      @cancel="cancelEdit"
    />

    <!-- 手动添加对话框 -->
    <AddModal
      :visible="showingAddModal"
      :mode="addMode"
      :title="addTitle"
      :url="addUrl"
      :batch-urls="batchUrls"
      :auto-generate-title="autoGenerateTitle"
      :parsed-urls="parsedUrls"
      @update:mode="addMode = $event"
      @update:title="addTitle = $event"
      @update:url="addUrl = $event"
      @update:batchUrls="batchUrls = $event"
      @update:autoGenerateTitle="autoGenerateTitle = $event"
      @quickAdd="fillQuickAdd"
      @save="saveAdd"
      @cancel="cancelAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWatchlistStore } from '@/stores/watchlist';
import type { WatchlistItem } from '@/services/watchlist';

// 导入子组件
import WatchlistButton from './watchlist/WatchlistButton.vue';
import WatchlistPanel from './watchlist/WatchlistPanel.vue';
import EditModal from './watchlist/EditModal.vue';
import AddModal from './watchlist/AddModal.vue';

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
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .watchlist-widget {
    left: 0.5rem;
  }
}
</style>