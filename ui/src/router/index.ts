import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/ranking',
      name: 'ranking',
      component: () => import('@/views/RankingView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/artwork/:id',
      name: 'artwork',
      component: () => import('@/views/ArtworkView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/artist/:id',
      name: 'artist',
      component: () => import('@/views/ArtistView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/downloads',
      name: 'downloads',
      component: () => import('@/views/DownloadsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/artists',
      name: 'artists',
      component: () => import('@/views/ArtistsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/repository',
      name: 'repository',
      component: () => import('@/views/RepositoryView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/bookmarks',
      name: 'bookmarks',
      component: () => import('@/views/BookmarksView.vue'),
      meta: { requiresAuth: true }
    }
  ],
  scrollBehavior(to, from, savedPosition) {
    // 如果有保存的位置（浏览器前进/后退），则恢复到该位置
    if (savedPosition) {
      return new Promise((resolve) => {
        // 延迟一点时间确保页面加载完成
        setTimeout(() => {
          resolve(savedPosition)
        }, 100)
      })
    }
    
    // 检查是否有保存的自定义滚动位置
    const savedScrollPosition = sessionStorage.getItem(`scroll_${to.fullPath}`)
    if (savedScrollPosition) {
      try {
        const position = JSON.parse(savedScrollPosition)
        // 清除保存的位置，避免重复使用
        sessionStorage.removeItem(`scroll_${to.fullPath}`)
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(position)
          }, 100)
      })
      } catch (error) {
        console.warn('解析保存的滚动位置失败:', error)
      }
    }
    
    // 如果有锚点，则滚动到锚点位置
    if (to.hash) {
      return new Promise((resolve) => {
        // 使用 nextTick 确保 DOM 更新完成
        setTimeout(() => {
          const element = document.querySelector(to.hash)
          
          if (element) {
            resolve({
              el: to.hash,
              behavior: 'smooth',
              top: 0 // 添加 top 偏移，确保元素完全可见
            })
          } else {
            // 如果元素不存在，滚动到顶部
            resolve({ top: 0 })
          }
        }, 100)
      })
    }
    
    // 否则滚动到页面顶部
    return new Promise((resolve) => {
      // 延迟一点时间，确保页面加载完成
      setTimeout(() => {
        resolve({ top: 0 })
      }, 100)
    })
  }
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 检查是否需要认证
  if (to.meta.requiresAuth) {
    // 这里可以添加认证检查逻辑
    // 暂时直接放行，后续可以集成认证状态检查
    next()
  } else {
    next()
  }
})

export default router
