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
            <SvgIcon name="home2" class="brand-icon" />
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
            <SvgIcon name="github" class="github-icon" />
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
