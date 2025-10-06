<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import RandomRecommendations from '@/components/home/RandomRecommendations.vue';

const authStore = useAuthStore();

const isLoggedIn = computed(() => authStore.isLoggedIn);

// 随机推荐开关状态
const showRecommendations = ref(true);

// 从本地存储加载设置
const loadSettings = () => {
  const saved = localStorage.getItem('pixiv-home-settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      showRecommendations.value = settings.showRecommendations !== false;
    } catch (e) {
      console.warn('Failed to parse saved settings:', e);
    }
  }
};

// 保存设置到本地存储
const saveSettings = () => {
  const settings = {
    showRecommendations: showRecommendations.value
  };
  localStorage.setItem('pixiv-home-settings', JSON.stringify(settings));
};

// 切换推荐显示状态
const toggleRecommendations = () => {
  showRecommendations.value = !showRecommendations.value;
  saveSettings();
};

onMounted(async () => {
  await authStore.fetchLoginStatus();
  loadSettings();
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
    <div v-if="isLoggedIn" class="recommendations-section">
      <div class="container">
        <div class="recommendations-header">
          <h2 class="section-title">随机推荐</h2>
          <div class="recommendations-toggle">
            <label class="toggle-label">
              <span class="toggle-text">显示推荐</span>
              <div class="toggle-switch">
                <input 
                  type="checkbox" 
                  :checked="showRecommendations"
                  @change="toggleRecommendations"
                >
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        </div>
        
        <div v-if="showRecommendations" class="recommendations-content">
          <RandomRecommendations />
        </div>
        
        <div v-else class="recommendations-disabled">
          <p class="disabled-message">随机推荐已关闭，您可以通过上方开关重新启用</p>
        </div>
      </div>
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
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: white;
  padding: 4rem 0;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 var(--spacing-2xl);
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: var(--spacing-2xl);
  opacity: 0.9;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: center;
  flex-wrap: wrap;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--spacing-2xl);
}

.recommendations-section {
  padding: var(--spacing-2xl) 0;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2xl);
}

.recommendations-toggle {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
  user-select: none;
}

.toggle-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.recommendations-content {
  animation: fadeIn 0.3s ease-in-out;
}

.recommendations-disabled {
  text-align: center;
  padding: var(--spacing-2xl);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

.disabled-message {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin: 0;
}

.features-section {
  padding: 4rem 0;
  background: var(--color-bg-secondary);
}

.section-title {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 3rem;
  color: var(--color-text-primary);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-2xl);
}

.feature-card {
  background: var(--color-bg-primary);
  padding: var(--spacing-2xl);
  border-radius: var(--radius-xl);
  text-align: center;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
  border: 1px solid var(--color-border);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.feature-icon {
  width: 4rem;
  height: 4rem;
  margin: 0 auto var(--spacing-xl);
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all var(--transition-normal);
}

.feature-card:hover .feature-icon {
  background: var(--color-primary-dark);
  transform: scale(1.1);
}

.feature-icon svg {
  width: 2rem;
  height: 2rem;
}

.feature-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-primary);
}

.feature-description {
  color: var(--color-text-secondary);
  line-height: 1.6;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

  .recommendations-header {
    flex-direction: column;
    gap: var(--spacing-lg);
    align-items: stretch;
  }

  .section-title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
  }
}
</style>
