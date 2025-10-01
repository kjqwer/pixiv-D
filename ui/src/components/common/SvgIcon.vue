<template>
  <svg :viewBox="viewBox" :fill="fill" :width="displayWidth" :height="displayHeight" v-bind="$attrs">
    <path v-if="iconData" :d="iconData" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { iconRegistry } from '@/assets/icons'
import { getIconViewBox } from '@/assets/icons/viewbox-config'

interface Props {
  name: string
  viewBox?: string
  fill?: string
  width?: string | number
  height?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  viewBox: undefined,
  fill: 'currentColor',
  width: undefined,
  height: undefined
})

const iconData = computed(() => {
  return iconRegistry[props.name] || ''
})

// 使用配置表来获取合适的viewBox
const viewBox = computed(() => {
  return getIconViewBox(props.name, props.viewBox)
})

// 统一默认大小为24px，如果没有指定width/height则使用默认值
const displayWidth = computed(() => {
  return props.width ? (typeof props.width === 'number' ? `${props.width}px` : props.width) : '24px'
})

const displayHeight = computed(() => {
  return props.height ? (typeof props.height === 'number' ? `${props.height}px` : props.height) : '24px'
})
</script>