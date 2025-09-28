<template>
    <div class="update-checker">
        <!-- 检查更新按钮 -->
        <button @click="checkUpdate" :disabled="isChecking" class="update-btn"
            :class="{ 'has-update': hasUpdate, 'checking': isChecking }" :title="hasUpdate ? '发现新版本！' : '检查更新'">
            <!-- 更新提示小红点 -->
            <span v-if="hasUpdate" class="update-dot"></span>
            <SvgIcon v-if="!isChecking" name="update" class="update-icon" />
            <SvgIcon v-else name="update" class="update-icon spinning" />
            <span v-if="!hasUpdate">{{ isChecking ? '检查中...' : '检查更新' }}</span>
            <span v-else class="update-available">有新版本</span>
        </button>

        <!-- 更新弹窗 -->
        <teleport to="body">
            <div v-if="showModal" class="modal-overlay" @click="closeModal">
                <div class="modal-content" @click.stop>
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <SvgIcon name="update" class="modal-icon" />
                            版本检查结果
                        </h3>
                        <button @click="closeModal" class="modal-close">
                            <SvgIcon name="close" class="modal-close" />
                        </button>
                    </div>

                    <div class="modal-body">
                        <div v-if="updateInfo" class="version-info">
                            <div class="version-row">
                                <span class="label">当前版本:</span>
                                <span class="version current">v{{ updateInfo.current }}</span>
                            </div>
                            <div class="version-row">
                                <span class="label">最新版本:</span>
                                <span class="version latest" :class="{ 'newer': updateInfo.hasUpdate }">
                                    v{{ updateInfo.latest }}
                                </span>
                            </div>
                        </div>

                        <div v-if="updateInfo?.hasUpdate" class="update-available-section">
                            <div class="update-status">
                                <SvgIcon name="success" class="status-icon success" />
                                <span class="status-text">发现新版本！</span>
                            </div>

                            <div v-if="updateInfo.releaseInfo" class="release-info">
                                <h4>{{ updateInfo.releaseInfo.name }}</h4>
                                <div class="release-date">
                                    发布时间: {{ formatDate(updateInfo.releaseInfo.publishedAt) }}
                                </div>
                                <div v-if="updateInfo.releaseInfo.body" class="release-notes">
                                    <h5>更新说明:</h5>
                                    <div class="release-body" v-html="formatReleaseNotes(updateInfo.releaseInfo.body)">
                                    </div>
                                </div>

                                <!-- 更新方法提示 -->
                                <div class="update-instructions">
                                    <h5>📋 更新方法:</h5>
                                    <div class="instructions-content">
                                        <div class="instruction-step">
                                            <span class="step-number">1</span>
                                            <span class="step-text">下载新版本的 <code>pixiv-manager-portable.rar</code>
                                                文件</span>
                                        </div>
                                        <div class="instruction-step">
                                            <span class="step-number">2</span>
                                            <span class="step-text">解压到当前程序目录，选择覆盖所有文件</span>
                                        </div>
                                        <div class="instruction-step">
                                            <span class="step-number">3</span>
                                            <span class="step-text">⚠️ <strong>重要：</strong>重新检查 <code>start.bat</code>
                                                中的代理端口和启动端口配置</span>
                                        </div>
                                        <div class="instruction-step">
                                            <span class="step-number">4</span>
                                            <span class="step-text">重新启动程序即可</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-else-if="updateInfo && !updateInfo.hasUpdate" class="no-update-section">
                            <div class="update-status">
                                <SvgIcon name="info" class="status-icon info" />
                                <span class="status-text">您使用的已是最新版本</span>
                            </div>
                        </div>

                        <div v-if="error" class="error-section">
                            <div class="update-status">
                                <SvgIcon name="error" class="status-icon error" />
                                <span class="status-text">检查更新失败</span>
                            </div>
                            <div class="error-message">{{ error }}</div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button @click="closeModal" class="btn btn-secondary">关闭</button>
                        <button v-if="updateInfo?.hasUpdate && updateInfo.releaseInfo?.downloadUrl"
                            @click="downloadUpdate" class="btn btn-primary">
                            下载更新
                        </button>
                        <button v-if="updateInfo?.hasUpdate && updateInfo.releaseInfo?.htmlUrl" @click="viewRelease"
                            class="btn btn-outline">
                            查看详情
                        </button>
                    </div>
                </div>
            </div>
        </teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUpdateStore } from '@/stores/update'

const updateStore = useUpdateStore()
const showModal = ref(false)
const error = ref<string | null>(null)

const hasUpdate = computed(() => updateStore.updateInfo?.hasUpdate ?? false)
const updateInfo = computed(() => updateStore.updateInfo)
const isChecking = computed(() => updateStore.isChecking)

const checkUpdate = async () => {
    error.value = null

    try {
        const result = await updateStore.checkUpdate(false)
        if (result) {
            showModal.value = true
        } else {
            error.value = '检查更新失败'
            showModal.value = true
        }
    } catch (err: any) {
        error.value = err.message || '网络连接失败'
        showModal.value = true
    }
}

const closeModal = () => {
    showModal.value = false
}

const downloadUpdate = () => {
    if (updateInfo.value?.releaseInfo?.downloadUrl) {
        window.open(updateInfo.value.releaseInfo.downloadUrl, '_blank')
    }
}

const viewRelease = () => {
    if (updateInfo.value?.releaseInfo?.htmlUrl) {
        window.open(updateInfo.value.releaseInfo.htmlUrl, '_blank')
    }
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
}

const formatReleaseNotes = (body: string) => {
    // 简单的Markdown到HTML转换
    return body
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
}

// 暴露给父组件的方法
defineExpose({
    checkUpdate
})
</script>

<style scoped>
.update-checker {
    position: relative;
}

.update-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border: 2px solid white;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }

    50% {
        transform: scale(1.2);
        opacity: 0.8;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.update-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    white-space: nowrap;
}

.update-btn:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-color: var(--color-border-hover);
    color: var(--color-text-primary);
}

.update-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.update-btn.has-update {
    background: var(--color-warning-light);
    border-color: var(--color-warning);
    color: #92400e;
    /* 这个颜色在主题中没有定义，保持原样 */
}

.update-btn.has-update:hover:not(:disabled) {
    background: #fde68a;
    /* 这个颜色在主题中没有完全匹配的，保持原样 */
}

.update-btn.checking {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary-dark);
}

.update-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
}

.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.update-available {
    font-weight: 600;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
}

.modal-content {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 32rem;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border);
}

.modal-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.modal-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-primary);
}

.modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-normal);
}

.modal-close:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.modal-close svg {
    width: 1rem;
    height: 1rem;
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
}

.version-info {
    margin-bottom: 1.5rem;
}

.version-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-bg-secondary);
}

.version-row:last-child {
    border-bottom: none;
}

.label {
    font-weight: 500;
    color: var(--color-text-primary);
}

.version {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.version.newer {
    background: var(--color-success-light);
    color: var(--color-success);
}

.update-available-section,
.no-update-section,
.error-section {
    margin-top: 1rem;
}

.update-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.status-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
}

.status-icon.success {
    color: var(--color-success);
}

.status-icon.info {
    color: var(--color-primary);
}

.status-icon.error {
    color: var(--color-error);
}

.status-text {
    font-weight: 600;
    color: var(--color-text-primary);
}

.release-info h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.release-date {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin-bottom: 1rem;
}

.release-notes h5 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
}

.release-body {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 1rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-text-primary);
    max-height: 12rem;
    overflow-y: auto;
}

.update-instructions {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--color-warning-light);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
}

.update-instructions h5 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-warning);
}

.instructions-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.instruction-step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
}

.step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    background: var(--color-warning);
    color: var(--color-bg-primary);
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
}

.step-text {
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color-warning);
}

.step-text code {
    background: var(--color-warning-light);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-sm);
    padding: 0.125rem 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.75rem;
    color: var(--color-warning);
}

.error-message {
    background: var(--color-error-light);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    color: var(--color-error);
    font-size: 0.875rem;
}

.modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-normal);
    border: 1px solid transparent;
    text-decoration: none;
}

.btn-primary {
    background: var(--color-primary);
    color: var(--color-bg-primary);
}

.btn-primary:hover {
    background: var(--color-primary-dark);
}

.btn-secondary {
    background: var(--color-text-secondary);
    color: var(--color-bg-primary);
}

.btn-secondary:hover {
    background: var(--color-text-secondary);
}

.btn-outline {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    border-color: var(--color-border);
}

.btn-outline:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-border-hover);
}

@media (max-width: 640px) {
    .modal-content {
        margin: 1rem;
        max-width: calc(100vw - 2rem);
    }

    .modal-header,
    .modal-body,
    .modal-footer {
        padding: 1rem;
    }

    .version-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }

    .modal-footer {
        flex-direction: column;
    }

    .btn {
        width: 100%;
    }
}
</style>