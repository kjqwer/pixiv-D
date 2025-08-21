# Pixiv 后端服务

这是一个优雅的 Pixiv 后端服务架构，提供作品信息获取、作者信息查询、文件下载等功能。

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
│   └── download.js      # 下载路由
├── services/            # 服务层
│   ├── artwork.js       # 作品服务
│   ├── artist.js        # 作者服务
│   └── download.js      # 下载服务
└── utils/               # 工具类
    └── response.js      # 响应工具
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 或直接运行
node backend/start.js
```

### 3. 测试登录

```bash
node backend/test-login.js
```

## 📡 API 接口

### 认证相关

- `GET /api/auth/status` - 获取登录状态
- `GET /api/auth/login-url` - 获取登录URL
- `POST /api/auth/callback` - 处理登录回调
- `POST /api/auth/relogin` - 重新登录
- `POST /api/auth/logout` - 登出

### 作品相关

- `GET /api/artwork/:id` - 获取作品详情
- `GET /api/artwork/:id/preview` - 获取作品预览
- `GET /api/artwork/:id/images` - 获取作品图片URL
- `GET /api/artwork/search` - 搜索作品

### 作者相关

- `GET /api/artist/:id` - 获取作者信息
- `GET /api/artist/:id/artworks` - 获取作者作品列表
- `GET /api/artist/:id/following` - 获取作者关注列表
- `GET /api/artist/:id/followers` - 获取作者粉丝列表
- `POST /api/artist/:id/follow` - 关注/取消关注作者

### 下载相关

- `POST /api/download/artwork/:id` - 下载单个作品
- `POST /api/download/artworks` - 批量下载作品
- `POST /api/download/artist/:id` - 下载作者作品
- `GET /api/download/progress/:taskId` - 获取下载进度
- `DELETE /api/download/cancel/:taskId` - 取消下载任务
- `GET /api/download/history` - 获取下载历史

## 🔧 配置说明

### 代理配置

在 `config.js` 中配置代理设置：

```javascript
const proxyConfig = {
  system: {
    host: '127.0.0.1',
    port: 7897,
    protocol: 'http'
  }
};
```

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

### 服务层

- **artwork.js**: 作品服务，处理作品API调用
- **artist.js**: 作者服务，处理作者API调用
- **download.js**: 下载服务，处理文件下载

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

### 3. 文件下载
- 下载单个作品
- 批量下载作品
- 下载作者作品
- 下载进度跟踪
- 下载历史记录

### 4. 认证管理
- OAuth2.0 登录流程
- 自动刷新令牌
- 登录状态管理

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

## �� 许可证

MIT License 