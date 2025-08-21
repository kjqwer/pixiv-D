<template>
  <div class="browse-section">
    <!-- 搜索和筛选区域 -->
    <div class="browse-header">
      <div class="search-filters">
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索作品标题、作者名称..."
            class="search-input"
            @input="debounceSearch"
          />
          <button @click="clearSearch" class="clear-btn" v-if="searchQuery">
            ✕
          </button>
        </div>
        
        <div class="filter-controls">
          <select v-model="sortBy" @change="handleSortChange" class="filter-select">
            <option value="date">按日期排序</option>
            <option value="name">按名称排序</option>
            <option value="size">按大小排序</option>
          </select>
          
          <select v-model="filterBy" @change="handleFilterChange" class="filter-select">
            <option value="all">全部</option>
            <option value="images">仅图片</option>
            <option value="videos">仅视频</option>
          </select>
        </div>
      </div>
      
      <div class="view-toggle">
        <button 
          class="view-btn" 
          :class="{ active: viewMode === 'artists' }"
          @click="switchToArtists"
        >
          <span class="btn-icon">👥</span>
          按作者浏览
        </button>
        <button 
          class="view-btn" 
          :class="{ active: viewMode === 'artworks' }"
          @click="switchToArtworks"
        >
          <span class="btn-icon">🖼️</span>
          所有作品
        </button>
        <button 
          class="view-btn" 
          :class="{ active: viewMode === 'gallery' }"
          @click="switchToGallery"
        >
          <span class="btn-icon">🎨</span>
          画廊模式
        </button>
      </div>
    </div>

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

    <!-- 统计信息 -->
    <div class="browse-stats">
      <span>共找到 {{ totalItems }} 个项目</span>
      <span v-if="viewMode === 'artworks'">• 第 {{ startIndex + 1 }}-{{ endIndex }} 项</span>
    </div>

    <!-- 作者列表 -->
    <div v-if="viewMode === 'artists'" class="artists-grid">
      <div 
        v-for="artist in paginatedArtists" 
        :key="artist.name"
        class="artist-card"
        @click="selectArtist(artist.name)"
      >
        <div class="artist-avatar">
          <span class="avatar-text">{{ artist.name.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="artist-info">
          <h4>{{ artist.name }}</h4>
          <p>{{ artist.artworkCount }} 个作品</p>
          <p>{{ formatFileSize(artist.totalSize) }}</p>
        </div>
        <div class="artist-actions">
          <button @click.stop="viewArtistArtworks(artist.name)" class="action-btn">
            查看作品
          </button>
        </div>
      </div>
    </div>

    <!-- 作品列表 -->
    <div v-if="viewMode === 'artworks'" class="artworks-grid">
      <div 
        v-for="artwork in paginatedArtworks" 
        :key="artwork.id"
        class="artwork-card"
        @click="viewArtwork(artwork)"
      >
        <div class="artwork-preview" v-if="artwork.files.length > 0">
          <img 
            :src="getPreviewUrl(artwork.files[0].path)" 
            :alt="artwork.title"
            class="preview-image"
            @click.stop="openImageViewer(artwork, 0)"
          />
          <div class="artwork-overlay">
            <button @click.stop="openImageViewer(artwork, 0)" class="view-btn-overlay">
              👁️ 查看大图
            </button>
          </div>
        </div>
        <div class="artwork-info">
          <h4>{{ artwork.title }}</h4>
          <p class="artist-name" @click.stop="selectArtist(artwork.artist)">
            👤 {{ artwork.artist }}
          </p>
          <p>{{ formatFileSize(artwork.size) }}</p>
          <p class="file-count">{{ artwork.files.length }} 个文件</p>
        </div>
        <div class="artwork-actions">
          <button @click.stop="viewArtwork(artwork)" class="action-btn">
            详情
          </button>
          <button @click.stop="openImageViewer(artwork, 0)" class="action-btn">
            预览
          </button>
        </div>
      </div>
    </div>

    <!-- 画廊模式 -->
    <div v-if="viewMode === 'gallery'" class="gallery-container">
      <div class="gallery-controls">
        <div class="zoom-controls">
          <button @click="zoomOut" class="zoom-btn" :disabled="zoomLevel <= 0.5">
            🔍-
          </button>
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <button @click="zoomIn" class="zoom-btn" :disabled="zoomLevel >= 3">
            🔍+
          </button>
        </div>
        <div class="view-controls">
          <button @click="setGridSize('small')" :class="['size-btn', { active: gridSize === 'small' }]">
            小
          </button>
          <button @click="setGridSize('medium')" :class="['size-btn', { active: gridSize === 'medium' }]">
            中
          </button>
          <button @click="setGridSize('large')" :class="['size-btn', { active: gridSize === 'large' }]">
            大
          </button>
        </div>
      </div>
      
      <div class="gallery-grid" :class="`grid-${gridSize}`">
        <div 
          v-for="artwork in paginatedArtworks" 
          :key="artwork.id"
          class="gallery-item"
          @click="openImageViewer(artwork, 0)"
        >
          <div class="gallery-image-container">
            <img 
              :src="getPreviewUrl(artwork.files[0].path)" 
              :alt="artwork.title"
              class="gallery-image"
              @load="onImageLoad"
              @error="onImageError"
            />
            <div class="gallery-overlay">
              <div class="overlay-content">
                <h4>{{ artwork.title }}</h4>
                <p>{{ artwork.artist }}</p>
                <div class="overlay-actions">
                  <button @click.stop="openImageViewer(artwork, 0)" class="overlay-btn">
                    👁️ 查看大图
                  </button>
                  <button @click.stop="viewArtwork(artwork)" class="overlay-btn">
                    📋 详情
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页控件 -->
    <div class="pagination" v-if="totalPages > 1">
      <button 
        @click="changePage(1)" 
        :disabled="currentPage <= 1"
        class="page-btn"
      >
        首页
      </button>
      <button 
        @click="changePage(currentPage - 1)" 
        :disabled="currentPage <= 1"
        class="page-btn"
      >
        上一页
      </button>
      
      <div class="page-numbers">
        <button 
          v-for="page in visiblePages" 
          :key="page"
          @click="changePage(page)"
          :class="['page-btn', { active: page === currentPage }]"
        >
          {{ page }}
        </button>
      </div>
      
      <button 
        @click="changePage(currentPage + 1)" 
        :disabled="currentPage >= totalPages"
        class="page-btn"
      >
        下一页
      </button>
      <button 
        @click="changePage(totalPages)" 
        :disabled="currentPage >= totalPages"
        class="page-btn"
      >
        末页
      </button>
    </div>

        <!-- 图片查看器 -->
    <div v-if="imageViewer.show" class="image-viewer-overlay" @click="closeImageViewer">
      <div class="image-viewer-content" @click.stop>
        <div class="viewer-header">
          <h3>{{ imageViewer.artwork?.title }}</h3>
          <div class="viewer-controls">
            <div class="viewer-zoom-controls">
              <button @click="zoomOut" class="zoom-btn" :disabled="zoomLevel <= 0.5">
                🔍-
              </button>
              <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
              <button @click="zoomIn" class="zoom-btn" :disabled="zoomLevel >= 3">
                🔍+
              </button>
              <button @click="resetZoom" class="reset-btn">重置</button>
            </div>
            <button @click="closeImageViewer" class="close-btn">×</button>
          </div>
        </div>
        
        <div class="viewer-main">
          <button @click="previousImage" class="nav-btn prev-btn" :disabled="imageViewer.currentIndex <= 0">
            ‹
          </button>
          
          <div class="image-container">
            <img 
              :src="getPreviewUrl(currentImagePath)" 
              :alt="currentImageName"
              class="viewer-image"
              :style="{ transform: `scale(${zoomLevel})` }"
            />
          </div>
          
          <button @click="nextImage" class="nav-btn next-btn" :disabled="imageViewer.currentIndex >= (imageViewer.artwork?.files?.length || 0) - 1">
            ›
          </button>
        </div>
        
        <div class="viewer-footer">
          <div class="image-info">
            <p>{{ currentImageName }}</p>
            <p>{{ formatFileSize(currentImageSize) }}</p>
          </div>
          <div class="image-counter">
            {{ imageViewer.currentIndex + 1 }} / {{ imageViewer.artwork?.files?.length || 0 }}
          </div>
        </div>
        
        <div class="thumbnail-strip">
          <div 
            v-for="(file, index) in (imageViewer.artwork?.files || [])" 
            :key="index"
            :class="['thumbnail', { active: index === imageViewer.currentIndex }]"
            @click="goToImage(index)"
          >
            <img 
              :src="getPreviewUrl(file.path)" 
              :alt="file.name"
              class="thumbnail-img"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Artist, Artwork } from '@/stores/repository.ts'
import { formatFileSize, getPreviewUrl } from '@/utils/formatters'

interface Props {
  artists: Artist[]
  artworks: Artwork[]
  currentPage: number
  pageSize: number
}

interface Emits {
  (e: 'update:searchQuery', query: string): void
  (e: 'update:viewMode', mode: string): void
  (e: 'select-artist', artistName: string): void
  (e: 'view-artwork', artwork: Artwork): void
  (e: 'change-page', page: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 响应式数据
const searchQuery = ref('')
const viewMode = ref('artists')
const sortBy = ref('date')
const filterBy = ref('all')
const breadcrumb = ref<Array<{name: string, type: string}>>([])

// 图片查看器
const imageViewer = ref({
  show: false,
  artwork: null as Artwork | null,
  currentIndex: 0
})

// 画廊模式相关
const zoomLevel = ref(1)
const gridSize = ref('medium')

// 计算属性
const filteredArtworks = computed(() => {
  let filtered = props.artworks

  // 搜索过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(artwork => 
      artwork.title.toLowerCase().includes(query) ||
      artwork.artist.toLowerCase().includes(query)
    )
  }

  // 类型过滤
  if (filterBy.value !== 'all') {
    filtered = filtered.filter(artwork => {
      const hasImages = artwork.files.some(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
      )
      const hasVideos = artwork.files.some(file => 
        /\.(mp4|avi|mov|wmv|flv)$/i.test(file.name)
      )
      
      if (filterBy.value === 'images') return hasImages
      if (filterBy.value === 'videos') return hasVideos
      return true
    })
  }

  // 排序
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.title.localeCompare(b.title)
      case 'size':
        return b.size - a.size
      case 'date':
      default:
        return new Date(b.id).getTime() - new Date(a.id).getTime()
    }
  })

  return filtered
})

const filteredArtists = computed(() => {
  let filtered = props.artists

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(artist => 
      artist.name.toLowerCase().includes(query)
    )
  }

  return filtered
})

const totalItems = computed(() => {
  return viewMode.value === 'artists' ? filteredArtists.value.length : filteredArtworks.value.length
})

const totalPages = computed(() => Math.ceil(totalItems.value / props.pageSize))

const startIndex = computed(() => (props.currentPage - 1) * props.pageSize)
const endIndex = computed(() => Math.min(startIndex.value + props.pageSize, totalItems.value))

const paginatedArtworks = computed(() => {
  return filteredArtworks.value.slice(startIndex.value, endIndex.value)
})

const paginatedArtists = computed(() => {
  return filteredArtists.value.slice(startIndex.value, endIndex.value)
})

const visiblePages = computed(() => {
  const pages = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const currentImagePath = computed(() => {
  if (!imageViewer.value.artwork || !imageViewer.value.artwork.files[imageViewer.value.currentIndex]) {
    return ''
  }
  return imageViewer.value.artwork.files[imageViewer.value.currentIndex].path
})

const currentImageName = computed(() => {
  if (!imageViewer.value.artwork || !imageViewer.value.artwork.files[imageViewer.value.currentIndex]) {
    return ''
  }
  return imageViewer.value.artwork.files[imageViewer.value.currentIndex].name
})

const currentImageSize = computed(() => {
  if (!imageViewer.value.artwork || !imageViewer.value.artwork.files[imageViewer.value.currentIndex]) {
    return 0
  }
  return imageViewer.value.artwork.files[imageViewer.value.currentIndex].size
})

// 方法
let searchTimeout: number
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    emit('update:searchQuery', searchQuery.value)
  }, 300)
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('update:searchQuery', '')
}

const handleSortChange = () => {
  // 排序改变时重新计算
}

const handleFilterChange = () => {
  // 过滤改变时重新计算
}

const switchToArtists = () => {
  viewMode.value = 'artists'
  emit('update:viewMode', 'artists')
}

const switchToArtworks = () => {
  viewMode.value = 'artworks'
  emit('update:viewMode', 'artworks')
}

const switchToGallery = () => {
  viewMode.value = 'gallery'
  emit('update:viewMode', 'gallery')
}

const selectArtist = (artistName: string) => {
  emit('select-artist', artistName)
}

const viewArtistArtworks = (artistName: string) => {
  breadcrumb.value = [{ name: '作者', type: 'root' }, { name: artistName, type: 'artist' }]
  emit('select-artist', artistName)
}

const viewArtwork = (artwork: Artwork) => {
  emit('view-artwork', artwork)
}

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('change-page', page)
  }
}

const navigateBreadcrumb = (index: number) => {
  breadcrumb.value = breadcrumb.value.slice(0, index + 1)
  // 根据面包屑导航回到相应页面
}

const openImageViewer = (artwork: Artwork, index: number = 0) => {
  imageViewer.value = {
    show: true,
    artwork,
    currentIndex: index
  }
}

const closeImageViewer = () => {
  imageViewer.value.show = false
}

const previousImage = () => {
  if (imageViewer.value.currentIndex > 0) {
    imageViewer.value.currentIndex--
  }
}

const nextImage = () => {
  if (imageViewer.value.artwork && imageViewer.value.currentIndex < imageViewer.value.artwork.files.length - 1) {
    imageViewer.value.currentIndex++
  }
}

const goToImage = (index: number) => {
  imageViewer.value.currentIndex = index
}

// 画廊模式图片缩放
const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value + 0.1, 3)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value - 0.1, 0.5)
}

// 画廊模式网格大小
const setGridSize = (size: 'small' | 'medium' | 'large') => {
  gridSize.value = size
}

// 重置缩放
const resetZoom = () => {
  zoomLevel.value = 1
}

// 画廊模式图片加载和错误处理
const onImageLoad = () => {
  // 图片加载成功后可以进行一些操作，例如调整布局
}

const onImageError = (event: Event) => {
  console.error('图片加载失败:', (event.target as HTMLImageElement).src)
  // 可以显示一个错误提示或替换图片
}

// 监听搜索变化
watch(searchQuery, () => {
  debounceSearch()
})

// 键盘快捷键支持
const handleKeydown = (event: KeyboardEvent) => {
  if (imageViewer.value.show) {
    switch (event.key) {
      case 'Escape':
        closeImageViewer()
        break
      case 'ArrowLeft':
        previousImage()
        break
      case 'ArrowRight':
        nextImage()
        break
      case '=':
      case '+':
        event.preventDefault()
        zoomIn()
        break
      case '-':
        event.preventDefault()
        zoomOut()
        break
      case '0':
        event.preventDefault()
        zoomLevel.value = 1
        break
    }
  }
}

// 监听键盘事件
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.browse-section {
  position: relative;
}

.browse-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 2rem;
}

.search-filters {
  flex: 1;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
}

.clear-btn:hover {
  background: #f3f4f6;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.875rem;
}

.view-toggle {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.view-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-icon {
  font-size: 1rem;
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

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.artist-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.artist-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.artist-avatar {
  width: 60px;
  height: 60px;
  background: #3b82f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
}

.artist-info {
  flex: 1;
}

.artist-info h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.artist-info p {
  margin: 0.25rem 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.artist-actions {
  display: flex;
  gap: 0.5rem;
}

.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.artwork-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.artwork-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.artwork-preview {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.artwork-card:hover .preview-image {
  transform: scale(1.05);
}

.artwork-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.artwork-card:hover .artwork-overlay {
  opacity: 1;
}

.view-btn-overlay {
  background: white;
  color: #1f2937;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.artwork-info {
  padding: 1rem;
}

.artwork-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: #1f2937;
}

.artist-name {
  color: #3b82f6 !important;
  cursor: pointer;
  font-weight: 500;
}

.artist-name:hover {
  text-decoration: underline;
}

.artwork-info p {
  margin: 0.25rem 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.file-count {
  font-weight: 500;
  color: #6b5563 !important;
}

.artwork-actions {
  padding: 0 1rem 1rem;
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #3b82f6;
}

.gallery-container {
  position: relative;
  margin-top: 2rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.gallery-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zoom-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.zoom-btn:hover:not(:disabled) {
  background: #2563eb;
}

.zoom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-level {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.size-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.size-btn:hover:not(:disabled) {
  background: #2563eb;
}

.size-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gallery-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

.grid-small .gallery-grid {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.grid-medium .gallery-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.grid-large .gallery-grid {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.gallery-item {
  position: relative;
  height: 250px;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  background: white;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.gallery-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.gallery-image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  overflow: hidden;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s ease;
  transform: scale(v-bind(zoomLevel));
}

.gallery-item:hover .gallery-image {
  transform: scale(v-bind(zoomLevel) * 1.05);
}

.gallery-item:hover .gallery-image {
  transform: scale(1.1);
}

.gallery-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.gallery-item:hover .gallery-overlay {
  opacity: 1;
}

.overlay-content {
  text-align: center;
  color: white;
  padding: 1rem;
}

.overlay-content h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
}

.overlay-content p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.8;
}

.overlay-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.overlay-btn {
  background: white;
  color: #1f2937;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.overlay-btn:hover {
  background: #f3f4f6;
  color: #3b82f6;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2rem;
}

.page-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #3b82f6;
}

.page-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.image-viewer-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.viewer-header h3 {
  margin: 0;
  color: #1f2937;
}

.viewer-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.viewer-zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
}

.reset-btn {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #4b5563;
}

.viewer-main {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  flex: 1;
  min-height: 400px;
}

.nav-btn {
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.7);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 70vh;
  overflow: auto;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.viewer-image {
  max-width: none;
  max-height: none;
  object-fit: contain;
  transition: transform 0.2s ease;
  cursor: zoom-in;
}

.viewer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.image-info p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.image-counter {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.thumbnail-strip {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  overflow-x: auto;
}

.thumbnail {
  width: 80px;
  height: 60px;
  border: 2px solid transparent;
  border-radius: 0.25rem;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s;
  flex-shrink: 0;
}

.thumbnail.active {
  border-color: #3b82f6;
}

.thumbnail:hover {
  border-color: #3b82f6;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 768px) {
  .browse-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .search-filters {
    flex-direction: column;
    width: 100%;
  }
  
  .search-box {
    max-width: none;
  }
  
  .filter-controls {
    width: 100%;
  }
  
  .filter-select {
    flex: 1;
  }
  
  .view-toggle {
    width: 100%;
    justify-content: center;
  }
  
  .gallery-controls {
    flex-direction: column;
    gap: 1rem;
  }
  
  .zoom-controls,
  .view-controls {
    justify-content: center;
  }
  
  .artists-grid,
  .artworks-grid,
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .artist-card {
    flex-direction: column;
    text-align: center;
  }
  
  .pagination {
    flex-wrap: wrap;
  }
  
  .page-numbers {
    order: 3;
    width: 100%;
    justify-content: center;
    margin-top: 0.5rem;
  }
  
  .image-viewer-content {
    width: 95%;
    max-height: 95vh;
  }
  
  .viewer-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .viewer-controls {
    justify-content: space-between;
  }
  
  .viewer-zoom-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .viewer-main {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .nav-btn {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }
  
  .thumbnail-strip {
    padding: 0.5rem;
  }
  
  .thumbnail {
    width: 60px;
    height: 45px;
  }
}
</style> 