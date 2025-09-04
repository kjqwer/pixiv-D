<template>
  <div class="artwork-page">
    <div class="container">
      <!-- 收藏错误提示 -->
      <div v-if="bookmarkError" class="error-section">
        <ErrorMessage :error="bookmarkError" title="警告" type="warning" dismissible @dismiss="clearBookmarkError" />
      </div>

      <div v-if="error" class="error-section">
        <ErrorMessage :error="error" @dismiss="clearError" />
      </div>

      <!-- 页面加载状态 -->
      <div v-if="loading && !artwork" class="loading-section">
        <LoadingSpinner text="加载中..." />
      </div>

      <!-- 作品内容 -->
      <div v-if="artwork" class="artwork-content" :class="{ 'content-loading': loading }">
        <!-- 左侧图片组件 -->
        <ArtworkGallery :artwork="artwork" :current-page="currentImagePage" :loading="loading"
          @page-change="currentImagePage = $event" />

        <!-- 右侧信息面板组件 -->
        <ArtworkInfoPanel :artwork="artwork" :downloading="downloading" :is-downloaded="isDownloaded"
          :current-task="currentTask" :loading="loading" :show-navigation="showNavigation"
          :previous-artwork="previousArtwork" :next-artwork="nextArtwork" :canNavigatePrevious="canNavigateToPrevious"
          :canNavigateNext="canNavigateToNext" :selected-tags="selectedTags" :show-recommendations="showRecommendations"
          @download="handleDownload" @bookmark="handleBookmark" @go-back="goBackToArtist"
          @navigate-previous="navigateToPrevious" @navigate-next="navigateToNext" @tag-click="handleTagClick"
          @toggle-recommendations="showRecommendations = $event" />
      </div>

      <!-- 推荐作品组件 -->
      <div v-if="artwork && showRecommendations" class="recommendations-section">
        <ArtworkRecommendations :artwork-id="artwork.id" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useRepositoryStore } from '@/stores/repository';
import { useDownloadStore } from '@/stores/download';
import artworkService from '@/services/artwork';
import artistService from '@/services/artist';
import downloadService from '@/services/download';
import { getApiBaseUrl, getImageProxyUrl } from '@/services/api';
import { saveScrollPositionForPath } from '@/utils/scrollManager';
import type { Artwork, DownloadTask } from '@/types';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import DownloadProgress from '@/components/download/DownloadProgress.vue';
import ArtworkGallery from '@/components/artwork/ArtworkGallery.vue';
import ArtworkInfoPanel from '@/components/artwork/ArtworkInfoPanel.vue';
import ArtworkRecommendations from '@/components/artwork/ArtworkRecommendations.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const repositoryStore = useRepositoryStore();
const downloadStore = useDownloadStore();

// 状态
const artwork = ref<Artwork | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const currentImagePage = ref(0); // 当前图片页面
const downloading = ref(false);
const isDownloaded = ref(false);

// 下载任务状态 - 使用Pinia store
const currentTask = computed(() => {
  if (!artwork.value) return null;
  return downloadStore.getArtworkTask(artwork.value.id);
});

// 收藏错误状态
const bookmarkError = ref<string | null>(null);

// 导航相关状态
const artistArtworks = ref<Artwork[]>([]);
const currentArtworkIndex = ref(-1);
const navigationLoading = ref(false);
const navigationCurrentPage = ref(1); // 当前导航页码
const hasMorePages = ref(true); // 是否还有更多页面
const hasPreviousPages = ref(false); // 是否还有上一页
const isLoadingMore = ref(false); // 是否正在加载更多页面
const isLoadingPrevious = ref(false); // 是否正在加载上一页

// 推荐作品开关状态
const showRecommendations = ref(true);

// 初始化推荐开关状态（从localStorage读取）
const initializeRecommendationsState = () => {
  const saved = localStorage.getItem('artwork-show-recommendations');
  if (saved !== null) {
    showRecommendations.value = JSON.parse(saved);
  }
};

// 监听推荐开关状态变化并保存到localStorage
watch(showRecommendations, (newValue) => {
  localStorage.setItem('artwork-show-recommendations', JSON.stringify(newValue));
});

// 导航相关计算属性
const showNavigation = computed(() => {
  return !!(route.query.artistId && route.query.artworkType);
});

const previousArtwork = computed(() => {
  // 如果当前作品在当前页的第一个位置，但还有上一页，返回null但按钮仍然可用
  if (currentArtworkIndex.value === 0 && hasPreviousPages.value) {
    return null; // 返回null，但hasPreviousPages会控制按钮状态
  }

  // 如果当前作品不在第一个位置，返回前一个作品
  if (currentArtworkIndex.value > 0) {
    return artistArtworks.value[currentArtworkIndex.value - 1];
  }

  return null;
});

const nextArtwork = computed(() => {
  if (currentArtworkIndex.value >= 0 && currentArtworkIndex.value < artistArtworks.value.length - 1) {
    return artistArtworks.value[currentArtworkIndex.value + 1];
  }
  return null;
});

// 新增计算属性：是否可以导航到上一个作品
const canNavigateToPrevious = computed(() => {
  const result = previousArtwork.value !== null || hasPreviousPages.value;
  console.log('canNavigateToPrevious:', {
    previousArtwork: previousArtwork.value,
    hasPreviousPages: hasPreviousPages.value,
    currentArtworkIndex: currentArtworkIndex.value,
    result
  });
  return result;
});

// 新增计算属性：是否可以导航到下一个作品
const canNavigateToNext = computed(() => {
  const result = nextArtwork.value !== null || hasMorePages.value;
  console.log('canNavigateToNext:', {
    nextArtwork: nextArtwork.value,
    hasMorePages: hasMorePages.value,
    currentArtworkIndex: currentArtworkIndex.value,
    result
  });
  return result;
});

// 获取作品详情
const fetchArtworkDetail = async () => {
  const artworkId = parseInt(route.params.id as string);
  if (isNaN(artworkId)) {
    error.value = '无效的作品ID';
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    // 清理下载状态
    downloading.value = false;

    const response = await artworkService.getArtworkDetail(artworkId);

    if (response.success && response.data) {
      // 重置页面状态
      currentImagePage.value = 0;

      // 更新作品数据
      artwork.value = response.data;

      // 检查下载状态
      await checkDownloadStatus(artworkId);

      // 如果导航数据还没有加载，且当前作品不在列表中，重新加载导航数据
      if (showNavigation.value && currentArtworkIndex.value === -1) {
        const page = parseInt(route.query.page as string) || 1;
        fetchArtistArtworks(page);
      }
    } else {
      throw new Error(response.error || '获取作品详情失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取作品详情失败';
    console.error('获取作品详情失败:', err);
  } finally {
    loading.value = false;
  }
};

// 检查下载状态
const checkDownloadStatus = async (artworkId: number, retryCount = 0) => {
  try {
    const response = await repositoryStore.checkArtworkDownloaded(artworkId);

    // console.log('下载状态检查响应:', response);

    // repository store的apiCall返回的是data.data，所以response直接是数据对象
    if (response && typeof response === 'object') {
      const newStatus = response.is_downloaded || false;

      // 如果状态发生变化，记录日志
      // if (isDownloaded.value !== newStatus) {
      //   console.log(`作品下载状态变化: ${isDownloaded.value} -> ${newStatus}`);
      // }

      isDownloaded.value = newStatus;
      // console.log('作品下载状态:', isDownloaded.value);
    }
  } catch (err) {
    console.error('检查下载状态失败:', err);
    isDownloaded.value = false;

    // 如果是网络错误且重试次数少于3次，延迟重试
    if (retryCount < 3 && (err instanceof Error && err.message.includes('network') || err instanceof TypeError)) {
      console.log(`下载状态检查失败，${2000 * (retryCount + 1)}ms 后重试 (${retryCount + 1}/3)`);
      setTimeout(() => {
        checkDownloadStatus(artworkId, retryCount + 1);
      }, 2000 * (retryCount + 1));
    }
  }
};

// 下载作品
const handleDownload = async () => {
  if (!artwork.value) return;

  try {
    // 清理下载状态
    downloading.value = true;

    // 如果已经下载过，则强制重新下载（跳过现有文件检查）
    const skipExisting = !isDownloaded.value;
    const response = await downloadService.downloadArtwork(artwork.value.id, {
      skipExisting
    });

    if (response.success) {
      console.log('下载响应:', response.data);

      // 检查是否跳过下载
      if (response.data.skipped) {
        console.log('作品已存在，跳过下载');
        // 重新检查下载状态
        await checkDownloadStatus(artwork.value.id);
        return;
      }

      // 如果是新任务，立即添加到store
      if (response.data.task_id) {
        // 立即创建任务状态，让进度条立即显示
        const newTask: DownloadTask = {
          id: response.data.task_id,
          type: 'artwork',
          status: 'downloading',
          progress: 0,
          total_files: response.data.total_files || 0,
          completed_files: 0,
          failed_files: 0,
          artwork_id: artwork.value.id,
          artist_name: response.data.artist_name,
          artwork_title: response.data.artwork_title,
          start_time: new Date().toISOString()
        };

        // 添加到store，store会自动管理SSE连接
        downloadStore.addTask(newTask);
      }
    } else {
      throw new Error(response.error || '下载失败');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '下载失败';
    console.error('下载失败:', err);
  } finally {
    downloading.value = false;
  }
};

// 监听任务完成状态
watch(currentTask, (newTask, oldTask) => {
  if (oldTask && !newTask) {
    // 任务被移除，检查下载状态
    if (artwork.value) {
      setTimeout(async () => {
        await checkDownloadStatus(artwork.value!.id);
      }, 1000);
    }
  } else if (newTask && ['completed', 'failed', 'cancelled', 'partial'].includes(newTask.status)) {
    // 任务完成，延迟检查下载状态
    if (artwork.value && artwork.value.id === newTask.artwork_id) {
      const delay = newTask.total_files > 1 ? 1500 : 1000;
      setTimeout(async () => {
        await checkDownloadStatus(artwork.value!.id);
      }, delay);
    }
  }
}, { immediate: true });

// 收藏/取消收藏
const handleBookmark = async () => {
  if (!artwork.value) return;

  try {
    const action = artwork.value.is_bookmarked ? 'remove' : 'add';
    const response = await artworkService.toggleBookmark(artwork.value.id, action);

    if (response.success && response.data) {
      // 更新作品状态
      artwork.value.is_bookmarked = response.data.is_bookmarked;
      artwork.value.total_bookmarks += artwork.value.is_bookmarked ? 1 : -1;

      // 显示成功消息
      console.log(response.data.message);
    } else {
      // 显示错误提示给用户
      bookmarkError.value = response.error || '收藏操作失败';
      console.error('收藏操作失败:', response.error);
    }
  } catch (err) {
    // 显示错误提示给用户
    bookmarkError.value = '藏暂时不可用，请去官方收藏或者取消收藏';
    console.error('收藏操作失败:', err);
  }
};



// 清除错误
const clearError = () => {
  error.value = null;
};

// 清除收藏错误
const clearBookmarkError = () => {
  bookmarkError.value = null;
};

// 获取作者作品列表用于导航
const fetchArtistArtworks = async (page = 1, append = false, prepend = false) => {
  const artistId = route.query.artistId;
  const artworkType = route.query.artworkType;

  if (!artistId || !artworkType) return;

  try {
    if (append) {
      isLoadingMore.value = true;
    } else if (prepend) {
      isLoadingPrevious.value = true;
    } else {
      navigationLoading.value = true;
    }

    const pageSize = 30;
    const offset = (page - 1) * pageSize;

    const response = await artistService.getArtistArtworks(parseInt(artistId as string), {
      type: artworkType as 'art' | 'manga' | 'novel',
      offset: offset,
      limit: pageSize
    });

    if (response.success && response.data) {
      if (append) {
        // 追加模式：将新作品添加到现有列表末尾
        artistArtworks.value.push(...response.data.artworks);
      } else if (prepend) {
        // 前置模式：将新作品添加到现有列表开头
        artistArtworks.value.unshift(...response.data.artworks);
        // 更新当前作品索引，因为前面插入了新作品
        currentArtworkIndex.value += response.data.artworks.length;
      } else {
        // 替换模式：替换整个列表
        artistArtworks.value = response.data.artworks;
        navigationCurrentPage.value = page;
      }

      // 检查是否还有更多页面
      hasMorePages.value = response.data.artworks.length === pageSize;
      // 检查是否还有上一页
      hasPreviousPages.value = page > 1;

      // 更新当前导航页码
      if (!append && !prepend) {
        navigationCurrentPage.value = page;
      }

      // 找到当前作品在列表中的位置
      const currentId = parseInt(route.params.id as string);
      currentArtworkIndex.value = artistArtworks.value.findIndex(art => art.id === currentId);

      console.log('fetchArtistArtworks 完成:', {
        page,
        append,
        prepend,
        artworksCount: response.data.artworks.length,
        hasMorePages: hasMorePages.value,
        hasPreviousPages: hasPreviousPages.value,
        navigationCurrentPage: navigationCurrentPage.value,
        currentArtworkIndex: currentArtworkIndex.value,
        currentId,
        currentArtworkId: artwork.value?.id,
        firstArtworkId: artistArtworks.value[0]?.id,
        lastArtworkId: artistArtworks.value[artistArtworks.value.length - 1]?.id,
        allArtworkIds: artistArtworks.value.map(art => art.id)
      });
    }
  } catch (err) {
    console.error('获取作者作品列表失败:', err);
  } finally {
    if (append) {
      isLoadingMore.value = false;
    } else if (prepend) {
      isLoadingPrevious.value = false;
    } else {
      navigationLoading.value = false;
    }
  }
};

// 加载下一页作品
const loadNextPage = async () => {
  if (!hasMorePages.value || isLoadingMore.value) return;

  const nextPage = navigationCurrentPage.value + 1;
  await fetchArtistArtworks(nextPage, true, false);
  // 更新当前导航页码
  navigationCurrentPage.value = nextPage;
};

// 加载上一页作品
const loadPreviousPage = async () => {
  if (!hasPreviousPages.value || isLoadingPrevious.value) return;

  const previousPage = navigationCurrentPage.value - 1;
  await fetchArtistArtworks(previousPage, false, true);
  // 更新当前导航页码
  navigationCurrentPage.value = previousPage;
};

// 辅助函数：更新returnUrl中的页码
const updateReturnUrlPage = (returnUrl: string, newPage: number): string => {
  if (!returnUrl) return returnUrl;

  // 如果returnUrl包含页码，更新它
  if (returnUrl.includes('page=')) {
    return returnUrl.replace(/page=\d+/, `page=${newPage}`);
  } else {
    // 如果returnUrl没有页码，添加页码
    const separator = returnUrl.includes('?') ? '&' : '?';
    return returnUrl + `${separator}page=${newPage}`;
  }
};

// 导航到下一个作品
const navigateToNext = async () => {
  if (!loading.value) {
    // 如果当前作品是当前页的最后一个，且还有更多页面，先加载下一页
    if (currentArtworkIndex.value === artistArtworks.value.length - 1 && hasMorePages.value) {
      await loadNextPage();
    }

    // 检查是否真的有下一个作品
    if (nextArtwork.value) {
      // 清理下载状态
      downloading.value = false;

      // 立即设置加载状态
      loading.value = true;

      // 计算返回链接的页码和当前导航页码
      let returnPage = parseInt(route.query.page as string) || 1;
      let currentNavPage = navigationCurrentPage.value;

      if (currentArtworkIndex.value === artistArtworks.value.length - 1) {
        // 如果跳转到下一页的作品，返回链接应该指向当前页，当前导航页码递增
        returnPage = currentNavPage; // 返回时应该在第x页
        currentNavPage = currentNavPage + 1;
      } else {
        // 如果是在同一页内导航，返回链接指向当前页
        returnPage = currentNavPage;
      }

      // 构建新的returnUrl，更新页码
      const newReturnUrl = updateReturnUrlPage(route.query.returnUrl as string, returnPage);

      router.push({
        path: `/artwork/${nextArtwork.value.id}`,
        query: {
          artistId: route.query.artistId,
          artworkType: route.query.artworkType,
          page: currentNavPage,
          returnUrl: newReturnUrl
        }
      });
    }
  }
};

// 导航到上一个作品
const navigateToPrevious = async () => {
  if (!loading.value) {
    // 如果当前作品是当前页的第一个，且还有上一页，先加载上一页
    if (currentArtworkIndex.value === 0 && hasPreviousPages.value) {
      await loadPreviousPage();
    }

    // 检查是否真的有上一个作品
    if (previousArtwork.value) {
      // 清理下载状态
      downloading.value = false;

      // 立即设置加载状态
      loading.value = true;

      // 计算返回链接的页码和当前导航页码
      let returnPage = parseInt(route.query.page as string) || 1;
      let currentNavPage = navigationCurrentPage.value;

      if (currentArtworkIndex.value === 0) {
        // 如果跳转到上一页的作品，返回链接应该指向当前页，当前导航页码递减
        returnPage = currentNavPage; // 返回时应该在第x页
        currentNavPage = currentNavPage - 1;
      } else {
        // 如果是在同一页内导航，返回链接指向当前页
        returnPage = currentNavPage;
      }

      // 构建新的returnUrl，更新页码
      const newReturnUrl = updateReturnUrlPage(route.query.returnUrl as string, returnPage);

      router.push({
        path: `/artwork/${previousArtwork.value.id}`,
        query: {
          artistId: route.query.artistId,
          artworkType: route.query.artworkType,
          page: currentNavPage,
          returnUrl: newReturnUrl
        }
      });
    }
  }
};

// 返回作者页面
const goBackToArtist = () => {
  const returnUrl = route.query.returnUrl as string;
  let targetPath = returnUrl || `/artist/${route.query.artistId}`;

  // 如果返回链接不包含页码，添加当前页码
  if (targetPath && !targetPath.includes('page=')) {
    const separator = targetPath.includes('?') ? '&' : '?';
    targetPath += `${separator}page=${navigationCurrentPage.value}`;
  }

  if (targetPath) {
    // 获取当前保存的滚动位置（如果有的话）
    const savedScrollKey = `scroll_${targetPath}`;
    const savedPosition = sessionStorage.getItem(savedScrollKey);

    // 如果没有保存的滚动位置，设置一个默认位置（通常是之前访问时的位置）
    if (!savedPosition && route.query.scrollTop) {
      const scrollPosition = {
        top: parseInt(route.query.scrollTop as string) || 0,
        left: 0
      };
      saveScrollPositionForPath(targetPath, scrollPosition);
    }

    router.push(targetPath);
  }
};

// 选中的标签状态
const selectedTags = ref<string[]>([]);
const isCtrlPressed = ref(false);
const isMultiSelecting = ref(false);

// 处理标签点击
const handleTagClick = (event: MouseEvent, tagName: string) => {
  // 阻止默认行为
  event.preventDefault();

  console.log('标签点击事件:', {
    tagName,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    isCtrlPressed: isCtrlPressed.value
  });

  // 如果按住Ctrl键，则添加到选中状态（不跳转）
  if (event.ctrlKey || event.metaKey) {
    console.log('检测到Ctrl键，添加到选中状态');
    isMultiSelecting.value = true;

    // 切换标签的选中状态
    const index = selectedTags.value.indexOf(tagName);
    if (index > -1) {
      // 如果已选中，则取消选中
      selectedTags.value.splice(index, 1);
    } else {
      // 如果未选中，则添加到选中列表
      selectedTags.value.push(tagName);
    }

    // console.log('当前选中的标签:', selectedTags.value);

    // 保存到sessionStorage
    sessionStorage.setItem('currentSearchTags', JSON.stringify(selectedTags.value));

    // 不跳转，只是更新选中状态
  } else {
    // console.log('普通点击，执行单标签搜索');
    // 普通点击，只搜索当前标签，清除之前的多标签选择
    selectedTags.value = [];
    sessionStorage.removeItem('currentSearchTags');
    isMultiSelecting.value = false;

    // 在新标签页中打开搜索
    const searchUrl = router.resolve({
      path: '/search',
      query: {
        mode: 'tags',
        tag: tagName
      }
    }).href;

    window.open(searchUrl, '_blank');
  }
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    isCtrlPressed.value = true;
  }
};

const handleKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Control' || event.key === 'Meta') {
    isCtrlPressed.value = false;

    // 当松开Ctrl键时，如果正在进行多选操作且有选中的标签，则在新标签页中打开搜索
    if (isMultiSelecting.value && selectedTags.value.length > 0) {
      console.log('松开Ctrl键，在新标签页中打开搜索，标签:', selectedTags.value);

      // 在新标签页中打开搜索
      const searchUrl = router.resolve({
        path: '/search',
        query: {
          mode: 'tags',
          tags: selectedTags.value
        }
      }).href;

      window.open(searchUrl, '_blank');

      // 清空选中状态
      selectedTags.value = [];
      sessionStorage.removeItem('currentSearchTags');
      isMultiSelecting.value = false;
    }
  }
};

// 监听路由变化，重新获取作品详情和导航数据
watch(() => route.params.id, (newId, oldId) => {
  // 如果是同一个ID，不重复加载
  if (newId === oldId) return;

  // 确保页面滚动到顶部
  window.scrollTo(0, 0);

  // 清理下载状态
  downloading.value = false;

  // 重新获取作品详情
  fetchArtworkDetail();

  // 如果是从作者页面来的，重新获取导航数据
  if (showNavigation.value) {
    // 从路由查询参数获取页码
    const page = parseInt(route.query.page as string) || 1;
    // 延迟获取导航数据，确保artwork已经更新
    setTimeout(() => {
      fetchArtistArtworks(page);
    }, 100);
  }
});

// 键盘快捷键支持
const handleKeydown = (event: KeyboardEvent) => {
  if (!showNavigation.value) return;

  if (event.key === 'ArrowLeft' && canNavigateToPrevious.value) {
    event.preventDefault();
    navigateToPrevious();
  } else if (event.key === 'ArrowRight' && canNavigateToNext.value) {
    event.preventDefault();
    navigateToNext();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    goBackToArtist();
  }
};

onMounted(() => {
  // 确保页面滚动到顶部
  window.scrollTo(0, 0);

  fetchArtworkDetail();
  if (showNavigation.value) {
    // 从路由查询参数获取页码
    const page = parseInt(route.query.page as string) || 1;
    fetchArtistArtworks(page);
  }

  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // 初始化推荐开关状态
  initializeRecommendationsState();
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
});
</script>

<style scoped>
.artwork-page {
  min-height: 100vh;
  background: #f8fafc;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.loading-section,
.error-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.artwork-content {
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 3rem;
  align-items: start;
  transition: opacity 0.3s ease;
}

.content-loading {
  opacity: 0.7;
  pointer-events: none;
}

.recommendations-section {
  margin-top: 3rem;
  padding: 2rem;
  background-color: #f0f2f5;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

@media (max-width: 1024px) {
  .artwork-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
}
</style>