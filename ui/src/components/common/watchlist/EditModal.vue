<template>
    <div v-if="visible" class="edit-modal-overlay" @click.self="$emit('cancel')">
        <div class="edit-modal" @click.stop>
            <div class="modal-header">
                <h4>编辑待看项目</h4>
                <button @click="$emit('cancel')" class="close-btn">
                    <SvgIcon name="close" class="close-icon" />
                </button>
            </div>
            <div class="modal-content">
                <div class="form-group">
                    <label>标题</label>
                    <input :value="title" @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
                        type="text" class="form-input" placeholder="请输入标题" @keyup.enter="handleSave">
                </div>
                <div class="form-group">
                    <label>URL</label>
                    <input :value="url" @input="$emit('update:url', ($event.target as HTMLInputElement).value)"
                        type="text" class="form-input" placeholder="请输入URL" @keyup.enter="handleSave">
                </div>
            </div>
            <div class="modal-actions">
                <button @click="$emit('cancel')" class="btn btn-secondary">取消</button>
                <button @click="handleSave" class="btn btn-primary" :disabled="!title.trim() || !url.trim()">
                    保存
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Props {
    visible: boolean;
    title: string;
    url: string;
}

defineProps<Props>();

const emit = defineEmits<{
    cancel: [];
    save: [];
    'update:title': [value: string];
    'update:url': [value: string];
}>();

const handleSave = () => {
    emit('save');
};
</script>

<style scoped>
.edit-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1002;
    backdrop-filter: blur(4px);
}

.edit-modal {
    background: var(--color-bg-primary);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 480px;
    max-height: 90vh;
    overflow: hidden;
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--color-border);
}

.modal-header h4 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
}

.close-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.close-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
}

.close-icon {
    width: 16px;
    height: 16px;
}

.modal-content {
    padding: 24px;
}

.form-group {
    margin-bottom: 20px;
}

.form-group:last-child {
    margin-bottom: 0;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
}

.form-input {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 14px;
    outline: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
}

.form-input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light);
}

.form-input::placeholder {
    color: var(--color-text-tertiary);
}

.modal-actions {
    display: flex;
    gap: 12px;
    padding: 20px 24px;
    border-top: 1px solid var(--color-border);
    justify-content: flex-end;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
}

.btn-secondary {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
}

.btn-secondary:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border-color: var(--color-border-hover);
}

.btn-primary {
    background: var(--color-primary);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
}

.btn-primary:disabled {
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    cursor: not-allowed;
}

@media (max-width: 480px) {
    .edit-modal {
        width: 95%;
        margin: 20px;
    }

    .modal-header,
    .modal-content,
    .modal-actions {
        padding-left: 16px;
        padding-right: 16px;
    }

    .modal-actions {
        flex-direction: column;
    }

    .btn {
        width: 100%;
    }
}
</style>