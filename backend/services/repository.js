const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec } = require('child_process')
const execAsync = promisify(exec)

class RepositoryService {
  constructor() {
    this.baseDir = process.env.DOWNLOAD_DIR || path.join(process.cwd(), 'downloads')
    this.configFile = path.join(this.baseDir, '.repository-config.json')
  }

  // 初始化仓库
  async initialize() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true })
      await this.loadConfig()
      return { success: true, message: '仓库初始化成功' }
    } catch (error) {
      throw new Error(`仓库初始化失败: ${error.message}`)
    }
  }

  // 加载配置
  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configFile, 'utf8')
      this.config = JSON.parse(configData)
    } catch (error) {
      // 如果配置文件不存在，创建默认配置
      this.config = {
        downloadDir: this.baseDir,
        autoMigration: false,
        migrationRules: [],
        fileStructure: 'artist/artwork', // artist/artwork, artwork, flat
        namingPattern: '{artist_name}/{artwork_id}_{title}',
        maxFileSize: 0, // 0表示无限制
        allowedExtensions: ['.jpg', '.png', '.gif', '.webp']
      }
      await this.saveConfig()
    }
  }

  // 保存配置
  async saveConfig() {
    try {
      await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2))
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
      
      // 扫描作者目录
      const artistEntries = await fs.readdir(this.baseDir, { withFileTypes: true })
      
      for (const artistEntry of artistEntries) {
        if (!artistEntry.isDirectory()) continue
        
        // 跳过配置文件和隐藏文件
        if (artistEntry.name.startsWith('.') || artistEntry.name === '.repository-config.json') {
          continue
        }
        
        const artistName = artistEntry.name
        const artistPath = path.join(this.baseDir, artistName)
        
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
            files.push({
              name: entry.name,
              path: path.relative(this.baseDir, filePath),
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
      const stats = await fs.statfs(this.baseDir)
      const total = stats.blocks * stats.bsize
      const free = stats.bavail * stats.bsize
      const used = total - free
      
      return {
        total,
        used,
        free,
        usagePercent: Math.round((used / total) * 100)
      }
    } catch (error) {
      return { total: 0, used: 0, free: 0, usagePercent: 0 }
    }
  }

  // 按作者浏览作品
  async getArtworksByArtist(artistName, offset = 0, limit = 20) {
    try {
      const stats = await this.scanRepository()
      const artistArtworks = stats.artworks.filter(artwork => 
        artwork.artist === artistName
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

  // 搜索作品
  async searchArtworks(query, offset = 0, limit = 20) {
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
      const migrationLog = []
      
      // 扫描源目录
      const scanSource = async (dirPath, relativePath = '') => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          const newRelativePath = path.join(relativePath, entry.name)
          
          if (entry.isDirectory()) {
            // 检查是否是作品目录
            const artworkMatch = entry.name.match(/^(\d+)_(.+)$/)
            if (artworkMatch) {
              const artworkId = artworkMatch[1]
              const title = artworkMatch[2]
              
              // 检查是否已存在
              const existingArtwork = await this.findArtworkById(artworkId)
              if (!existingArtwork) {
                // 迁移作品
                const targetPath = path.join(this.baseDir, newRelativePath)
                await fs.mkdir(path.dirname(targetPath), { recursive: true })
                await this.copyDirectory(fullPath, targetPath)
                
                migrationLog.push({
                  type: 'artwork',
                  id: artworkId,
                  title: title,
                  source: fullPath,
                  target: targetPath,
                  status: 'success'
                })
              } else {
                migrationLog.push({
                  type: 'artwork',
                  id: artworkId,
                  title: title,
                  source: fullPath,
                  status: 'skipped',
                  reason: '已存在'
                })
              }
            } else {
              // 递归扫描子目录
              await scanSource(fullPath, newRelativePath)
            }
          }
        }
      }
      
      await scanSource(sourceDir)
      
      return {
        success: true,
        message: '迁移完成',
        log: migrationLog,
        totalMigrated: migrationLog.filter(item => item.status === 'success').length
      }
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