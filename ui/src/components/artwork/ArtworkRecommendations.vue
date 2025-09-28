<template>
    <div class="artwork-recommendations">
        <div class="recommendations-header">
            <h3 class="recommendations-title">相关推荐</h3>
            <div class="recommendations-info" v-if="totalCount > 0">
                <span>共 {{ totalCount }} 个推荐作品</span>
            </div>
        </div>

        <div v-if="loading && artworks.length === 0" class="loading-section">
            <LoadingSpinner text="加载推荐中..." />
        </div>

        <div v-else-if="error && artworks.length === 0" class="error-section">
            <ErrorMessage :error="error" @dismiss="clearError" />
        </div>

        <div v-else-if="artworks.length > 0" class="recommendations-content">
            <div class="artworks-grid">
                <ArtworkCard v-for="artwork in artworks" :key="artwork.id" :artwork="artwork"
                    @click="handleArtworkClick" />
            </div>

            <!-- 加载更多按钮 -->
            <div v-if="hasMore" class="load-more-section">
                <button @click="loadMore" class="load-more-btn" :disabled="loadingMore">
                    {{ loadingMore ? '加载中...' : '加载更多' }}
                </button>
            </div>

            <!-- 没有更多内容提示 -->
            <div v-else-if="artworks.length > 0" class="no-more-section">
                <p>已加载全部推荐作品</p>
            </div>
        </div>

        <div v-else class="empty-section">
            <p>暂无相关推荐</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import artworkService from '@/services/artwork';
import type { Artwork } from '@/types';
import ArtworkCard from '@/components/artwork/ArtworkCard.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

interface Props {
    artworkId: number;
}

const props = defineProps<Props>();
const router = useRouter();

// 状态
const artworks = ref<Artwork[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const nextUrl = ref<string | null>(null);
const hasMore = ref(false);
const totalCount = ref(0);

// 缓存相关
const cache = ref<Map<string, any>>(new Map());
const cacheTimeout = ref<Map<string, number>>(new Map());
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 缓存键生成
const getCacheKey = (artworkId: number, isFirstPage: boolean = true) => {
    return `recommendations_${artworkId}_${isFirstPage ? 'first' : 'more'}`;
};

// 获取缓存
const getCache = (key: string) => {
    const cached = cache.value.get(key);
    const timeout = cacheTimeout.value.get(key);

    if (cached && timeout && Date.now() < timeout) {
        return cached;
    }

    // 清除过期缓存
    if (cached) {
        cache.value.delete(key);
        cacheTimeout.value.delete(key);
    }

    return null;
};

// 设置缓存
const setCache = (key: string, data: any) => {
    cache.value.set(key, data);
    cacheTimeout.value.set(key, Date.now() + CACHE_DURATION);
};

// 清除缓存
const clearCache = () => {
    cache.value.clear();
    cacheTimeout.value.clear();
};

// 获取推荐作品
const fetchRecommendations = async (isLoadMore = false) => {
    if (!props.artworkId) return;

    // 检查缓存（仅第一页）
    if (!isLoadMore) {
        const cacheKey = getCacheKey(props.artworkId, true);
        const cached = getCache(cacheKey);
        if (cached) {
            artworks.value = cached.artworks;
            nextUrl.value = cached.nextUrl;
            hasMore.value = cached.hasMore;
            totalCount.value = cached.totalCount;
            return;
        }
    }

    try {
        if (isLoadMore) {
            loadingMore.value = true;
        } else {
            loading.value = true;
            error.value = null;
        }

        const response = await artworkService.getRelatedArtworks(props.artworkId, {
            offset: isLoadMore ? artworks.value.length : 0,
            limit: 30
        });

        if (response.success && response.data) {
            if (isLoadMore) {
                // 追加到现有列表
                artworks.value.push(...response.data.artworks);
            } else {
                // 替换列表
                artworks.value = response.data.artworks;
                totalCount.value = response.data.total || response.data.artworks.length;
            }

            nextUrl.value = response.data.next_url || null;
            hasMore.value = !!response.data.next_url && response.data.artworks.length > 0;

            // 缓存第一页结果
            if (!isLoadMore) {
                const cacheKey = getCacheKey(props.artworkId, true);
                setCache(cacheKey, {
                    artworks: response.data.artworks,
                    nextUrl: nextUrl.value,
                    hasMore: hasMore.value,
                    totalCount: totalCount.value
                });
            }
        } else {
            throw new Error(response.error || '获取推荐作品失败');
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : '获取推荐作品失败';
        console.error('获取推荐作品失败:', err);
    } finally {
        if (isLoadMore) {
            loadingMore.value = false;
        } else {
            loading.value = false;
        }
    }
};

// 加载更多
const loadMore = async () => {
    if (!hasMore.value || loadingMore.value) return;
    await fetchRecommendations(true);
};

// 处理作品点击
const handleArtworkClick = (artwork: Artwork) => {
    // 在新标签页中打开
    const url = router.resolve({
        path: `/artwork/${artwork.id}`
    });
    window.open(url.href, '_blank');
};

// 清除错误
const clearError = () => {
    error.value = null;
};

// 监听作品ID变化
watch(() => props.artworkId, (newId, oldId) => {
    if (newId !== oldId) {
        // 清除状态
        artworks.value = [];
        nextUrl.value = null;
        hasMore.value = false;
        totalCount.value = 0;
        error.value = null;

        // 获取新的推荐
        if (newId) {
            fetchRecommendations();
        }
    }
});

onMounted(() => {
    if (props.artworkId) {
        fetchRecommendations();
    }
});
</script>

<style scoped>
.artwork-recommendations {
    background: var(--color-bg-primary);
    border-radius: var(--radius-xl);
    padding: var(--spacing-2xl);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border);
}

.recommendations-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2xl);
}

.recommendations-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
}

.recommendations-info {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

.loading-section,
.error-section,
.empty-section {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    color: var(--color-text-secondary);
}

.artworks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-2xl);
    margin-bottom: var(--spacing-2xl);
}

.load-more-section {
    display: flex;
    justify-content: center;
    margin-bottom: var(--spacing-lg);
}

.load-more-btn {
    padding: var(--spacing-md) var(--spacing-2xl);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    font-size: 1rem;
}

.load-more-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
    transform: translateY(-1px);
}

.load-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.no-more-section {
    text-align: center;
    padding: var(--spacing-2xl) 0;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

@media (max-width: 768px) {
    .artwork-recommendations {
        padding: var(--spacing-xl);
    }

    .recommendations-header {
        flex-direction: column;
        gap: var(--spacing-sm);
        align-items: flex-start;
    }

    .artworks-grid {
        grid-template-columns: 1fr;
        gap: var(--spacing-xl);
    }
}
</style>