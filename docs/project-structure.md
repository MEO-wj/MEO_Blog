# MEO_Blog 项目结构文档

## 总览

```
MEO_Blog/
├── backend/                    # Go 后端服务
├── web/                        # React + R3F 前端应用（含 3D 场景 + 手机端）
├── model/                      # GLB 3D 模型资源
├── docker/                     # Nginx 配置
├── docs/                       # 项目文档
├── docker-compose.yml          # 全栈部署编排
├── docker-compose.server.yml   # 服务器部署（含 Certbot HTTPS）
├── .env.example                # 环境变量模板
└── .gitignore
```

---

## backend/ — Go 后端

技术栈：Go + Chi + pgx + go-redis + slog

```
backend/
├── go.mod                              # Go 模块定义
├── go.sum                              # 依赖校验
├── Dockerfile                          # 多阶段构建：golang:1.26.5-alpine → alpine:3.24.1
├── cmd/
│   └── server/
│       └── main.go                     # 程序入口：加载配置、启动 HTTP 服务、优雅关闭
├── internal/
│   ├── config/
│   │   └── config.go                   # 从环境变量读取配置
│   ├── http/
│   │   ├── router.go                   # Chi 路由注册，挂载所有 /api/v1/* 端点
│   │   └── responses.go               # 统一 JSON 响应格式 {data, meta, error}
│   ├── middleware/
│   │   └── middleware.go               # 中间件：RequestID、CORS、Logging、Recovery、Auth
│   └── repository/
│       ├── db.go                       # pgxpool 连接池初始化（PostgreSQL）
│       └── redis.go                    # go-redis 客户端初始化
└── migrations/                         # 16 个数据库迁移版本
    ├── 000001_init.up.sql              # 初始建表
    ├── 000002_admin_profile_and_project_icon.up.sql
    ├── 000003_admin_profile_extend.up.sql
    ├── 000004_add_github_url.up.sql
    ├── 000005_blog_system.up.sql       # 博客系统（分类、文章、评论）
    ├── 000006_guestbook.up.sql         # 留言墙
    ├── 000007_resume.up.sql            # 简历
    ├── 000008_favorites.up.sql         # 收藏
    ├── 000009_favorites_dimensions.up.sql
    ├── 000010_favorite_positions.up.sql
    ├── 000011_project_sort_order.up.sql
    ├── 000012_drop_redundant_slug_index.up.sql
    ├── 000013_project_sort_order_index.up.sql
    ├── 000014_partners.up.sql          # 合作伙伴
    ├── 000015_site_permissions.up.sql  # 站点权限
    ├── 000016_guestbook_moderation.up.sql  # 留言审核
    └── *.down.sql                      # 对应的回滚脚本
```

### 已实现 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/health | 健康检查 |
| GET/PATCH | /api/v1/admin/profile | 管理员资料 |
| POST | /api/v1/admin/login | 管理员登录（密码 + 手柄序列） |
| GET | /api/v1/projects | 项目列表（缓存优先） |
| GET | /api/v1/projects/{id} | 项目详情 |
| POST/PATCH/DELETE | /api/v1/admin/projects/* | 项目管理 |
| GET | /api/v1/posts | 文章列表 |
| GET | /api/v1/posts/{slug} | 文章详情 |
| POST/PATCH/DELETE | /api/v1/admin/posts/* | 文章管理 |
| GET | /api/v1/categories | 分类列表 |
| POST/PATCH/DELETE | /api/v1/admin/categories/* | 分类管理 |
| GET | /api/v1/guestbook/messages | 留言列表（已审核公开） |
| POST | /api/v1/guestbook/messages | 发布留言 |
| POST | /api/v1/guestbook/replies | 发布回复 |
| DELETE | /api/v1/guestbook/messages/{id} | 删除留言 |
| DELETE | /api/v1/guestbook/replies/{id} | 删除回复 |
| PATCH | /api/v1/admin/guestbook/* | 留言审核 |
| GET | /api/v1/favorites | 收藏列表 |
| POST/DELETE/PATCH | /api/v1/admin/favorites/* | 收藏管理 |
| GET | /api/v1/resume | 简历图片 |
| POST | /api/v1/admin/resume | 上传简历 |
| GET | /api/v1/github/profile | GitHub 个人资料 |
| GET | /api/v1/github/contributions | 贡献热力图 |
| GET | /api/v1/github/repositories | 公开仓库 |
| GET | /api/v1/partners | 合作伙伴列表 |
| POST/DELETE | /api/v1/admin/partners/* | 合作伙伴管理 |
| GET | /api/v1/site-permissions | 站点权限状态 |
| PATCH | /api/v1/admin/site-permissions | 更新站点权限 |

### 启动方式

```bash
cd backend
go run ./cmd/server
# → http://localhost:8080/api/v1/health
```

---

## web/ — React 前端

技术栈：React 19 + React Three Fiber + Drei + Zustand + Tailwind CSS v4 + React Router v7

```
web/
├── package.json                        # 项目依赖和脚本
├── tsconfig.json                       # TypeScript 配置（ES2022, JSX, strict）
├── vite-env.d.ts                       # Vite 类型声明
├── vite.config.ts                      # Vite 配置：React 插件、Tailwind、模型文件代理中间件
├── index.html                          # HTML 入口
├── Dockerfile                          # 多阶段构建：node:24-alpine → nginx:alpine
├── public/
│   └── Sence_layout.json               # 3D 场景布局数据（由 3D_Layout_Editor 生成）
└── src/
    ├── main.tsx                        # React 入口，挂载 App 到 #root
    ├── App.tsx                         # 路由定义 + 桌面/手机端分流（≤760px 切 MobileSwitchAppHome）
    ├── styles/
    │   └── global.css                  # Tailwind v4 导入 + 自定义主题色
    ├── app/
    │   └── Layout.tsx                  # 页面布局：顶部导航栏 + Outlet（占位路由）
    ├── scene/                          # 3D 场景模块
    │   ├── types.ts                    # 类型定义：Vec3, LayoutItem, SceneLayout
    │   ├── SceneEntry.tsx              # 3D 场景页面：Canvas + OrbitControls + 加载覆盖层
    │   ├── NightStage.tsx              # 夜景灯光：地面、网格、月光、屏幕辉光、暖光
    │   ├── SceneLoader.tsx             # 加载 Sence_layout.json，构建父子层级树
    │   ├── ModelItem.tsx               # 单个模型组件：Cache Storage 加载 + 原点居中
    │   ├── SwitchScreenOverlay.tsx     # Switch 屏幕叠加层，3D→UI 桥接
    │   ├── LoadingOverlay.tsx          # 加载进度条（分阶段显示，图标优先）
    │   ├── modelUtils.ts               # 模型路径映射 + Cache Storage 缓存逻辑
    │   └── useSceneLayout.ts           # Hook：获取并解析 Sence_layout.json
    ├── features/
    │   ├── dashboard/
    │   │   └── DashboardPage.tsx       # 占位页
    │   ├── posts/
    │   │   └── PostsPage.tsx           # 占位页
    │   ├── projects/
    │   │   └── ProjectsPage.tsx        # 占位页
    │   ├── games/
    │   │   └── GamesPage.tsx           # 占位页
    │   ├── about/
    │   │   └── AboutPage.tsx           # 占位页
    │   └── switch-ui/                  # Switch 主界面 + 手机端 App
    │       ├── SwitchHomeScreen.tsx    # 桌面端 Switch 主界面
    │       ├── MobileSwitchAppHome.tsx # 手机端 App 首页
    │       ├── MobileBlogReader.tsx    # 手机端博客阅读器
    │       ├── MobileActionDock.tsx    # 手机端底部导航栏
    │       ├── ActionButton.tsx        # 功能按钮组件
    │       ├── AdminPanel.tsx          # 管理后台（终端窗口风格）
    │       ├── BlogBookshelf.tsx       # 博客书架 + 卷轴阅读器
    │       ├── FavoritesModal.tsx      # 收藏展示（任务布告栏）
    │       ├── MessageWallModal.tsx    # 留言墙
    │       ├── GitHubProfile.tsx       # GitHub 个人资料 + 热力图
    │       ├── ProjectCard.tsx         # 项目横向卡片
    │       ├── ProjectDetail.tsx       # 项目详情弹窗（Markdown 渲染）
    │       ├── ResumeModal.tsx         # 简历展示
    │       ├── SaveToast.tsx           # 保存成功提示
    │       ├── Icon.tsx                # SVG 图标组件
    │       ├── switchHomeData.ts       # 首页数据与类型
    │       ├── entryPermissions.ts     # 入口权限工具方法
    │       ├── useSound.ts             # Switch 风格音效 Hook
    │       ├── useWheelScroll.ts       # 滚轮滚动速度控制
    │       ├── switch-ui.css           # Switch UI 样式
    │       └── mobile-switch-app.css   # 手机端样式
    ├── api/
    │   ├── types.ts                    # API 契约类型：Post, Project, Game, PaginatedMeta 等
    │   ├── client.ts                   # fetch 封装：统一请求 /api/v1/*，解析 {data, error}
    │   └── saveQueue.ts               # 保存请求队列（防抖 + 失败重试）
    └── stores/
        ├── sceneStore.ts               # Zustand：场景加载状态
        └── adminStore.ts               # Zustand：管理员登录状态
```

### 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| / | SceneEntry / MobileSwitchAppHome | 桌面端 3D 场景，手机端 App 首页（视口 ≤760px 分流） |
| /dashboard | DashboardPage | 占位 |
| /posts | PostsPage | 占位 |
| /projects | ProjectsPage | 占位 |
| /games | GamesPage | 占位 |
| /about | AboutPage | 占位 |

> 实际功能（博客、留言墙、管理后台等）均在 Switch 主界面中以弹窗/子视图形式呈现，不走独立路由。

### 3D 场景关键逻辑

- **模型路径映射**：`modelUtils.ts` 将 `Sence_layout.json` 中的 `/public/models/...` 路径映射到实际的 `/model/...` 路径
- **Cache Storage**：首次加载 GLB 后缓存到浏览器 Cache Storage，二次访问直接读取本地缓存
- **原点居中**：加载模型后计算包围盒中心并偏移，与 3D_Layout_Editor 行为一致
- **父子层级**：`SceneLoader` 根据 `parentId` 递归嵌套 `<group>`，实现桌子上的 PS5、Switch 等
- **加载超时保护**：模型 blob 读取有超时保护，修复首次加载卡住问题
- **Switch 屏幕叠加**：`SwitchScreenOverlay` 使用 R3F Html 在 Switch 屏幕平面上渲染 DOM UI
- **相机动画**：从全景视角到 Switch 屏幕的电影级推拉动画，GSAP 平滑插值
- **Vite 中间件**：开发环境下将 `/model/*` 和 `/Sence_layout.json` 代理到仓库根目录

### 手机端关键逻辑

- **视口分流**：`App.tsx` 中使用 `window.matchMedia("(max-width: 760px)")` 判断，手机端直接渲染 `MobileSwitchAppHome`
- **轻量化**：不加载 Three.js / GLB 模型，节省流量
- **Nintendo App 风格**：方形项目图标横向滑动 + 底部 Dock 导航
- **博客阅读器**：`MobileBlogReader` 独立组件，分类简介过长时支持展开/收起
- **入口权限**：手机端也受站点权限控制，无权限时显示提示

### 启动方式

```bash
cd web
npm install
npm run dev
# → http://127.0.0.1:5174/
```

---

## model/ — 3D 模型资源

所有 GLB 格式的 3D 模型文件，按类别分目录。

```
model/
├── manifest.json                       # 模型清单（版本、hash、大小、用途）
├── PS5/
│   ├── dualsense-controller.glb        # DualSense 手柄
│   ├── ps5-box.glb                     # PS5 包装盒
│   └── ps5-console.glb                 # PS5 主机
├── Scene/
│   ├── sci-fi_table.glb                # 科幻桌子（场景主体）
│   ├── sofa.glb                        # 沙发
│   ├── trestle2.glb                    # 支架
│   ├── karaoke_piranha_plant.glb       # 食人花摆件
│   ├── small_cabinet_left_wood.glb     # 木质小柜子
│   ├── small_cabinet_middle_light.glb  # 浅色小柜子
│   └── small_cabinet_right_gray.glb    # 灰色小柜子
└── Switch/
    ├── nintendo_switch_handheld_split.glb   # Switch 掌机模式
    ├── nintendo_switch_dock_set_split.glb   # Switch 底座套装
    └── nintendo_switch_cartridge.glb        # Switch 卡带
```

---

## web/public/Sence_layout.json — 场景布局

由 3D_Layout_Editor 生成的数据文件，描述场景中每个模型的位置、旋转、缩放和父子关系。

| 字段 | 类型 | 说明 |
|------|------|------|
| version | number | 布局版本号 |
| camera.position | Vec3 | 相机位置 |
| camera.target | Vec3 | 相机看向的点 |
| items[].id | string | 模型唯一标识 |
| items[].assetKey | string | 资源键名 |
| items[].path | string | 模型文件路径（运行时映射到 /model/） |
| items[].parentId | string? | 父模型 ID（null 表示根级） |
| items[].position | Vec3 | 位置坐标 |
| items[].rotationDeg | Vec3 | 旋转角度（度） |
| items[].scale | Vec3 | 缩放比例 |

---

## docker/ — Nginx 配置

```
docker/
├── nginx.local.conf                    # 本地开发反向代理配置
└── Dockerfile.nginx                    # Nginx 镜像
```

配置要点：

- `/` → 前端静态文件（SPA fallback）
- `/api/` → backend:8080
- `/model/` → 模型文件（强缓存 1 年，immutable）
- `/Sence_layout.json` → 无缓存

---

## docker-compose.yml — 全栈部署

| 服务 | 镜像 | 说明 |
|------|------|------|
| nginx | 自构建 (Dockerfile.nginx) | 反向代理 + 静态资源服务 |
| backend | 自构建 (backend/Dockerfile) | Go 后端 API |
| postgres | postgres:16-alpine | PostgreSQL 数据库 |
| redis | redis:7-alpine | Redis 缓存 |
| migrate | migrate/migrate | 数据库迁移任务 |

### 启动

```bash
cp .env.example .env   # 编辑密码等配置
docker compose up -d --build
# → http://localhost/
```

### 服务器部署

```bash
docker compose -f docker-compose.server.yml up -d --build
# → https://your-domain.com/ (含 Certbot HTTPS)
```

---

## 依赖关系

```
web/src/scene/*
    └── 读取 web/public/Sence_layout.json（Vite 自动提供）
    └── 加载 model/*.glb（开发时通过 Vite 中间件代理，生产时由 Nginx 提供）

web/src/features/switch-ui/*
    └── 调用 /api/v1/* 获取数据
    └── 状态由 Zustand stores 管理

backend/cmd/server/main.go
    └── internal/config    → 环境变量
    └── internal/http      → Chi 路由 + 全部 API 端点
    └── internal/middleware → 中间件链（含 Auth）
    └── internal/repository → PostgreSQL + Redis

docker-compose.yml
    └── nginx ← 前端静态文件 + 反向代理 /api/* → backend
    └── backend → postgres + redis
    └── migrate → postgres
```
