# Pixiv Manager Frontend

Pixiv 作品管理前端应用，基于 Vue 3 + TypeScript + Vite + Pinia 构建。

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

## 许可证

本项目仅供学习和个人使用，请遵守 Pixiv 的服务条款。

