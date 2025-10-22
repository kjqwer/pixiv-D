<template>
  <div class="repository-view">
    <div class="container">
      <!-- 页面标题 -->
      <div class="page-header">
        <h1 class="page-title">仓库管理</h1>
        <p class="page-description">管理已下载的作品文件，设置存储位置和迁移旧项目</p>
      </div>

      <!-- 统计信息卡片 -->
      <RepositoryStatsComponent :stats="stats" />

      <!-- 功能选项卡 -->
      <div class="tabs">
        <button class="tab-button" :class="{ active: activeTab === 'config' }" @click="activeTab = 'config'">
          配置管理
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'browse' }" @click="activeTab = 'browse'">
          文件浏览
        </button>
      </div>

      <!-- 扫描控制面板 -->
      <div class="scan-controls">
        <div class="scan-buttons">
          <button @click="performFullScan" :disabled="isScanning" class="scan-button">
            {{ isScanning ? '扫描中...' : '完整扫描' }}
          </button>
          <button @click="clearCache" class="clear-cache-button">
            清除缓存
          </button>
        </div>
        
        <!-- 扫描进度 -->
        <div v-if="isScanning" class="scan-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: scanProgress + '%' }"></div>
          </div>
          <div class="progress-text">{{ scanStatus }}</div>
        </div>
      </div>

      <!-- 配置管理 -->
      <div v-if="activeTab === 'config'" class="tab-content">
        <RepositoryConfigComponent :config="config" :migrating="migrating" :migration-progress="migrationProgress"
          :migration-percent="migrationPercent" :migration-result="migrationResult" @save-config="saveConfig"
          @reset-config="resetConfig" @test-download-dir="testDownloadDir"
          @config-saved="handleConfigSaved" />
      </div>

      <!-- 文件浏览 -->
      <div v-if="activeTab === 'browse'" class="tab-content">
        <RepositoryBrowse :artists="artists" :artworks="artworks" :current-page="currentPage" :page-size="pageSize"
          :total-items="totalItems" :view-mode="viewMode" @update:search-query="handleSearchQuery"
          @update:view-mode="handleViewMode" @select-artist="selectArtist" @view-artwork="viewArtwork"
          @change-page="changePage" />
      </div>
    </div>

    <!-- 作品详情模态框 -->
    <ArtworkModal :artwork="selectedArtwork" @close="closeArtworkModal" @delete-artwork="deleteArtwork" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRepositoryStore, type RepositoryStats, type RepositoryConfig, type Artist, type Artwork } from '@/stores/repository.ts'
import RepositoryStatsComponent from '@/components/repository/RepositoryStats.vue'
import RepositoryConfigComponent from '@/components/repository/RepositoryConfig.vue'
import RepositoryBrowse from '@/components/repository/RepositoryBrowse.vue'
import ArtworkModal from '@/components/repository/ArtworkModal.vue'

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

// 扫描相关状态
const isScanning = ref(false)
const scanProgress = ref(0)
const scanStatus = ref('')

// 浏览相关
const searchQuery = ref('')
const viewMode = ref('artworks') // 默认显示作品模式
const artists = ref<Artist[]>([])
const artworks = ref<Artwork[]>([])
const currentPage = ref(1)
const pageSize = 50 // 增加每页显示数量
const totalItems = ref(0) // 添加总数状态
const currentArtist = ref<string>('') // 添加当前查看的作者状态

// 迁移相关
const migrateSourceDir = ref('')
const migrating = ref(false)
const migrationResult = ref<any>(null)
const migrationProgress = ref('')
const migrationPercent = ref(0)

// 模态框
const selectedArtwork = ref<Artwork | null>(null)

// 加载数据
onMounted(async () => {
  await loadStats()
  await loadConfig()
  await loadArtists()
  await loadAllArtworks(1) // 加载第一页
})

// 加载统计信息
const loadStats = async () => {
  try {
    // 首先尝试快速扫描获取基本信息
    try {
      const quickResult = await repositoryStore.quickScan()
      console.log('快速扫描结果:', quickResult)
    } catch (error) {
      console.warn('快速扫描失败，使用传统方法:', error)
    }
    
    // 然后获取完整统计信息
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
const saveConfig = async () => {
  try {
    // 处理扩展名字符串
    if (typeof config.value.allowedExtensions === 'string') {
      config.value.allowedExtensions = (config.value.allowedExtensions as string)
        .split(',')
        .map((ext: string) => ext.trim())
        .filter((ext: string) => ext)
    }

    // 获取当前配置（旧配置）
    const oldConfig = await repositoryStore.getConfig()
    const oldDownloadDir = oldConfig.downloadDir

    // 保存新配置
    await repositoryStore.updateConfig(config.value)

    // 如果启用了自动迁移，且下载目录发生了变化，执行迁移
    if (config.value.autoMigration && oldDownloadDir !== config.value.downloadDir) {
      await performAutoMigration(oldDownloadDir)
    }

    alert('配置保存成功')
  } catch (error: any) {
    console.error('保存配置失败:', error)
    alert('保存配置失败: ' + error.message)
  }
}

// 重置配置
const resetConfig = async () => {
  if (!confirm('确定要重置配置为默认值吗？此操作不可恢复。')) {
    return
  }

  try {
    await repositoryStore.resetConfig()
    // 重新加载配置
    await loadConfig()
    alert('配置已重置为默认值')
  } catch (error: any) {
    console.error('重置配置失败:', error)
    alert('重置配置失败: ' + error.message)
  }
}

// 执行自动迁移
const performAutoMigration = async (oldDownloadDir: string) => {
  try {
    migrating.value = true
    migrationProgress.value = '正在准备迁移...'
    migrationPercent.value = 10

    console.log('开始自动迁移:', { oldDir: oldDownloadDir, newDir: config.value.downloadDir })

    migrationProgress.value = `正在从 ${oldDownloadDir} 迁移到 ${config.value.downloadDir}...`
    migrationPercent.value = 30

    // 执行迁移：从旧目录到新目录
    const result = await repositoryStore.migrateFromOldToNew(oldDownloadDir, config.value.downloadDir)
    migrationResult.value = result
    migrationPercent.value = 100

    console.log('迁移完成:', result)

    // 显示迁移结果
    if (result.totalMigrated > 0) {
      alert(`迁移完成！成功移动 ${result.totalMigrated} 个目录`)
    } else {
      alert('迁移完成，但没有找到需要迁移的文件')
    }

  } catch (error: any) {
    console.error('自动迁移失败:', error)
    migrationProgress.value = '迁移失败: ' + error.message
    alert('自动迁移失败: ' + error.message)
  } finally {
    migrating.value = false
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

// 加载所有作品
const loadAllArtworks = async (page = 1, limit = pageSize) => {
  try {
    currentArtist.value = '' // 加载所有作品时清除当前作者
    const offset = (page - 1) * limit
    const result = await repositoryStore.getAllArtworks(offset, limit)
    artworks.value = result.artworks
    totalItems.value = result.total // 更新总数
    currentPage.value = page
  } catch (error: any) {
    console.error('加载所有作品失败:', error)
  }
}

// 选择作者
const selectArtist = async (artistName: string) => {
  try {
    // 重置搜索和分页
    searchQuery.value = ''
    currentPage.value = 1
    currentArtist.value = artistName // 设置当前查看的作者

    // 获取作者作品
    const result = await repositoryStore.getArtworksByArtist(artistName, 0, pageSize)
    artworks.value = result.artworks
    totalItems.value = result.total || result.artworks.length

    // 切换到作品视图
    viewMode.value = 'artworks'
    activeTab.value = 'browse'
  } catch (error: any) {
    console.error('加载作者作品失败:', error)
  }
}

// 处理搜索查询
const handleSearchQuery = async (query: string) => {
  searchQuery.value = query
  currentArtist.value = '' // 搜索时清除当前作者

  // 重置分页
  currentPage.value = 1

  if (query.trim()) {
    try {
      // 搜索作品
      const result = await repositoryStore.searchArtworks(query, 0, pageSize)
      artworks.value = result.artworks
      totalItems.value = result.total

      // 切换到作品视图
      viewMode.value = 'artworks'
      activeTab.value = 'browse'
    } catch (error: any) {
      console.error('搜索失败:', error)
    }
  } else {
    // 清空搜索，加载所有作品
    await loadAllArtworks(1)
  }
}

// 处理视图模式
const handleViewMode = (mode: string) => {
  viewMode.value = mode

  // 根据视图模式加载相应数据
  if (mode === 'artists') {
    // 作者模式，确保作者数据已加载
    currentArtist.value = '' // 切换到作者模式时清除当前作者
    if (artists.value.length === 0) {
      loadArtists()
    }
  } else if (mode === 'artworks' || mode === 'gallery') {
    // 作品模式，确保作品数据已加载
    if (artworks.value.length === 0) {
      loadAllArtworks(1)
    }
  }
}

// 查看作品详情
const viewArtwork = (artwork: Artwork) => {
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
    await loadAllArtworks(currentPage.value) // 重新加载当前页
  } catch (error: any) {
    console.error('删除作品失败:', error)
    alert('删除作品失败: ' + error.message)
  }
}

// 分页处理
const changePage = async (page: number, options?: { artist?: string }) => {
  currentPage.value = page

  // 如果传入了作者信息，使用作者特定的分页
  if (options?.artist) {
    currentArtist.value = options.artist
  }

  if (searchQuery.value.trim()) {
    // 如果有搜索查询，重新搜索
    try {
      const offset = (page - 1) * pageSize
      const result = await repositoryStore.searchArtworks(searchQuery.value, offset, pageSize)
      artworks.value = result.artworks
      totalItems.value = result.total
    } catch (error: any) {
      console.error('搜索失败:', error)
    }
  } else if (currentArtist.value) {
    // 如果当前在查看特定作者的作品
    try {
      const offset = (page - 1) * pageSize
      const result = await repositoryStore.getArtworksByArtist(currentArtist.value, offset, pageSize)
      artworks.value = result.artworks
      totalItems.value = result.total || result.artworks.length
    } catch (error: any) {
      console.error('加载作者作品失败:', error)
    }
  } else {
    // 否则加载指定页面的所有作品
    await loadAllArtworks(page)
  }
}

// 选择下载目录
const selectDownloadDir = async () => {
  try {
    // 使用简单的prompt方式，让用户输入完整路径
    const dir = prompt('请输入下载目录的完整路径:', config.value.downloadDir || './downloads')
    if (dir && dir.trim()) {
      config.value.downloadDir = dir.trim()
    }
  } catch (error: any) {
    console.error('选择目录失败:', error)
    alert('选择目录失败，请手动输入路径')
  }
}

// 验证目录路径
const validateDirectory = async (path: string) => {
  try {
    // 这里可以添加后端API调用来验证目录是否存在
    // 暂时使用简单的客户端验证
    if (!path || path.trim() === '') {
      return { valid: false, message: '路径不能为空' }
    }

    // 检查路径格式
    const trimmedPath = path.trim()
    if (trimmedPath.includes('..') || trimmedPath.includes('//')) {
      return { valid: false, message: '路径格式不正确' }
    }

    return { valid: true, message: '路径格式正确' }
  } catch (error: any) {
    return { valid: false, message: '验证失败: ' + error.message }
  }
}

// 测试下载目录
const testDownloadDir = async () => {
  const validation = await validateDirectory(config.value.downloadDir)
  if (validation.valid) {
    alert('路径格式正确！保存配置后系统会验证目录是否存在。')
  } else {
    alert('路径验证失败: ' + validation.message)
  }
}

// 处理配置保存后的刷新
const handleConfigSaved = async () => {
  try {
    // 重新加载所有数据
    await loadStats()
    await loadConfig()
    await loadArtists()
    await loadAllArtworks(1)

    console.log('配置保存后数据刷新完成')
  } catch (error: any) {
    console.error('配置保存后刷新数据失败:', error)
  }
}

// 执行完整扫描
const performFullScan = async () => {
  try {
    isScanning.value = true
    scanProgress.value = 0
    scanStatus.value = '开始扫描...'

    const result = await repositoryStore.scanRepository({
      maxConcurrency: 5, // 减少并发数，避免文件句柄过多
      useCache: true,
      forceRefresh: true
    })

    scanStatus.value = '扫描完成'
    scanProgress.value = 100

    // 重新加载数据
    await loadStats()
    await loadArtists()
    await loadAllArtworks(1)

    alert(`扫描完成！发现 ${result.artworks.length} 个作品，${result.artists.length} 个作者`)
  } catch (error: any) {
    console.error('扫描失败:', error)
    alert('扫描失败: ' + error.message)
  } finally {
    isScanning.value = false
    scanStatus.value = ''
    scanProgress.value = 0
  }
}

// 清除扫描缓存
const clearCache = async () => {
  try {
    await repositoryStore.clearScanCache()
    alert('扫描缓存已清除')
  } catch (error: any) {
    console.error('清除缓存失败:', error)
    alert('清除缓存失败: ' + error.message)
  }
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

.scan-controls {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.scan-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.scan-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.scan-button:hover:not(:disabled) {
  background: #2563eb;
}

.scan-button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.clear-cache-button {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-cache-button:hover {
  background: #4b5563;
}

.scan-progress {
  margin-top: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #6b7280;
  text-align: center;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .scan-buttons {
    flex-direction: column;
  }
}
</style>