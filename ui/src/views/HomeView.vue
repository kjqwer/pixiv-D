<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import RandomRecommendations from '@/components/home/RandomRecommendations.vue';

const authStore = useAuthStore();

const isLoggedIn = computed(() => authStore.isLoggedIn);

onMounted(async () => {
  await authStore.fetchLoginStatus();
});
</script>

<template>
  <div class="home">
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">Pixiv 作品管理器</h1>
        <p class="hero-subtitle">
          发现、收藏、下载你喜欢的 Pixiv 作品
        </p>

        <div class="hero-actions">
          <router-link v-if="!isLoggedIn" to="/login" class="btn btn-primary">
            立即登录
          </router-link>
          <router-link v-else to="/search" class="btn btn-primary">
            开始搜索
          </router-link>

          <router-link to="/downloads" class="btn btn-secondary">
            下载管理
          </router-link>
        </div>
      </div>
    </div>

    <!-- 随机推荐区域 -->
    <div class="recommendations-section">
      <RandomRecommendations v-if="isLoggedIn" />
    </div>

    <div class="features-section">
      <div class="container">
        <h2 class="section-title">主要功能</h2>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">
              <SvgIcon name="search" />
            </div>
            <h3 class="feature-title">作品搜索</h3>
            <p class="feature-description">
              通过关键词、标签、作者等多种方式搜索作品
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <SvgIcon name="ranking" />
            </div>
            <h3 class="feature-title">热门榜单</h3>
            <p class="feature-description">
              查看日榜、周榜、月榜热门作品，一键批量下载
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <SvgIcon name="download" />
            </div>
            <h3 class="feature-title">一键下载</h3>
            <p class="feature-description">
              支持单个作品、批量作品、作者作品下载
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <SvgIcon name="user" />
            </div>
            <h3 class="feature-title">作者管理</h3>
            <p class="feature-description">
              关注喜欢的作者，查看作品列表和统计信息
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <SvgIcon name="download" />
            </div>
            <h3 class="feature-title">下载管理</h3>
            <p class="feature-description">
              实时查看下载进度，管理下载历史和任务
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">
              <SvgIcon name="folder" />
            </div>
            <h3 class="feature-title">仓库管理</h3>
            <p class="feature-description">
              管理本地作品仓库，分类整理和快速检索
            </p>
          </div>

        </div>
      </div>
    </div>


  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
}

.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 0;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 2rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
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
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.recommendations-section {
  padding: 2rem 0;
  background: white;
}

.features-section {
  padding: 4rem 0;
  background: #f8fafc;
}

.section-title {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 3rem;
  color: #1f2937;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-icon {
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1.5rem;
  background: #3b82f6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.feature-icon svg {
  width: 2rem;
  height: 2rem;
}

.feature-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

.feature-description {
  color: #6b7280;
  line-height: 1.6;
}



@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .btn {
    width: 100%;
    max-width: 300px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }


}
</style>
