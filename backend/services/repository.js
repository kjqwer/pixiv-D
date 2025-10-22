const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec } = require('child_process')
const ConfigManager = require('../config/config-manager')
const execAsync = promisify(exec)
const { defaultLogger } = require('../utils/logger');
const artworkUtils = require('../utils/artwork-utils');

// 创建logger实例
const logger = defaultLogger.child('RepositoryService');



class RepositoryService {
  constructor() {
    // 初始化配置管理器
    this.configManager = new ConfigManager()
    this.config = null
    
    // 配置加载状态
    this.configLoaded = false
    this.configLoading = false
    
    // 磁盘使用情况缓存
    this.diskUsageCache = {
      data: null,
      timestamp: 0,
      cacheDuration: 5 * 60 * 1000 // 5分钟缓存
    }
    
    // 文件扫描缓存
    this.scanCache = {
      data: null,
      timestamp: 0,
      cacheDuration: 10 * 60 * 1000 // 10分钟缓存
    }
    
    // 缓存文件路径
    this.cacheFilePath = null
    this.scanCacheFilePath = null
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
      
      // 初始化缓存文件路径
      this.cacheFilePath = path.join(path.dirname(this.configManager.getConfigPath()), 'disk-usage-cache.json')
      this.scanCacheFilePath = path.join(path.dirname(this.configManager.getConfigPath()), 'scan-cache.json')
      
      // 加载持久化缓存
      await this.loadPersistentCache()
      await this.loadScanCache()
      
      return { success: true, message: '仓库初始化成功' }
    } catch (error) {
      throw new Error(`仓库初始化失败: ${error.message}`)
    }
  }

  // 加载配置 - 优化版本，支持缓存和防重复加载
  async loadConfig() {
    // 如果配置已加载，直接返回
    if (this.configLoaded && this.config) {
      return this.config
    }
    
    // 如果正在加载，等待加载完成
    if (this.configLoading) {
      while (this.configLoading) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return this.config
    }
    
    // 开始加载配置
    this.configLoading = true
    
    try {
      this.config = await this.configManager.readConfig()
      this.configLoaded = true
      logger.info('配置加载成功')
      return this.config
    } catch (error) {
      logger.error('加载配置失败，使用默认配置:', error)
      // 如果加载失败，使用默认配置对象
      this.config = {
        downloadDir: "./downloads",
        fileStructure: "artist/artwork",
        namingPattern: "{artist_name}/{artwork_id}_{title}",
        maxFileSize: 0,
        allowedExtensions: [".jpg", ".png", ".gif", ".webp"],
        autoMigration: false,
        migrationRules: [],
        lastUpdated: new Date().toISOString()
      }
      this.configLoaded = true
      return this.config
    } finally {
      this.configLoading = false
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
  async getStats(forceRefresh = false) {
    try {
      const stats = await this.scanRepository()
      return {
        totalArtworks: stats.artworks.length,
        totalArtists: stats.artists.length,
        totalSize: stats.totalSize,
        diskUsage: await this.getDiskUsage(forceRefresh),
        lastScan: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`获取统计信息失败: ${error.message}`)
    }
  }

  // 扫描仓库 - 优化版本，支持并发扫描
  async scanRepository(options = {}) {
    const { 
      maxConcurrency = 5, // 减少默认并发数，避免文件句柄过多
      useCache = true, 
      forceRefresh = false,
      progressCallback = null 
    } = options

    // 检查缓存
    if (useCache && !forceRefresh) {
      const cachedResult = await this.getCachedScanResult()
      if (cachedResult) {
        logger.info('使用缓存的扫描结果')
        return cachedResult
      }
    }

    const artworks = []
    const artists = new Set()
    let totalSize = 0
    let processedArtists = 0

    try {
      // 确保配置已加载（使用缓存版本）
      if (!this.configLoaded) {
        await this.loadConfig()
      }
      
      // 使用当前配置的目录
      const currentBaseDir = this.getCurrentBaseDir()
      
      // 扫描作者目录
      const artistEntries = await fs.readdir(currentBaseDir, { withFileTypes: true })
      const artistDirs = artistEntries
        .filter(entry => entry.isDirectory() && 
                        !entry.name.startsWith('.') && 
                        entry.name !== '.repository-config.json')
        .map(entry => ({
          name: entry.name,
          path: path.join(currentBaseDir, entry.name)
        }))

      logger.info(`开始并发扫描 ${artistDirs.length} 个作者目录`)

      // 并发处理作者目录
      const artistPromises = artistDirs.map(async (artistDir) => {
        try {
          const artistName = artistDir.name
          const artistPath = artistDir.path
          
          // 扫描作者下的作品目录
          const artworkEntries = await fs.readdir(artistPath, { withFileTypes: true })
          const artworkDirs = artworkEntries
            .filter(entry => entry.isDirectory())
            .map(entry => ({
              name: entry.name,
              path: path.join(artistPath, entry.name)
            }))

          // 并发扫描作品文件
          const artworkPromises = artworkDirs.map(async (artworkDir) => {
            try {
              const fullPath = artworkDir.path
              
              // 检查是否是作品目录（包含数字ID）
              const artworkMatch = artworkDir.name.match(/^(\d+)_(.+)$/)
              if (!artworkMatch) return null
              
              const artworkId = artworkMatch[1]
              const title = artworkMatch[2]
              
              // 扫描作品文件
              const files = await this.scanArtworkFiles(fullPath)
              
              if (files.length > 0) {
                const artworkSize = files.reduce((sum, file) => sum + file.size, 0)
                return {
                  id: artworkId,
                  title: title,
                  artist: artistName,
                  artistPath: artistPath,
                  path: fullPath,
                  files: files,
                  size: artworkSize,
                  createdAt: await this.getFileCreationTime(fullPath)
                }
              }
              return null
            } catch (error) {
              logger.warn(`扫描作品目录失败 ${artworkDir.path}:`, error.message)
              return null
            }
          })

          // 等待所有作品扫描完成
          const artworkResults = await Promise.all(artworkPromises)
          const validArtworks = artworkResults.filter(artwork => artwork !== null)
          
          processedArtists++
          if (progressCallback) {
            progressCallback({
              type: 'artist_completed',
              artist: artistName,
              artworkCount: validArtworks.length,
              progress: Math.round((processedArtists / artistDirs.length) * 100)
            })
          }

          return validArtworks
        } catch (error) {
          logger.warn(`扫描作者目录失败 ${artistDir.path}:`, error.message)
          return []
        }
      })

      // 分批处理，避免过多并发
      const batchSize = maxConcurrency
      for (let i = 0; i < artistPromises.length; i += batchSize) {
        const batch = artistPromises.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch)
        
        // 处理批次结果
        for (const artistArtworks of batchResults) {
          for (const artwork of artistArtworks) {
            artworks.push(artwork)
            artists.add(artwork.artist)
            totalSize += artwork.size
          }
        }

        // 更新进度
        if (progressCallback) {
          progressCallback({
            type: 'batch_completed',
            processed: Math.min(i + batchSize, artistDirs.length),
            total: artistDirs.length,
            progress: Math.round((Math.min(i + batchSize, artistDirs.length) / artistDirs.length) * 100)
          })
        }
      }
      
      const result = {
        artworks,
        artists: Array.from(artists),
        totalSize,
        scanTime: Date.now()
      }

      // 缓存结果
      if (useCache) {
        await this.cacheScanResult(result)
      }

      logger.info(`扫描完成: ${artworks.length} 个作品, ${artists.size} 个作者, 总大小: ${Math.round(totalSize / 1024 / 1024)}MB`)
      
      return result
    } catch (error) {
      throw new Error(`扫描仓库失败: ${error.message}`)
    }
  }

  // 扫描作品文件 - 优化版本，支持并发扫描和批量统计
  async scanArtworkFiles(artworkPath) {
    try {
      // 确保配置已加载（使用缓存版本）
      if (!this.configLoaded) {
        await this.loadConfig()
      }
      
      const entries = await fs.readdir(artworkPath, { withFileTypes: true })
      const fileEntries = entries.filter(entry => entry.isFile())
      
      // 过滤允许的扩展名
      const allowedFiles = fileEntries.filter(entry => {
        const ext = path.extname(entry.name).toLowerCase()
        return this.config.allowedExtensions.includes(ext)
      })

      if (allowedFiles.length === 0) {
        return []
      }

      // 大幅减少并发数量，避免 "too many open files" 错误
      const batchSize = 3 // 进一步减少到3，更安全
      const results = []
      
      for (let i = 0; i < allowedFiles.length; i += batchSize) {
        const batch = allowedFiles.slice(i, i + batchSize)
        
        // 处理当前批次
        const batchPromises = batch.map(async (entry) => {
          try {
            const filePath = path.join(artworkPath, entry.name)
            const stats = await fs.stat(filePath)
            const currentBaseDir = this.getCurrentBaseDir()
            
            return {
              name: entry.name,
              path: path.relative(currentBaseDir, filePath),
              size: stats.size,
              extension: path.extname(entry.name).toLowerCase(),
              modifiedAt: stats.mtime
            }
          } catch (error) {
            logger.warn(`获取文件统计信息失败 ${entry.name}:`, error.message)
            return null
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        
        // 添加小延迟，让系统有时间关闭文件句柄
        if (i + batchSize < allowedFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 20)) // 增加延迟时间
        }
      }

      return results.filter(file => file !== null)
    } catch (error) {
      logger.warn(`扫描作品文件失败 ${artworkPath}:`, error.message)
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
  async getDiskUsage(forceRefresh = false) {
    try {
      const currentBaseDir = this.getCurrentBaseDir()
      
      // 检查是否在打包环境中
      const isPkg = process.pkg !== undefined
      
      // 尝试使用 fs.statfs (Node.js 内置方法) - 最快的方法
      if (!isPkg && typeof fs.statfs === 'function') {
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
          logger.info('fs.statfs 调用失败:', statfsError.message)
        }
      } else {
        logger.info('fs.statfs 在打包环境中不可用，尝试使用系统命令')
      }
      
      // 如果 fs.statfs 不可用，尝试使用系统命令
      if (process.platform === 'win32') {
        // Windows 系统 - 优先使用最快的命令
        const methods = [
          // 方法1: 使用 PowerShell (通常比 wmic 快)
          async () => {
            try {
              // 设置超时，避免长时间等待
              const { stdout } = await Promise.race([
                execAsync('powershell "Get-WmiObject -Class Win32_LogicalDisk | Select-Object Size,FreeSpace,Caption | ConvertTo-Json"'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('PowerShell 超时')), 3000))
              ])
              
              const disks = JSON.parse(stdout)
              const diskArray = Array.isArray(disks) ? disks : [disks]
              
              for (const disk of diskArray) {
                const caption = disk.Caption
                const freeSpace = parseInt(disk.FreeSpace)
                const totalSize = parseInt(disk.Size)
                
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
            } catch (error) {
              logger.info('PowerShell 方法失败:', error.message)
              throw error
            }
          },
          
          // 方法2: 使用 wmic (备用方案)
          async () => {
            try {
              const { stdout } = await Promise.race([
                execAsync('wmic logicaldisk get size,freespace,caption /format:csv'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('wmic 超时')), 3000))
              ])
              
              const lines = stdout.trim().split('\n').slice(1) // 跳过标题行
              
              for (const line of lines) {
                const parts = line.split(',')
                if (parts.length >= 3) {
                  const caption = parts[0].trim()
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
            } catch (error) {
              logger.info('wmic 方法失败:', error.message)
              throw error
            }
          }
        ]
        
        // 尝试所有方法，但限制总时间
        for (const method of methods) {
          try {
            const result = await Promise.race([
              method(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('磁盘信息获取超时')), 5000))
            ])
            if (result) {
              return result
            }
          } catch (error) {
            logger.info(`磁盘使用情况获取方法失败:`, error.message)
            continue
          }
        }
      } else {
        // Unix/Linux 系统
        try {
          const { stdout } = await Promise.race([
            execAsync(`df -B1 "${currentBaseDir}" | tail -1`),
            new Promise((_, reject) => setTimeout(() => reject(new Error('df 命令超时')), 3000))
          ])
          
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
          logger.info('df 命令失败:', dfError.message)
        }
      }
      
      // 如果系统命令都失败，返回基于缓存的估算值
      return await this.getCachedDiskUsage(currentBaseDir, forceRefresh)
      
    } catch (error) {
      logger.error('获取磁盘使用情况失败:', error)
      return { 
        total: 0, 
        used: 0, 
        free: 0, 
        usagePercent: 0,
        note: '获取失败'
      }
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
          
          // 使用工具函数检查是否是目标作品目录
          const extractedArtworkId = await artworkUtils.extractArtworkIdFromDir(artworkEntry.name);
          if (extractedArtworkId && extractedArtworkId === parseInt(artworkId)) {
            const artworkPath = path.join(artistPath, artworkEntry.name)
            
            // 检查作品信息文件 - 这是最可靠的判断标准
            const infoPath = path.join(artworkPath, 'artwork_info.json')
            let artworkInfo;
            try {
              const infoContent = await fs.readFile(infoPath, 'utf8')
              artworkInfo = JSON.parse(infoContent)
            } catch (error) {
              // 信息文件不存在或无法读取，认为未下载
              return false
            }
            
            // 检查是否有图片文件
            const files = await this.scanArtworkFiles(artworkPath)
            if (files.length === 0) {
              // 有信息文件但没有图片文件，认为未下载
              return false
            }
            
            // 检查图片数量是否与artwork_info.json中记录的一致
            const expectedImageCount = artworkInfo.page_count || 1
            if (files.length < expectedImageCount) {
              // 图片文件数量不足，认为下载不完整
              logger.info(`作品 ${artworkId} 图片数量不匹配: 期望 ${expectedImageCount} 个，实际 ${files.length} 个`)
              return false
            }
            
            // 有信息文件、有图片文件且数量匹配，认为已下载
            // logger.info(`作品 ${artworkId} 已完整下载: ${files.length}/${expectedImageCount} 个图片文件`)
            return true
          }
        }
      }
      
      return false
    } catch (error) {
      logger.error('检查作品下载状态失败:', error)
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
  async deleteArtwork(artworkId, req) {
    try {
      // 优化：直接通过文件系统查找，避免全仓库扫描
      const artwork = await this.findArtworkByIdOptimized(artworkId)
      if (!artwork) {
        throw new Error('作品不存在')
      }
      
      // 从注册表中移除作品记录
      try {
        // 使用共享的下载服务实例，而不是创建新实例
        const downloadService = req.backend?.getDownloadService();
        if (downloadService) {
          await downloadService.downloadRegistry.removeArtwork(artwork.artist, artworkId);
          logger.debug('已从下载注册表中移除作品', { 
            artistName: artwork.artist, 
            artworkId: artworkId 
          });
        } else {
          logger.warn('无法获取下载服务实例，跳过注册表更新');
        }
      } catch (error) {
        logger.warn('从下载注册表中移除作品失败:', error.message);
      }
      
      await fs.rm(artwork.path, { recursive: true, force: true })
      
      // 优化：直接检查作者目录是否为空，避免重复扫描
      const artistDir = artwork.artistPath
      try {
        const artistEntries = await fs.readdir(artistDir, { withFileTypes: true })
        const hasArtworks = artistEntries.some(async (entry) => {
          if (!entry.isDirectory()) return false;
          return await artworkUtils.isArtworkDirectory(entry.name);
        });
        
        if (!hasArtworks) {
          await fs.rmdir(artistDir)
        }
      } catch (error) {
        // 如果读取目录失败，可能目录已经不存在，忽略错误
        logger.warn(`检查作者目录失败: ${error.message}`)
      }
      
      return { success: true, message: '作品删除成功' }
    } catch (error) {
      throw new Error(`删除作品失败: ${error.message}`)
    }
  }

  // 优化的作品查找方法：直接通过文件系统查找，避免全仓库扫描
  async findArtworkByIdOptimized(artworkId) {
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
        
        const artistName = artistEntry.name
        const artistPath = path.join(currentBaseDir, artistName)
        
        // 扫描作者下的作品目录
        const artworkEntries = await fs.readdir(artistPath, { withFileTypes: true })
        
        for (const artworkEntry of artworkEntries) {
          if (!artworkEntry.isDirectory()) continue
          
          // 使用工具函数检查是否是目标作品目录
          const extractedArtworkId = await artworkUtils.extractArtworkIdFromDir(artworkEntry.name);
          if (extractedArtworkId && extractedArtworkId === parseInt(artworkId)) {
            const artworkPath = path.join(artistPath, artworkEntry.name)
            const title = await artworkUtils.extractTitleFromDir(artworkEntry.name) || 'Unknown Title';
            
            // 找到目标作品，返回基本信息（不需要扫描文件详情）
            return {
              id: artworkId,
              title: title,
              artist: artistName,
              artistPath: artistPath,
              path: artworkPath
            }
          }
        }
      }
      
      return null // 未找到作品
    } catch (error) {
      throw new Error(`查找作品失败: ${error.message}`)
    }
  }

  // 加载持久化缓存
  async loadPersistentCache() {
    try {
      if (!this.cacheFilePath) {
        return
      }
      
      const cacheData = await fs.readFile(this.cacheFilePath, 'utf8')
      const cache = JSON.parse(cacheData)
      
      // 检查缓存是否有效（24小时内）
      const now = Date.now()
      const cacheAge = now - cache.timestamp
      const maxCacheAge = 24 * 60 * 60 * 1000 // 24小时
      
      if (cacheAge < maxCacheAge) {
        this.diskUsageCache.data = cache.data
        this.diskUsageCache.timestamp = cache.timestamp
        logger.info('已加载持久化缓存，缓存年龄:', Math.round(cacheAge / 1000 / 60), '分钟')
      } else {
        logger.info('持久化缓存已过期，将重新计算')
      }
    } catch (error) {
      logger.info('加载持久化缓存失败，将使用内存缓存:', error.message)
    }
  }

  // 保存持久化缓存
  async savePersistentCache() {
    try {
      if (!this.cacheFilePath || !this.diskUsageCache.data) {
        return
      }
      
      const cacheData = {
        data: this.diskUsageCache.data,
        timestamp: this.diskUsageCache.timestamp,
        savedAt: new Date().toISOString()
      }
      
      await fs.writeFile(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8')
      logger.info('持久化缓存已保存')
    } catch (error) {
      logger.error('保存持久化缓存失败:', error.message)
    }
  }

  // 清除磁盘使用情况缓存
  async clearDiskUsageCache() {
    try {
      // 清除内存缓存
      this.diskUsageCache.data = null
      this.diskUsageCache.timestamp = 0
      
      // 删除持久化缓存文件
      if (this.cacheFilePath) {
        try {
          await fs.unlink(this.cacheFilePath)
          logger.info('持久化缓存文件已删除')
        } catch (error) {
          logger.info('删除持久化缓存文件失败:', error.message)
        }
      }
      
      return { success: true, message: '缓存已清除' }
    } catch (error) {
      throw new Error(`清除缓存失败: ${error.message}`)
    }
  }

  // 获取缓存的磁盘使用情况
  async getCachedDiskUsage(currentBaseDir, forceRefresh = false) {
    const now = Date.now()
    
    // 检查内存缓存是否有效（除非强制刷新）
    if (!forceRefresh && this.diskUsageCache.data && 
        (now - this.diskUsageCache.timestamp) < this.diskUsageCache.cacheDuration) {
      logger.info('使用内存缓存的磁盘使用情况')
      return this.diskUsageCache.data
    }
    
    // 缓存过期或不存在，计算新的值
    try {
      // 快速估算：只计算前几层目录
      const estimatedSize = await this.quickDirectorySizeEstimate(currentBaseDir)
      
      // 基于估算值创建磁盘使用情况
      const estimatedTotal = Math.max(estimatedSize * 200, 100 * 1024 * 1024 * 1024) // 至少100GB
      const estimatedUsed = estimatedSize
      const estimatedFree = estimatedTotal - estimatedUsed
      
      const result = {
        total: estimatedTotal,
        used: estimatedUsed,
        free: estimatedFree,
        usagePercent: Math.round((estimatedUsed / estimatedTotal) * 100),
        note: '基于目录估算（缓存5分钟）'
      }
      
      // 更新内存缓存
      this.diskUsageCache.data = result
      this.diskUsageCache.timestamp = now
      
      // 保存到持久化缓存
      await this.savePersistentCache()
      
      return result
    } catch (error) {
      logger.info('快速估算失败，返回默认值:', error.message)
      return { 
        total: 0, 
        used: 0, 
        free: 0, 
        usagePercent: 0,
        note: '无法获取磁盘信息'
      }
    }
  }

  // 快速目录大小估算（只计算前几层）
  async quickDirectorySizeEstimate(dirPath, maxDepth = 2, currentDepth = 0) {
    try {
      if (currentDepth >= maxDepth) {
        return 0
      }
      
      let totalSize = 0
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      // 限制处理的文件数量，避免过长时间
      const maxFiles = 1000
      let processedFiles = 0
      
      for (const entry of entries) {
        if (processedFiles >= maxFiles) {
          break
        }
        
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          totalSize += await this.quickDirectorySizeEstimate(fullPath, maxDepth, currentDepth + 1)
        } else {
          try {
            const stats = await fs.stat(fullPath)
            totalSize += stats.size
            processedFiles++
          } catch (error) {
            // 忽略无法访问的文件
          }
        }
      }
      
      // 如果达到文件数量限制，进行估算
      if (processedFiles >= maxFiles) {
        const remainingEntries = entries.length - processedFiles
        const avgFileSize = totalSize / processedFiles
        totalSize += remainingEntries * avgFileSize
      }
      
      return totalSize
    } catch (error) {
      logger.error('快速目录大小估算失败:', error)
      return 0
    }
  }

  // 计算目录大小（完整版本，用于需要精确值时）
  async calculateDirectorySize(dirPath) {
    try {
      let totalSize = 0
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath)
        } else {
          try {
            const stats = await fs.stat(fullPath)
            totalSize += stats.size
          } catch (error) {
            // 忽略无法访问的文件
            logger.info(`无法访问文件: ${fullPath}`)
          }
        }
      }
      
      return totalSize
    } catch (error) {
      logger.error('计算目录大小失败:', error)
      return 0
    }
  }

  // 获取文件预览URL
  async getFilePreviewUrl(filePath) {
    // 这里可以返回一个代理URL，用于前端预览
    const relativePath = path.relative(this.baseDir, filePath)
    return `/api/repository/preview?path=${encodeURIComponent(relativePath)}`
  }

  // 获取缓存的扫描结果
  async getCachedScanResult() {
    try {
      const now = Date.now()
      
      // 检查内存缓存
      if (this.scanCache.data && 
          (now - this.scanCache.timestamp) < this.scanCache.cacheDuration) {
        return this.scanCache.data
      }
      
      // 检查持久化缓存
      if (this.scanCacheFilePath && await fs.access(this.scanCacheFilePath).then(() => true).catch(() => false)) {
        const cacheData = await fs.readFile(this.scanCacheFilePath, 'utf8')
        const cache = JSON.parse(cacheData)
        
        // 检查缓存是否有效
        const cacheAge = now - cache.timestamp
        if (cacheAge < this.scanCache.cacheDuration) {
          this.scanCache.data = cache.data
          this.scanCache.timestamp = cache.timestamp
          return cache.data
        }
      }
      
      return null
    } catch (error) {
      logger.warn('获取扫描缓存失败:', error.message)
      return null
    }
  }

  // 缓存扫描结果
  async cacheScanResult(result) {
    try {
      const now = Date.now()
      
      // 更新内存缓存
      this.scanCache.data = result
      this.scanCache.timestamp = now
      
      // 保存到持久化缓存
      if (this.scanCacheFilePath) {
        const cacheData = {
          data: result,
          timestamp: now,
          savedAt: new Date().toISOString()
        }
        
        await fs.writeFile(this.scanCacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8')
        logger.info('扫描结果已缓存')
      }
    } catch (error) {
      logger.warn('缓存扫描结果失败:', error.message)
    }
  }

  // 加载扫描缓存
  async loadScanCache() {
    try {
      if (!this.scanCacheFilePath) {
        return
      }
      
      const cacheData = await fs.readFile(this.scanCacheFilePath, 'utf8')
      const cache = JSON.parse(cacheData)
      
      // 检查缓存是否有效（10分钟内）
      const now = Date.now()
      const cacheAge = now - cache.timestamp
      const maxCacheAge = this.scanCache.cacheDuration
      
      if (cacheAge < maxCacheAge) {
        this.scanCache.data = cache.data
        this.scanCache.timestamp = cache.timestamp
        logger.info('已加载扫描缓存，缓存年龄:', Math.round(cacheAge / 1000 / 60), '分钟')
      } else {
        logger.info('扫描缓存已过期，将重新扫描')
      }
    } catch (error) {
      logger.info('加载扫描缓存失败，将重新扫描:', error.message)
    }
  }

  // 清除扫描缓存
  async clearScanCache() {
    try {
      // 清除内存缓存
      this.scanCache.data = null
      this.scanCache.timestamp = 0
      
      // 删除持久化缓存文件
      if (this.scanCacheFilePath) {
        try {
          await fs.unlink(this.scanCacheFilePath)
          logger.info('扫描缓存文件已删除')
        } catch (error) {
          logger.info('删除扫描缓存文件失败:', error.message)
        }
      }
      
      return { success: true, message: '扫描缓存已清除' }
    } catch (error) {
      throw new Error(`清除扫描缓存失败: ${error.message}`)
    }
  }

  // 快速扫描 - 仅获取基本信息，不扫描文件详情
  async quickScan() {
    try {
      // 确保配置已加载（使用缓存版本）
      if (!this.configLoaded) {
        await this.loadConfig()
      }
      const currentBaseDir = this.getCurrentBaseDir()
      
      const artistEntries = await fs.readdir(currentBaseDir, { withFileTypes: true })
      const artistDirs = artistEntries
        .filter(entry => entry.isDirectory() && 
                        !entry.name.startsWith('.') && 
                        entry.name !== '.repository-config.json')

      const artists = artistDirs.map(entry => entry.name)
      let totalArtworks = 0

      // 快速统计作品数量
      for (const artistDir of artistDirs) {
        try {
          const artistPath = path.join(currentBaseDir, artistDir.name)
          const artworkEntries = await fs.readdir(artistPath, { withFileTypes: true })
          const artworkDirs = artworkEntries.filter(entry => entry.isDirectory())
          totalArtworks += artworkDirs.length
        } catch (error) {
          logger.warn(`快速扫描作者目录失败 ${artistDir.name}:`, error.message)
        }
      }

      return {
        totalArtists: artists.length,
        totalArtworks,
        artists,
        scanTime: Date.now()
      }
    } catch (error) {
      throw new Error(`快速扫描失败: ${error.message}`)
    }
  }

  // 增量扫描 - 只扫描变更的目录和文件
  async incrementalScan(options = {}) {
    const { 
      maxConcurrency = 10, 
      useCache = true, 
      progressCallback = null 
    } = options

    try {
      // 确保配置已加载（使用缓存版本）
      if (!this.configLoaded) {
        await this.loadConfig()
      }
      const currentBaseDir = this.getCurrentBaseDir()
      
      // 获取上次扫描的时间戳
      const lastScanTime = this.scanCache.timestamp || 0
      const now = Date.now()
      
      // 如果缓存时间超过1小时，执行完整扫描
      if (now - lastScanTime > 60 * 60 * 1000) {
        logger.info('缓存过期，执行完整扫描')
        return await this.scanRepository(options)
      }

      const artworks = []
      const artists = new Set()
      let totalSize = 0
      let changedCount = 0

      // 扫描作者目录
      const artistEntries = await fs.readdir(currentBaseDir, { withFileTypes: true })
      const artistDirs = artistEntries
        .filter(entry => entry.isDirectory() && 
                        !entry.name.startsWith('.') && 
                        entry.name !== '.repository-config.json')

      logger.info(`开始增量扫描 ${artistDirs.length} 个作者目录`)

      // 并发处理作者目录
      const artistPromises = artistDirs.map(async (artistDir) => {
        try {
          const artistName = artistDir.name
          const artistPath = path.join(currentBaseDir, artistName)
          
          // 检查作者目录是否在缓存时间后有变更
          const artistStats = await fs.stat(artistPath)
          if (artistStats.mtime.getTime() <= lastScanTime) {
            // 目录未变更，跳过
            return []
          }

          changedCount++
          logger.debug(`检测到变更的作者目录: ${artistName}`)

          // 扫描作者下的作品目录
          const artworkEntries = await fs.readdir(artistPath, { withFileTypes: true })
          const artworkDirs = artworkEntries
            .filter(entry => entry.isDirectory())
            .map(entry => ({
              name: entry.name,
              path: path.join(artistPath, entry.name)
            }))

          // 并发扫描作品文件
          const artworkPromises = artworkDirs.map(async (artworkDir) => {
            try {
              const fullPath = artworkDir.path
              
              // 检查作品目录是否在缓存时间后有变更
              const artworkStats = await fs.stat(fullPath)
              if (artworkStats.mtime.getTime() <= lastScanTime) {
                // 作品目录未变更，跳过
                return null
              }

              // 检查是否是作品目录（包含数字ID）
              const artworkMatch = artworkDir.name.match(/^(\d+)_(.+)$/)
              if (!artworkMatch) return null
              
              const artworkId = artworkMatch[1]
              const title = artworkMatch[2]
              
              // 扫描作品文件
              const files = await this.scanArtworkFiles(fullPath)
              
              if (files.length > 0) {
                const artworkSize = files.reduce((sum, file) => sum + file.size, 0)
                return {
                  id: artworkId,
                  title: title,
                  artist: artistName,
                  artistPath: artistPath,
                  path: fullPath,
                  files: files,
                  size: artworkSize,
                  createdAt: await this.getFileCreationTime(fullPath)
                }
              }
              return null
            } catch (error) {
              logger.warn(`扫描作品目录失败 ${artworkDir.path}:`, error.message)
              return null
            }
          })

          // 等待所有作品扫描完成
          const artworkResults = await Promise.all(artworkPromises)
          return artworkResults.filter(artwork => artwork !== null)
        } catch (error) {
          logger.warn(`扫描作者目录失败 ${artistDir.path}:`, error.message)
          return []
        }
      })

      // 分批处理，避免过多并发
      const batchSize = maxConcurrency
      for (let i = 0; i < artistPromises.length; i += batchSize) {
        const batch = artistPromises.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch)
        
        // 处理批次结果
        for (const artistArtworks of batchResults) {
          for (const artwork of artistArtworks) {
            artworks.push(artwork)
            artists.add(artwork.artist)
            totalSize += artwork.size
          }
        }

        // 更新进度
        if (progressCallback) {
          progressCallback({
            type: 'incremental_progress',
            processed: Math.min(i + batchSize, artistDirs.length),
            total: artistDirs.length,
            changed: changedCount,
            progress: Math.round((Math.min(i + batchSize, artistDirs.length) / artistDirs.length) * 100)
          })
        }
      }
      
      const result = {
        artworks,
        artists: Array.from(artists),
        totalSize,
        scanTime: now,
        isIncremental: true,
        changedCount
      }

      // 更新缓存
      if (useCache) {
        await this.cacheScanResult(result)
      }

      logger.info(`增量扫描完成: ${artworks.length} 个作品, ${artists.size} 个作者, 变更: ${changedCount} 个目录`)
      
      return result
    } catch (error) {
      throw new Error(`增量扫描失败: ${error.message}`)
    }
  }
}

module.exports = RepositoryService