<template>
    <div class="artwork-info">
        <div class="artwork-header">
            <h1 class="artwork-title">{{ artwork.title }}</h1>
            <!-- 下载按钮 -->
            <div class="artwork-actions">
                <button @click="$emit('download')" :disabled="downloading || !artwork" class="btn btn-primary"
                    :title="downloading ? '正在下载中...' : (isDownloaded ? '重新下载作品 (快捷键: ↓)' : '下载作品到本地 (快捷键: ↓)')">
                    <span v-if="downloading">下载中...</span>
                    <span v-else-if="isDownloaded">重新下载</span>
                    <span v-else>下载</span>
                </button>
                <button @click="$emit('bookmark')" class="btn btn-secondary"
                    :title="artwork.is_bookmarked ? '取消收藏此作品' : '收藏此作品'">
                    {{ artwork.is_bookmarked ? '取消收藏' : '收藏' }}
                </button>
            </div>
        </div>

        <!-- 下载状态和进度区域 -->
        <div class="download-section">
            <!-- 下载状态提示 -->
            <div v-if="isDownloaded && !currentTask" class="download-status">
                <div class="status-indicator">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="status-icon">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    <span>已下载到本地</span>
                </div>
            </div>

            <!-- 下载进度 -->
            <DownloadProgress v-if="currentTask" :task="currentTask" :loading="downloading"
                @update="$emit('updateTask', $event)" @remove="$emit('removeTask', $event)" />
        </div>

        <!-- 作者信息 -->
        <div class="artist-info">
            <img :src="getImageUrl(artwork.user.profile_image_urls.medium)" :alt="artwork.user.name"
                class="artist-avatar" crossorigin="anonymous" />
            <div class="artist-details">
                <h3 class="artist-name">{{ artwork.user.name }}</h3>
                <p class="artist-account">@{{ artwork.user.account }}</p>
            </div>
            <router-link :to="`/artist/${artwork.user.id}`" class="btn btn-text">
                查看作者
            </router-link>
        </div>

        <!-- 作品导航 -->
        <div v-if="showNavigation" class="artwork-navigation">
            <button @click="$emit('goBack')" class="nav-btn nav-back" title="返回作者页面(快捷键: Esc / ↑ )">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
                <span>返回 <span class="keyboard-hint">(Esc)</span></span>
            </button>
            <button @click="$emit('navigatePrevious')" class="nav-btn nav-prev"
                :disabled="!canNavigatePrevious || loading"
                :title="canNavigatePrevious ? (previousArtwork ? `上一个(快捷键: ←): ${previousArtwork.title}` : '加载上一页') : '没有上一个作品'">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
                <span>{{ loading ? '切换中...' : '上一个' }} </span>
            </button>
            <button @click="$emit('navigateNext')" class="nav-btn nav-next" :disabled="!canNavigateNext || loading"
                :title="canNavigateNext ? (nextArtwork ? `下一个(快捷键: →): ${nextArtwork.title}` : '加载下一页') : '没有下一个作品'">
                <span>{{ loading ? '切换中...' : '下一个' }} </span>
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                </svg>
            </button>
        </div>

        <!-- 作品统计 -->
        <div class="artwork-stats">
            <div class="stat">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>{{ artwork.total_bookmarks }}</span>
            </div>
            <div class="stat">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
                <span>{{ artwork.total_view }}</span>
            </div>
            <div class="stat">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                        d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                </svg>
                <span>{{ artwork.width }} × {{ artwork.height }}</span>
            </div>
        </div>

        <!-- 标签 -->
        <div class="artwork-tags">
            <h3>标签</h3>
            <div class="tags-list">
                <button v-for="tag in artwork.tags" :key="tag.name" @click="handleTagClick($event, tag.name)"
                    class="tag tag-clickable" :class="{ 'tag-selected': selectedTags.includes(tag.name) }"
                    :title="`搜索标签: ${tag.name} (在新标签页中打开，按住Ctrl键点击选择多个标签，松开Ctrl键搜索)`">
                    {{ tag.name }}
                </button>
            </div>
        </div>

        <!-- 描述 -->
        <div v-if="artwork.description" class="artwork-description">
            <h3>描述</h3>
            <div class="description-content" v-html="artwork.description"></div>
        </div>

        <!-- 时间信息和推荐开关 -->
        <div class="artwork-meta">
            <div class="meta-content">
                <div class="meta-item">
                    <span class="meta-label">创建时间:</span>
                    <span class="meta-value">{{ formatDate(artwork.create_date) }}</span>
                </div>
                <div v-if="isValidUpdateDate && artwork.update_date !== artwork.create_date" class="meta-item">
                    <span class="meta-label">更新时间:</span>
                    <span class="meta-value">{{ formatDate(artwork.update_date) }}</span>
                </div>
            </div>

            <!-- 推荐作品开关 -->
            <div class="toggle-container">
                <span class="toggle-label">相关推荐</span>
                <label class="toggle-switch">
                    <input type="checkbox" :checked="showRecommendations" @change="handleToggleChange" />
                    <span class="slider"></span>
                </label>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getImageProxyUrl } from '@/services/api';
import type { Artwork, DownloadTask } from '@/types';
import DownloadProgress from '@/components/download/DownloadProgress.vue';

const router = useRouter();

interface Props {
    artwork: Artwork;
    downloading: boolean;
    isDownloaded: boolean;
    currentTask: DownloadTask | null;
    loading: boolean;
    showNavigation: boolean;
    previousArtwork: Artwork | null;
    nextArtwork: Artwork | null;
    canNavigatePrevious: boolean;
    canNavigateNext: boolean;
    selectedTags: string[];
    showRecommendations: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    download: [];
    bookmark: [];
    updateTask: [task: DownloadTask];
    removeTask: [taskId: string];
    goBack: [];
    navigatePrevious: [];
    navigateNext: [];
    tagClick: [event: MouseEvent, tagName: string];
    toggleRecommendations: [checked: boolean];
}>();

// 使用统一的图片代理函数
const getImageUrl = getImageProxyUrl;

// 检查更新时间是否有效
const isValidUpdateDate = computed(() => {
    if (!props.artwork.update_date) return false;

    try {
        const date = new Date(props.artwork.update_date);
        return !isNaN(date.getTime());
    } catch (error) {
        return false;
    }
});

// 格式化日期
const formatDate = (dateString: string) => {
    if (!dateString) return '未知时间';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn('无效的日期格式:', dateString);
            return '时间格式错误';
        }
        return date.toLocaleDateString('zh-CN');
    } catch (error) {
        console.error('日期格式化错误:', error);
        return '时间解析失败';
    }
};

// 处理标签点击
const handleTagClick = (event: MouseEvent, tagName: string) => {
    emit('tagClick', event, tagName);
};

// 处理推荐开关切换
const handleToggleChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit('toggleRecommendations', target.checked);
};
</script>

<style scoped>
.artwork-info {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.artwork-header {
    margin-bottom: 1.5rem;
}

.download-section {
    margin-bottom: 2rem;
}

.artwork-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 1rem 0;
    line-height: 1.3;
}

.artwork-actions {
    display: flex;
    gap: 1rem;
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

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background: #3b82f6;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: #2563eb;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

.btn-text {
    background: none;
    color: #3b82f6;
    padding: 0.5rem 1rem;
}

.btn-text:hover {
    background: #f3f4f6;
}

.artist-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: #f8fafc;
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
}

.artist-avatar {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    object-fit: cover;
}

.artist-details {
    flex: 1;
}

.artist-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
}

.artist-account {
    color: #6b7280;
    margin: 0;
    font-size: 0.875rem;
}

.artwork-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
}

.stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
}

.stat svg {
    width: 1rem;
    height: 1rem;
}

.artwork-tags {
    margin-bottom: 2rem;
}

.artwork-tags h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
}

.tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.tag {
    background: #f3f4f6;
    color: #374151;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    line-height: 1;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.tag-clickable {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
}

.tag-clickable:hover {
    background: #bae6fd;
    color: #075985;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tag-selected {
    background: #3b82f6 !important;
    color: white !important;
    border-color: #2563eb !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.tag-selected:hover {
    background: #2563eb !important;
    color: white !important;
}

.artwork-description {
    margin-bottom: 2rem;
}

.artwork-description h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
}

.description-content {
    color: #374151;
    line-height: 1.6;
}

.artwork-meta {
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
}

.meta-content {
    flex: 1;
}

.meta-item {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
}

.meta-item:last-child {
    margin-bottom: 0;
}

.meta-label {
    font-weight: 500;
    color: #374151;
    min-width: 80px;
    margin-right: 0.5rem;
}

.meta-value {
    color: #6b7280;
}

.artwork-navigation {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.75rem;
}

.nav-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background: white;
    color: #374151;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    justify-content: center;
}

.nav-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    position: relative;
}

.nav-btn:disabled::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 0.5rem;
    z-index: 1;
}

.nav-btn svg {
    width: 1.25rem;
    height: 1.25rem;
}

.nav-back {
    flex: 0 0 auto;
    min-width: 100px;
    justify-content: center;
    background: #f3f4f6;
    border-color: #9ca3af;
}

.nav-back:hover {
    background: #e5e7eb;
}

.nav-prev,
.nav-next {
    flex: 1;
    min-width: 120px;
}

.nav-prev {
    justify-content: flex-start;
}

.nav-next {
    justify-content: flex-end;
}

.download-status {
    padding: 1rem 1.25rem;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #0369a1;
    font-size: 0.875rem;
    font-weight: 500;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.status-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #059669;
}

.toggle-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 0.25rem 0.5rem;
    width: fit-content;
    transition: all 0.2s ease;
    flex-shrink: 0;
    height: 1.5rem;
}

.toggle-container:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
}

.toggle-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    line-height: 1;
}

.toggle-switch {
    position: relative;
    width: 28px;
    height: 14px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #e5e7eb;
    transition: .3s;
    border-radius: 14px;
}

.slider:before {
    position: absolute;
    content: "";
    height: 10px;
    width: 10px;
    left: 2px;
    bottom: 2px;
    border-radius: 50%;
    background-color: white;
    transition: .3s;
}

input:checked+.slider {
    background-color: #3b82f6;
}

input:focus+.slider {
    box-shadow: 0 0 1px #3b82f6;
}

input:checked+.slider:before {
    transform: translateX(14px);
}

.keyboard-hint {
    font-size: 0.75rem;
    color: #9ca3af;
    font-weight: 400;
    margin-left: 0.25rem;
    opacity: 0.8;
}

@media (max-width: 768px) {
    .artwork-actions {
        flex-direction: column;
    }

    .btn {
        width: 100%;
    }

    .artwork-stats {
        flex-direction: column;
        gap: 1rem;
    }

    .artwork-navigation {
        flex-direction: column;
        gap: 0.75rem;
    }

    .nav-back {
        order: -1;
        align-self: flex-start;
        min-width: 80px;
    }

    .nav-prev,
    .nav-next {
        min-width: auto;
    }

    .artwork-meta {
        flex-direction: column;
        gap: 1rem;
    }

    .toggle-container {
        align-self: flex-end;
    }
}
</style>