import axios from 'axios';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  acquireTimeout: number;
  ssl: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ConnectionTestResult {
  connected: boolean;
  version?: string;
  serverInfo?: string;
  connectionId?: number;
  uptime?: number;
}

interface MigrationResult {
  success: boolean;
  direction: 'json-to-db' | 'db-to-json';
  recordsProcessed: number;
  message: string;
}

class DatabaseService {
  private baseURL = '/api/database';

  /**
   * 测试数据库连接
   */
  async testConnection(config: DatabaseConfig): Promise<ApiResponse<ConnectionTestResult>> {
    try {
      const response = await axios.post(`${this.baseURL}/test-connection`, config);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '连接测试失败'
      };
    }
  }

  /**
   * 保存数据库配置
   */
  async saveConfig(config: DatabaseConfig): Promise<ApiResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/config`, config);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '保存配置失败'
      };
    }
  }

  /**
   * 获取数据库配置
   */
  async getConfig(): Promise<ApiResponse<DatabaseConfig>> {
    try {
      const response = await axios.get(`${this.baseURL}/config`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '获取配置失败'
      };
    }
  }

  /**
   * 检查数据库连接状态
   */
  async getConnectionStatus(): Promise<ApiResponse<{ connected: boolean; config?: Partial<DatabaseConfig> }>> {
    try {
      const response = await axios.get(`${this.baseURL}/status`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '获取连接状态失败'
      };
    }
  }

  /**
   * 初始化数据库表结构
   */
  async initializeTables(): Promise<ApiResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/initialize`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '初始化数据库失败'
      };
    }
  }

  /**
   * 执行数据迁移
   */
  async migrateData(direction: 'json-to-db' | 'db-to-json', overwrite: boolean = true): Promise<ApiResponse<MigrationResult>> {
    try {
      const response = await axios.post(`${this.baseURL}/migrate/${direction}`, {
        overwrite
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '数据迁移失败'
      };
    }
  }

  /**
   * 获取注册表统计信息（数据库版本）
   */
  async getRegistryStats(): Promise<ApiResponse<{
    artistCount: number;
    artworkCount: number;
    version: string;
    created_at: string;
    updated_at: string;
  }>> {
    try {
      const response = await axios.get(`${this.baseURL}/registry/stats`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '获取统计信息失败'
      };
    }
  }

  /**
   * 导出数据库注册表数据
   */
  async exportRegistry(): Promise<ApiResponse<any>> {
    try {
      const response = await axios.get(`${this.baseURL}/registry/export`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '导出数据失败'
      };
    }
  }

  /**
   * 导入数据到数据库注册表
   */
  async importRegistry(data: any): Promise<ApiResponse<{
    addedArtists: number;
    addedArtworks: number;
    skippedArtworks: number;
    totalArtists: number;
    totalArtworks: number;
  }>> {
    try {
      const response = await axios.post(`${this.baseURL}/registry/import`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '导入数据失败'
      };
    }
  }

  /**
   * 从文件系统重建数据库注册表
   */
  async rebuildRegistry(): Promise<ApiResponse<{ taskId: string }>> {
    try {
      const response = await axios.post(`${this.baseURL}/registry/rebuild`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '重建注册表失败'
      };
    }
  }

  /**
   * 清理数据库注册表
   */
  async cleanupRegistry(): Promise<ApiResponse<{
    removedArtists: number;
    removedArtworks: number;
    remainingArtists: number;
    remainingArtworks: number;
  }>> {
    try {
      const response = await axios.post(`${this.baseURL}/registry/cleanup`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '清理注册表失败'
      };
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<ApiResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/disconnect`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '断开连接失败'
      };
    }
  }
}

export default new DatabaseService();
export type { DatabaseConfig, ApiResponse, ConnectionTestResult, MigrationResult };