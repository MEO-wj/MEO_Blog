# MEO_Blog 项目结构文档

## 总览

```
MEO_Blog/
├── backend/                    # Go 后端服务
├── web/                        # React + R3F 前端应用（含 3D 场景）
├── model/                      # GLB 3D 模型资源
├── docker/                     # Nginx 配置
├── docs/                       # 项目文档
├── docker-compose.yml          # 全栈部署编排
├── .env.example                # 环境变量模板
└── .gitignore
```

---

## backend/ — Go 后端

技术栈：Go + Chi + pgx + go-redis + slog

```
backend/
├── go.mod                              # Go 模块定义（github.com/meo-blog/backend）
├── go.sum                              # 依赖校验
├── Dockerfile                          # 多阶段构建：golang:1.22-alpine → alpine:3.19
├── cmd/
│   └── server/
│       └── main.go                     # 程序入口：加载配置、启动 HTTP 服务、优雅关闭
├── internal/
│   ├── config/
│   │   └── config.go                   # 从环境变量读取配置（APP_ENV, DATABASE_URL, REDIS_ADDR 等）
│   ├── http/
│   │   ├── router.go                   # Chi 路由注册，挂载 /api/v1/health 端点
│   │   └── responses.go               # 统一 JSON 响应格式 {data, meta, error}
│   ├── middleware/
│   │   └── middleware.go               # 四个中间件：RequestID、CORS、Logging、Recovery
│   └── repository/
│       ├── db.go                       # pgxpool 连接池初始化（PostgreSQL）
│       └── redis.go                    # go-redis 客户端初始化
└── migrations/
    ├── 000001_init.up.sql              # 建表：posts, devlogs, games, projects, personal_games,
    │                                   #   tags, taggings, contacts, assets, scene_layouts
    └── 000001_init.down.sql            # 回滚：按逆序删除所有表
```

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/v1/health | 健康检查，返回 `{"data":{"status":"ok"}}` |

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
├── Dockerfile                          # 多阶段构建：node:20-alpine → nginx:alpine
├── public/
│   └── Sence_layout.json               # 3D 场景布局数据（由 3D_Layout_Editor 生成）
└── src/
    ├── main.tsx                        # React 入口，挂载 App 到 #root
    ├── App.tsx                         # 路由定义：/ → 3D 场景，其余走 Layout
    ├── styles/
    │   └── global.css                  # Tailwind v4 导入 + 自定义主题色
    ├── app/
    │   └── Layout.tsx                  # 页面布局：顶部导航栏 + Outlet
    ├── scene/
    │   ├── types.ts                    # 类型定义：Vec3, LayoutItem, SceneLayout
    │   ├── SceneEntry.tsx              # 3D 场景页面：Canvas + OrbitControls + HUD
    │   ├── NightStage.tsx              # 夜景灯光：地面、网格、月光、屏幕辉光、暖光
    │   ├── SceneLoader.tsx             # 加载 Sence_layout.json，构建父子层级树
    │   ├── ModelItem.tsx               # 单个模型组件：Cache Storage 加载 + 原点居中
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
    │   └── about/
    │       └── AboutPage.tsx           # 占位页
    ├── api/
    │   ├── types.ts                    # API 契约类型：Post, Game, Project, Devlog, PaginatedMeta
    │   └── client.ts                   # fetch 封装：统一请求 /api/v1/*，解析 {data, error}
    └── stores/
        └── sceneStore.ts               # Zustand 状态：场景加载状态
```

### 路由

| 路径 | 组件 | 说明 |
|------|------|------|
| / | SceneEntry | 3D 场景入口（全屏 Canvas） |
| /dashboard | DashboardPage | 占位 |
| /posts | PostsPage | 占位 |
| /projects | ProjectsPage | 占位 |
| /games | GamesPage | 占位 |
| /about | AboutPage | 占位 |

### 3D 场景关键逻辑

- **模型路径映射**：`modelUtils.ts` 将 `Sence_layout.json` 中的 `/public/models/...` 路径映射到实际的 `/model/...` 路径
- **Cache Storage**：首次加载 GLB 后缓存到浏览器 Cache Storage，二次访问直接读取本地缓存
- **原点居中**：加载模型后计算包围盒中心并偏移，与 3D_Layout_Editor 行为一致
- **父子层级**：`SceneLoader` 根据 `parentId` 递归嵌套 `<group>`，实现桌子上的 PS5、Switch 等
- **Vite 中间件**：开发环境下将 `/model/*` 和 `/Sence_layout.json` 代理到仓库根目录

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
├── manifest.json                       # 模型清单（当前只列出 PS5 的 3 个）
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

由 3D_Layout_Editor 生成的数据文件，描述场景中每个模型的位置、旋转、缩放和父子关系。放在 `web/public/` 下，Vite 会自动作为静态资源提供。

| 字段 | 类型 | 说明 |
|------|------|------|
| version | number | 布局版本号 |
| camera.position | Vec3 | 相机位置 |
| camera.target | Vec3 | 相机看向的点 |
| items[].id | string | 模型唯一标识 |
| items[].assetKey | string | 资源键名 |
| items[].path | string | 模型文件路径（需映射） |
| items[].parentId | string? | 父模型 ID（null 表示根级） |
| items[].position | Vec3 | 位置坐标 |
| items[].rotationDeg | Vec3 | 旋转角度（度） |
| items[].scale | Vec3 | 缩放比例 |

---

## docker/ — Nginx 配置

```
docker/
└── nginx.conf                          # 反向代理配置
                                        #   / → 前端静态文件（SPA fallback）
                                        #   /api/ → backend:8080
                                        #   /model/ → 模型文件（强缓存 1 年）
                                        #   /Sence_layout.json → 无缓存
```

---

## docker-compose.yml — 全栈部署

| 服务 | 镜像 | 说明 |
|------|------|------|
| nginx | nginx:alpine | 反向代理 + 静态资源服务 |
| web | 自构建 | React 前端构建产物 |
| backend | 自构建 | Go 后端 API |
| postgres | postgres:16-alpine | PostgreSQL 数据库 |
| redis | redis:7-alpine | Redis 缓存 |
| migrate | migrate/migrate | 数据库迁移任务 |

### 启动

```bash
cp .env.example .env   # 编辑密码等配置
docker compose up -d --build
# → http://localhost/
```

---

## 依赖关系

```
web/src/scene/*
    └── 读取 web/public/Sence_layout.json（Vite 自动提供）
    └── 加载 model/*.glb（通过 Vite 中间件代理到根目录）

backend/cmd/server/main.go
    └── internal/config    → 环境变量
    └── internal/http      → Chi 路由
    └── internal/middleware → 中间件链

docker-compose.yml
    └── nginx ← web（静态文件）+ backend（API 代理）
    └── backend → postgres + redis
    └── migrate → postgres
```
