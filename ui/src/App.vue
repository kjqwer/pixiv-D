<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDownloadStore } from '@/stores/download'
import { useUpdateStore } from '@/stores/update'
import SettingsWidget from '@/components/common/SettingsWidget.vue'
import DownloadProgressWidget from '@/components/common/DownloadProgressWidget.vue'
import WatchlistWidget from '@/components/common/WatchlistWidget.vue'
import UpdateChecker from '@/components/common/UpdateChecker.vue'

const route = useRoute()
const authStore = useAuthStore()
const downloadStore = useDownloadStore()
const updateStore = useUpdateStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const username = computed(() => authStore.username)

// 在下载管理页面隐藏下载进度小组件
const showDownloadWidget = computed(() => {
  return isLoggedIn.value && route.path !== '/downloads'
})

onMounted(async () => {
  await authStore.fetchLoginStatus()
  
  // 如果已登录，初始化下载store和检查更新
  if (authStore.isLoggedIn) {
    await downloadStore.fetchTasks()
    // 启动定期刷新
    downloadStore.startRefreshInterval()
    
    // 自动检查更新（静默）
    setTimeout(() => {
      updateStore.autoCheckUpdate()
    }, 2000) // 延迟2秒，避免影响登录流程
  }
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
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span class="brand-text">Pixiv Manager</span>
          </RouterLink>
        </div>

        <div class="nav-menu">
          <RouterLink to="/" class="nav-link">首页</RouterLink>
          <RouterLink to="/search" class="nav-link" v-if="isLoggedIn">搜索</RouterLink>
          <RouterLink to="/ranking" class="nav-link" v-if="isLoggedIn">排行榜</RouterLink>
          <RouterLink to="/downloads" class="nav-link" v-if="isLoggedIn">下载管理</RouterLink>
          <RouterLink to="/artists" class="nav-link" v-if="isLoggedIn">作者管理</RouterLink>
          <RouterLink to="/repository" class="nav-link" v-if="isLoggedIn">仓库管理</RouterLink>
          <RouterLink to="/bookmarks" class="nav-link" v-if="isLoggedIn">我的收藏</RouterLink>
        </div>

        <div class="nav-auth">
          <div v-if="isLoggedIn" class="user-info">
            <span class="username">{{ username }}</span>
            <button @click="authStore.logout" class="btn btn-text">登出</button>
          </div>
          <RouterLink v-else to="/login" class="btn btn-primary">登录</RouterLink>

          <!-- 更新检查器 -->
          <UpdateChecker />

          <!-- GitHub 链接 -->
          <a href="https://github.com/kjqwer/pixiv-D" target="_blank" rel="noopener noreferrer" class="github-link"
            title="查看项目源码">
            <svg viewBox="0 0 24 24" fill="currentColor" class="github-icon">
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
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
        <p>&copy; 2025 Pixiv Manager. 仅供学习和个人使用。</p>
      </div>
    </footer>

    <!-- 设置小组件 - 只在登录时显示 -->
    <SettingsWidget v-if="isLoggedIn" />
    
    <!-- 下载进度小组件 - 只在登录时显示，在下载管理页面隐藏 -->
    <DownloadProgressWidget v-if="showDownloadWidget" />
    
    <!-- 待看名单小组件 - 只在登录时显示 -->
    <WatchlistWidget v-if="isLoggedIn" />
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
  gap: 0.75rem;
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

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  color: #6b7280;
  text-decoration: none;
  transition: all 0.2s;
  margin-left: 0.5rem;
}

.github-link:hover {
  color: #374151;
  background: #f3f4f6;
  transform: translateY(-1px);
}

.github-icon {
  width: 1.5rem;
  height: 1.5rem;
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

  .github-link {
    margin-left: 0.25rem;
  }

  .github-icon {
    width: 1.25rem;
    height: 1.25rem;
  }
}
</style>
