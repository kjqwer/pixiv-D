<template>
  <div class="artist-search">
    <!-- 搜索表单 -->
    <div class="search-form">
      <div class="search-input-group">
        <input v-model="searchKeyword" type="text" placeholder="输入作者名称或账号搜索..." class="search-input"
          @keyup.enter="handleSearch" />
        <button @click="handleSearch" class="search-btn" :disabled="loading">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
      </div>

      <!-- 搜索选项 -->
      <div class="search-options">
        <label class="checkbox-label">
          <input v-model="hideFollowedArtists" type="checkbox" class="form-checkbox" />
          <span>隐藏已关注的作者</span>
        </label>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-if="loading" class="loading-section">
      <LoadingSpinner text="搜索中..." />
    </div>

    <div v-else-if="error" class="error-section">
      <ErrorMessage :error="error" @dismiss="clearError" />
    </div>

    <div v-else-if="searchResults.length > 0" class="results-section">
      <div class="results-header">
        <h3>搜索结果 ({{ filteredResults.length }})</h3>
        <div v-if="hideFollowedArtists && searchResults.length !== filteredResults.length" class="filter-info">
          已隐藏 {{ searchResults.length - filteredResults.length }} 个已关注的作者
        </div>
      </div>

      <div class="artists-grid">
        <ArtistCard v-for="artist in filteredResults" :key="artist.id" :artist="artist" :show-follow-button="true"
          :show-unfollow-button="false" @follow="handleFollow" @download="handleDownload" />
      </div>
    </div>

    <div v-else-if="hasSearched" class="empty-section">
      <div class="empty-content">
        <svg viewBox="0 0 24 24" fill="currentColor" class="empty-icon">
          <path
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <h3>未找到相关作者</h3>
        <p>尝试使用不同的关键词搜索</p>
      </div>
    </div>

    <div v-else class="welcome-section">
      <div class="welcome-content">
        <h3>搜索作者</h3>
        <p>输入作者名称或账号来搜索</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useArtistStore } from '@/stores/artist'

import ArtistCard from '@/components/artist/ArtistCard.vue'

const router = useRouter()
const artistStore = useArtistStore()

// 搜索状态
const searchKeyword = ref('')
const hideFollowedArtists = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const hasSearched = ref(false)
const searchResults = ref<any[]>([])

// 计算属性：过滤搜索结果
const filteredResults = computed(() => {
  if (!hideFollowedArtists.value) {
    return searchResults.value
  }

  // 获取已关注作者的ID列表
  const followedIds = new Set(artistStore.followingArtists.map(artist => artist.id))

  // 过滤掉已关注的作者
  return searchResults.value.filter(artist => !followedIds.has(artist.id))
})

// 执行搜索
const handleSearch = async () => {
  if (!searchKeyword.value.trim()) {
    return
  }

  try {
    loading.value = true
    error.value = null
    hasSearched.value = true

    await artistStore.searchArtists(searchKeyword.value)
    searchResults.value = artistStore.searchResults
  } catch (err) {
    error.value = err instanceof Error ? err.message : '搜索失败'
    console.error('搜索失败:', err)
  } finally {
    loading.value = false
  }
}

// 关注作者
const handleFollow = async (artistId: number) => {
  try {
    await artistStore.followArtist(artistId)
    // 更新搜索结果中的关注状态
    const artist = searchResults.value.find(a => a.id === artistId)
    if (artist) {
      artist.is_followed = true
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '关注失败'
    console.error('关注失败:', err)
  }
}

// 下载作品
const handleDownload = (artist: any) => {
  // 触发父组件的下载事件
  emit('download', artist)
}

// 清除错误
const clearError = () => {
  error.value = null
}

// 定义事件
interface Emits {
  (e: 'download', artist: any): void
}

const emit = defineEmits<Emits>()

// 暴露方法给父组件
defineExpose({
  searchKeyword,
  clearSearch: () => {
    searchKeyword.value = ''
    searchResults.value = []
    hasSearched.value = false
    error.value = null
  }
})
</script>

<style scoped>
.artist-search {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.search-btn {
  padding: 0.75rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover:not(:disabled) {
  background: #2563eb;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.search-options {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.form-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
}

.loading-section,
.error-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.results-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.results-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.results-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.filter-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.empty-section,
.welcome-section {
  text-align: center;
  padding: 3rem 0;
}

.empty-content,
.welcome-content {
  max-width: 300px;
  margin: 0 auto;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.empty-content h3,
.welcome-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.empty-content p,
.welcome-content p {
  color: #6b7280;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .search-input-group {
    flex-direction: column;
  }

  .artists-grid {
    grid-template-columns: 1fr;
  }

  .search-options {
    justify-content: flex-start;
  }
}
</style>