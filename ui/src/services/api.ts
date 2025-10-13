import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types';

// API配置 - 使用相对路径，这样就不需要硬编码端口
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 导出API基础URL，供其他组件使用
export const getApiBaseUrl = () => API_BASE_URL || window.location.origin;

// 获取图片代理URL的工具函数
export const getImageProxyUrl = (originalUrl: string) => {
  if (!originalUrl) return '';
  
  // 如果是Pixiv的图片URL，通过后端代理
  if (originalUrl.includes('i.pximg.net')) {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${getApiBaseUrl()}/api/proxy/image?url=${encodedUrl}`;
  }
  
  return originalUrl;
};

// 获取Pximg资源（包括ZIP等文件）的代理URL
export const getPximgFileProxyUrl = (originalUrl: string) => {
  if (!originalUrl) return '';
  if (originalUrl.includes('i.pximg.net')) {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${getApiBaseUrl()}/api/proxy/file?url=${encodedUrl}`;
  }
  return originalUrl;
};

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL || window.location.origin,
      timeout: 60000, // 增加到60秒
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 可以在这里添加认证token等
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        return response;
      },
      (error) => {
        // 统一错误处理
        if (error.response) {
          const { status, data } = error.response;
          console.error(`API Error ${status}:`, data);
        } else if (error.request) {
          console.error('Network Error:', error.request);
        } else {
          console.error('Request Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * POST请求
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * PUT请求
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<ApiResponse> {
    return this.get('/health');
  }
}

export const apiService = new ApiService();
export default apiService;