import apiService from './api';
import type { ApiResponse, LoginStatus } from '@/types';

export interface LoginUrlResponse {
  login_url: string;
  code_verifier: string;
}

export interface LoginCallbackRequest {
  code: string;
}

export interface LoginCallbackResponse {
  user: {
    id: number;
    name: string;
    account: string;
  };
}

class AuthService {
  /**
   * 获取登录状态
   */
  async getLoginStatus(): Promise<ApiResponse<LoginStatus>> {
    return apiService.get<LoginStatus>('/api/auth/status');
  }

  /**
   * 获取登录URL
   */
  async getLoginUrl(): Promise<ApiResponse<LoginUrlResponse>> {
    return apiService.get<LoginUrlResponse>('/api/auth/login-url');
  }

  /**
   * 处理登录回调
   */
  async handleLoginCallback(code: string): Promise<ApiResponse<LoginCallbackResponse>> {
    return apiService.post<LoginCallbackResponse>('/api/auth/callback', { code });
  }

  /**
   * 重新登录
   */
  async relogin(): Promise<ApiResponse> {
    return apiService.post('/api/auth/relogin');
  }

  /**
   * 手动刷新token
   */
  async refreshToken(): Promise<ApiResponse> {
    return apiService.post('/api/auth/refresh-token');
  }

  /**
   * 登出
   */
  async logout(): Promise<ApiResponse> {
    return apiService.post('/api/auth/logout');
  }
}

export const authService = new AuthService();
export default authService;