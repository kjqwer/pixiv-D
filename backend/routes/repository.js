const express = require('express')
const path = require('path')
const fs = require('fs').promises
const RepositoryService = require('../services/repository')
const ResponseUtil = require('../utils/response')

const router = express.Router()
const repositoryService = new RepositoryService()

// 初始化仓库
router.post('/initialize', async (req, res) => {
  try {
    const result = await repositoryService.initialize()
    res.json(ResponseUtil.success(result))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取仓库配置
router.get('/config', async (req, res) => {
  try {
    const config = await repositoryService.getConfig()
    res.json(ResponseUtil.success(config))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 更新仓库配置
router.put('/config', async (req, res) => {
  try {
    const result = await repositoryService.updateConfig(req.body)
    res.json(ResponseUtil.success(result))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取仓库统计信息
router.get('/stats', async (req, res) => {
  try {
    const stats = await repositoryService.getStats()
    res.json(ResponseUtil.success(stats))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取所有作者列表
router.get('/artists', async (req, res) => {
  try {
    const { offset = 0, limit = 50 } = req.query
    const artists = await repositoryService.getArtists(parseInt(offset), parseInt(limit))
    res.json(ResponseUtil.success(artists))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取作者作品列表
router.get('/artists/:artistName/artworks', async (req, res) => {
  try {
    const { artistName } = req.params
    const { offset = 0, limit = 20 } = req.query
    const artworks = await repositoryService.getArtworksByArtist(
      artistName, 
      parseInt(offset), 
      parseInt(limit)
    )
    res.json(ResponseUtil.success(artworks))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 搜索作品
router.get('/search', async (req, res) => {
  try {
    const { q, offset = 0, limit = 20 } = req.query
    if (!q) {
      return res.status(400).json(ResponseUtil.error('搜索关键词不能为空'))
    }
    
    const results = await repositoryService.searchArtworks(q, parseInt(offset), parseInt(limit))
    res.json(ResponseUtil.success(results))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取作品详情
router.get('/artworks/:artworkId', async (req, res) => {
  try {
    const { artworkId } = req.params
    const artwork = await repositoryService.findArtworkById(artworkId)
    
    if (!artwork) {
      return res.status(404).json(ResponseUtil.error('作品不存在'))
    }
    
    res.json(ResponseUtil.success(artwork))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 删除作品
router.delete('/artworks/:artworkId', async (req, res) => {
  try {
    const { artworkId } = req.params
    const result = await repositoryService.deleteArtwork(artworkId)
    res.json(ResponseUtil.success(result))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 自动迁移旧项目
router.post('/migrate', async (req, res) => {
  try {
    const { sourceDir } = req.body
    if (!sourceDir) {
      return res.status(400).json(ResponseUtil.error('源目录不能为空'))
    }
    
    const result = await repositoryService.migrateOldProjects(sourceDir)
    res.json(ResponseUtil.success(result))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 文件预览代理
router.get('/preview', async (req, res) => {
  try {
    const { path: filePath } = req.query
    if (!filePath) {
      return res.status(400).json(ResponseUtil.error('文件路径不能为空'))
    }
    
    const fullPath = path.join(repositoryService.baseDir, filePath)
    
    // 安全检查：确保文件在仓库目录内
    const relativePath = path.relative(repositoryService.baseDir, fullPath)
    
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return res.status(403).json(ResponseUtil.error('访问被拒绝'))
    }
    
    // 检查文件是否存在
    try {
      await fs.access(fullPath)
    } catch (error) {
      return res.status(404).json(ResponseUtil.error('文件不存在'))
    }
    
    // 获取文件信息
    const stats = await fs.stat(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    
    // 设置响应头
    res.setHeader('Content-Type', getContentType(ext))
    res.setHeader('Content-Length', stats.size)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    
    // 流式传输文件
    const fileStream = require('fs').createReadStream(fullPath)
    fileStream.pipe(res)
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取文件信息
router.get('/file-info', async (req, res) => {
  try {
    const { path: filePath } = req.query
    if (!filePath) {
      return res.status(400).json(ResponseUtil.error('文件路径不能为空'))
    }
    
    const fullPath = path.join(repositoryService.baseDir, filePath)
    
    // 安全检查
    const relativePath = path.relative(repositoryService.baseDir, fullPath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return res.status(403).json(ResponseUtil.error('访问被拒绝'))
    }
    
    const stats = await fs.stat(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    
    res.json(ResponseUtil.success({
      name: path.basename(fullPath),
      path: filePath,
      size: stats.size,
      extension: ext,
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime,
      contentType: getContentType(ext),
      previewUrl: `/api/repository/preview?path=${encodeURIComponent(filePath)}`
    }))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取目录结构
router.get('/directory', async (req, res) => {
  try {
    const { path: dirPath = '' } = req.query
    const fullPath = path.join(repositoryService.baseDir, dirPath)
    
    // 安全检查
    const relativePath = path.relative(repositoryService.baseDir, fullPath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return res.status(403).json(ResponseUtil.error('访问被拒绝'))
    }
    
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const items = []
    
    for (const entry of entries) {
      const itemPath = path.join(dirPath, entry.name)
      const fullItemPath = path.join(fullPath, entry.name)
      
      if (entry.isDirectory()) {
        items.push({
          type: 'directory',
          name: entry.name,
          path: itemPath
        })
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (repositoryService.config.allowedExtensions.includes(ext)) {
          const stats = await fs.stat(fullItemPath)
          items.push({
            type: 'file',
            name: entry.name,
            path: itemPath,
            size: stats.size,
            extension: ext,
            modifiedAt: stats.mtime
          })
        }
      }
    }
    
    res.json(ResponseUtil.success({
      path: dirPath,
      items: items.sort((a, b) => {
        // 目录在前，文件在后
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    }))
  } catch (error) {
    res.status(500).json(ResponseUtil.error(error.message))
  }
})

// 获取内容类型
function getContentType(extension) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml'
  }
  
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream'
}

module.exports = router 