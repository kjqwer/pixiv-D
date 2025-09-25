<template>
  <svg :viewBox="viewBox" :fill="fill" v-bind="$attrs">
    <path v-if="iconData" :d="iconData" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { iconRegistry } from '@/assets/icons'

interface Props {
  name: string
  viewBox?: string
  fill?: string
}

const props = withDefaults(defineProps<Props>(), {
  viewBox: '0 0 24 24',
  fill: 'currentColor'
})

const iconData = computed(() => {
  return iconRegistry[props.name] || ''
})
</script>