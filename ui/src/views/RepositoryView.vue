<template>
  <div class="repository-view">
    <div class="container">
      <!-- 页面标题 -->
      <div class="page-header">
        <h1 class="page-title">仓库管理</h1>
        <p class="page-description">管理已下载的作品文件，设置存储位置和迁移旧项目</p>
      </div>

      <!-- 统计信息卡片 -->
      <div class="stats-grid" v-if="stats">
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalArtworks }}</div>
            <div class="stat-label">总作品数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👤</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalArtists }}</div>
            <div class="stat-label">总作者数</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💾</div>
          <div class="stat-content">
            <div class="stat-value">{{ formatFileSize(stats.totalSize) }}</div>
            <div class="stat-label">总存储大小</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💿</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.diskUsage.usagePercent }}%</div>
            <div class="stat-label">磁盘使用率</div>
          </div>
        </div>
      </div>

      <!-- 功能选项卡 -->
      <div class="tabs">
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'config' }"
          @click="activeTab = 'config'"
        >
          配置管理
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'browse' }"
          @click="activeTab = 'browse'"
        >
          文件浏览
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'migrate' }"
          @click="activeTab = 'migrate'"
        >
          数据迁移
        </button>
      </div>

      <!-- 配置管理 -->
      <div v-if="activeTab === 'config'" class="tab-content">
        <div class="config-section">
          <h3>仓库配置</h3>
          <div class="config-form">
            <div class="form-group">
              <label>下载目录</label>
              <div class="path-input-group">
                <input 
                  v-model="config.downloadDir" 
                  type="text" 
                  placeholder="设置下载目录路径"
                  class="form-input"
                  readonly
                />
                <button type="button" @click="selectDownloadDir" class="btn btn-secondary">
                  选择目录
                </button>
              </div>
              <small class="form-help">默认路径: ./downloads</small>
            </div>
            <div class="form-group">
              <label>文件结构</label>
              <select v-model="config.fileStructure" class="form-select">
                <option value="artist/artwork">作者/作品</option>
                <option value="artwork">仅作品</option>
                <option value="flat">扁平结构</option>
              </select>
            </div>
            <div class="form-group">
              <label>命名模式</label>
              <input 
                v-model="config.namingPattern" 
                type="text" 
                placeholder="{artist_name}/{artwork_id}_{title}"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>最大文件大小 (MB)</label>
              <input 
                v-model.number="config.maxFileSize" 
                type="number" 
                placeholder="0表示无限制"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>允许的文件扩展名</label>
              <input 
                :value="config.allowedExtensions.join(',')" 
                @input="(e) => config.allowedExtensions = (e.target as HTMLInputElement).value.split(',').map(ext => ext.trim()).filter(ext => ext)"
                type="text" 
                placeholder=".jpg,.png,.gif,.webp"
                class="form-input"
              />
            </div>
            <div class="form-actions">
              <button @click="saveConfig" class="btn btn-primary" :disabled="saving">
                {{ saving ? '保存中...' : '保存配置' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件浏览 -->
      <div v-if="activeTab === 'browse'" class="tab-content">
        <div class="browse-section">
          <div class="browse-header">
            <div class="search-box">
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="搜索作品或作者..."
                class="search-input"
                @input="debounceSearch"
              />
            </div>
            <div class="view-toggle">
              <button 
                class="view-btn" 
                :class="{ active: viewMode === 'artists' }"
                @click="viewMode = 'artists'"
              >
                按作者浏览
              </button>
              <button 
                class="view-btn" 
                :class="{ active: viewMode === 'artworks' }"
                @click="viewMode = 'artworks'"
              >
                所有作品
              </button>
            </div>
          </div>

          <!-- 作者列表 -->
          <div v-if="viewMode === 'artists'" class="artists-grid">
            <div 
              v-for="artist in artists" 
              :key="artist.name"
              class="artist-card"
              @click="selectArtist(artist.name)"
            >
              <div class="artist-info">
                <h4>{{ artist.name }}</h4>
                <p>{{ artist.artworkCount }} 个作品</p>
                <p>{{ formatFileSize(artist.totalSize) }}</p>
              </div>
            </div>
          </div>

          <!-- 作品列表 -->
          <div v-if="viewMode === 'artworks'" class="artworks-grid">
            <div 
              v-for="artwork in artworks" 
              :key="artwork.id"
              class="artwork-card"
              @click="viewArtwork(artwork)"
            >
              <div class="artwork-preview" v-if="artwork.files.length > 0">
                <img 
                  :src="getPreviewUrl(artwork.files[0].path)" 
                  :alt="artwork.title"
                  class="preview-image"
                />
              </div>
              <div class="artwork-info">
                <h4>{{ artwork.title }}</h4>
                <p>{{ artwork.artist }}</p>
                <p>{{ formatFileSize(artwork.size) }}</p>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div class="pagination" v-if="totalPages > 1">
            <button 
              @click="changePage(currentPage - 1)" 
              :disabled="currentPage <= 1"
              class="page-btn"
            >
              上一页
            </button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button 
              @click="changePage(currentPage + 1)" 
              :disabled="currentPage >= totalPages"
              class="page-btn"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <!-- 数据迁移 -->
      <div v-if="activeTab === 'migrate'" class="tab-content">
        <div class="migrate-section">
          <h3>数据迁移</h3>
          <p class="migrate-description">
            将旧项目中的作品文件迁移到当前仓库中。系统会自动识别作品ID并避免重复迁移。
          </p>
          
          <div class="migrate-form">
            <div class="form-group">
              <label>源目录路径</label>
              <div class="path-input-group">
                <input 
                  v-model="migrateSourceDir" 
                  type="text" 
                  placeholder="选择要迁移的目录路径"
                  class="form-input"
                  readonly
                />
                <button type="button" @click="selectMigrateDir" class="btn btn-secondary">
                  选择目录
                </button>
              </div>
            </div>
            <div class="form-actions">
              <button 
                @click="startMigration" 
                class="btn btn-primary" 
                :disabled="migrating"
              >
                {{ migrating ? '迁移中...' : '开始迁移' }}
              </button>
            </div>
          </div>

          <!-- 迁移结果 -->
          <div v-if="migrationResult" class="migration-result">
            <h4>迁移结果</h4>
            <div class="result-stats">
              <p>成功迁移: {{ migrationResult.totalMigrated }} 个作品</p>
              <p>跳过: {{ migrationResult.log.filter((item: any) => item.status === 'skipped').length }} 个作品</p>
            </div>
            <div class="migration-log">
              <h5>详细日志</h5>
                             <div 
                 v-for="(item, index) in migrationResult.log" 
                 :key="index"
                 class="log-item"
                 :class="(item as any).status"
               >
                                 <span class="log-status">{{ (item as any).status === 'success' ? '✅' : '⏭️' }}</span>
                 <span class="log-text">{{ (item as any).title }} (ID: {{ (item as any).id }})</span>
                 <span v-if="(item as any).reason" class="log-reason">{{ (item as any).reason }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 作品详情模态框 -->
    <div v-if="selectedArtwork" class="modal-overlay" @click="closeArtworkModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedArtwork.title }}</h3>
          <button @click="closeArtworkModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="artwork-details">
            <p><strong>作者:</strong> {{ selectedArtwork.artist }}</p>
            <p><strong>作品ID:</strong> {{ selectedArtwork.id }}</p>
            <p><strong>文件大小:</strong> {{ formatFileSize(selectedArtwork.size) }}</p>
            <p><strong>文件数量:</strong> {{ selectedArtwork.files.length }}</p>
          </div>
          <div class="artwork-files">
            <h4>文件列表</h4>
            <div class="files-grid">
              <div 
                v-for="file in selectedArtwork.files" 
                :key="file.path"
                class="file-item"
              >
                <img 
                  :src="getPreviewUrl(file.path)" 
                  :alt="file.name"
                  class="file-preview"
                />
                <div class="file-info">
                  <p>{{ file.name }}</p>
                  <p>{{ formatFileSize(file.size) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="deleteArtwork(selectedArtwork.id)" class="btn btn-danger">
            删除作品
          </button>
          <button @click="closeArtworkModal" class="btn btn-secondary">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRepositoryStore, type RepositoryStats, type RepositoryConfig, type Artist, type Artwork } from '@/stores/repository.ts'

const repositoryStore = useRepositoryStore()

// 响应式数据
const activeTab = ref('config')
const stats = ref<RepositoryStats | null>(null)
const config = ref<RepositoryConfig>({
  downloadDir: './downloads',
  fileStructure: 'artist/artwork',
  namingPattern: '{artist_name}/{artwork_id}_{title}',
  maxFileSize: 0,
  allowedExtensions: ['.jpg', '.png', '.gif', '.webp'],
  autoMigration: false,
  migrationRules: []
})

// 浏览相关
const viewMode = ref('artists')
const searchQuery = ref('')
const artists = ref<Artist[]>([])
const artworks = ref<Artwork[]>([])
const currentPage = ref(1)
const pageSize = 20
const totalPages = computed(() => Math.ceil(artworks.value.length / pageSize))

// 迁移相关
const migrateSourceDir = ref('')
const migrating = ref(false)
const migrationResult = ref<any>(null)

// 模态框
const selectedArtwork = ref<Artwork | null>(null)

// 加载数据
onMounted(async () => {
  await loadStats()
  await loadConfig()
  await loadArtists()
})

// 加载统计信息
const loadStats = async () => {
  try {
    stats.value = await repositoryStore.getStats()
  } catch (error: any) {
    console.error('加载统计信息失败:', error)
  }
}

// 加载配置
const loadConfig = async () => {
  try {
    const configData = await repositoryStore.getConfig()
    config.value = { ...config.value, ...configData }
  } catch (error: any) {
    console.error('加载配置失败:', error)
  }
}

// 保存配置
const saving = ref(false)
const saveConfig = async () => {
  saving.value = true
  try {
    // 处理扩展名字符串
    if (typeof config.value.allowedExtensions === 'string') {
      config.value.allowedExtensions = (config.value.allowedExtensions as string)
        .split(',')
        .map((ext: string) => ext.trim())
        .filter((ext: string) => ext)
    }
    
    await repositoryStore.updateConfig(config.value)
    alert('配置保存成功')
  } catch (error: any) {
    console.error('保存配置失败:', error)
    alert('保存配置失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 加载作者列表
const loadArtists = async () => {
  try {
    const result = await repositoryStore.getArtists()
    artists.value = result.artists
  } catch (error: any) {
    console.error('加载作者列表失败:', error)
  }
}

// 选择作者
const selectArtist = async (artistName: string) => {
  try {
    const result = await repositoryStore.getArtworksByArtist(artistName)
    artworks.value = result.artworks
    viewMode.value = 'artworks'
  } catch (error: any) {
    console.error('加载作者作品失败:', error)
  }
}

// 搜索作品
let searchTimeout: number
const debounceSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      try {
        const result = await repositoryStore.searchArtworks(searchQuery.value)
        artworks.value = result.artworks
        viewMode.value = 'artworks'
        } catch (error: any) {
    console.error('搜索失败:', error)
  }
    } else {
      await loadArtists()
    }
  }, 300)
}

// 查看作品详情
const viewArtwork = (artwork: any) => {
  selectedArtwork.value = artwork
}

// 关闭作品模态框
const closeArtworkModal = () => {
  selectedArtwork.value = null
}

// 删除作品
const deleteArtwork = async (artworkId: string) => {
  if (!confirm('确定要删除这个作品吗？此操作不可恢复。')) {
    return
  }
  
  try {
    await repositoryStore.deleteArtwork(artworkId)
    alert('作品删除成功')
    closeArtworkModal()
    await loadStats()
    await loadArtists()
  } catch (error: any) {
    console.error('删除作品失败:', error)
    alert('删除作品失败: ' + error.message)
  }
}

// 开始迁移
const startMigration = async () => {
  if (!migrateSourceDir.value.trim()) {
    alert('请输入源目录路径')
    return
  }
  
  migrating.value = true
  try {
    migrationResult.value = await repositoryStore.migrateOldProjects(migrateSourceDir.value)
    alert('迁移完成')
    await loadStats()
    await loadArtists()
  } catch (error: any) {
    console.error('迁移失败:', error)
    alert('迁移失败: ' + error.message)
  } finally {
    migrating.value = false
  }
}

// 分页
const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 选择下载目录
const selectDownloadDir = async () => {
  try {
    // 使用HTML5文件选择器选择目录
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = false
    
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length > 0) {
        // 获取选择的目录路径
        const path = files[0].webkitRelativePath.split('/')[0]
        config.value.downloadDir = path
      }
    }
    
    input.click()
  } catch (error: any) {
    console.error('选择目录失败:', error)
    // 降级到prompt
    const dir = prompt('请输入下载目录路径:', './downloads')
    if (dir) {
      config.value.downloadDir = dir
    }
  }
}

// 选择迁移目录
const selectMigrateDir = async () => {
  try {
    const input = document.createElement('input')
    input.type = 'file'
    input.webkitdirectory = true
    input.multiple = false
    
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length > 0) {
        const path = files[0].webkitRelativePath.split('/')[0]
        migrateSourceDir.value = path
      }
    }
    
    input.click()
  } catch (error: any) {
    console.error('选择目录失败:', error)
    // 降级到prompt
    const dir = prompt('请选择要迁移的源目录路径:')
    if (dir) {
      migrateSourceDir.value = dir
    }
  }
}

// 工具函数
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getPreviewUrl = (filePath: string) => {
  return `/api/repository/preview?path=${encodeURIComponent(filePath)}`
}
</script>

<style scoped>
.repository-view {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.page-description {
  color: #6b7280;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #3b82f6;
}

.tab-button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-content {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 2rem;
}

.config-section h3,
.browse-section h3,
.migrate-section h3 {
  margin: 0 0 1.5rem 0;
  color: #1f2937;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.path-input-group {
  display: flex;
  gap: 0.5rem;
}

.path-input-group .form-input {
  flex: 1;
}

.path-input-group .btn {
  white-space: nowrap;
}

.form-help {
  color: #6b7280;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.form-actions {
  margin-top: 2rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.browse-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.search-box {
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.view-toggle {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.artist-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.artist-card:hover {
  background: #f3f4f6;
  border-color: #3b82f6;
}

.artworks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
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
  height: 150px;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-info {
  padding: 1rem;
}

.artwork-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: #1f2937;
}

.artwork-info p {
  margin: 0.25rem 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #6b7280;
}

.migrate-description {
  color: #6b7280;
  margin-bottom: 2rem;
}

.migration-result {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.result-stats {
  margin-bottom: 1rem;
}

.migration-log {
  max-height: 300px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.log-status {
  font-size: 1.2rem;
}

.log-reason {
  color: #6b7280;
  font-size: 0.875rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 0.5rem;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
}

.modal-body {
  padding: 1.5rem;
}

.artwork-details {
  margin-bottom: 2rem;
}

.artwork-details p {
  margin: 0.5rem 0;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.file-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  overflow: hidden;
}

.file-preview {
  width: 100%;
  height: 100px;
  object-fit: cover;
}

.file-info {
  padding: 0.5rem;
}

.file-info p {
  margin: 0.25rem 0;
  font-size: 0.75rem;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .browse-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .search-box {
    max-width: none;
  }
  
  .artists-grid,
  .artworks-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style> 