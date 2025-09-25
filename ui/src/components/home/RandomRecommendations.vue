<template>
    <div class="random-recommendations">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">为你推荐</h2>
                <div class="header-actions">
                    <button @click="refreshRecommendations" class="btn btn-secondary btn-small" :disabled="loading">
                        <svg v-if="!loading" viewBox="0 0 24 24" fill="currentColor" class="refresh-icon">
                            <path
                                d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                        </svg>
                        <LoadingSpinner v-else text="" />
                        刷新推荐
                    </button>
                </div>
            </div>

            <div v-if="loading && recommendations.length === 0" class="loading-section">
                <LoadingSpinner text="正在获取推荐..." />
            </div>

            <div v-else-if="error" class="error-section">
                <ErrorMessage :error="error" @dismiss="clearError" />
            </div>

            <div v-else-if="recommendations.length === 0" class="empty-section">
                <div class="empty-content">
                    <SvgIcon name="empty2" class="empty-icon" />
                    <p class="empty-text">暂无推荐内容</p>
                    <p class="empty-subtext">关注一些作者后，这里会显示他们的最新作品</p>
                </div>
            </div>

            <div v-else class="recommendations-grid">
                <ArtworkCard v-for="artwork in recommendations" :key="artwork.id" :artwork="artwork"
                    @click="handleArtworkClick" />
            </div>

            <div v-if="recommendations.length > 0" class="section-footer">
                <p class="footer-text">
                    基于你关注的 {{ selectedArtists.length }} 位作者的最新作品推荐
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useArtistStore } from '@/stores/artist';
import artistService from '@/services/artist';
import type { Artist, Artwork } from '@/types';
import ArtworkCard from '@/components/artwork/ArtworkCard.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import ErrorMessage from '@/components/common/ErrorMessage.vue';

const router = useRouter();
const artistStore = useArtistStore();

// 状态
const loading = ref(false);
const error = ref<string | null>(null);
const recommendations = ref<Artwork[]>([]);
const selectedArtists = ref<Artist[]>([]);

// 计算属性
const hasFollowingArtists = computed(() => artistStore.followingArtists.length > 0);

// 随机选择作者
const selectRandomArtists = (artists: Artist[], count: number): Artist[] => {
    if (artists.length <= count) return artists;

    const shuffled = [...artists].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

// 获取作者最新作品
const fetchArtistArtworks = async (artist: Artist): Promise<Artwork[]> => {
    try {
        const response = await artistService.getArtistArtworks(artist.id, {
            type: 'art',
            limit: 3 // 每个作者获取3个最新作品
        });

        if (response.success && response.data) {
            return response.data.artworks || [];
        }
        return [];
    } catch (err) {
        console.error(`获取作者 ${artist.name} 作品失败:`, err);
        return [];
    }
};

// 生成推荐
const generateRecommendations = async () => {
    if (!hasFollowingArtists.value) {
        recommendations.value = [];
        selectedArtists.value = [];
        return;
    }

    try {
        loading.value = true;
        error.value = null;

        // 随机选择3-4个作者
        const artistCount = Math.min(4, Math.max(3, Math.floor(artistStore.followingArtists.length * 0.3)));
        const randomArtists = selectRandomArtists(artistStore.followingArtists, artistCount);
        selectedArtists.value = randomArtists;

        // 获取所有作者的最新作品
        const allArtworks: Artwork[] = [];
        for (const artist of randomArtists) {
            const artworks = await fetchArtistArtworks(artist);
            allArtworks.push(...artworks);
        }

        // 按创建时间排序，取最新的作品
        const sortedArtworks = allArtworks
            .sort((a, b) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime())
            .slice(0, 12); // 最多显示12个作品

        recommendations.value = sortedArtworks;
    } catch (err) {
        error.value = err instanceof Error ? err.message : '获取推荐失败';
        console.error('生成推荐失败:', err);
    } finally {
        loading.value = false;
    }
};

// 刷新推荐
const refreshRecommendations = async () => {
    await generateRecommendations();
};

// 处理作品点击
const handleArtworkClick = (artwork: Artwork) => {
    router.push(`/artwork/${artwork.id}`);
};

// 清除错误
const clearError = () => {
    error.value = null;
};

onMounted(async () => {
    // 如果还没有关注作者数据，先获取
    if (artistStore.followingArtists.length === 0) {
        try {
            await artistStore.fetchFollowingArtists();
        } catch (err) {
            console.error('获取关注作者失败:', err);
        }
    }

    // 生成推荐
    await generateRecommendations();
});

// 监听关注作者列表变化
watch(() => hasFollowingArtists.value, (newValue) => {
    if (newValue && recommendations.value.length === 0) {
        generateRecommendations();
    }
});
</script>

<style scoped>
.random-recommendations {
    margin: 2rem 0;
    padding: 0 2rem;
}

.random-recommendations .container {
    max-width: 1200px;
    margin: 0 auto;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.section-title {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 1rem;
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
}

.btn-small {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
}

.refresh-icon {
    width: 1rem;
    height: 1rem;
}

.loading-section {
    display: flex;
    justify-content: center;
    padding: 3rem 0;
}

.error-section {
    margin-bottom: 2rem;
}

.empty-section {
    text-align: center;
    padding: 4rem 0;
}

.empty-content {
    max-width: 400px;
    margin: 0 auto;
}

.empty-icon {
    width: 4rem;
    height: 4rem;
    color: #9ca3af;
    margin-bottom: 1rem;
}

.empty-text {
    font-size: 1.25rem;
    font-weight: 600;
    color: #6b7280;
    margin: 0 0 0.5rem 0;
}

.empty-subtext {
    color: #9ca3af;
    margin: 0;
    line-height: 1.5;
}

.recommendations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
    max-width: 100%;
}

/* 确保网格能够更好地填充空间 */
.recommendations-grid:has(:nth-child(4n)) {
    grid-template-columns: repeat(4, 1fr);
}

.recommendations-grid:has(:nth-child(3n)):not(:has(:nth-child(4n))) {
    grid-template-columns: repeat(3, 1fr);
}

.recommendations-grid:has(:nth-child(2n)):not(:has(:nth-child(3n))) {
    grid-template-columns: repeat(2, 1fr);
}

.section-footer {
    text-align: center;
    padding: 1rem 0;
    border-top: 1px solid #e5e7eb;
}

.footer-text {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
}

@media (max-width: 1200px) {
    .recommendations-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    }
}

@media (max-width: 768px) {
    .random-recommendations {
        padding: 0 1rem;
    }

    .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }

    .recommendations-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
    }

    .section-title {
        font-size: 1.5rem;
    }
}

@media (max-width: 480px) {
    .recommendations-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
}
</style>