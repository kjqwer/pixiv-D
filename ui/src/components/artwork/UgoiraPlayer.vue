<template>
  <div class="ugoira-player">
    <div class="player-stage">
      <img v-if="currentFrameUrl" :src="currentFrameUrl" class="stage-image" crossorigin="anonymous" />
      <div v-else class="stage-placeholder">
        <LoadingSpinner text="动图加载中..." />
      </div>
      <div v-if="error" class="stage-error">{{ error }}</div>
    </div>

    <div class="player-controls">
      <button class="btn btn-primary btn-small" @click="togglePlay" :disabled="loading || !!error">
        {{ playing ? '暂停' : '播放' }}
      </button>
      <span class="status-text" v-if="loading">预加载帧 {{ loadedCount }}/{{ frames.length }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import JSZip from 'jszip';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import artworkService from '@/services/artwork';
import { getPximgFileProxyUrl } from '@/services/api';
import type { Artwork } from '@/types';

interface Props {
  artwork: Artwork;
}

const props = defineProps<Props>();

const loading = ref(true);
const error = ref<string | null>(null);
const frames = ref<{ file: string; delay: number }[]>([]);
const frameUrls = ref<string[]>([]);
const currentFrameIndex = ref(0);
const playing = ref(true);
let timer: number | null = null;
const loadedCount = ref(0);

const currentFrameUrl = ref<string>('');

const clearTimer = () => {
  if (timer) {
    window.clearTimeout(timer);
    timer = null;
  }
};

const cleanupUrls = () => {
  frameUrls.value.forEach((url) => URL.revokeObjectURL(url));
  frameUrls.value = [];
};

const scheduleNextFrame = () => {
  clearTimer();
  if (!playing.value || frames.value.length === 0) return;
  const delay = frames.value[currentFrameIndex.value]?.delay || 60;
  timer = window.setTimeout(() => {
    currentFrameIndex.value = (currentFrameIndex.value + 1) % frames.value.length;
    currentFrameUrl.value = frameUrls.value[currentFrameIndex.value] || '';
    scheduleNextFrame();
  }, delay);
};

const togglePlay = () => {
  playing.value = !playing.value;
  if (playing.value) scheduleNextFrame();
  else clearTimer();
};

const loadUgoira = async () => {
  try {
    loading.value = true;
    error.value = null;
    // 获取元数据
    const metaResp = await artworkService.getUgoiraMeta(props.artwork.id);
    if (!metaResp.success || !metaResp.data) throw new Error(metaResp.error || '获取ugoira元数据失败');
    frames.value = metaResp.data.frames || [];
    // 优先使用原始zip，如果没有则用medium
    const zipUrl = metaResp.data.zip_urls.original || metaResp.data.zip_urls.medium || '';
    if (!zipUrl) throw new Error('缺少Ugoira ZIP地址');
    const proxied = getPximgFileProxyUrl(zipUrl);
    // 下载ZIP
    const resp = await fetch(proxied);
    if (!resp.ok) throw new Error(`下载ZIP失败: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    // 预加载帧
    const orderedFrames = frames.value.slice().sort((a, b) => a.file.localeCompare(b.file));
    for (const fr of orderedFrames) {
      const fileEntry = zip.file(fr.file);
      if (!fileEntry) continue;
      const blob = await fileEntry.async('blob');
      const url = URL.createObjectURL(blob);
      frameUrls.value.push(url);
      loadedCount.value = frameUrls.value.length;
    }
    if (frameUrls.value.length === 0) throw new Error('ZIP中未找到帧图片');
    currentFrameIndex.value = 0;
    currentFrameUrl.value = frameUrls.value[0];
    loading.value = false;
    playing.value = true;
    scheduleNextFrame();
  } catch (e: any) {
    error.value = e?.message || '加载ugoira失败';
    loading.value = false;
    playing.value = false;
    clearTimer();
  }
};

onMounted(() => {
  loadUgoira();
});

onUnmounted(() => {
  clearTimer();
  cleanupUrls();
});

// 当artwork变化时重新加载
watch(() => props.artwork.id, () => {
  clearTimer();
  cleanupUrls();
  loadUgoira();
});
</script>

<style scoped>
.ugoira-player {
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.player-stage {
  position: relative;
  aspect-ratio: 1;
  background: var(--color-bg-tertiary);
}

.stage-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.stage-placeholder,
.stage-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

.status-text {
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>