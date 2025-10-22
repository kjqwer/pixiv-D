#!/usr/bin/env node

/**
 * 配置文件修复脚本
 * 用于检查和修复损坏的配置文件
 */

const fs = require('fs').promises
const path = require('path')

async function fixConfig() {
  try {
    console.log('🔧 开始检查配置文件...')
    
    // 检测配置文件路径
    const isPkg = process.pkg !== undefined
    let configPath
    
    if (isPkg) {
      configPath = path.join(process.cwd(), 'data', 'user-config.json')
    } else {
      configPath = path.join(__dirname, '..', 'config', 'user-config.json')
    }
    
    console.log(`📁 配置文件路径: ${configPath}`)
    
    // 检查文件是否存在
    try {
      await fs.access(configPath)
      console.log('✅ 配置文件存在')
    } catch (error) {
      console.log('❌ 配置文件不存在，将创建默认配置')
      return
    }
    
    // 检查文件内容
    try {
      const content = await fs.readFile(configPath, 'utf8')
      
      if (!content || content.trim() === '') {
        console.log('⚠️  配置文件为空')
        throw new Error('配置文件为空')
      }
      
      // 尝试解析JSON
      const config = JSON.parse(content)
      console.log('✅ 配置文件格式正确')
      console.log('📋 配置内容:', JSON.stringify(config, null, 2))
      
    } catch (error) {
      console.log('❌ 配置文件损坏:', error.message)
      
      // 备份损坏的文件
      const backupPath = configPath + '.backup.' + Date.now()
      try {
        await fs.copyFile(configPath, backupPath)
        console.log(`💾 已备份损坏的配置文件到: ${backupPath}`)
      } catch (backupError) {
        console.log('⚠️  备份失败:', backupError.message)
      }
      
      // 创建默认配置
      const defaultConfig = {
        downloadDir: "./downloads",
        fileStructure: "artist/artwork",
        namingPattern: "{artist_name}/{artwork_id}_{title}",
        maxFileSize: 0,
        allowedExtensions: [".jpg", ".png", ".gif", ".webp"],
        autoMigration: false,
        migrationRules: [],
        lastUpdated: new Date().toISOString()
      }
      
      // 确保目录存在
      const configDir = path.dirname(configPath)
      await fs.mkdir(configDir, { recursive: true })
      
      // 写入默认配置
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8')
      console.log('✅ 已创建默认配置文件')
      
    }
    
    console.log('🎉 配置文件检查完成')
    
  } catch (error) {
    console.error('❌ 修复配置文件失败:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  fixConfig()
}

module.exports = { fixConfig }
