# Pixiv Manager Frontend

一个优雅的 Pixiv 作品管理前端应用，基于 Vue 3 + TypeScript + Vite + Pinia 构建。

## 功能特性

- 🎨 **作品搜索与浏览** - 支持关键词搜索、标签筛选、排序等功能
- 👨‍🎨 **作者管理** - 关注喜欢的作者，查看作品列表和统计信息
- 📥 **下载管理** - 支持单个作品、批量作品、作者作品下载
- 🔐 **用户认证** - 基于 Pixiv OAuth 2.0 的安全登录系统
- 📱 **响应式设计** - 完美适配桌面端和移动端
- ⚡ **现代化技术栈** - Vue 3 + TypeScript + Vite + Pinia

## 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP 客户端**: Axios
- **样式**: CSS3 + 响应式设计

## 项目结构

```
src/
├── components/          # 组件目录
│   ├── common/         # 通用组件
│   │   ├── LoadingSpinner.vue
│   │   └── ErrorMessage.vue
│   └── artwork/        # 作品相关组件
│       └── ArtworkCard.vue
├── views/              # 页面组件
│   ├── HomeView.vue    # 首页
│   ├── LoginView.vue   # 登录页
│   ├── SearchView.vue  # 搜索页
│   ├── ArtworkView.vue # 作品详情页
│   ├── ArtistView.vue  # 作者详情页
│   ├── DownloadsView.vue # 下载管理页
│   └── ArtistsView.vue # 作者管理页
├── services/           # API 服务层
│   ├── api.ts         # 基础 API 服务
│   ├── auth.ts        # 认证相关 API
│   ├── artwork.ts     # 作品相关 API
│   ├── artist.ts      # 作者相关 API
│   └── download.ts    # 下载相关 API
├── stores/            # Pinia 状态管理
│   └── auth.ts        # 认证状态管理
├── types/             # TypeScript 类型定义
│   └── index.ts       # 全局类型定义
├── router/            # 路由配置
│   └── index.ts       # 路由定义
├── assets/            # 静态资源
│   └── main.css       # 全局样式
├── App.vue            # 根组件
└── main.ts            # 应用入口
```

## 开发指南

### 环境要求

- Node.js >= 16
- pnpm >= 7

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint
```

## 设计原则

### 组件设计
- **单一职责**: 每个组件只负责一个特定功能
- **可复用性**: 组件设计时考虑复用性，避免过度耦合
- **类型安全**: 全面使用 TypeScript 确保类型安全

### 状态管理
- **集中管理**: 使用 Pinia 进行集中状态管理
- **响应式**: 状态变化自动触发 UI 更新
- **持久化**: 关键状态支持本地持久化

### API 设计
- **服务层**: 所有 API 调用封装在服务层
- **错误处理**: 统一的错误处理机制
- **类型安全**: API 响应类型定义完整

### 样式设计
- **响应式**: 支持多种屏幕尺寸
- **一致性**: 统一的设计语言和组件库
- **可维护性**: 模块化的 CSS 结构

## 主要功能模块

### 1. 认证模块
- Pixiv OAuth 2.0 登录
- 登录状态管理
- 自动刷新 Token

### 2. 作品搜索
- 关键词搜索
- 标签筛选
- 排序选项
- 分页加载

### 3. 作品详情
- 作品信息展示
- 多页作品支持
- 下载功能
- 作者信息

### 4. 作者管理
- 作者信息展示
- 作品列表
- 关注/取消关注
- 批量下载

### 5. 下载管理
- 下载任务创建
- 进度跟踪
- 历史记录
- 任务取消

## 部署说明

### 环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 构建部署

```bash
# 构建生产版本
pnpm build

# 部署到静态服务器
# dist/ 目录包含所有静态文件
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目仅供学习和个人使用，请遵守 Pixiv 的服务条款。

## 更新日志

### v1.0.0
- 初始版本发布
- 基础功能实现
- 响应式设计
- TypeScript 支持
