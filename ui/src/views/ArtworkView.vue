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
        <ArtworkGallery :artwork="artwork" :current-page="currentPage" :loading="loading"
          @page-change="currentPage = $event" />

        <!-- 右侧信息面板组件 -->
        <ArtworkInfoPanel :artwork="artwork" :downloading="downloading" :is-downloaded="isDownloaded"
          :current-task="currentTask" :loading="loading" :show-navigation="showNavigation"
          :previous-artwork="previousArtwork" :next-artwork="nextArtwork" :selected-tags="selectedTags"
          @download="handleDownload" @bookmark="handleBookmark" @update-task="updateTask" @remove-task="removeTask"
          @go-back="goBackToArtist" @navigate-previous="navigateToPrevious" @navigate-next="navigateToNext"
          @tag-click="handleTagClick" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useRepositoryStore } from '@/stores/repository';
import artworkService from '@/services/artwork';
import artistService from '@/services/artist';
import downloadService from '@/services/download';
import { getApiBaseUrl, getImageProxyUrl } from '@/services/api';
import type { Artwork, DownloadTask } from '@/types';
import ErrorMessage from '@/components/common/ErrorMessage.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import DownloadProgress from '@/components/download/DownloadProgress.vue';
import ArtworkGallery from '@/components/artwork/ArtworkGallery.vue';
import ArtworkInfoPanel from '@/components/artwork/ArtworkInfoPanel.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const repositoryStore = useRepositoryStore();

// 状态
const artwork = ref<Artwork | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const currentPage = ref(0);
const downloading = ref(false);
const isDownloaded = ref(false);

// 下载任务状态
const currentTask = ref<DownloadTask | null>(null);
const sseConnection = ref<(() => void) | null>(null);

// 收藏错误状态
const bookmarkError = ref<string | null>(null);

// 导航相关状态
const artistArtworks = ref<Artwork[]>([]);
const currentArtworkIndex = ref(-1);
const navigationLoading = ref(false);

// 导航相关计算属性
const showNavigation = computed(() => {
  return !!(route.query.artistId && route.query.artworkType);
});

const previousArtwork = computed(() => {
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

    // 立即清理所有下载相关状态
    currentTask.value = null;
    downloading.value = false;
    stopTaskStreaming();

    const response = await artworkService.getArtworkDetail(artworkId);

    if (response.success && response.data) {
      // 重置页面状态
      currentPage.value = 0;

      // 更新作品数据
      artwork.value = response.data;

      // 检查下载状态
      await checkDownloadStatus(artworkId);
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

    console.log('下载状态检查响应:', response);

    // repository store的apiCall返回的是data.data，所以response直接是数据对象
    if (response && typeof response === 'object') {
      const newStatus = response.is_downloaded || false;

      // 如果状态发生变化，记录日志
      if (isDownloaded.value !== newStatus) {
        console.log(`作品下载状态变化: ${isDownloaded.value} -> ${newStatus}`);
      }

      isDownloaded.value = newStatus;
      console.log('作品下载状态:', isDownloaded.value);
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
    // 清理之前的任务状态
    currentTask.value = null;
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

      // 如果是新任务，立即创建任务状态并开始监听进度
      if (response.data.task_id) {
        // 立即创建任务状态，让进度条立即显示
        currentTask.value = {
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

        // 立即开始SSE监听任务进度
        startTaskStreaming(response.data.task_id);
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

// 开始SSE监听任务进度
const startTaskStreaming = (taskId: string) => {
  // 清除之前的连接
  if (sseConnection.value) {
    sseConnection.value();
  }

  console.log('开始SSE监听任务进度:', taskId);

  // 建立SSE连接
  sseConnection.value = downloadService.streamTaskProgress(
    taskId,
    (task) => {
      console.log('收到SSE进度更新:', {
        taskId,
        status: task.status,
        progress: task.progress,
        completed: task.completed_files,
        total: task.total_files
      });

      // 立即更新任务状态，让进度条立即显示
      currentTask.value = task;

      // 如果任务完成，清理连接并检查下载状态
      if (['completed', 'failed', 'cancelled', 'partial'].includes(task.status)) {
        console.log('任务完成，关闭SSE连接');
        stopTaskStreaming();

        // 延迟检查下载状态，确保文件写入完成
        // 减少延迟时间，提高响应速度
        const delay = task.total_files > 1 ? 1500 : 1000; // 多文件延迟1.5秒，单文件延迟1秒

        setTimeout(async () => {
          // 检查当前页面是否还是同一个作品，避免页面切换后的状态更新
          if (artwork.value && artwork.value.id === task.artwork_id) {
            console.log(`延迟 ${delay}ms 后检查下载状态`);
            await checkDownloadStatus(artwork.value.id);

            // 如果任务完成但状态检查显示未下载，再次延迟检查
            if (task.status === 'completed' && !isDownloaded.value) {
              console.log('任务完成但状态检查失败，再次延迟检查');
              setTimeout(async () => {
                if (artwork.value && artwork.value.id === task.artwork_id) {
                  await checkDownloadStatus(artwork.value.id);
                }
              }, 1000);
            }

            // 清理任务状态，显示下载完成状态
            currentTask.value = null;
          }
        }, delay);
      }
    },
    () => {
      console.log('SSE连接完成');
      stopTaskStreaming();
    }
  );
};



// 停止SSE监听
const stopTaskStreaming = () => {
  if (sseConnection.value) {
    sseConnection.value();
    sseConnection.value = null;
  }
  // 确保清理任务状态
  currentTask.value = null;
  downloading.value = false;
};

// 更新任务状态
const updateTask = (task: DownloadTask) => {
  currentTask.value = task;
};

// 移除任务
const removeTask = (taskId: string) => {
  if (currentTask.value?.id === taskId) {
    currentTask.value = null;
    stopTaskStreaming();
  }
};

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
const fetchArtistArtworks = async () => {
  const artistId = route.query.artistId;
  const artworkType = route.query.artworkType;

  if (!artistId || !artworkType) return;

  try {
    navigationLoading.value = true;

    // 获取当前页面信息
    const currentPage = parseInt(route.query.page as string) || 1;
    const pageSize = 30;
    const offset = (currentPage - 1) * pageSize;

    const response = await artistService.getArtistArtworks(parseInt(artistId as string), {
      type: artworkType as 'art' | 'manga' | 'novel',
      offset: offset,
      limit: pageSize
    });

    if (response.success && response.data) {
      artistArtworks.value = response.data.artworks;
      // 找到当前作品在列表中的位置
      const currentId = parseInt(route.params.id as string);
      currentArtworkIndex.value = artistArtworks.value.findIndex(art => art.id === currentId);
    }
  } catch (err) {
    console.error('获取作者作品列表失败:', err);
  } finally {
    navigationLoading.value = false;
  }
};

// 导航到上一个作品
const navigateToPrevious = () => {
  if (previousArtwork.value && !loading.value) {
    // 立即清理下载任务状态
    currentTask.value = null;
    downloading.value = false;
    stopTaskStreaming();

    // 立即设置加载状态
    loading.value = true;

    router.push({
      path: `/artwork/${previousArtwork.value.id}`,
      query: {
        artistId: route.query.artistId,
        artworkType: route.query.artworkType,
        page: route.query.page,
        returnUrl: route.query.returnUrl
      }
    });
  }
};

// 导航到下一个作品
const navigateToNext = () => {
  if (nextArtwork.value && !loading.value) {
    // 立即清理下载任务状态
    currentTask.value = null;
    downloading.value = false;
    stopTaskStreaming();

    // 立即设置加载状态
    loading.value = true;

    router.push({
      path: `/artwork/${nextArtwork.value.id}`,
      query: {
        artistId: route.query.artistId,
        artworkType: route.query.artworkType,
        page: route.query.page,
        returnUrl: route.query.returnUrl
      }
    });
  }
};

// 返回作者页面
const goBackToArtist = () => {
  if (route.query.returnUrl) {
    router.push(route.query.returnUrl as string);
  } else if (route.query.artistId) {
    router.push(`/artist/${route.query.artistId}`);
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

  // 立即清理所有下载相关状态
  currentTask.value = null;
  downloading.value = false;
  stopTaskStreaming();

  // 重新获取作品详情
  fetchArtworkDetail();

  // 如果是从作者页面来的，重新获取导航数据
  if (showNavigation.value) {
    fetchArtistArtworks();
  }
});

// 键盘快捷键支持
const handleKeydown = (event: KeyboardEvent) => {
  if (!showNavigation.value) return;

  if (event.key === 'ArrowLeft' && previousArtwork.value) {
    event.preventDefault();
    navigateToPrevious();
  } else if (event.key === 'ArrowRight' && nextArtwork.value) {
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
    fetchArtistArtworks();
  }

  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
});

// 组件卸载时移除事件监听和清理SSE连接
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  stopTaskStreaming();
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