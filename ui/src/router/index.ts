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
  ]
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
