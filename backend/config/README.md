# 用户配置系统

## 概述

本系统使用自动生成的用户配置文件来存储用户的下载目录路径和其他设置。配置文件会在后端初始化时自动创建，无需手动配置。

## 配置文件位置

- **配置文件**: `backend/config/user-config.json`
- **默认下载目录**: `./downloads` (相对于项目根目录)

## 配置项说明

```json
{
  "downloadDir": "./downloads",           // 下载目录路径
  "fileStructure": "artist/artwork",      // 文件结构模式
  "namingPattern": "{artist_name}/{artwork_id}_{title}", // 命名模式
  "maxFileSize": 0,                       // 最大文件大小 (0=无限制)
  "allowedExtensions": [".jpg", ".png", ".gif", ".webp"], // 允许的文件扩展名
  "autoMigration": false,                 // 是否启用自动迁移
  "migrationRules": [],                   // 迁移规则
  "lastUpdated": "2024-01-01T00:00:00.000Z" // 最后更新时间
}
```

## 自动初始化

1. 当后端启动时，系统会自动检查配置文件是否存在
2. 如果配置文件不存在，会自动创建默认配置文件
3. 默认下载目录为项目根目录下的 `downloads` 文件夹

## 配置管理

### 前端界面
- 在仓库管理页面可以修改配置
- 支持重置为默认配置
- 支持自动迁移功能

### API接口
- `GET /api/repository/config` - 获取配置
- `PUT /api/repository/config` - 更新配置
- `POST /api/repository/config/reset` - 重置配置

## 注意事项

1. **配置文件已加入 .gitignore**：每个用户的配置文件不同，不会被提交到版本控制
2. **路径支持**：
   - 相对路径：`./downloads` (相对于项目根目录)
   - 绝对路径：`D:\downloads` 或 `/home/user/downloads`
3. **迁移功能**：支持将旧目录中的文件移动到新配置的下载目录

## 故障排除

### 配置文件损坏
如果配置文件损坏或无法读取，系统会自动使用默认配置并重新创建配置文件。

### 权限问题
确保后端有权限读取和写入配置文件目录。

### 路径问题
- 确保路径格式正确
- Windows路径使用反斜杠：`D:\downloads`
- Unix路径使用正斜杠：`/home/user/downloads` 