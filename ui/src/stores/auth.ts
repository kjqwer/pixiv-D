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
  const statusCheckTimer = ref<number | null>(null); // 添加状态检查定时器

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
        
        // 如果登录状态发生变化，启动或停止状态检查
        if (response.data.isLoggedIn) {
          startStatusCheck();
        } else {
          stopStatusCheck();
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取登录状态失败';
      console.error('获取登录状态失败:', err);
      
      // 如果获取状态失败，可能是token过期，停止状态检查
      stopStatusCheck();
    } finally {
      loading.value = false;
    }
  };

  // 启动定期状态检查
  const startStatusCheck = () => {
    // 清除之前的定时器
    stopStatusCheck();
    
    // 每5分钟检查一次登录状态
    statusCheckTimer.value = window.setInterval(async () => {
      try {
        const response = await authService.getLoginStatus();
        if (response.success && response.data) {
          // 更新登录状态
          loginStatus.value = response.data;
          
          // 如果已登出，停止检查
          if (!response.data.isLoggedIn) {
            stopStatusCheck();
          }
        }
      } catch (err) {
        console.error('定期检查登录状态失败:', err);
        // 检查失败，可能是网络问题或token过期，停止检查
        stopStatusCheck();
      }
    }, 5 * 60 * 1000); // 5分钟
    
    console.log('登录状态定期检查已启动');
  };

  // 停止定期状态检查
  const stopStatusCheck = () => {
    if (statusCheckTimer.value) {
      clearInterval(statusCheckTimer.value);
      statusCheckTimer.value = null;
      console.log('登录状态定期检查已停止');
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
        stopStatusCheck(); // 停止状态检查
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
    clearError,
    startStatusCheck,
    stopStatusCheck
  };
}); 