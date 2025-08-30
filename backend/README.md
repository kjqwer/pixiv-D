# Pixiv 后端服务

Pixiv 后端服务架构，提供作品信息获取、作者信息查询、文件下载等功能。

## 🏗️ 项目架构

```
backend/
├── server.js              # 主服务器文件
├── core.js                # 核心后端逻辑
├── auth.js                # 认证模块
├── config.js              # 代理配置
├── start.js               # 启动脚本
├── test-login.js          # 登录测试脚本
├── middleware/            # 中间件
│   ├── auth.js           # 认证中间件
│   └── errorHandler.js   # 错误处理中间件
├── routes/               # 路由模块
│   ├── auth.js          # 认证路由
│   ├── artwork.js       # 作品路由
│   ├── artist.js        # 作者路由
│   ├── download.js      # 下载路由
│   ├── ranking.js       # 排行榜路由
│   └── repository.js    # 仓库管理路由
├── services/            # 服务层
│   ├── artwork.js       # 作品服务
│   ├── artist.js        # 作者服务
│   ├── download.js      # 下载服务
│   ├── ranking.js       # 排行榜服务
│   └── repository.js    # 仓库管理服务
└── utils/               # 工具类
    └── response.js      # 响应工具
```

## 📡 API 接口

### 认证相关

- `GET /api/auth/status` - 获取登录状态
- `GET /api/auth/login-url` - 获取登录URL
- `POST /api/auth/callback` - 处理登录回调
- `POST /api/auth/relogin` - 重新登录
- `POST /api/auth/logout` - 登出

### 作品相关

- `GET /api/artwork/search` - 搜索作品
  - 参数: `keyword`, `type`, `sort`, `duration`, `offset`, `limit`
- `GET /api/artwork/:id` - 获取作品详情
  - 参数: `include_user`, `include_series`
- `GET /api/artwork/:id/preview` - 获取作品预览
- `GET /api/artwork/:id/images` - 获取作品图片URL
  - 参数: `size` (small/medium/large/original)

### 排行榜相关

- `GET /api/ranking` - 获取排行榜数据
  - 参数: `mode` (day/week/month), `type` (art/manga/novel), `offset`, `limit`

### 作者相关

- `GET /api/artist/following` - 获取当前用户关注的作者列表
  - 参数: `offset`, `limit`
- `GET /api/artist/:id/artworks` - 获取作者作品列表
  - 参数: `type`, `filter`, `offset`, `limit`
- `GET /api/artist/:id/following` - 获取作者关注列表
  - 参数: `restrict`, `offset`, `limit`
- `GET /api/artist/:id/followers` - 获取作者粉丝列表
  - 参数: `restrict`, `offset`, `limit`
- `POST /api/artist/:id/follow` - 关注/取消关注作者
  - 参数: `restrict` (public/private)

### 下载相关

- `POST /api/download/artwork/:id` - 下载单个作品
  - 参数: `size`, `quality`, `format`
- `POST /api/download/artworks` - 批量下载作品
  - 参数: `artworkIds`, `size`, `quality`, `format`, `concurrent`
- `POST /api/download/artist/:id` - 下载作者作品
  - 参数: `type`, `filter`, `size`, `quality`, `format`, `concurrent`
- `POST /api/download/ranking` - 下载排行榜作品
  - 参数: `mode`, `type`, `limit`, `size`, `quality`, `format`
- `GET /api/download/progress/:taskId` - 获取下载进度
- `DELETE /api/download/cancel/:taskId` - 取消下载任务
- `GET /api/download/history` - 获取下载历史
  - 参数: `offset`, `limit`

### 代理相关

- `GET /api/proxy/image` - 图片代理服务
  - 参数: `url` (图片URL)
- `GET /api/proxy/cache/stats` - 获取图片缓存统计信息
- `DELETE /api/proxy/cache` - 清理所有图片缓存
- `DELETE /api/proxy/cache/expired` - 清理过期图片缓存
- `GET /api/proxy/cache/config` - 获取缓存配置
- `PUT /api/proxy/cache/config` - 更新缓存配置
- `POST /api/proxy/cache/config/reset` - 重置缓存配置为默认值

### API缓存管理相关

- `GET /api/proxy/api-cache/stats` - 获取API缓存统计信息
- `DELETE /api/proxy/api-cache` - 清理所有API缓存
- `DELETE /api/proxy/api-cache/expired` - 清理过期API缓存
- `GET /api/proxy/api-cache/config` - 获取API缓存配置
- `PUT /api/proxy/api-cache/config` - 更新API缓存配置
- `POST /api/proxy/api-cache/config/reset` - 重置API缓存配置为默认值

### 仓库管理相关

- `POST /api/repository/initialize` - 初始化仓库
- `GET /api/repository/config` - 获取仓库配置
- `PUT /api/repository/config` - 更新仓库配置
- `GET /api/repository/stats` - 获取仓库统计信息
- `GET /api/repository/artists` - 获取作者列表
  - 参数: `offset`, `limit`
- `GET /api/repository/artists/:artistName/artworks` - 获取作者作品列表
  - 参数: `offset`, `limit`
- `GET /api/repository/search` - 搜索作品
  - 参数: `q`, `offset`, `limit`
- `GET /api/repository/artworks/:artworkId` - 获取作品详情
- `DELETE /api/repository/artworks/:artworkId` - 删除作品
- `POST /api/repository/migrate` - 自动迁移旧项目
  - 参数: `sourceDir` (源目录路径)
- `GET /api/repository/preview` - 文件预览代理
  - 参数: `path` (文件路径)
- `GET /api/repository/file-info` - 获取文件信息
  - 参数: `path` (文件路径)
- `GET /api/repository/directory` - 获取目录结构
  - 参数: `path` (目录路径)
- `GET /api/repository/check-downloaded/:artworkId` - 检查作品是否已下载
- `GET /api/repository/check-directory` - 检查目录是否存在
  - 参数: `path` (目录路径)
- `POST /api/repository/migrate-old-to-new` - 从旧目录迁移到新目录
  - 参数: `oldDir` (旧目录路径), `newDir` (新目录路径)

## 🔧 配置说明

### 代理配置

在 `config.js` 中配置代理设置：

### 环境变量

- `PORT` - 服务器端口 (默认: 3000)
- `NODE_ENV` - 运行环境 (development/production)
- `FRONTEND_URL` - 前端URL (用于CORS)

## 📁 文件结构说明

### 核心模块

- **server.js**: 主服务器类，负责初始化、配置和启动服务器
- **core.js**: 核心后端逻辑，管理认证状态和配置
- **auth.js**: 认证模块，处理OAuth2.0登录流程

### 中间件

- **auth.js**: 认证中间件，验证用户登录状态
- **errorHandler.js**: 全局错误处理中间件

### 路由模块

- **auth.js**: 认证相关路由
- **artwork.js**: 作品相关路由
- **artist.js**: 作者相关路由
- **download.js**: 下载相关路由
- **repository.js**: 仓库管理路由
- **proxy.js**: 代理服务路由

### 服务层

- **artwork.js**: 作品服务，处理作品API调用
- **artist.js**: 作者服务，处理作者API调用
- **download.js**: 下载服务，处理文件下载
- **repository.js**: 仓库管理服务，处理文件管理和配置
- **image-cache.js**: 图片缓存服务，管理图片代理缓存
- **api-cache.js**: API缓存服务，管理API请求缓存

### 工具类

- **response.js**: 统一API响应格式工具

## 🎯 主要功能

### 1. 作品信息获取
- 获取作品详细信息
- 获取作品预览信息
- 获取作品图片URL
- 搜索作品

### 2. 作者信息查询
- 获取作者基本信息
- 获取作者作品列表
- 获取作者关注/粉丝列表
- 关注/取消关注作者

### 3. 排行榜功能
- 获取日/周/月排行榜数据
- 支持插画、漫画、小说类型筛选
- 分页浏览排行榜作品
- 批量下载排行榜作品

### 4. 文件下载
- 下载单个作品
- 批量下载作品
- 下载作者作品
- 下载进度跟踪
- 下载历史记录

### 5. 认证管理
- OAuth2.0 登录流程
- 自动刷新令牌
- 登录状态管理

### 6. 仓库管理
- 文件存储配置管理
- 作品文件浏览和搜索
- 按作者分类浏览
- 文件预览和下载
- 自动迁移旧项目
- 磁盘使用情况监控
- 作品删除管理

### 7. 图片缓存管理
- 图片代理缓存功能
- 自动缓存过期清理
- 缓存大小限制管理
- 缓存统计信息查看
- 手动缓存清理功能

### 8. API缓存管理
- 作者相关API请求缓存功能
- 自动缓存过期清理（默认5分钟）
- 缓存大小限制管理（默认50MB）
- 缓存统计信息查看
- 手动缓存清理功能
- 支持配置缓存策略和端点白名单

## 🔒 安全特性

- 统一的错误处理
- 请求参数验证
- 认证中间件保护
- CORS 配置
- 代理支持

## 📊 监控和日志

- 请求日志记录
- 错误日志记录
- 健康检查接口
- 下载进度跟踪

## 🛠️ 开发指南

### 添加新路由

1. 在 `routes/` 目录下创建新的路由文件
2. 在 `server.js` 中注册路由
3. 添加相应的中间件保护

### 添加新服务

1. 在 `services/` 目录下创建新的服务类
2. 实现相应的业务逻辑
3. 在路由中调用服务

### 添加新中间件

1. 在 `middleware/` 目录下创建新的中间件文件
2. 在 `server.js` 中注册中间件

## 📝 注意事项

1. 确保代理配置正确
2. 首次使用需要登录获取访问令牌
3. 下载功能需要足够的磁盘空间
4. 建议在生产环境中使用PM2等进程管理器

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License 