<template>
    <div class="bookmarks-page">
        <div class="container">
            <div class="page-header">
                <h1 class="page-title">我的收藏</h1>
                <div class="page-actions">
                    <select v-model="selectedType" @change="handleTypeChange" class="type-select">
                        <option value="all">全部类型</option>
                        <option value="illust">插画</option>
                        <option value="manga">漫画</option>
                        <option value="novel">小说</option>
                    </select>
                </div>
            </div>

            <div v-if="loading" class="loading-section">
                <LoadingSpinner text="加载中..." />
            </div>

            <div v-else-if="error" class="error-section">
                <ErrorMessage :error="error" @dismiss="clearError" />
            </div>

            <div v-else-if="artworks.length === 0" class="empty-section">
                <div class="empty-content">
                    <SvgIcon name="empty2" class="empty-icon" />
                    <h3>暂无收藏作品</h3>
                    <p>你还没有收藏任何作品</p>
                    <router-link to="/search" class="btn btn-primary">
                        去搜索作品
                    </router-link>
                </div>
            </div>

            <div v-else class="artworks-grid">
                <div v-for="artwork in artworks" :key="artwork.id" class="artwork-card-wrapper">
                    <ArtworkCard :artwork="artwork" @click="handleArtworkClick" />
                </div>
            </div>

            <!-- 加载更多 -->
            <div v-if="hasMore && !loading" class="load-more">
                <button @click="loadMore" class="btn btn-secondary">
                    加载更多
                </button>
            </div>

            <div v-if="loadingMore" class="loading-more">
                <LoadingSpinner text="加载更多..." />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { artworkService } from '@/services/artwork';
import { getImageProxyUrl } from '@/services/api';
import { saveScrollPosition, restoreScrollPosition } from '@/utils/scrollManager';
import type { Artwork } from '@/types';

import ArtworkCard from '@/components/artwork/ArtworkCard.vue';

const router = useRouter();
const route = useRoute();

// 响应式数据
const artworks = ref<(Artwork & { loaded?: boolean; error?: boolean })[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const selectedType = ref('all');
const offset = ref(0);
const limit = 30;
const hasMore = ref(true);

// 计算属性
const getImageUrl = getImageProxyUrl;

// 获取收藏列表
const fetchBookmarks = async (isLoadMore = false) => {
    try {
        if (isLoadMore) {
            loadingMore.value = true;
        } else {
            loading.value = true;
            error.value = null;
        }

        const response = await artworkService.getBookmarks({
            type: selectedType.value === 'all' ? undefined : selectedType.value,
            offset: isLoadMore ? offset.value : 0,
            limit
        });

        if (response.success && response.data) {
            const newArtworks = response.data.artworks.map(artwork => ({
                ...artwork,
                loaded: false,
                error: false
            }));

            if (isLoadMore) {
                artworks.value.push(...newArtworks);
            } else {
                artworks.value = newArtworks;
            }

            offset.value = isLoadMore ? offset.value + limit : limit;
            hasMore.value = !!response.data.next_url;
        } else {
            error.value = response.error || '获取收藏列表失败';
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : '获取收藏列表失败';
        console.error('获取收藏列表失败:', err);
    } finally {
        loading.value = false;
        loadingMore.value = false;
    }
};

// 类型切换
const handleTypeChange = () => {
    offset.value = 0;
    hasMore.value = true;
    fetchBookmarks();
};

// 加载更多
const loadMore = () => {
    if (!loadingMore.value && hasMore.value) {
        fetchBookmarks(true);
    }
};

// 处理作品点击
const handleArtworkClick = (artwork: Artwork) => {
    // 保存当前页面的滚动位置
    saveScrollPosition(route.fullPath);
    
    router.push({
        path: `/artwork/${artwork.id}`,
        query: {
            returnUrl: route.fullPath,
            scrollTop: (window.scrollY || document.documentElement.scrollTop).toString()
        }
    });
};

// 清除错误
const clearError = () => {
    error.value = null;
};

// 页面加载时获取数据
onMounted(async () => {
    await fetchBookmarks();
    
    // 恢复滚动位置
    setTimeout(() => {
        restoreScrollPosition(route.fullPath);
    }, 200);
});
</script>

<style scoped>
.bookmarks-page {
    padding: 2rem 0;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.page-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
}

.page-actions {
    display: flex;
    gap: 1rem;
}

.type-select {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    font-size: 1rem;
    color: #374151;
}

.loading-section,
.error-section,
.empty-section {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
}

.empty-content {
    text-align: center;
    color: #6b7280;
}

.empty-icon {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1rem;
    color: #d1d5db;
}

.empty-content h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
}

.empty-content p {
    margin-bottom: 1.5rem;
}

.artworks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.artwork-card-wrapper {
    position: relative;
}

.load-more,
.loading-more {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
}

@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
    }

    .artworks-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 1rem;
    }


}
</style>