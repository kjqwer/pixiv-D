/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 生成文件预览URL
 * @param filePath 文件路径
 * @returns 预览URL
 */
export const getPreviewUrl = (filePath: string): string => {
  return `/api/repository/preview?path=${encodeURIComponent(filePath)}`
} 