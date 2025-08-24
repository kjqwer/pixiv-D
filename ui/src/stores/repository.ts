import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface RepositoryConfig {
  downloadDir: string
  fileStructure: 'artist/artwork' | 'artwork' | 'flat'
  namingPattern: string
  maxFileSize: number
  allowedExtensions: string[]
  autoMigration: boolean
  migrationRules: any[]
}

export interface RepositoryStats {
  totalArtworks: number
  totalArtists: number
  totalSize: number
  diskUsage: {
    total: number
    used: number
    free: number
    usagePercent: number
    note?: string
  }
  lastScan: string
}

export interface Artist {
  name: string
  artworkCount: number
  totalSize: number
  lastUpdated: number | null
}

export interface ArtworkFile {
  name: string
  path: string
  size: number
  extension: string
  modifiedAt: string
}

export interface Artwork {
  id: string
  title: string
  artist: string
  artistPath: string
  path: string
  files: ArtworkFile[]
  size: number
  createdAt: string
}

export interface MigrationResult {
  success: boolean
  message: string
  log: Array<{
    type: string
    id: string
    title: string
    source?: string
    target?: string
    status: 'success' | 'skipped'
    reason?: string
  }>
  totalMigrated: number
}

export const useRepositoryStore = defineStore('repository', () => {
  const config = ref<RepositoryConfig | null>(null)
  const stats = ref<RepositoryStats | null>(null)

  // API基础URL
  const API_BASE = '/api/repository'

  // 通用API调用函数
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data || data
  }

  // 初始化仓库
  const initialize = async () => {
    return await apiCall('/initialize', { method: 'POST' })
  }

  // 获取配置
  const getConfig = async (): Promise<RepositoryConfig> => {
    const result = await apiCall('/config')
    config.value = result
    return result
  }

  // 更新配置
  const updateConfig = async (newConfig: Partial<RepositoryConfig>) => {
    const result = await apiCall('/config', {
      method: 'PUT',
      body: JSON.stringify(newConfig),
    })
    if (config.value) {
      config.value = { ...config.value, ...newConfig }
    }
    return result
  }

  // 重置配置
  const resetConfig = async (): Promise<any> => {
    const result = await apiCall('/config/reset', {
      method: 'POST',
    })
    // 重新加载配置
    config.value = await getConfig()
    return result
  }

  // 获取统计信息
  const getStats = async (forceRefresh = false): Promise<RepositoryStats> => {
    const result = await apiCall(`/stats${forceRefresh ? '?forceRefresh=true' : ''}`)
    stats.value = result
    return result
  }

  // 获取作者列表
  const getArtists = async (offset = 0, limit = 50) => {
    return await apiCall(`/artists?offset=${offset}&limit=${limit}`)
  }

  // 获取作者作品
  const getArtworksByArtist = async (artistName: string, offset = 0, limit = 50) => {
    return await apiCall(`/artists/${encodeURIComponent(artistName)}/artworks?offset=${offset}&limit=${limit}`)
  }

  // 获取所有作品
  const getAllArtworks = async (offset = 0, limit = 50) => {
    return await apiCall(`/artworks?offset=${offset}&limit=${limit}`)
  }

  // 搜索作品
  const searchArtworks = async (query: string, offset = 0, limit = 50) => {
    return await apiCall(`/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`)
  }

  // 获取作品详情
  const getArtwork = async (artworkId: string): Promise<Artwork> => {
    return await apiCall(`/artworks/${artworkId}`)
  }

  // 删除作品
  const deleteArtwork = async (artworkId: string) => {
    return await apiCall(`/artworks/${artworkId}`, { method: 'DELETE' })
  }

  // 迁移旧项目
  const migrateOldProjects = async (sourceDir: string): Promise<MigrationResult> => {
    return await apiCall('/migrate', {
      method: 'POST',
      body: JSON.stringify({ sourceDir }),
    })
  }

  // 获取文件信息
  const getFileInfo = async (filePath: string) => {
    return await apiCall(`/file-info?path=${encodeURIComponent(filePath)}`)
  }

  // 获取目录结构
  const getDirectory = async (dirPath = '') => {
    return await apiCall(`/directory?path=${encodeURIComponent(dirPath)}`)
  }

  // 检查作品是否已下载
  const checkArtworkDownloaded = async (artworkId: number) => {
    return await apiCall(`/check-downloaded/${artworkId}`)
  }

  // 检查目录是否存在
  const checkDirectoryExists = async (dirPath: string) => {
    return await apiCall(`/check-directory?path=${encodeURIComponent(dirPath)}`)
  }

  // 从旧目录迁移到新目录
  const migrateFromOldToNew = async (oldDir: string, newDir: string) => {
    return await apiCall('/migrate-old-to-new', {
      method: 'POST',
      body: JSON.stringify({ oldDir, newDir }),
    })
  }

  return {
    // 状态
    config,
    stats,

    // 方法
    initialize,
    getConfig,
    updateConfig,
    resetConfig,
    getStats,
    getArtists,
    getArtworksByArtist,
    getAllArtworks,
    searchArtworks,
    getArtwork,
    deleteArtwork,
    migrateOldProjects,
    getFileInfo,
    getDirectory,
    checkArtworkDownloaded,
    checkDirectoryExists,
    migrateFromOldToNew,
  }
}) 