const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec } = require('child_process')
const ConfigManager = require('../config/config-manager')
const execAsync = promisify(exec)

class RepositoryService {
  constructor() {
    // 初始化配置管理器
    this.configManager = new ConfigManager()
    this.config = null
  }

  // 获取当前工作目录（基于配置）
  getCurrentBaseDir() {
    if (this.config && this.config.downloadDir) {
      // 如果是相对路径，转换为绝对路径
      return path.isAbsolute(this.config.downloadDir) 
        ? this.config.downloadDir 
        : path.resolve(process.cwd(), this.config.downloadDir)
    }
    // 默认返回项目根目录下的downloads文件夹
    return path.resolve(process.cwd(), 'downloads')
  }

  // 初始化仓库
  async initialize() {
    try {
      // 初始化配置管理器
      await this.configManager.initialize()
      
      // 加载配置
      await this.loadConfig()
      
      // 确保下载目录存在
      const currentBaseDir = this.getCurrentBaseDir()
      await fs.mkdir(currentBaseDir, { recursive: true })
      
      return { success: true, message: '仓库初始化成功' }
    } catch (error) {
      throw new Error(`仓库初始化失败: ${error.message}`)
    }
  }

  // 加载配置
  async loadConfig() {
    try {
      this.config = await this.configManager.readConfig()
    } catch (error) {
      console.error('加载配置失败:', error)
      // 如果加载失败，使用默认配置
      this.config = await this.configManager.readConfig()
    }
  }

  // 保存配置
  async saveConfig() {
    try {
      await this.configManager.saveConfig(this.config)
    } catch (error) {
      throw new Error(`保存配置失败: ${error.message}`)
    }
  }

  // 获取仓库配置
  async getConfig() {
    await this.loadConfig()
    return this.config
  }

  // 更新仓库配置
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    await this.saveConfig()
    return { success: true, message: '配置更新成功' }
  }

  // 重置仓库配置为默认值
  async resetConfig() {
    try {
      this.config = await this.configManager.resetToDefault()
      return { success: true, message: '配置已重置为默认值' }
    } catch (error) {
      throw new Error(`重置配置失败: ${error.message}`)
    }
  }

  // 获取仓库统计信息
  async getStats() {
    try {
      const stats = await this.scanRepository()
      return {
        totalArtworks: stats.artworks.length,
        totalArtists: stats.artists.length,
        totalSize: stats.totalSize,
        diskUsage: await this.getDiskUsage(),
        lastScan: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`获取统计信息失败: ${error.message}`)
    }
  }

  // 扫描仓库
  async scanRepository() {
    const artworks = []
    const artists = new Set()
    let totalSize = 0

    try {
      // 确保配置已加载
      await this.loadConfig()
      
      // 使用当前配置的目录
      const currentBaseDir = this.getCurrentBaseDir()
      
      // 扫描作者目录
      const artistEntries = await fs.readdir(currentBaseDir, { withFileTypes: true })
      
      for (const artistEntry of artistEntries) {
        if (!artistEntry.isDirectory()) continue
        
        // 跳过配置文件和隐藏文件
        if (artistEntry.name.startsWith('.') || artistEntry.name === '.repository-config.json') {
          continue
        }
        
        const artistName = artistEntry.name
        const artistPath = path.join(currentBaseDir, artistName)
        
        // 扫描作者下的作品目录
        const artworkEntries = await fs.readdir(artistPath, { withFileTypes: true })
        
        for (const artworkEntry of artworkEntries) {
          if (!artworkEntry.isDirectory()) continue
          
          const fullPath = path.join(artistPath, artworkEntry.name)
          
          // 检查是否是作品目录（包含数字ID）
          const artworkMatch = artworkEntry.name.match(/^(\d+)_(.+)$/)
          if (artworkMatch) {
            const artworkId = artworkMatch[1]
            const title = artworkMatch[2]
            
            // 扫描作品文件
            const files = await this.scanArtworkFiles(fullPath)
            
            if (files.length > 0) {
              artworks.push({
                id: artworkId,
                title: title,
                artist: artistName,
                artistPath: artistPath,
                path: fullPath,
                files: files,
                size: files.reduce((sum, file) => sum + file.size, 0),
                createdAt: await this.getFileCreationTime(fullPath)
              })
              artists.add(artistName)
              totalSize += files.reduce((sum, file) => sum + file.size, 0)
            }
          }
        }
      }
      
      return {
        artworks,
        artists: Array.from(artists),
        totalSize
      }
    } catch (error) {
      throw new Error(`扫描仓库失败: ${error.message}`)
    }
  }

  // 扫描作品文件
  async scanArtworkFiles(artworkPath) {
    try {
      // 确保配置已加载
      await this.loadConfig()
      
      const files = []
      const entries = await fs.readdir(artworkPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(artworkPath, entry.name)
          const ext = path.extname(entry.name).toLowerCase()
          
          if (this.config.allowedExtensions.includes(ext)) {
            const stats = await fs.stat(filePath)
            const currentBaseDir = this.getCurrentBaseDir()
            files.push({
              name: entry.name,
              path: path.relative(currentBaseDir, filePath),
              size: stats.size,
              extension: ext,
              modifiedAt: stats.mtime
            })
          }
        }
      }
      
      return files
    } catch (error) {
      return []
    }
  }

  // 获取文件创建时间
  async getFileCreationTime(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.birthtime
    } catch (error) {
      return new Date()
    }
  }

  // 获取磁盘使用情况
  async getDiskUsage() {
    try {
      const currentBaseDir = this.getCurrentBaseDir()
      
      // 尝试使用 fs.statfs (Node.js 内置方法)
      try {
        const stats = await fs.statfs(currentBaseDir)
        const total = stats.blocks * stats.bsize
        const free = stats.bavail * stats.bsize
        const used = total - free
        
        return {
          total,
          used,
          free,
          usagePercent: Math.round((used / total) * 100)
        }
      } catch (statfsError) {
        console.log('fs.statfs 不可用，尝试使用系统命令:', statfsError.message)
        
        // 如果 fs.statfs 不可用，尝试使用系统命令
        if (process.platform === 'win32') {
          // Windows 系统
          try {
            const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption')
            const lines = stdout.trim().split('\n').slice(1) // 跳过标题行
            
            for (const line of lines) {
              const parts = line.trim().split(/\s+/)
              if (parts.length >= 3) {
                const caption = parts[0]
                const freeSpace = parseInt(parts[1])
                const totalSize = parseInt(parts[2])
                
                // 检查当前目录是否在这个磁盘上
                if (currentBaseDir.toUpperCase().startsWith(caption.toUpperCase())) {
                  const used = totalSize - freeSpace
                  return {
                    total: totalSize,
                    used,
                    free: freeSpace,
                    usagePercent: Math.round((used / totalSize) * 100)
                  }
                }
              }
            }
          } catch (wmicError) {
            console.log('wmic 命令失败:', wmicError.message)
          }
        } else {
          // Unix/Linux 系统
          try {
            const { stdout } = await execAsync(`df -B1 "${currentBaseDir}" | tail -1`)
            const parts = stdout.trim().split(/\s+/)
            if (parts.length >= 4) {
              const total = parseInt(parts[1])
              const used = parseInt(parts[2])
              const free = parseInt(parts[3])
              
              return {
                total,
                used,
                free,
                usagePercent: Math.round((used / total) * 100)
              }
            }
          } catch (dfError) {
            console.log('df 命令失败:', dfError.message)
          }
        }
        
        // 如果所有方法都失败，返回默认值
        console.log('无法获取磁盘使用情况，返回默认值')
        return { total: 0, used: 0, free: 0, usagePercent: 0 }
      }
    } catch (error) {
      console.error('获取磁盘使用情况失败:', error)
      return { total: 0, used: 0, free: 0, usagePercent: 0 }
    }
  }

  // 获取作者作品
  async getArtworksByArtist(artistName, offset = 0, limit = 50) {
    try {
      const stats = await this.scanRepository()
      const artistArtworks = stats.artworks.filter(artwork => 
        artwork.artist.toLowerCase() === artistName.toLowerCase()
      )
      
      return {
        artworks: artistArtworks.slice(offset, offset + limit),
        total: artistArtworks.length,
        offset,
        limit
      }
    } catch (error) {
      throw new Error(`获取作者作品失败: ${error.message}`)
    }
  }

  // 按作品ID查找
  async findArtworkById(artworkId) {
    try {
      const stats = await this.scanRepository()
      return stats.artworks.find(artwork => artwork.id === artworkId)
    } catch (error) {
      throw new Error(`查找作品失败: ${error.message}`)
    }
  }

  // 检查作品是否已下载
  async isArtworkDownloaded(artworkId) {
    try {
      // 确保配置已加载
      await this.loadConfig()
      
      // 使用当前配置的目录
      const currentBaseDir = this.getCurrentBaseDir()
      
      // 扫描所有作者目录
      const artistEntries = await fs.readdir(currentBaseDir, { withFileTypes: true })
      
      for (const artistEntry of artistEntries) {
        if (!artistEntry.isDirectory()) continue
        
        // 跳过配置文件和隐藏文件
        if (artistEntry.name.startsWith('.') || artistEntry.name === '.repository-config.json') {
          continue
        }
        
        const artistPath = path.join(currentBaseDir, artistEntry.name)
        
        // 扫描作者下的作品目录
        const artworkEntries = await fs.readdir(artistPath, { withFileTypes: true })
        
        for (const artworkEntry of artworkEntries) {
          if (!artworkEntry.isDirectory()) continue
          
          // 检查是否是目标作品目录（包含数字ID）
          const artworkMatch = artworkEntry.name.match(/^(\d+)_(.+)$/)
          if (artworkMatch && artworkMatch[1] === artworkId.toString()) {
            // 检查作品目录中是否有图片文件
            const artworkPath = path.join(artistPath, artworkEntry.name)
            const files = await this.scanArtworkFiles(artworkPath)
            return files.length > 0
          }
        }
      }
      
      return false
    } catch (error) {
      console.error('检查作品下载状态失败:', error)
      return false
    }
  }

  // 检查目录是否存在
  async checkDirectoryExists(dirPath) {
    try {
      // 如果是相对路径，转换为绝对路径
      const fullPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath)
      
      const stats = await fs.stat(fullPath)
      return stats.isDirectory()
    } catch (error) {
      return false
    }
  }

  // 搜索作品
  async searchArtworks(query, offset = 0, limit = 50) {
    try {
      const stats = await this.scanRepository()
      const filtered = stats.artworks.filter(artwork =>
        artwork.title.toLowerCase().includes(query.toLowerCase()) ||
        artwork.artist.toLowerCase().includes(query.toLowerCase()) ||
        artwork.id.includes(query)
      )
      
      return {
        artworks: filtered.slice(offset, offset + limit),
        total: filtered.length,
        offset,
        limit
      }
    } catch (error) {
      throw new Error(`搜索作品失败: ${error.message}`)
    }
  }

  // 获取所有作者列表
  async getArtists(offset = 0, limit = 50) {
    try {
      const stats = await this.scanRepository()
      const artists = stats.artists.slice(offset, offset + limit)
      
      // 获取每个作者的统计信息
      const artistsWithStats = artists.map(artistName => {
        const artistArtworks = stats.artworks.filter(artwork => artwork.artist === artistName)
        const totalSize = artistArtworks.reduce((sum, artwork) => sum + artwork.size, 0)
        
        return {
          name: artistName,
          artworkCount: artistArtworks.length,
          totalSize,
          lastUpdated: artistArtworks.length > 0 
            ? Math.max(...artistArtworks.map(a => new Date(a.createdAt).getTime()))
            : null
        }
      })
      
      return {
        artists: artistsWithStats,
        total: stats.artists.length,
        offset,
        limit
      }
    } catch (error) {
      throw new Error(`获取作者列表失败: ${error.message}`)
    }
  }

  // 自动迁移旧项目
  async migrateOldProjects(sourceDir) {
    try {
      // 确保配置已加载
      await this.loadConfig()
      
      const currentBaseDir = this.getCurrentBaseDir()
      const result = {
        success: true,
        message: '迁移完成',
        log: [],
        totalMigrated: 0
      }
      
      // 确保目标目录存在
      await fs.mkdir(currentBaseDir, { recursive: true })
      
      // 扫描源目录
      const sourceEntries = await fs.readdir(sourceDir, { withFileTypes: true })
      
      for (const entry of sourceEntries) {
        if (!entry.isDirectory()) continue
        
        const oldDirPath = path.join(sourceDir, entry.name)
        const newDirPath = path.join(currentBaseDir, entry.name)
        
        // 检查是否已存在
        try {
          await fs.access(newDirPath)
          result.log.push({
            id: entry.name,
            title: entry.name,
            status: 'skipped',
            reason: '目录已存在'
          })
          continue
        } catch (error) {
          // 目录不存在，可以迁移
        }
        
        try {
          // 直接移动整个目录
          await fs.rename(oldDirPath, newDirPath)
          
          result.log.push({
            id: entry.name,
            title: entry.name,
            status: 'success'
          })
          result.totalMigrated++
          
        } catch (error) {
          result.log.push({
            id: entry.name,
            title: entry.name,
            status: 'error',
            reason: error.message
          })
        }
      }
      
      return result
    } catch (error) {
      throw new Error(`迁移失败: ${error.message}`)
    }
  }

  // 从旧目录迁移到新目录
  async migrateFromOldToNew(oldDir, newDir) {
    try {
      const result = {
        success: true,
        message: '迁移完成',
        log: [],
        totalMigrated: 0
      }
      
      // 检查旧目录是否存在
      try {
        await fs.access(oldDir)
      } catch (error) {
        return {
          ...result,
          message: '旧目录不存在，无需迁移'
        }
      }
      
      // 确保新目录存在
      await fs.mkdir(newDir, { recursive: true })
      
      // 扫描旧目录
      const oldEntries = await fs.readdir(oldDir, { withFileTypes: true })
      
      for (const entry of oldEntries) {
        if (!entry.isDirectory()) continue
        
        const oldEntryPath = path.join(oldDir, entry.name)
        const newEntryPath = path.join(newDir, entry.name)
        
        // 检查是否已存在
        try {
          await fs.access(newEntryPath)
          result.log.push({
            id: entry.name,
            title: entry.name,
            status: 'skipped',
            reason: '目录已存在'
          })
          continue
        } catch (error) {
          // 目录不存在，可以迁移
        }
        
        try {
          // 直接移动整个目录
          await fs.rename(oldEntryPath, newEntryPath)
          
          result.log.push({
            id: entry.name,
            title: entry.name,
            status: 'success'
          })
          result.totalMigrated++
          
        } catch (error) {
          result.log.push({
            id: entry.name,
            title: entry.name,
            status: 'error',
            reason: error.message
          })
        }
      }
      
      return result
    } catch (error) {
      throw new Error(`迁移失败: ${error.message}`)
    }
  }

  // 复制目录
  async copyDirectory(source, target) {
    try {
      await fs.mkdir(target, { recursive: true })
      const entries = await fs.readdir(source, { withFileTypes: true })
      
      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name)
        const targetPath = path.join(target, entry.name)
        
        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath)
        } else {
          await fs.copyFile(sourcePath, targetPath)
        }
      }
    } catch (error) {
      throw new Error(`复制目录失败: ${error.message}`)
    }
  }

  // 删除作品
  async deleteArtwork(artworkId) {
    try {
      const artwork = await this.findArtworkById(artworkId)
      if (!artwork) {
        throw new Error('作品不存在')
      }
      
      await fs.rm(artwork.path, { recursive: true, force: true })
      
      // 检查作者目录是否为空，如果为空则删除
      const artistDir = artwork.artistPath
      const artistArtworks = await this.getArtworksByArtist(artwork.artist)
      if (artistArtworks.artworks.length === 0) {
        await fs.rmdir(artistDir)
      }
      
      return { success: true, message: '作品删除成功' }
    } catch (error) {
      throw new Error(`删除作品失败: ${error.message}`)
    }
  }

  // 获取文件预览URL
  async getFilePreviewUrl(filePath) {
    // 这里可以返回一个代理URL，用于前端预览
    const relativePath = path.relative(this.baseDir, filePath)
    return `/api/repository/preview?path=${encodeURIComponent(relativePath)}`
  }
}

module.exports = RepositoryService 