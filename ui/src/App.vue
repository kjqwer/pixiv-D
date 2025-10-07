<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDownloadStore } from '@/stores/download'
import { useUpdateStore } from '@/stores/update'
import SettingsWidget from '@/components/common/SettingsWidget.vue'
import DownloadProgressWidget from '@/components/common/DownloadProgressWidget.vue'
import WatchlistWidget from '@/components/common/WatchlistWidget.vue'
import RegistryWidget from '@/components/common/RegistryWidget.vue'
import UpdateChecker from '@/components/common/UpdateChecker.vue'

const route = useRoute()
const authStore = useAuthStore()
const downloadStore = useDownloadStore()
const updateStore = useUpdateStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const username = computed(() => authStore.username)

// 移动端菜单状态
const isMobileMenuOpen = ref(false)

// 在下载管理页面隐藏下载进度小组件
const showDownloadWidget = computed(() => {
  return isLoggedIn.value && route.path !== '/downloads'
})

// 切换移动端菜单
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

// 关闭移动端菜单
const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

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
          <RouterLink to="/" class="brand-link" @click="closeMobileMenu">
            <SvgIcon name="home2" class="brand-icon" />
            <span class="brand-text">Pixiv Manager</span>
          </RouterLink>
        </div>

        <!-- 移动端菜单切换按钮 -->
        <button class="mobile-nav-toggle" @click="toggleMobileMenu" :class="{ active: isMobileMenuOpen }">
          <SvgIcon name="menu" class="menu-icon" />
        </button>

        <!-- 桌面端导航菜单 -->
        <div class="nav-menu desktop-nav">
          <RouterLink to="/" class="nav-link">首页</RouterLink>
          <RouterLink to="/search" class="nav-link" v-if="isLoggedIn">搜索</RouterLink>
          <RouterLink to="/ranking" class="nav-link" v-if="isLoggedIn">排行榜</RouterLink>
          <RouterLink to="/downloads" class="nav-link" v-if="isLoggedIn">下载管理</RouterLink>
          <RouterLink to="/artists" class="nav-link" v-if="isLoggedIn">作者管理</RouterLink>
          <RouterLink to="/repository" class="nav-link" v-if="isLoggedIn">仓库管理</RouterLink>
          <RouterLink to="/bookmarks" class="nav-link" v-if="isLoggedIn">我的收藏</RouterLink>
        </div>

        <!-- 桌面端用户信息 -->
        <div class="nav-auth desktop-nav">
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

      <!-- 移动端菜单 -->
      <div class="mobile-nav-menu" :class="{ active: isMobileMenuOpen }">
        <div class="mobile-nav-content">
          <!-- 移动端导航链接 -->
          <div class="mobile-nav-links">
            <RouterLink to="/" class="mobile-nav-item" @click="closeMobileMenu">首页</RouterLink>
            <RouterLink to="/search" class="mobile-nav-item" v-if="isLoggedIn" @click="closeMobileMenu">搜索</RouterLink>
            <RouterLink to="/ranking" class="mobile-nav-item" v-if="isLoggedIn" @click="closeMobileMenu">排行榜</RouterLink>
            <RouterLink to="/downloads" class="mobile-nav-item" v-if="isLoggedIn" @click="closeMobileMenu">下载管理</RouterLink>
            <RouterLink to="/artists" class="mobile-nav-item" v-if="isLoggedIn" @click="closeMobileMenu">作者管理</RouterLink>
            <RouterLink to="/repository" class="mobile-nav-item" v-if="isLoggedIn" @click="closeMobileMenu">仓库管理</RouterLink>
            <RouterLink to="/bookmarks" class="mobile-nav-item" v-if="isLoggedIn" @click="closeMobileMenu">我的收藏</RouterLink>
          </div>

          <!-- 移动端用户信息 -->
          <div class="mobile-user-section">
            <div v-if="isLoggedIn" class="mobile-user-info">
              <div class="mobile-username">{{ username }}</div>
              <button @click="authStore.logout(); closeMobileMenu()" class="btn-mobile">登出</button>
            </div>
            <RouterLink v-else to="/login" class="btn-mobile btn-mobile-primary" @click="closeMobileMenu">登录</RouterLink>
          </div>
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

    <!-- 下载注册表管理小组件 - 只在登录时显示 -->
    <RegistryWidget v-if="isLoggedIn" />

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
  z-index: 1002; /* 提高导航栏z-index，确保在所有元素之上 */
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4rem;
  position: relative;
}

.nav-brand {
  display: flex;
  align-items: center;
  z-index: 1003;
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

/* 移动端菜单切换按钮 */
.mobile-nav-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.2s;
  z-index: 1003; /* 确保汉堡菜单按钮在最上层 */
}

.mobile-nav-toggle:hover {
  background: #f3f4f6;
}

.menu-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #374151;
}

/* 桌面端导航 */
.desktop-nav {
  display: flex;
}

.nav-menu {
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

/* 移动端菜单 */
.mobile-nav-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  transform: translateY(-100%);
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 1001; /* 提高z-index，确保在小组件之上 */
}

.mobile-nav-menu.active {
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
}

.mobile-nav-content {
  padding: 1rem 2rem 2rem;
}

.mobile-nav-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.mobile-nav-item {
  display: block;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: #374151;
  font-weight: 500;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.mobile-nav-item:hover {
  background: #f3f4f6;
  color: #3b82f6;
}

.mobile-nav-item.router-link-active {
  background: #eff6ff;
  color: #3b82f6;
}

.mobile-user-section {
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
}

.mobile-user-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.mobile-username {
  color: #374151;
  font-weight: 600;
  font-size: 1.1rem;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .nav-container {
    padding: 0 1rem;
    height: 3.5rem;
  }

  /* 隐藏桌面端导航 */
  .desktop-nav {
    display: none;
  }

  /* 显示移动端菜单切换按钮 */
  .mobile-nav-toggle {
    display: block;
  }

  .brand-text {
    display: none;
  }

  .mobile-nav-content {
    padding: 1rem;
  }

  .footer-container {
    padding: 0 1rem;
  }
}

@media (max-width: 480px) {
  .nav-container {
    padding: 0 0.75rem;
  }

  .brand-icon {
    width: 1.75rem;
    height: 1.75rem;
  }

  .mobile-nav-content {
    padding: 0.75rem;
  }

  .mobile-nav-item {
    padding: 0.625rem 0.75rem;
    font-size: 0.9rem;
  }

  .mobile-username {
    font-size: 1rem;
  }
}
</style>
