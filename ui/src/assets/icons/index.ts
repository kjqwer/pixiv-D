// 导入各类图标
import { brandIcons } from './brand'
import { navigationIcons } from './navigation'
import { actionIcons } from './actions'

// 自动合并所有分类图标到统一注册表
export const iconRegistry: Record<string, string> = {
  ...brandIcons,
  ...navigationIcons,
  ...actionIcons
}

// 类型定义
export type IconName = keyof typeof iconRegistry

// 添加新图标的辅助函数
export const addIcon = (name: string, pathData: string) => {
  iconRegistry[name] = pathData
}

// 检查图标是否存在
export const hasIcon = (name: string): boolean => {
  return name in iconRegistry
}

// 获取所有图标名称
export const getAllIconNames = (): string[] => {
  return Object.keys(iconRegistry)
} 