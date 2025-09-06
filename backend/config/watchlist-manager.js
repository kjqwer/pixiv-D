const fs = require('fs').promises
const path = require('path')
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('WatchlistManager');

/**
 * 待看名单管理器
 * 负责管理用户的待看名单数据
 */
class WatchlistManager {
  constructor() {
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    if (isPkg) {
      // 在打包环境中，使用可执行文件所在目录
      this.configDir = path.join(process.cwd(), 'data', 'watchlist.json')
    } else {
      // 在开发环境中，使用相对路径
      this.configDir = path.join(__dirname, 'watchlist.json')
    }
    
    // 确保配置目录存在
    this.ensureConfigDir()
    
    this.defaultData = {
      items: [],
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
        logger.info('待看名单目录创建成功:', configDirPath)
      }
    } catch (error) {
      logger.error('创建待看名单目录失败:', error)
    }
  }

  /**
   * 初始化待看名单文件
   * 如果文件不存在，则创建默认数据
   */
  async initialize() {
    try {
      // 检查文件是否存在
      await fs.access(this.configDir)
      logger.info('待看名单文件已存在')
    } catch (error) {
      // 文件不存在，创建默认文件
      logger.info('创建默认待看名单文件...')
      await this.createDefaultData()
    }
  }

  /**
   * 创建默认数据文件
   */
  async createDefaultData() {
    try {
      // 确保配置目录存在
      const configDirPath = path.dirname(this.configDir)
      await fs.mkdir(configDirPath, { recursive: true })
      
      // 检查目录是否创建成功
      try {
        await fs.access(configDirPath)
        logger.info('待看名单目录确认存在:', configDirPath)
      } catch (accessError) {
        logger.error('待看名单目录访问失败:', accessError)
        throw new Error(`无法访问配置目录: ${configDirPath}`)
      }
      
      // 写入默认数据
      const dataContent = JSON.stringify(this.defaultData, null, 2)
      await fs.writeFile(this.configDir, dataContent, 'utf8')
      
      // 验证文件是否写入成功
      try {
        await fs.access(this.configDir)
        logger.info('默认待看名单文件创建成功:', this.configDir)
      } catch (verifyError) {
        logger.error('待看名单文件验证失败:', verifyError)
        throw new Error('待看名单文件创建后无法访问')
      }
    } catch (error) {
      logger.error('创建默认待看名单文件失败:', error)
      throw error
    }
  }

  /**
   * 读取待看名单数据
   */
  async readData() {
    try {
      // 首先检查文件是否存在
      const exists = await this.dataExists()
      if (!exists) {
        logger.info('待看名单文件不存在，创建默认数据...')
        await this.createDefaultData()
      }
      
      const dataContent = await fs.readFile(this.configDir, 'utf8')
      const data = JSON.parse(dataContent)
      
      // 合并默认数据，确保所有必要的字段都存在
      return { ...this.defaultData, ...data }
    } catch (error) {
      logger.error('读取待看名单文件失败:', error)
      logger.info('使用默认数据...')
      // 如果读取失败，尝试创建默认数据
      try {
        await this.createDefaultData()
        return { ...this.defaultData }
      } catch (createError) {
        logger.error('创建默认数据也失败:', createError)
        // 最后返回内存中的默认数据
        return { ...this.defaultData }
      }
    }
  }

  /**
   * 保存待看名单数据
   */
  async saveData(data) {
    try {
      // 添加更新时间
      const dataToSave = {
        ...data,
        lastUpdated: new Date().toISOString()
      }
      
      await fs.writeFile(
        this.configDir,
        JSON.stringify(dataToSave, null, 2),
        'utf8'
      )
      
      logger.info('待看名单文件保存成功')
      return true
    } catch (error) {
      logger.error('保存待看名单文件失败:', error)
      throw error
    }
  }

  /**
   * 添加待看项目
   */
  async addItem(item) {
    try {
      const data = await this.readData()
      
      // 检查是否已存在相同的URL
      const existingIndex = data.items.findIndex(existingItem => existingItem.url === item.url)
      
      if (existingIndex !== -1) {
        // 如果存在，更新现有项目
        data.items[existingIndex] = {
          ...data.items[existingIndex],
          ...item,
          updatedAt: new Date().toISOString()
        }
      } else {
        // 添加新项目
        const newItem = {
          id: Date.now().toString(),
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        data.items.push(newItem)
      }
      
      await this.saveData(data)
      return data.items
    } catch (error) {
      logger.error('添加待看项目失败:', error)
      throw error
    }
  }

  /**
   * 删除待看项目
   */
  async removeItem(id) {
    try {
      const data = await this.readData()
      const initialLength = data.items.length
      
      data.items = data.items.filter(item => item.id !== id)
      
      if (data.items.length === initialLength) {
        throw new Error('待看项目不存在')
      }
      
      await this.saveData(data)
      return data.items
    } catch (error) {
      logger.error('删除待看项目失败:', error)
      throw error
    }
  }

  /**
   * 更新待看项目
   */
  async updateItem(id, updates) {
    try {
      const data = await this.readData()
      const itemIndex = data.items.findIndex(item => item.id === id)
      
      if (itemIndex === -1) {
        throw new Error('待看项目不存在')
      }
      
      data.items[itemIndex] = {
        ...data.items[itemIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      
      await this.saveData(data)
      return data.items[itemIndex]
    } catch (error) {
      logger.error('更新待看项目失败:', error)
      throw error
    }
  }

  /**
   * 获取所有待看项目
   */
  async getAllItems() {
    try {
      const data = await this.readData()
      return data.items
    } catch (error) {
      logger.error('获取待看项目失败:', error)
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
  async dataExists() {
    try {
      await fs.access(this.configDir)
      return true
    } catch (error) {
      return false
    }
  }
}

module.exports = WatchlistManager 