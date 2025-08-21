import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import authService from '@/services/auth';
import type { LoginStatus } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const loginStatus = ref<LoginStatus>({
    isLoggedIn: false
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const isLoggedIn = computed(() => loginStatus.value.isLoggedIn);
  const username = computed(() => loginStatus.value.username);
  const userId = computed(() => loginStatus.value.user_id);

  // 获取登录状态
  const fetchLoginStatus = async () => {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.getLoginStatus();
      if (response.success && response.data) {
        loginStatus.value = response.data;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取登录状态失败';
      console.error('获取登录状态失败:', err);
    } finally {
      loading.value = false;
    }
  };

  // 获取登录URL
  const getLoginUrl = async () => {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.getLoginUrl();
      if (response.success && response.data) {
        return response.data.login_url;
      }
      throw new Error(response.error || '获取登录URL失败');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取登录URL失败';
      console.error('获取登录URL失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 处理登录回调
  const handleLoginCallback = async (code: string) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.handleLoginCallback(code);
      if (response.success) {
        await fetchLoginStatus(); // 重新获取登录状态
        return response.data;
      }
      throw new Error(response.error || '登录失败');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败';
      console.error('登录失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 重新登录
  const relogin = async () => {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.relogin();
      if (response.success) {
        await fetchLoginStatus(); // 重新获取登录状态
        return true;
      }
      throw new Error(response.error || '重新登录失败');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '重新登录失败';
      console.error('重新登录失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 登出
  const logout = async () => {
    try {
      loading.value = true;
      error.value = null;
      const response = await authService.logout();
      if (response.success) {
        loginStatus.value = { isLoggedIn: false };
        return true;
      }
      throw new Error(response.error || '登出失败');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登出失败';
      console.error('登出失败:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  return {
    // 状态
    loginStatus,
    loading,
    error,
    
    // 计算属性
    isLoggedIn,
    username,
    userId,
    
    // 方法
    fetchLoginStatus,
    getLoginUrl,
    handleLoginCallback,
    relogin,
    logout,
    clearError
  };
}); 