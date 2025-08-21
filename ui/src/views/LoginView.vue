<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">登录 Pixiv</h1>
          <p class="login-subtitle">
            通过 Pixiv 账号登录以使用所有功能
          </p>
        </div>

        <div v-if="error" class="error-section">
          <ErrorMessage 
            :error="error" 
            title="登录失败"
            dismissible
            @dismiss="clearError"
          />
        </div>

        <div class="login-status" v-if="isLoggedIn">
          <div class="status-success">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <div class="status-content">
              <h3>已登录</h3>
              <p>欢迎回来，{{ username }}！</p>
            </div>
          </div>
          
          <div class="login-actions">
            <router-link to="/" class="btn btn-primary">
              返回首页
            </router-link>
            <button @click="handleLogout" class="btn btn-secondary" :disabled="loading">
              {{ loading ? '登出中...' : '登出' }}
            </button>
          </div>
        </div>

        <div v-else class="login-form">
          <div class="login-info">
            <p>点击下方按钮将跳转到 Pixiv 官方登录页面</p>
            <ul class="login-features">
              <li>安全可靠的官方登录</li>
              <li>支持所有 Pixiv 功能</li>
              <li>自动保存登录状态</li>
            </ul>
          </div>

          <div class="login-actions">
            <button 
              @click="handleLogin" 
              class="btn btn-primary btn-large"
              :disabled="loading"
            >
              <LoadingSpinner v-if="loading" text="获取登录链接..." />
              <span v-else>开始登录</span>
            </button>
            
            <router-link to="/" class="btn btn-text">
              返回首页
            </router-link>
          </div>
        </div>

        <div class="login-footer">
          <p class="footer-text">
            登录即表示您同意我们的
            <a href="#" class="footer-link">服务条款</a>
            和
            <a href="#" class="footer-link">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const router = useRouter();
const authStore = useAuthStore();

const isLoggedIn = computed(() => authStore.isLoggedIn);
const username = computed(() => authStore.username);
const loading = computed(() => authStore.loading);
const error = computed(() => authStore.error);

onMounted(async () => {
  await authStore.fetchLoginStatus();
});

const handleLogin = async () => {
  try {
    const loginUrl = await authStore.getLoginUrl();
    window.open(loginUrl, '_blank');
  } catch (err) {
    console.error('获取登录URL失败:', err);
  }
};

const handleLogout = async () => {
  try {
    await authStore.logout();
    router.push('/');
  } catch (err) {
    console.error('登出失败:', err);
  }
};

const clearError = () => {
  authStore.clearError();
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-container {
  width: 100%;
  max-width: 480px;
}

.login-card {
  background: white;
  border-radius: 1rem;
  padding: 2.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.login-subtitle {
  color: #6b7280;
  line-height: 1.6;
}

.error-section {
  margin-bottom: 2rem;
}

.login-status {
  text-align: center;
}

.status-success {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 1.5rem;
  border-radius: 0.75rem;
  margin-bottom: 2rem;
}

.status-success svg {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
}

.status-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.status-content p {
  margin: 0;
  opacity: 0.8;
}

.login-form {
  margin-bottom: 2rem;
}

.login-info {
  margin-bottom: 2rem;
}

.login-info p {
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.6;
}

.login-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.login-features li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #374151;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.login-features li::before {
  content: "✓";
  color: #10b981;
  font-weight: bold;
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-text {
  background: none;
  color: #6b7280;
  padding: 0.5rem 1rem;
}

.btn-text:hover {
  color: #374151;
  background: #f3f4f6;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
  min-width: 200px;
}

.login-footer {
  text-align: center;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.footer-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.footer-link {
  color: #3b82f6;
  text-decoration: none;
}

.footer-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .login-page {
    padding: 1rem;
  }
  
  .login-card {
    padding: 2rem;
  }
  
  .login-title {
    font-size: 1.75rem;
  }
  
  .btn-large {
    min-width: 100%;
  }
}
</style> 