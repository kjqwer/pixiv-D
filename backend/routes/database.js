const express = require('express');
const router = express.Router();
const DatabaseManager = require('../database/database-manager');
const RegistryDatabase = require('../database/registry-database');
const RegistryMigration = require('../services/registry-migration');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('DatabaseRouter');

// 全局数据库管理器实例
let databaseManager = null;
let registryDatabase = null;

/**
 * 设置数据库实例
 */
function setDatabaseInstances(dbManager, regDatabase) {
  databaseManager = dbManager;
  registryDatabase = regDatabase;
}

/**
 * 测试数据库连接
 * POST /api/database/test-connection
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { host, port, user, password, database, ssl } = req.body;
    
    if (!host || !port || !user || !database) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的连接参数'
      });
    }
    
    // 创建临时数据库管理器进行测试
    const testManager = new DatabaseManager();
    
    // 初始化连接池
    await testManager.init({
      host,
      port: parseInt(port),
      user,
      password,
      database,
      ssl: ssl || false
    });
    
    const result = await testManager.testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          message: '数据库连接成功',
          serverVersion: result.serverVersion,
          connectionTime: result.connectionTime
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    // 关闭测试连接
    await testManager.close();
    
  } catch (error) {
    logger.error('测试数据库连接失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 保存数据库配置
 * POST /api/database/config
 */
router.post('/config', async (req, res) => {
  try {
    const { host, port, user, password, database, connectionLimit, ssl } = req.body;
    
    if (!host || !port || !user || !database) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的连接参数'
      });
    }
    
    const config = {
      host,
      port: parseInt(port),
      user,
      password,
      database,
      connectionLimit: parseInt(connectionLimit) || 10,
      ssl: ssl || false
    };
    
    // 先测试连接
    const testManager = new DatabaseManager();
    await testManager.init(config);
    const testResult = await testManager.testConnection();
    
    if (!testResult.success) {
      await testManager.close();
      return res.status(400).json({
        success: false,
        error: `连接测试失败: ${testResult.error}`
      });
    }
    
    await testManager.close();
    
    // 保存配置到文件
    const fs = require('fs-extra');
    const path = require('path');
    
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    const configPath = isPkg 
      ? path.join(process.cwd(), 'data', 'database.json')  // 打包环境：当前工作目录的data文件夹
      : path.join(__dirname, '..', '..', 'data', 'database.json');  // 开发环境：项目根目录的data文件夹
    
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, config, { spaces: 2 });
    
    // 重新初始化全局数据库管理器
    if (databaseManager) {
      await databaseManager.close();
    }
    
    databaseManager = new DatabaseManager();
    await databaseManager.init(config);
    
    // 初始化注册表数据库
    registryDatabase = new RegistryDatabase(databaseManager);
    await registryDatabase.init();
    
    res.json({
      success: true,
      data: {
        message: '数据库配置已保存并连接成功',
        config: {
          host: config.host,
          port: config.port,
          user: config.user,
          database: config.database,
          connectionLimit: config.connectionLimit,
          ssl: config.ssl
        }
      }
    });
    
  } catch (error) {
    logger.error('保存数据库配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取数据库配置
 * GET /api/database/config
 */
router.get('/config', async (req, res) => {
  try {
    const fs = require('fs-extra');
    const path = require('path');
    
    // 检测是否在pkg打包环境中运行
    const isPkg = process.pkg !== undefined;
    
    const configPath = isPkg 
      ? path.join(process.cwd(), 'data', 'database.json')  // 打包环境：当前工作目录的data文件夹
      : path.join(__dirname, '..', '..', 'data', 'database.json');  // 开发环境：项目根目录的data文件夹
    
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      
      // 不返回密码
      const safeConfig = {
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database,
        connectionLimit: config.connectionLimit,
        ssl: config.ssl,
        hasPassword: !!config.password
      };
      
      res.json({
        success: true,
        data: safeConfig
      });
    } else {
      res.json({
        success: true,
        data: null
      });
    }
    
  } catch (error) {
    logger.error('获取数据库配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取数据库连接状态
 * GET /api/database/status
 */
router.get('/status', async (req, res) => {
  try {
    if (!databaseManager) {
      return res.json({
        success: true,
        data: {
          connected: false,
          message: '数据库未配置'
        }
      });
    }
    
    const isConnected = databaseManager.isConnected;
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        message: isConnected ? '数据库已连接' : '数据库连接断开'
      }
    });
    
  } catch (error) {
    logger.error('获取数据库状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 初始化数据库表
 * POST /api/database/init-tables
 */
router.post('/init-tables', async (req, res) => {
  try {
    if (!databaseManager) {
      return res.status(400).json({
        success: false,
        error: '数据库未配置'
      });
    }
    
    if (!registryDatabase) {
      registryDatabase = new RegistryDatabase(databaseManager);
    }
    
    await registryDatabase.init();
    
    res.json({
      success: true,
      data: {
        message: '数据库表初始化成功'
      }
    });
    
  } catch (error) {
    logger.error('初始化数据库表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 数据迁移：JSON到数据库
 * POST /api/database/migrate/json-to-db
 */
router.post('/migrate/json-to-db', async (req, res) => {
  try {
    const { overwrite = true, createBackup = true } = req.body;
    
    if (!databaseManager || !registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库未配置或未初始化'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const jsonRegistry = downloadService.downloadRegistry;
    const fileManager = downloadService.fileManager;
    
    const migration = new RegistryMigration(jsonRegistry, registryDatabase, fileManager);
    const result = await migration.performMigration('json-to-db', overwrite, createBackup);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('JSON到数据库迁移失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 数据迁移：数据库到JSON
 * POST /api/database/migrate/db-to-json
 */
router.post('/migrate/db-to-json', async (req, res) => {
  try {
    const { overwrite = true, createBackup = true } = req.body;
    
    if (!databaseManager || !registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库未配置或未初始化'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const jsonRegistry = downloadService.downloadRegistry;
    const fileManager = downloadService.fileManager;
    
    const migration = new RegistryMigration(jsonRegistry, registryDatabase, fileManager);
    const result = await migration.performMigration('db-to-json', overwrite, createBackup);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('数据库到JSON迁移失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 比较注册表差异
 * GET /api/database/compare-registries
 */
router.get('/compare-registries', async (req, res) => {
  try {
    if (!databaseManager || !registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库未配置或未初始化'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const jsonRegistry = downloadService.downloadRegistry;
    const fileManager = downloadService.fileManager;
    
    const migration = new RegistryMigration(jsonRegistry, registryDatabase, fileManager);
    const comparison = await migration.compareRegistries();
    
    res.json({
      success: true,
      data: comparison
    });
    
  } catch (error) {
    logger.error('比较注册表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 断开数据库连接
 * POST /api/database/disconnect
 */
router.post('/disconnect', async (req, res) => {
  try {
    if (databaseManager) {
      await databaseManager.disconnect();
      databaseManager = null;
      registryDatabase = null;
    }
    
    res.json({
      success: true,
      data: {
        message: '数据库连接已断开'
      }
    });
    
  } catch (error) {
    logger.error('断开数据库连接失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 数据库注册表相关API

/**
 * 获取数据库注册表统计信息
 * GET /api/database/registry/stats
 */
router.get('/registry/stats', async (req, res) => {
  try {
    if (!registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库注册表未初始化'
      });
    }
    
    const stats = await registryDatabase.getStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('获取数据库注册表统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导出数据库注册表
 * GET /api/database/registry/export
 */
router.get('/registry/export', async (req, res) => {
  try {
    if (!registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库注册表未初始化'
      });
    }
    
    const registryData = await registryDatabase.exportRegistry();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="database-registry.json"');
    res.json(registryData);
    
  } catch (error) {
    logger.error('导出数据库注册表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导入数据到数据库注册表
 * POST /api/database/registry/import
 */
router.post('/registry/import', async (req, res) => {
  try {
    const { registryData } = req.body;
    
    if (!registryData) {
      return res.status(400).json({
        success: false,
        error: '缺少注册表数据'
      });
    }
    
    if (!registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库注册表未初始化'
      });
    }
    
    const result = await registryDatabase.importRegistry(registryData);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('导入数据库注册表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 从文件系统重建数据库注册表
 * POST /api/database/registry/rebuild
 */
router.post('/registry/rebuild', async (req, res) => {
  try {
    if (!registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库注册表未初始化'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const fileManager = downloadService.fileManager;
    
    // 生成任务ID
    const taskId = `db-registry-rebuild-${Date.now()}`;
    
    // 立即返回任务ID，不等待完成
    res.json({
      success: true,
      data: {
        taskId,
        status: 'started',
        message: '数据库注册表重建任务已启动'
      }
    });
    
    // 异步执行重建任务
    setImmediate(async () => {
      try {
        // 设置任务状态为进行中
        global.dbRegistryRebuildTasks = global.dbRegistryRebuildTasks || new Map();
        global.dbRegistryRebuildTasks.set(taskId, {
          status: 'running',
          startTime: Date.now(),
          progress: {
            scannedArtists: 0,
            scannedArtworks: 0,
            addedArtworks: 0,
            skippedArtworks: 0,
            currentArtist: null
          }
        });
        
        const result = await registryDatabase.rebuildFromFileSystem(fileManager, taskId);
        
        // 更新任务状态为完成
        global.dbRegistryRebuildTasks.set(taskId, {
          status: 'completed',
          startTime: global.dbRegistryRebuildTasks.get(taskId).startTime,
          endTime: Date.now(),
          result: result
        });
        
        logger.info(`数据库注册表重建任务完成: ${taskId}`, result);
      } catch (error) {
        logger.error(`数据库注册表重建任务失败: ${taskId}`, error);
        
        // 更新任务状态为失败
        global.dbRegistryRebuildTasks.set(taskId, {
          status: 'failed',
          startTime: global.dbRegistryRebuildTasks.get(taskId).startTime,
          endTime: Date.now(),
          error: error.message
        });
      }
    });
    
  } catch (error) {
    logger.error('启动数据库注册表重建任务失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取数据库注册表重建任务状态
 * GET /api/database/registry/rebuild/status/:taskId
 */
router.get('/registry/rebuild/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    global.dbRegistryRebuildTasks = global.dbRegistryRebuildTasks || new Map();
    const task = global.dbRegistryRebuildTasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
    
  } catch (error) {
    logger.error('获取数据库注册表重建任务状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 清理数据库注册表
 * POST /api/database/registry/cleanup
 */
router.post('/registry/cleanup', async (req, res) => {
  try {
    if (!registryDatabase) {
      return res.status(400).json({
        success: false,
        error: '数据库注册表未初始化'
      });
    }
    
    const downloadService = req.backend.getDownloadService();
    const fileManager = downloadService.fileManager;
    
    const result = await registryDatabase.cleanupRegistry(fileManager);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('清理数据库注册表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 导出数据库管理器实例，供其他模块使用
router.getDatabaseManager = () => databaseManager;
router.getRegistryDatabase = () => registryDatabase;
router.setDatabaseInstances = setDatabaseInstances;

module.exports = router;