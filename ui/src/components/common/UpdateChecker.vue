<template>
    <div class="update-checker">
        <!-- 检查更新按钮 -->
        <button @click="checkUpdate" :disabled="isChecking" class="update-btn"
            :class="{ 'has-update': hasUpdate, 'checking': isChecking }" :title="hasUpdate ? '发现新版本！' : '检查更新'">
            <!-- 更新提示小红点 -->
            <span v-if="hasUpdate" class="update-dot"></span>
            <svg v-if="!isChecking" viewBox="0 0 24 24" fill="currentColor" class="update-icon">
                <path
                    d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" class="update-icon spinning">
                <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
            </svg>
            <span v-if="!hasUpdate">{{ isChecking ? '检查中...' : '检查更新' }}</span>
            <span v-else class="update-available">有新版本</span>
        </button>

        <!-- 更新弹窗 -->
        <teleport to="body">
            <div v-if="showModal" class="modal-overlay" @click="closeModal">
                <div class="modal-content" @click.stop>
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <svg viewBox="0 0 24 24" fill="currentColor" class="modal-icon">
                                <path
                                    d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                            </svg>
                            版本检查结果
                        </h3>
                        <button @click="closeModal" class="modal-close">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path
                                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
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
                                <svg viewBox="0 0 24 24" fill="currentColor" class="status-icon success">
                                    <path
                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
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
                                <svg viewBox="0 0 24 24" fill="currentColor" class="status-icon info">
                                    <path
                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                                </svg>
                                <span class="status-text">您使用的已是最新版本</span>
                            </div>
                        </div>

                        <div v-if="error" class="error-section">
                            <div class="update-status">
                                <svg viewBox="0 0 24 24" fill="currentColor" class="status-icon error">
                                    <path
                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                </svg>
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
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.update-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
}

.update-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.update-btn.has-update {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
}

.update-btn.has-update:hover:not(:disabled) {
    background: #fde68a;
}

.update-btn.checking {
    background: #dbeafe;
    border-color: #3b82f6;
    color: #1d4ed8;
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
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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
    border-bottom: 1px solid #e5e7eb;
}

.modal-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
}

.modal-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #3b82f6;
}

.modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.25rem;
    background: none;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
}

.modal-close:hover {
    background: #f3f4f6;
    color: #374151;
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
    border-bottom: 1px solid #f3f4f6;
}

.version-row:last-child {
    border-bottom: none;
}

.label {
    font-weight: 500;
    color: #374151;
}

.version {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: #f3f4f6;
    color: #374151;
}

.version.newer {
    background: #dcfce7;
    color: #166534;
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
    color: #10b981;
}

.status-icon.info {
    color: #3b82f6;
}

.status-icon.error {
    color: #ef4444;
}

.status-text {
    font-weight: 600;
    color: #111827;
}

.release-info h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
}

.release-date {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1rem;
}

.release-notes h5 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
}

.release-body {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 1rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #374151;
    max-height: 12rem;
    overflow-y: auto;
}

.update-instructions {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #fef7cd;
    border: 1px solid #fbbf24;
    border-radius: 0.375rem;
}

.update-instructions h5 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #92400e;
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
    background: #f59e0b;
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
}

.step-text {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #92400e;
}

.step-text code {
    background: #fde68a;
    border: 1px solid #f59e0b;
    border-radius: 0.25rem;
    padding: 0.125rem 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.75rem;
    color: #92400e;
}

.error-message {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    padding: 0.75rem;
    color: #991b1b;
    font-size: 0.875rem;
}

.modal-footer {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    text-decoration: none;
}

.btn-primary {
    background: #3b82f6;
    color: white;
}

.btn-primary:hover {
    background: #2563eb;
}

.btn-secondary {
    background: #6b7280;
    color: white;
}

.btn-secondary:hover {
    background: #4b5563;
}

.btn-outline {
    background: white;
    color: #374151;
    border-color: #d1d5db;
}

.btn-outline:hover {
    background: #f9fafb;
    border-color: #9ca3af;
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