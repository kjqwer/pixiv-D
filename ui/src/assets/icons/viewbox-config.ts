/**
 * 图标viewBox配置表
 * 定义不同图标使用的viewBox尺寸
 */

// 默认viewBox尺寸
export const DEFAULT_VIEWBOX = '0 0 24 24'

// 大尺寸viewBox的图标配置
export const LARGE_VIEWBOX_ICONS: Record<string, string> = {
  'clock': '0 0 1024 1024',
  'rebuild': '0 0 1024 1024',
  'download': '0 0 1024 1024',
  'clean': '0 0 1024 1024',
  'upload': '0 0 1024 1024',
  'reset': '0 0 1024 1024',
  'folder-search': '0 0 1024 1024',
  'layers': '0 0 1024 1024',
  'trending-up': '0 0 1024 1024',
  'trending-down': '0 0 1024 1024',
  'database': '0 0 1024 1024',
}

/**
 * 获取指定图标的viewBox
 * @param iconName 图标名称
 * @param customViewBox 自定义viewBox（优先级最高）
 * @returns viewBox字符串
 */
export function getIconViewBox(iconName: string, customViewBox?: string): string {
  if (customViewBox) {
    return customViewBox
  }
  
  return LARGE_VIEWBOX_ICONS[iconName] || DEFAULT_VIEWBOX
}