const fs = require('fs').promises
const path = require('path')
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('ConfigManager');


/**
 * 配置管理器
 * 负责自动生成和管理用户配置文件
 */
class ConfigManager {
  constructor() {
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.configDir = path.join(process.cwd(), 'data', 'user-config.json')
    } else {
      // 在开发环境中，使用相对路径
      this.configDir = path.join(__dirname, 'user-config.json')
    }
    
    // 确保配置目录存在
    this.ensureConfigDir()
    
    this.defaultConfig = {
      downloadDir: "./downloads",
      fileStructure: "artist/artwork",
      namingPattern: "{artist_name}/{artwork_id}_{title}",
      maxFileSize: 0,
      allowedExtensions: [".jpg", ".png", ".gif", ".webp"],
      autoMigration: false,
      migrationRules: [],
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * 确保配置目录存在
   */
  ensureConfigDir() {
    try {
      const configDirPath = path.dirname(this.configDir)
      if (!require('fs').existsSync(configDirPath)) {
        require('fs').mkdirSync(configDirPath, { recursive: true })
        logger.info('配置目录创建成功:', configDirPath)
      }
    } catch (error) {
      logger.error('创建配置目录失败:', error)
    }
  }

  /**
   * 初始化配置文件
   * 如果配置文件不存在，则创建默认配置
   */
  async initialize() {
    try {
      // 检查配置文件是否存在
      await fs.access(this.configDir)
      logger.info('用户配置文件已存在')
    } catch (error) {
      // 配置文件不存在，创建默认配置
      logger.info('创建默认用户配置文件...')
      await this.createDefaultConfig()
    }
  }

  /**
   * 创建默认配置文件
   */
  async createDefaultConfig() {
    try {
      // 确保配置目录存在
      const configDirPath = path.dirname(this.configDir)
      await fs.mkdir(configDirPath, { recursive: true })
      
      // 检查目录是否创建成功
      try {
        await fs.access(configDirPath)
        logger.info('配置目录确认存在:', configDirPath)
      } catch (accessError) {
        logger.error('配置目录访问失败:', accessError)
        throw new Error(`无法访问配置目录: ${configDirPath}`)
      }
      
      // 写入默认配置
      const configContent = JSON.stringify(this.defaultConfig, null, 2)
      await fs.writeFile(this.configDir, configContent, 'utf8')
      
      // 验证文件是否写入成功
      try {
        await fs.access(this.configDir)
        logger.info('默认配置文件创建成功:', this.configDir)
      } catch (verifyError) {
        logger.error('配置文件验证失败:', verifyError)
        throw new Error('配置文件创建后无法访问')
      }
    } catch (error) {
      logger.error('创建默认配置文件失败:', error)
      throw error
    }
  }

  /**
   * 读取配置文件
   */
  async readConfig() {
    try {
      // 首先检查文件是否存在
      const exists = await this.configExists()
      if (!exists) {
        logger.info('配置文件不存在，创建默认配置...')
        await this.createDefaultConfig()
      }
      
      const configData = await fs.readFile(this.configDir, 'utf8')
      const config = JSON.parse(configData)
      
      // 合并默认配置，确保所有必要的字段都存在
      return { ...this.defaultConfig, ...config }
    } catch (error) {
      logger.error('读取配置文件失败:', error)
      logger.info('使用默认配置...')
      // 如果读取失败，尝试创建默认配置
      try {
        await this.createDefaultConfig()
        return { ...this.defaultConfig }
      } catch (createError) {
        logger.error('创建默认配置也失败:', createError)
        // 最后返回内存中的默认配置
        return { ...this.defaultConfig }
      }
    }
  }

  /**
   * 保存配置文件
   */
  async saveConfig(config) {
    try {
      // 添加更新时间
      const configToSave = {
        ...config,
        lastUpdated: new Date().toISOString()
      }
      
      await fs.writeFile(
        this.configDir,
        JSON.stringify(configToSave, null, 2),
        'utf8'
      )
      
      logger.info('配置文件保存成功')
      return true
    } catch (error) {
      logger.error('保存配置文件失败:', error)
      throw error
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(updates) {
    try {
      const currentConfig = await this.readConfig()
      const newConfig = { ...currentConfig, ...updates }
      await this.saveConfig(newConfig)
      return newConfig
    } catch (error) {
      logger.error('更新配置失败:', error)
      throw error
    }
  }

  /**
   * 重置为默认配置
   */
  async resetToDefault() {
    try {
      await this.saveConfig(this.defaultConfig)
      logger.info('配置已重置为默认值')
      return this.defaultConfig
    } catch (error) {
      logger.error('重置配置失败:', error)
      throw error
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath() {
    return this.configDir
  }

  /**
   * 检查配置文件是否存在
   */
  async configExists() {
    try {
      await fs.access(this.configDir)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports = ConfigManager 