import { defineStore } from 'pinia'
import { ref } from 'vue'

interface ReleaseInfo {
  name: string
  body: string
  publishedAt: string
  htmlUrl: string
  downloadUrl?: string
}

interface UpdateInfo {
  current: string
  latest: string
  hasUpdate: boolean
  releaseInfo?: ReleaseInfo
}

export const useUpdateStore = defineStore('update', () => {
  const updateInfo = ref<UpdateInfo | null>(null)
  const isChecking = ref(false)
  const lastCheckTime = ref<Date | null>(null)

  // 检查更新
  const checkUpdate = async (silent = false): Promise<UpdateInfo | null> => {
    if (isChecking.value) return null
    
    isChecking.value = true
    
    try {
      const response = await fetch('/api/update/check-latest')
      const result = await response.json()
      
      if (result.success) {
        updateInfo.value = result.data
        lastCheckTime.value = new Date()
        return result.data
      } else {
        if (!silent) {
          console.error('检查更新失败:', result.error)
        }
        return null
      }
    } catch (error) {
      if (!silent) {
        console.error('检查更新网络错误:', error)
      }
      return null
    } finally {
      isChecking.value = false
    }
  }

  // 自动检查更新（登录后调用）
  const autoCheckUpdate = async () => {
    // 如果距离上次检查不足1小时，跳过
    if (lastCheckTime.value && Date.now() - lastCheckTime.value.getTime() < 60 * 60 * 1000) {
      return
    }
    
    const result = await checkUpdate(true) // 静默检查
    
    // 如果有更新，显示一个简单的控制台提示
    if (result?.hasUpdate) {
      console.log(`🎉 发现新版本 v${result.latest}，当前版本 v${result.current}`)
    }
  }

  // 获取当前版本
  const getCurrentVersion = async () => {
    try {
      const response = await fetch('/api/update/current-version')
      const result = await response.json()
      
      if (result.success) {
        return result.data.version
      }
    } catch (error) {
      console.error('获取当前版本失败:', error)
    }
    return null
  }

  return {
    updateInfo,
    isChecking,
    lastCheckTime,
    checkUpdate,
    autoCheckUpdate,
    getCurrentVersion
  }
}) 