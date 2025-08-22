const fs = require('fs').promises
const path = require('path')

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
   * 初始化配置文件
   * 如果配置文件不存在，则创建默认配置
   */
  async initialize() {
    try {
      // 检查配置文件是否存在
      await fs.access(this.configDir)
      console.log('用户配置文件已存在')
    } catch (error) {
      // 配置文件不存在，创建默认配置
      console.log('创建默认用户配置文件...')
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
      
      // 写入默认配置
      await fs.writeFile(
        this.configDir,
        JSON.stringify(this.defaultConfig, null, 2),
        'utf8'
      )
      
      console.log('默认配置文件创建成功:', this.configDir)
    } catch (error) {
      console.error('创建默认配置文件失败:', error)
      throw error
    }
  }

  /**
   * 读取配置文件
   */
  async readConfig() {
    try {
      const configData = await fs.readFile(this.configDir, 'utf8')
      return JSON.parse(configData)
    } catch (error) {
      console.error('读取配置文件失败:', error)
      // 如果读取失败，返回默认配置
      return { ...this.defaultConfig }
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
      
      console.log('配置文件保存成功')
      return true
    } catch (error) {
      console.error('保存配置文件失败:', error)
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
      console.error('更新配置失败:', error)
      throw error
    }
  }

  /**
   * 重置为默认配置
   */
  async resetToDefault() {
    try {
      await this.saveConfig(this.defaultConfig)
      console.log('配置已重置为默认值')
      return this.defaultConfig
    } catch (error) {
      console.error('重置配置失败:', error)
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