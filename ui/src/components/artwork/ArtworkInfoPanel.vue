<template>
    <div class="artwork-info">
        <div class="artwork-header">
            <div class="title-section">
                <h1 class="artwork-title">{{ artwork.title }}</h1>
                <!-- 下载状态角标 -->
                <div v-if="isDownloaded && !currentTask" class="download-badge" title="已下载到本地">
                    <SvgIcon name="check-circle" class="badge-icon" />
                </div>
            </div>
        </div>

        <!-- 按钮操作区域 - 单独的第二行 -->
        <div class="artwork-actions">
            <!-- 下载按钮 -->
            <button @click="$emit('download')" :disabled="downloading || !artwork" class="btn btn-primary"
                :title="downloading ? '正在下载中...' : (isDownloaded ? '重新下载作品 (快捷键: ↓)' : '下载作品到本地 (快捷键: ↓)')">
                <span v-if="downloading">下载中...</span>
                <span v-else-if="isDownloaded">重新下载</span>
                <span v-else>下载</span>
            </button>
            <!-- 收藏功能暂时不可用，已注释 -->
            <!-- <button @click="$emit('bookmark')" class="btn btn-secondary"
                :title="artwork.is_bookmarked ? '取消收藏此作品' : '收藏此作品'">
                {{ artwork.is_bookmarked ? '取消收藏' : '收藏' }}
            </button> -->
            <!-- 删除按钮：只有已下载的作品才显示 -->
            <button v-if="isDownloaded" @click="$emit('delete')" :disabled="deleting" class="btn btn-danger"
                :title="deleting ? '正在删除中...' : '删除此作品 (不可恢复)'">
                <span v-if="deleting">删除中...</span>
                <span v-else>删除作品</span>
            </button>
        </div>

        <!-- 下载进度区域 -->
        <div class="download-section">
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
                <SvgIcon name="arrow-left" />
                <span>返回 <span class="keyboard-hint">(Esc)</span></span>
            </button>
            <button @click="$emit('navigatePrevious')" class="nav-btn nav-prev"
                :disabled="!canNavigatePrevious || loading"
                :title="canNavigatePrevious ? (previousArtwork ? `上一个(快捷键: ←): ${previousArtwork.title}` : '加载上一页') : '没有上一个作品'">
                <SvgIcon name="arrow-left2" />
                <span>{{ loading ? '切换中...' : '上一个' }} </span>
            </button>
            <button @click="$emit('navigateNext')" class="nav-btn nav-next" :disabled="!canNavigateNext || loading"
                :title="canNavigateNext ? (nextArtwork ? `下一个(快捷键: →): ${nextArtwork.title}` : '加载下一页') : '没有下一个作品'">
                <span>{{ loading ? '切换中...' : '下一个' }} </span>
                <SvgIcon name="arrow-next" />
            </button>
        </div>

        <!-- 作品统计 -->
        <div class="artwork-stats">
            <div class="stat">
                <SvgIcon name="bookmark" />
                <span>{{ artwork.total_bookmarks }}</span>
            </div>
            <div class="stat">
                <SvgIcon name="eye" />
                <span>{{ artwork.total_view }}</span>
            </div>
            <div class="stat">
                <SvgIcon name="folder" />
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

        <!-- Caption - 只在描述为空或不同于caption时显示 -->
        <div v-if="artwork.caption && artwork.caption !== artwork.description" class="artwork-caption">
            <div class="caption-header">
                <h3>原文</h3>
                <label class="caption-toggle">
                    <input type="checkbox" :checked="showCaption" @change="handleCaptionToggleChange" />
                    <span class="caption-slider"></span>
                </label>
            </div>
            <div v-if="showCaption" class="caption-content" v-html="artwork.caption">
            </div>
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
    deleting?: boolean; // 新增删除中状态
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
    showCaption?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    showCaption: false,
    deleting: false
});

const emit = defineEmits<{
    download: [];
    // bookmark: []; // 收藏功能暂时不可用，已注释
    delete: []; // 新增删除事件
    updateTask: [task: DownloadTask];
    removeTask: [taskId: string];
    goBack: [];
    navigatePrevious: [];
    navigateNext: [];
    tagClick: [event: MouseEvent, tagName: string];
    toggleRecommendations: [checked: boolean];
    toggleCaption: [checked: boolean];
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

// 处理 Caption 开关切换
const handleCaptionToggleChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit('toggleCaption', target.checked);
};
</script>

<style scoped>
.artwork-info {
    background: var(--color-bg-primary);
    border-radius: var(--radius-xl);
    padding: var(--spacing-2xl);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border);
}

.artwork-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: var(--spacing-lg);
}

.title-section {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex: 1;
}

.artwork-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.3;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.download-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: var(--color-success-light);
    border: 1px solid var(--color-success);
    border-radius: 50%;
    flex-shrink: 0;
    cursor: help;
}

.badge-icon {
    width: 12px;
    height: 12px;
    color: var(--color-success);
}

.download-section {
    margin-bottom: var(--spacing-2xl);
}

.artwork-actions {
    display: flex;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    padding-top: var(--spacing-sm);
}

.artwork-actions .btn {
    min-width: 120px;
    white-space: nowrap;
}

.artist-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-xl);
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
    color: var(--color-text-primary);
    margin: 0 0 var(--spacing-xs) 0;
}

.artist-account {
    color: var(--color-text-secondary);
    margin: 0;
    font-size: 0.875rem;
}

.artwork-stats {
    display: flex;
    gap: var(--spacing-2xl);
    margin-bottom: var(--spacing-2xl);
}

.stat {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

.stat svg {
    width: 1rem;
    height: 1rem;
}

.artwork-tags {
    margin-bottom: var(--spacing-2xl);
}

.artwork-tags h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--spacing-lg) 0;
}

.tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
}

.artwork-description {
    margin-bottom: var(--spacing-2xl);
}

.artwork-description h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--spacing-lg) 0;
}

.description-content {
    color: var(--color-text-primary);
    line-height: 1.6;
}

.artwork-caption {
    margin-bottom: var(--spacing-xl);
}

.caption-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-sm) 0;
}

.caption-header h3 {
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin: 0;
}

.caption-toggle {
    position: relative;
    width: 24px;
    height: 12px;
}

.caption-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.caption-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--color-border-hover);
    transition: var(--transition-normal);
    border-radius: 12px;
}

.caption-slider:before {
    position: absolute;
    content: "";
    height: 8px;
    width: 8px;
    left: 2px;
    bottom: 2px;
    border-radius: 50%;
    background-color: white;
    transition: var(--transition-normal);
}

.caption-toggle input:checked+.caption-slider {
    background-color: var(--color-primary);
}

.caption-toggle input:focus+.caption-slider {
    box-shadow: 0 0 1px var(--color-primary);
}

.caption-toggle input:checked+.caption-slider:before {
    transform: translateX(12px);
}

.caption-content {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md) var(--spacing-lg);
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
}

.artwork-meta {
    padding-top: var(--spacing-xl);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-lg);
}

.meta-content {
    flex: 1;
}

.meta-item {
    display: flex;
    align-items: center;
    margin-bottom: var(--spacing-sm);
}

.meta-item:last-child {
    margin-bottom: 0;
}

.meta-label {
    font-weight: 500;
    color: var(--color-text-primary);
    min-width: 80px;
    margin-right: var(--spacing-sm);
}

.meta-value {
    color: var(--color-text-secondary);
}

.artwork-navigation {
    display: flex;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-2xl);
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
}

.nav-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    justify-content: center;
}

.nav-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
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
    border-radius: var(--radius-md);
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
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
}

.nav-back:hover {
    background: var(--color-bg-secondary);
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

.toggle-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--spacing-xs) var(--spacing-sm);
    width: fit-content;
    transition: all var(--transition-normal);
    flex-shrink: 0;
    height: 1.5rem;
}

.toggle-container:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-hover);
}

.toggle-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
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
    background-color: var(--color-border);
    transition: var(--transition-slow);
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
    transition: var(--transition-slow);
}

input:checked+.slider {
    background-color: var(--color-primary);
}

input:focus+.slider {
    box-shadow: 0 0 1px var(--color-primary);
}

input:checked+.slider:before {
    transform: translateX(14px);
}

.keyboard-hint {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    font-weight: 400;
    margin-left: var(--spacing-xs);
    opacity: 0.8;
}

@media (max-width: 768px) {
    .artwork-info {
        padding: var(--spacing-lg);
        margin: 0;
        border-radius: var(--radius-lg);
    }

    .artwork-title {
        font-size: 1.25rem;
        max-width: none;
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
    }

    /* 移动端按钮重新布局 */
    .artwork-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
    }

    .artwork-actions .btn {
        min-width: unset;
        padding: var(--spacing-md);
        font-size: 0.875rem;
        font-weight: 600;
        border-radius: var(--radius-lg);
        height: 44px; /* 符合移动端触摸标准 */
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* 下载按钮占据两列 */
    .artwork-actions .btn:first-child {
        grid-column: 1 / -1;
    }

    /* 如果有删除按钮，下载按钮占一列，删除按钮占一列 */
    .artwork-actions .btn:first-child:not(:last-child) {
        grid-column: 1 / 2;
    }

    .artwork-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--spacing-md);
        text-align: center;
        background: var(--color-bg-secondary);
        padding: var(--spacing-lg);
        border-radius: var(--radius-lg);
        margin-bottom: var(--spacing-xl);
    }

    .stat {
        flex-direction: column;
        gap: var(--spacing-xs);
        font-size: 0.75rem;
    }

    .stat svg {
        width: 1.25rem;
        height: 1.25rem;
        margin: 0 auto;
    }

    /* 移动端导航优化 */
    .artwork-navigation {
        position: sticky;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--color-bg-primary);
        border-top: 1px solid var(--color-border);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        padding: var(--spacing-md);
        margin: var(--spacing-xl) calc(-1 * var(--spacing-lg)) 0;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: var(--spacing-sm);
        box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
        z-index: 1001;
    }

    .nav-back {
        order: 0;
        min-width: 60px;
        padding: var(--spacing-sm);
        border-radius: var(--radius-md);
        background: var(--color-bg-secondary);
        border-color: var(--color-border);
    }

    .nav-back span {
        display: none;
    }

    .nav-prev,
    .nav-next {
        min-width: unset;
        padding: var(--spacing-md) var(--spacing-lg);
        font-weight: 600;
        border-radius: var(--radius-lg);
        height: 44px;
    }

    .nav-prev {
        order: 1;
        justify-content: center;
    }

    .nav-next {
        order: 2;
        justify-content: center;
    }

    /* 快速导航提示 */
    .artwork-navigation::before {
        content: "← 上一个 | 下一个 →";
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.75rem;
        color: var(--color-text-tertiary);
        background: var(--color-bg-secondary);
        padding: var(--spacing-xs) var(--spacing-sm);
        border-radius: var(--radius-sm);
        white-space: nowrap;
        opacity: 0.8;
    }

    .artist-info {
        padding: var(--spacing-lg);
        margin-bottom: var(--spacing-lg);
    }

    .artist-avatar {
        width: 2.5rem;
        height: 2.5rem;
    }

    .artist-name {
        font-size: 1rem;
    }

    .artist-account {
        font-size: 0.8rem;
    }

    .artwork-tags {
        margin-bottom: var(--spacing-lg);
    }

    .tags-list {
        gap: var(--spacing-xs);
    }

    .artwork-meta {
        flex-direction: column;
        gap: var(--spacing-md);
        padding-bottom: 80px; /* 为底部导航留出更多空间 */
    }

    .toggle-container {
        align-self: stretch;
        justify-content: space-between;
        padding: var(--spacing-md);
        height: auto;
    }

    .caption-content {
        max-height: 100px;
        font-size: 0.8rem;
    }

    .caption-header h3 {
        font-size: 0.9rem;
    }

    .artwork-description,
    .artwork-caption {
        margin-bottom: var(--spacing-lg);
    }

    .keyboard-hint {
        display: none;
    }
}

/* 更小屏幕的额外优化 */
@media (max-width: 480px) {
    .artwork-info {
        padding: var(--spacing-md);
    }

    .artwork-title {
        font-size: 1.125rem;
        line-height: 1.4;
    }

    .artwork-actions .btn {
        font-size: 0.8rem;
        height: 40px;
        padding: var(--spacing-sm);
    }

    .artwork-stats {
        padding: var(--spacing-md);
    }

    .stat {
        font-size: 0.7rem;
    }

    .stat svg {
        width: 1rem;
        height: 1rem;
    }

    .artist-info {
        padding: var(--spacing-md);
    }

    .artist-avatar {
        width: 2rem;
        height: 2rem;
    }

    .nav-prev,
    .nav-next {
        padding: var(--spacing-sm) var(--spacing-md);
        font-size: 0.875rem;
        height: 40px;
    }

    .nav-back {
        min-width: 50px;
        padding: var(--spacing-xs);
    }
}
</style>