<template>
  <div class="browse-section">
    <!-- 面包屑导航 -->
    <div class="breadcrumb" v-if="breadcrumb.length > 0">
      <span 
        v-for="(item, index) in breadcrumb" 
        :key="index"
        class="breadcrumb-item"
        @click="navigateBreadcrumb(index)"
      >
        {{ item.name }}
        <span v-if="index < breadcrumb.length - 1" class="separator">/</span>
      </span>
    </div>

    <!-- 搜索面板 -->
    <SearchPanel
      :initial-query="searchQuery"
      :initial-sort="sortBy"
      :initial-filter="filterBy"
      @search="handleSearch"
      @sort="handleSort"
      @filter="handleFilter"
      @clear="handleClear"
    />

    <!-- 视图模式切换 -->
    <ViewModeToggle
      v-model="viewMode"
      @update:model-value="handleViewModeChange"
    />

    <!-- 统计信息 -->
    <div class="browse-stats">
      <span>共找到 {{ totalItems }} 个项目</span>
      <span v-if="viewMode !== 'artists' && totalPages > 1">
        • 第 {{ startIndex + 1 }}-{{ endIndex }} 项
      </span>
    </div>

    <!-- 作者视图 -->
    <ArtistsView
      v-if="viewMode === 'artists'"
      :artists="artists"
      @select-artist="handleSelectArtist"
      @view-artist-works="handleViewArtistWorks"
    />

    <!-- 作品视图 -->
    <ArtworksView
      v-else-if="viewMode === 'artworks'"
      :artworks="artworks"
      @view-artwork="handleViewArtwork"
      @select-artist="handleSelectArtist"
      @open-image-viewer="handleOpenImageViewer"
    />

    <!-- 画廊视图 -->
    <GalleryView
      v-else-if="viewMode === 'gallery'"
      :artworks="artworks"
      @view-artwork="handleViewArtwork"
      @open-image-viewer="handleOpenImageViewer"
    />

    <!-- 分页控件 -->
    <Pagination
      :current-page="currentPage"
      :total-pages="totalPages"
      @change-page="handlePageChange"
    />

    <!-- 图片查看器 -->
    <ImageViewer
      v-model:current-index="imageViewerIndex"
      :show="imageViewer.show"
      :artwork="imageViewer.artwork"
      @close="closeImageViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Artist, Artwork } from '@/stores/repository.ts'
import SearchPanel from './components/SearchPanel.vue'
import ViewModeToggle from './components/ViewModeToggle.vue'
import ArtistsView from './components/ArtistsView.vue'
import ArtworksView from './components/ArtworksView.vue'
import GalleryView from './components/GalleryView.vue'
import Pagination from './components/Pagination.vue'
import ImageViewer from './components/ImageViewer.vue'

interface Props {
  artists: Artist[]
  artworks: Artwork[]
  currentPage: number
  pageSize: number
  totalItems: number
  viewMode: string
}

interface Emits {
  (e: 'update:searchQuery', query: string): void
  (e: 'update:viewMode', mode: string): void
  (e: 'select-artist', artistName: string): void
  (e: 'view-artwork', artwork: Artwork): void
  (e: 'change-page', page: number, options?: { artist?: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 本地状态
const searchQuery = ref('')
const sortBy = ref('date')
const filterBy = ref('all')
const breadcrumb = ref<Array<{name: string, type: string}>>([])
const currentArtist = ref<string>('') // 添加当前查看的作者状态

// 图片查看器
const imageViewer = ref({
  show: false,
  artwork: null as Artwork | null
})
const imageViewerIndex = ref(0)

// 计算属性
const totalPages = computed(() => {
  if (props.viewMode === 'artists') {
    return Math.ceil(props.artists.length / props.pageSize)
  } else {
    return Math.ceil(props.totalItems / props.pageSize)
  }
})

const startIndex = computed(() => (props.currentPage - 1) * props.pageSize)
const endIndex = computed(() => {
  if (props.viewMode === 'artists') {
    return Math.min(startIndex.value + props.pageSize, props.artists.length)
  } else {
    return Math.min(startIndex.value + props.artworks.length, props.totalItems)
  }
})

// 方法
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentArtist.value = '' // 搜索时清除当前作者
  emit('update:searchQuery', query)
}

const handleSort = (sort: string) => {
  sortBy.value = sort
  // 这里可以添加排序逻辑
}

const handleFilter = (filter: string) => {
  filterBy.value = filter
  // 这里可以添加过滤逻辑
}

const handleClear = () => {
  searchQuery.value = ''
  emit('update:searchQuery', '')
}

const handleViewModeChange = (mode: string) => {
  emit('update:viewMode', mode)
}

const handleSelectArtist = (artistName: string) => {
  emit('select-artist', artistName)
}

const handleViewArtistWorks = (artistName: string) => {
  breadcrumb.value = [{ name: '作者', type: 'root' }, { name: artistName, type: 'artist' }]
  currentArtist.value = artistName // 设置当前查看的作者
  emit('select-artist', artistName)
}

const handleViewArtwork = (artwork: Artwork) => {
  emit('view-artwork', artwork)
}

const handleOpenImageViewer = (artwork: Artwork, index: number = 0) => {
  imageViewer.value = {
    show: true,
    artwork
  }
  imageViewerIndex.value = index
}

const closeImageViewer = () => {
  imageViewer.value.show = false
}

const handlePageChange = (page: number) => {
  // 根据当前状态决定如何分页
  if (currentArtist.value) {
    // 当前在查看特定作者的作品
    emit('change-page', page, { artist: currentArtist.value })
  } else {
    // 全局搜索或浏览
    emit('change-page', page)
  }
}

const navigateBreadcrumb = (index: number) => {
  breadcrumb.value = breadcrumb.value.slice(0, index + 1)
  // 根据面包屑导航回到相应页面
}

// 监听外部查询变化
watch(() => props.viewMode, (newMode) => {
  // 当视图模式改变时，重置面包屑和当前作者
  if (newMode === 'artists') {
    breadcrumb.value = []
    currentArtist.value = ''
  }
})
</script>

<style scoped>
.browse-section {
  position: relative;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.breadcrumb-item {
  color: #3b82f6;
  cursor: pointer;
  font-size: 0.875rem;
}

.breadcrumb-item:hover {
  text-decoration: underline;
}

.separator {
  color: #6b7280;
  margin-left: 0.5rem;
}

.browse-stats {
  margin-bottom: 1rem;
  color: #6b7280;
  font-size: 0.875rem;
}
</style> 