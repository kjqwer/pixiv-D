/**
 * 滚动位置管理工具
 * 用于在页面跳转时保存和恢复滚动位置
 */

/**
 * 保存当前页面的滚动位置
 * @param path 页面路径，用于标识保存的位置
 */
export function saveScrollPosition(path?: string): void {
  const currentPath = path || window.location.pathname + window.location.search
  const scrollPosition = {
    top: window.pageYOffset || document.documentElement.scrollTop,
    left: window.pageXOffset || document.documentElement.scrollLeft
  }
  
  sessionStorage.setItem(`scroll_${currentPath}`, JSON.stringify(scrollPosition))
}

/**
 * 保存指定页面的滚动位置
 * @param path 页面路径
 * @param position 滚动位置
 */
export function saveScrollPositionForPath(path: string, position: { top: number; left: number }): void {
  sessionStorage.setItem(`scroll_${path}`, JSON.stringify(position))
}

/**
 * 获取保存的滚动位置
 * @param path 页面路径
 * @returns 滚动位置或null
 */
export function getSavedScrollPosition(path?: string): { top: number; left: number } | null {
  const currentPath = path || window.location.pathname + window.location.search
  const saved = sessionStorage.getItem(`scroll_${currentPath}`)
  
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (error) {
      console.warn('解析保存的滚动位置失败:', error)
      return null
    }
  }
  
  return null
}

/**
 * 清除保存的滚动位置
 * @param path 页面路径，如果不提供则清除当前页面的
 */
export function clearScrollPosition(path?: string): void {
  const currentPath = path || window.location.pathname + window.location.search
  sessionStorage.removeItem(`scroll_${currentPath}`)
}

/**
 * 清除所有保存的滚动位置
 */
export function clearAllScrollPositions(): void {
  const keys = Object.keys(sessionStorage)
  keys.forEach(key => {
    if (key.startsWith('scroll_')) {
      sessionStorage.removeItem(key)
    }
  })
}

/**
 * 滚动到指定位置
 * @param position 滚动位置
 * @param behavior 滚动行为
 */
export function scrollToPosition(
  position: { top: number; left: number }, 
  behavior: ScrollBehavior = 'auto'
): void {
  window.scrollTo({
    top: position.top,
    left: position.left,
    behavior
  })
}

/**
 * 在页面即将卸载时保存滚动位置
 * 通常用于 beforeunload 事件
 */
export function saveScrollPositionBeforeUnload(): void {
  saveScrollPosition()
}

/**
 * 在页面加载完成后恢复滚动位置
 * 通常用于 mounted 生命周期
 */
export function restoreScrollPosition(path?: string): void {
  const savedPosition = getSavedScrollPosition(path)
  if (savedPosition) {
    // 延迟一点时间确保页面内容完全加载
    setTimeout(() => {
      scrollToPosition(savedPosition, 'auto')
      // 恢复后清除保存的位置
      clearScrollPosition(path)
    }, 100)
  }
} 