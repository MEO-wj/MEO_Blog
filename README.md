<div align="center">

# MEO_Blog

### 基于 3D 主机场景叙事的个人博客网站

![Experience](https://img.shields.io/badge/Experience-3D%20Scene%20Entry-EA580C)
![Theme](https://img.shields.io/badge/Theme-Console%20Gaming-2563EB)
![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20R3F-16A34A)
![Backend](https://img.shields.io/badge/Backend-Go%20%2B%20PostgreSQL-00ADD8)
![Status](https://img.shields.io/badge/Status-Active%20Development-22C55E)

</div>

一个以 **3D 游戏主机场景** 为入口的个人博客网站。访客进入后会先置身于一个可探索的夜间主机收藏房间，点击 Switch 屏幕后镜头以电影级动画推进，进入 Switch 风格的主界面，所有博客内容均通过该界面进行导航和阅读。

> 设计理念：以 3D 为入口，以 2D 页面承载内容阅读。

## 快速导航

- [在线体验](#在线体验)
- [核心特色](#核心特色)
- [功能模块](#功能模块)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [本地开发](#本地开发)
- [部署](#部署)
- [文档索引](#文档索引)

## 在线体验

| 端 | 入口 | 说明 |
| --- | --- | --- |
| 桌面端 | `/` | 3D 场景 + Switch 主界面 |
| 手机端 | `/` | 自动适配 Switch App 风格 2D 界面 |

> 桌面端需要 WebGL 支持，首次加载约需下载 3D 模型资源（已启用浏览器 Cache Storage 缓存，二次访问秒开）。

## 核心特色

### 沉浸式 3D 场景

- **夜间房间环境**：深色调背景、网格地板、星空雾气
- **丰富模型资产**：PS5 主机、DualSense 手柄、Switch 掌机/底座/卡带、科幻书桌、沙发、储物柜、食人花摆件
- **动态光照**：月光方向光 + 屏幕辉光点光 + 暖色边缘光 + 蓝色填充光，2048×2048 阴影贴图
- **轨道控制**：支持鼠标旋转、缩放，自由探索整个房间
- **电影级运镜**：从全景视角到 Switch 屏幕的平滑推拉动画

### Switch 风格主界面

- 1280×720 主机风格 UI，位于 Switch 屏幕平面上
- 顶部用户区：头像、昵称、邮箱、实时时钟
- 横向项目卡片栏：拖拽滚动 + 键盘导航
- 底部功能栏：模拟主机手柄操作体验
- 完整键盘导航：方向键切换、Enter 确认、Escape 返回
- Switch 风格音效反馈（悬停、点击、关闭等）

### 手机端适配

- 视口 ≤ 760px 自动切换为轻量 2D App 布局
- 不加载 Three.js / GLB 模型，节省流量
- Nintendo App 风格的图标卡片和底部导航
- 独立博客阅读入口，支持分类简介展开/收起

## 功能模块

### 博客系统（魔法书架）
- 书架视图：分类以书本形式展示，每本书有自定义图标和颜色
- 卷轴视图：文章以羊皮纸卷轴样式呈现
- 阅读器：羊皮纸风格内容区，支持 GFM Markdown（表格、任务列表、删除线等）
- 评论系统：昵称 + 邮箱 + 内容，管理员可删除
- 管理功能：分类和文章 CRUD，草稿/发布状态切换

### 留言墙
- 发帖：昵称本地缓存 + 内容（500 字限制）
- 回复：支持多层回复，管理员回复有专属徽章
- 审核机制：管理员可审核留言，审核通过后公开可见
- 删除：用户可删除自己的留言，管理员可删除任意留言

### 收藏展示（任务布告栏）
- 基于 Knuth 乘法哈希的确定性伪随机布局
- 铁钉固定 + 羊皮纸背景 + 火漆印章装饰
- 灯箱查看：点击图片全屏放大
- 管理功能：上传、拖拽排序、删除

### 项目展示
- 项目卡片：图标、标题、副标题、分类标签、主题色
- 详情弹窗：Markdown 简介 + 技术栈图标 + 状态徽章
- 按需加载：首页仅加载摘要，点击后懒加载完整详情

### GitHub 集成
- 个人资料：头像、昵称、简介、位置、邮箱、关注者/关注数
- 贡献热力图：最近 90 天，GitHub 绿色系配色
- 公开仓库：名称、描述、语言、Star 数、Fork 数

### 简历展示
- 图片形式简历，支持放大预览
- 管理员可上传/替换

### 合作伙伴
- 横向滑动展示合作伙伴图标和链接
- 管理员可增删改

### 管理后台
- **双重验证登录**：密码 + 手柄按键序列（方向键 + ABXY 组合）
- 终端窗口风格面板
- 个人资料编辑、项目管理、博客管理、留言审核、收藏管理、入口权限配置

### 游客入口权限
- 可配置游客是否可见 3D 场景入口
- 无权限时显示友好提示

## 技术架构

| 层 | 技术 |
| --- | --- |
| **前端语言** | TypeScript |
| **前端框架** | React 19 |
| **构建工具** | Vite 6 |
| **3D 渲染** | Three.js + React Three Fiber + Drei |
| **状态管理** | Zustand |
| **路由** | React Router v7 |
| **样式** | Tailwind CSS v4 |
| **Markdown** | react-markdown + remark-gfm |
| **后端语言** | Go |
| **HTTP 框架** | Chi |
| **数据库** | PostgreSQL 16 |
| **数据库驱动** | pgx |
| **缓存** | Redis 7 |
| **日志** | slog |
| **容器化** | Docker Compose |
| **反向代理** | Nginx |
| **HTTPS** | Let's Encrypt (Certbot) |

## 项目结构

```text
MEO_Blog/
├── backend/                        # Go 后端服务
│   ├── cmd/server/main.go          # 入口：配置加载、HTTP 启动、优雅关闭
│   ├── internal/
│   │   ├── config/                 # 环境变量配置
│   │   ├── http/                   # Chi 路由 + 统一响应格式
│   │   ├── middleware/             # RequestID、CORS、Logging、Recovery、Auth
│   │   └── repository/             # PostgreSQL 连接池 + Redis 客户端
│   └── migrations/                 # 数据库迁移（16 个版本）
├── web/                            # React 前端应用
│   ├── src/
│   │   ├── main.tsx                # React 入口
│   │   ├── App.tsx                 # 路由定义 + 桌面/手机端分流
│   │   ├── scene/                  # 3D 场景：入口、模型加载、灯光、相机、缓存
│   │   ├── features/switch-ui/     # Switch 主界面 + 手机端 App 界面
│   │   ├── api/                    # API 客户端 + 类型定义 + 保存队列
│   │   └── stores/                 # Zustand 状态
│   └── public/Sence_layout.json    # 3D 场景布局数据
├── model/                          # GLB 3D 模型资源
│   ├── PS5/                        # PS5 主机、手柄、包装盒
│   ├── Switch/                     # Switch 掌机、底座、卡带
│   └── Scene/                      # 桌子、沙发、柜子、摆件
├── docker/                         # Nginx 配置
├── docs/                           # 设计文档、架构文档
├── docker-compose.yml              # 全栈部署编排
├── docker-compose.server.yml       # 服务器部署（含 Certbot）
├── docker-compose.local-server.yml # Local server/NAS deployment (:18080)
└── .env.example                    # 环境变量模板
```

## 本地开发

### 前端

```bash
cd web
npm install
npm run dev
# → http://127.0.0.1:5174/
```

### 后端

```bash
cd backend
# 确保 PostgreSQL 和 Redis 已运行
go run ./cmd/server
# → http://localhost:8080/api/v1/health
```

### 全栈（Docker）

```bash
cp .env.example .env
# 编辑 .env 填入密码等配置
docker compose -f docker-compose.local-server.yml up -d --build
# → http://localhost:18080/
```

## 部署

```bash
# 服务器部署（含 HTTPS）
docker compose up -d --build
# Equivalent explicit cloud configuration:
docker compose -f docker-compose.server.yml up -d --build
```

部署架构：

```text
nginx (:80/:443) → 前端静态文件
                 → /api/* → backend:8080
                 → /model/* → 强缓存 1 年

backend:8080 → postgres:5432
             → redis:6379

postgres:5432 → ./data/postgres (持久化)
redis:6379    → ./data/redis (持久化)
```

## 管理后台备份与恢复

管理员可以在“数据备份”页面：

- 下载包含 `database.dump`、`manifest.json` 和 `uploads/` 的完整 `.tar.gz` 备份。
- 直接上传原始 `.tar.gz` 恢复，无需解压。
- 选择已经解压的备份文件夹恢复。

恢复会在校验备份格式后，以单事务替换当前 PostgreSQL 数据库；数据库失败时自动回滚。备份中的上传文件会覆盖同名文件，但不会删除目标部署中的其他文件。恢复完成后页面会自动刷新。

> 恢复属于覆盖操作。执行前建议先从目标博客下载一份当前备份。

## 文档索引

| 文档 | 说明 |
| --- | --- |
| [概念设计方案](./docs/concept-design.md) | 项目定位、场景设定、信息架构、首页分镜 |
| [产品介绍](./docs/product-introduction.md) | 完整功能模块与设计理念 |
| [开发架构文档](./docs/development-architecture.md) | 技术栈选型、API 契约、缓存策略 |
| [项目结构文档](./docs/project-structure.md) | 目录结构、路由、关键逻辑说明 |
| [CI/CD 指南](./docs/cicd-guide.md) | 持续集成与部署方案 |
| [Switch 界面设计](./docs/switch-interface-1-design.md) | Switch 主界面信息架构与交互设计 |
| [手机端适配设计](./docs/mobile-nintendo-app-layout-design.md) | 手机端 Nintendo App 风格布局设计 |
| [模型资源说明](./docs/public-models-README.md) | 3D 模型资源清单与格式说明 |
| [模型获取指南](./docs/model-sourcing-guide.md) | 3D 模型采购/下载指引 |
| [外部资源说明](./docs/external-assets-README.md) | 外部依赖资源清单 |

### 推荐阅读顺序

1. 先看本页 README，了解项目全貌
2. 再看 [产品介绍](./docs/product-introduction.md)，了解完整功能
3. 然后看 [项目结构文档](./docs/project-structure.md)，理解代码组织
4. 如需深入，看 [开发架构文档](./docs/development-architecture.md) 了解技术细节

## License

MIT
