<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'
import { useDownloadStore } from '@/stores/download'

const downloadStore = useDownloadStore()

const baseTitle = ref(document.title)
const wasDownloadingWhenHidden = ref(false)
const animationTimer = ref<number | null>(null)
let marqueeIndex = 0

const clearAnimation = () => {
  if (animationTimer.value) {
    clearInterval(animationTimer.value)
    animationTimer.value = null
  }
}

const startDownloadingAnimation = () => {
  // 滚动字幕效果（标题跑马灯）
  clearAnimation()
  const text = '   作品下载中...   '
  marqueeIndex = 0
  animationTimer.value = window.setInterval(() => {
    const rotated = text.slice(marqueeIndex) + text.slice(0, marqueeIndex)
    document.title = rotated
    marqueeIndex = (marqueeIndex + 1) % text.length
  }, 250)
}

const startCompletedAnimation = () => {
  // 轻微脉冲效果：在“下载完成”和“下载完成 ✓”之间切换
  clearAnimation()
  const frames = ['下载完成', '下载完成 ✓']
  let idx = 0
  animationTimer.value = window.setInterval(() => {
    document.title = frames[idx]
    idx = (idx + 1) % frames.length
  }, 800)
}

const updateTitleForHidden = () => {
  const len = downloadStore.downloadingTasks.length
  if (len > 0) {
    startDownloadingAnimation()
    wasDownloadingWhenHidden.value = true
  } else {
    if (wasDownloadingWhenHidden.value) {
      startCompletedAnimation()
    } else {
      clearAnimation()
      document.title = baseTitle.value
    }
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    updateTitleForHidden()
  } else {
    document.title = baseTitle.value
    wasDownloadingWhenHidden.value = false
    clearAnimation()
  }
}

onMounted(() => {
  baseTitle.value = document.title
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  watch(
    () => downloadStore.downloadingTasks.length,
    () => {
      if (document.visibilityState === 'hidden') {
        updateTitleForHidden()
      }
    },
    { immediate: false }
  )
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  clearAnimation()
})
</script>

<template>
  <!-- 纯逻辑组件，不渲染任何内容 -->
</template>