const fs = require('fs').promises
const path = require('path')
const fsExtra = require('fs-extra')
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('MigrateDownloads');


/**
 * 转换现有的下载格式为仓库管理格式
 * 从: {artistName}_{artworkId}/{artworkTitle}/
 * 到: {artistName}/{artworkId}_{artworkTitle}/
 */
async function migrateDownloads() {
  const downloadsPath = path.join(__dirname, '../../downloads')
  
  try {
    logger.info('开始转换下载格式...')
    
    // 读取downloads目录
    const entries = await fs.readdir(downloadsPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      
      const oldDirName = entry.name
      logger.info(`处理目录: ${oldDirName}`)
      
      // 解析目录名: {artistName}_{artworkId}
      const match = oldDirName.match(/^(.+)_(\d+)$/)
      if (!match) {
        logger.info(`跳过不符合格式的目录: ${oldDirName}`)
        continue
      }
      
      const [, artistName, artworkId] = match
      const oldDirPath = path.join(downloadsPath, oldDirName)
      
      // 读取作品目录
      const artworkEntries = await fs.readdir(oldDirPath, { withFileTypes: true })
      
      for (const artworkEntry of artworkEntries) {
        if (!artworkEntry.isDirectory()) continue
        
        const artworkTitle = artworkEntry.name
        const oldArtworkPath = path.join(oldDirPath, artworkTitle)
        
        // 新的目录结构
        const newArtistDir = path.join(downloadsPath, artistName)
        const newArtworkDirName = `${artworkId}_${artworkTitle}`
        const newArtworkPath = path.join(newArtistDir, newArtworkDirName)
        
        logger.info(`转换: ${oldArtworkPath} -> ${newArtworkPath}`)
        
        try {
          // 创建新的作者目录
          await fsExtra.ensureDir(newArtistDir)
          
          // 移动作品目录
          await fsExtra.move(oldArtworkPath, newArtworkPath)
          
          logger.info(`✓ 成功转换: ${artworkTitle}`)
        } catch (error) {
          logger.error(`✗ 转换失败: ${artworkTitle}`, error.message)
        }
      }
      
      // 检查原目录是否为空，如果为空则删除
      try {
        const remainingEntries = await fs.readdir(oldDirPath)
        if (remainingEntries.length === 0) {
          await fsExtra.remove(oldDirPath)
          logger.info(`删除空目录: ${oldDirPath}`)
        }
      } catch (error) {
        logger.error(`删除目录失败: ${oldDirPath}`, error.message)
      }
    }
    
    logger.info('转换完成！')
    
  } catch (error) {
    logger.error('转换过程中发生错误:', error)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateDownloads()
}

module.exports = { migrateDownloads } 