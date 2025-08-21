<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const username = computed(() => authStore.username)

onMounted(async () => {
  await authStore.fetchLoginStatus()
})
</script>

<template>
  <div id="app">
    <!-- 导航栏 -->
    <nav class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <RouterLink to="/" class="brand-link">
            <svg viewBox="0 0 24 24" fill="currentColor" class="brand-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span class="brand-text">Pixiv Manager</span>
          </RouterLink>
        </div>

        <div class="nav-menu">
          <RouterLink to="/" class="nav-link">首页</RouterLink>
          <RouterLink to="/search" class="nav-link" v-if="isLoggedIn">搜索</RouterLink>
          <RouterLink to="/downloads" class="nav-link" v-if="isLoggedIn">下载管理</RouterLink>
          <RouterLink to="/artists" class="nav-link" v-if="isLoggedIn">作者管理</RouterLink>
        </div>

        <div class="nav-auth">
          <div v-if="isLoggedIn" class="user-info">
            <span class="username">{{ username }}</span>
            <button @click="authStore.logout" class="btn btn-text">登出</button>
          </div>
          <RouterLink v-else to="/login" class="btn btn-primary">登录</RouterLink>
        </div>
      </div>
    </nav>

    <!-- 主内容区域 -->
    <main class="main-content">
      <RouterView />
    </main>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-container">
        <p>&copy; 2024 Pixiv Manager. 仅供学习和个人使用。</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4rem;
}

.nav-brand {
  display: flex;
  align-items: center;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: #1f2937;
  font-weight: 700;
  font-size: 1.25rem;
}

.brand-icon {
  width: 2rem;
  height: 2rem;
  color: #3b82f6;
}

.brand-text {
  color: #1f2937;
}

.nav-menu {
  display: flex;
  gap: 2rem;
}

.nav-link {
  text-decoration: none;
  color: #6b7280;
  font-weight: 500;
  transition: color 0.2s;
  padding: 0.5rem 0;
  border-bottom: 2px solid transparent;
}

.nav-link:hover {
  color: #3b82f6;
}

.nav-link.router-link-active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.nav-auth {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.username {
  color: #374151;
  font-weight: 500;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-text {
  background: none;
  color: #6b7280;
  padding: 0.25rem 0.5rem;
}

.btn-text:hover {
  color: #374151;
  background: #f3f4f6;
}

.main-content {
  flex: 1;
}

.footer {
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
  padding: 2rem 0;
  margin-top: auto;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  text-align: center;
}

.footer p {
  color: #6b7280;
  margin: 0;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .nav-container {
    padding: 0 1rem;
  }
  
  .nav-menu {
    gap: 1rem;
  }
  
  .brand-text {
    display: none;
  }
  
  .username {
    display: none;
  }
}
</style>
