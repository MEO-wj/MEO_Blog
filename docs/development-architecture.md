# MEO_Blog 开发架构文档

## 目标定位

`MEO_Blog` 不是传统文章列表型博客，而是一个以外部 3D 场景作为入口、以 Switch 主界面式 2D 操作层承接内容的个人站点。用户进入网站时先看到一个夜间桌面 / 主机收藏场景，点击 Switch 屏幕、PS5、柜子、植物等对象后进入真正可阅读、可检索、可互动的博客系统。

第一阶段目标：

- 用 TypeScript 搭建前端主栈，保证 3D、UI、状态和接口契约都有类型约束。
- 用当前 `Sence_layout.json` 驱动 3D 模型布局，避免硬编码场景坐标。
- 设计 Switch 主界面风格的信息架构，用横向卡片承载游戏、项目、GitHub、仓库、邮箱、开发日志和博客。
- 后端使用 Go，数据库使用 PostgreSQL，缓存使用 Redis。
- Docker Compose 一键部署前端、后端、PostgreSQL、Redis 和反向代理。
- 模型资源必须支持浏览器本地缓存，第二次打开不重复从服务器拉取大体积 GLB。

## 当前前端预览

当前已建立一个轻量 TypeScript 3D 预览：

```text
preview/blog-scene/
|-- index.html
|-- main.ts
```

运行方式：

```bash
npm install
npm run dev
```

访问：

```text
http://127.0.0.1:5173/preview/blog-scene/
```

这个预览页会读取仓库根目录的 `Sence_layout.json`，按其中的模型路径、坐标、旋转、缩放和父子关系搭建初始场景。JSON 中的 `/public/models/...` 会在前端映射到当前仓库实际的 `/model/...` 路径。

## 前端技术栈

正式前端建议采用：

| 模块 | 技术 |
| --- | --- |
| 语言 | TypeScript |
| 构建 | Vite |
| UI 框架 | React |
| 3D 渲染 | Three.js + React Three Fiber + Drei |
| 路由 | React Router 或 TanStack Router |
| 数据请求 | TanStack Query |
| 状态管理 | Zustand |
| 动画 | GSAP / Framer Motion |
| 样式 | CSS Modules 或 Tailwind CSS |
| 内容渲染 | MDX 或后端 Markdown 渲染 |
| 可视化 | Recharts / ECharts，按需引入 |

当前预览先使用原生 TypeScript + Three.js，是为了快速验证模型布局；正式应用层建议迁移到 React + R3F，保留现有 `Sence_layout.json` 驱动方式。

推荐前端目录：

```text
web/
|-- src/
|   |-- app/                 # 路由入口、布局
|   |-- scene/               # 3D 场景、模型加载、相机、热点
|   |-- switch-ui/           # Switch 主界面式 2D UI
|   |-- features/
|   |   |-- games/
|   |   |-- projects/
|   |   |-- github/
|   |   |-- posts/
|   |   |-- devlogs/
|   |   |-- contact/
|   |-- api/                 # API client 和契约类型
|   |-- stores/              # Zustand 状态
|   |-- styles/
|-- public/
```

## 3D 场景设计

3D 外部场景负责“进入感”和“导航隐喻”，不承担文章长阅读。它应该做到：

- 首屏只加载必要模型，非关键模型延迟加载。
- 场景对象绑定内容入口，例如 Switch 屏幕进入主页，PS5 区进入项目，柜子进入归档或收藏。
- 每个热点有 hover 高亮、短标签和点击运镜。
- 运镜结束后进入 2D Switch UI，而不是把所有内容都做在 3D 里。

当前夜景方向：

- 深色网格地面和暗色背景。
- 冷色月光作为主光。
- Switch / 屏幕附近使用青绿色点光模拟电子屏亮度。
- 局部暖光加强轮廓，避免整屏全黑。

## 模型缓存策略

模型文件是博客首屏性能的主要风险。当前 TypeScript 预览已经实现浏览器 Cache Storage 缓存：

1. 第一次加载模型时，前端通过 `fetch` 获取 GLB。
2. 成功后写入 `caches.open("meo-blog-model-cache-v1")`。
3. 再把响应转成 `Blob URL` 交给 `GLTFLoader`。
4. 第二次打开同一路径模型时优先从 Cache Storage 读取，不再重复下载大文件。

后续正式版本建议：

- 模型文件名带内容 hash，例如 `ps5-console.ab12cd.glb`。
- `manifest.json` 记录模型版本、大小、hash 和用途。
- Cache key 使用完整 URL + hash。
- 大模型采用懒加载：可见、点击、空闲时再加载。
- 静态服务配置强缓存：

```http
Cache-Control: public, max-age=31536000, immutable
```

对布局 JSON、文章数据等动态资源使用短缓存或 ETag：

```http
Cache-Control: no-cache
ETag: "..."
```

## Switch 主界面信息架构

2D 内容层参考 Switch 主界面，而不是照抄视觉素材。核心原则是横向卡片、当前选中项放大、高亮边框、底部圆角工具栏、右上角状态区。

主界面模块：

| Switch 卡片 | 内容 |
| --- | --- |
| 游戏库 | 个人玩过 / 正在玩 / 推荐游戏 |
| 我的游戏 | 自己开发的小游戏、Demo、实验项目 |
| GitHub 动态 | commit、PR、issue、contribution 记录 |
| 仓库 | 个人精选仓库、项目说明、技术栈 |
| 开发日志 | 项目进展、踩坑、版本记录 |
| 博客文章 | 技术文章、长文、教程、归档 |
| 邮箱 / 联系 | 邮箱、社交链接、留言入口 |
| 关于我 | 个人简介、技能、设备、偏好 |

底部工具栏建议：

- Home：回到主界面
- Posts：文章
- Games：游戏库
- Projects：项目 / 仓库
- GitHub：开发记录
- Mail：联系
- Settings：主题、音效、动效、模型质量

交互建议：

- 左右键 / 手柄方向键切换卡片。
- Enter / A 键进入。
- Esc / B 键返回。
- 首屏卡片最多加载摘要，详情进入页面后再请求。
- 移动端改为水平滑动卡片，底部工具栏压缩为图标。

## 功能设计

### 游戏库

展示个人游戏记录：

- 游戏名称、平台、封面、状态。
- 评分、游玩时长、完成度。
- 个人短评和长评。
- 标签：独立游戏、任天堂、魂类、平台跳跃、叙事等。
- 和博客文章关联，例如一篇游戏随笔关联到某个游戏。

### 我的游戏

展示自己开发的游戏或互动 Demo：

- 项目封面、玩法简介、引擎、技术栈。
- Web Demo 链接、GitHub 链接、版本记录。
- 开发日志聚合。

### GitHub 记录

展示开发动态：

- 近期 commit。
- 活跃仓库。
- PR / issue。
- contribution 热力图。
- 常用语言和技术栈统计。

GitHub 数据建议由后端定时同步，避免前端暴露 token。

### 仓库展示

仓库信息包括：

- 名称、描述、语言、stars、forks。
- README 摘要。
- 标签和项目类型。
- 是否置顶。
- 关联开发日志和博客文章。

### 邮箱和联系

提供联系入口：

- 邮箱地址展示。
- 联系表单。
- 表单验证码或限流。
- 后端发送邮件或记录到数据库。

### 开发日志和博客

内容分为两类：

- `posts`：完整技术文章、长文、教程。
- `devlogs`：更短的项目进展、版本记录、开发碎片。

两者都支持标签、系列、草稿、置顶、搜索和归档。

## 后端技术栈

正式后端建议：

| 模块 | 技术 |
| --- | --- |
| 语言 | Go |
| HTTP 框架 | Gin / Fiber / Chi，推荐 Chi 或 Gin |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| ORM / SQL | sqlc 或 GORM，推荐 sqlc 保持 SQL 可控 |
| 数据迁移 | goose / golang-migrate |
| 配置 | env + YAML 可选 |
| 日志 | zap / slog |
| 鉴权 | JWT + HttpOnly Cookie |
| 部署 | Docker Compose |

推荐后端目录：

```text
api/
|-- cmd/server/
|-- internal/
|   |-- config/
|   |-- http/
|   |-- middleware/
|   |-- service/
|   |-- repository/
|   |-- cache/
|   |-- githubsync/
|   |-- mailer/
|-- migrations/
|-- sql/
```

## 数据库设计初稿

核心表：

```text
users
posts
devlogs
games
personal_games
projects
github_repositories
github_events
tags
taggings
contacts
assets
scene_layouts
```

关键字段建议：

```sql
posts(
  id uuid primary key,
  slug text unique not null,
  title text not null,
  summary text,
  content_md text not null,
  cover_url text,
  status text not null,
  published_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

```sql
games(
  id uuid primary key,
  title text not null,
  platform text,
  cover_url text,
  play_status text,
  rating numeric(3,1),
  hours_played numeric(6,1),
  review_md text,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

```sql
projects(
  id uuid primary key,
  name text not null,
  slug text unique not null,
  description text,
  repo_url text,
  demo_url text,
  cover_url text,
  tech_stack text[],
  pinned boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

## Redis 缓存设计

Redis 主要用于：

- API 列表页缓存。
- GitHub 同步结果缓存。
- 邮件 / 联系表单限流。
- 首页聚合数据缓存。

建议 key：

```text
home:switch-dashboard:v1
posts:list:{queryHash}
posts:detail:{slug}
games:list:{queryHash}
projects:pinned
github:profile
github:events:recent
ratelimit:contact:{ip}
```

缓存策略：

- 列表数据：60 秒到 10 分钟。
- GitHub 数据：30 分钟到 6 小时。
- 文章详情：发布后长缓存，更新时主动删除。
- 联系表单限流：按 IP 和邮箱限制。

## 后端 API 契约

统一响应：

```json
{
  "data": {},
  "meta": {
    "requestId": "req_01h...",
    "cached": false
  },
  "error": null
}
```

错误响应：

```json
{
  "data": null,
  "meta": {
    "requestId": "req_01h..."
  },
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid request payload",
    "fields": {
      "email": "invalid email"
    }
  }
}
```

分页：

```json
{
  "page": 1,
  "pageSize": 12,
  "total": 42,
  "hasNext": true
}
```

### 首页聚合

`GET /api/v1/home`

返回 Switch 主界面需要的聚合数据。

```json
{
  "data": {
    "profile": {
      "name": "MEO",
      "headline": "Developer / Gamer"
    },
    "cards": [
      {
        "type": "game",
        "title": "Blasphemous",
        "subtitle": "Recently played",
        "coverUrl": "/assets/games/blasphemous.webp",
        "href": "/games/blasphemous"
      }
    ],
    "status": {
      "githubUpdatedAt": "2026-05-19T00:00:00Z"
    }
  },
  "meta": {
    "cached": true
  },
  "error": null
}
```

### 博客文章

`GET /api/v1/posts?page=1&pageSize=12&tag=threejs`

`GET /api/v1/posts/{slug}`

`POST /api/v1/admin/posts`

`PATCH /api/v1/admin/posts/{id}`

文章列表项：

```json
{
  "id": "uuid",
  "slug": "threejs-scene-entry",
  "title": "用 Three.js 做博客入口",
  "summary": "3D 场景入口的设计与性能策略",
  "coverUrl": "/assets/posts/threejs-scene.webp",
  "tags": ["threejs", "frontend"],
  "publishedAt": "2026-05-19T00:00:00Z"
}
```

### 开发日志

`GET /api/v1/devlogs?project=meo-blog`

`GET /api/v1/devlogs/{id}`

开发日志项：

```json
{
  "id": "uuid",
  "title": "完成第一版 3D 夜景预览",
  "projectSlug": "meo-blog",
  "contentMd": "今天完成了...",
  "createdAt": "2026-05-19T00:00:00Z"
}
```

### 游戏库

`GET /api/v1/games?status=playing&platform=switch`

`GET /api/v1/games/{slug}`

游戏详情：

```json
{
  "id": "uuid",
  "slug": "blasphemous",
  "title": "Blasphemous",
  "platform": "Switch",
  "coverUrl": "/assets/games/blasphemous.webp",
  "playStatus": "completed",
  "rating": 9.2,
  "hoursPlayed": 42,
  "reviewMd": "..."
}
```

### 我的游戏 / 互动项目

`GET /api/v1/personal-games`

`GET /api/v1/personal-games/{slug}`

```json
{
  "id": "uuid",
  "slug": "pixel-lab",
  "title": "Pixel Lab",
  "engine": "Web",
  "techStack": ["TypeScript", "Canvas"],
  "demoUrl": "https://...",
  "repoUrl": "https://github.com/..."
}
```

### 项目和仓库

`GET /api/v1/projects`

`GET /api/v1/projects/{slug}`

`GET /api/v1/github/repositories`

`GET /api/v1/github/events`

仓库项：

```json
{
  "name": "MEO_Blog",
  "owner": "MEO",
  "description": "3D scene entry personal blog",
  "url": "https://github.com/...",
  "language": "TypeScript",
  "stars": 0,
  "forks": 0,
  "pushedAt": "2026-05-19T00:00:00Z"
}
```

### 联系和邮箱

`POST /api/v1/contact`

请求：

```json
{
  "name": "Visitor",
  "email": "visitor@example.com",
  "subject": "合作咨询",
  "message": "你好，我想..."
}
```

响应：

```json
{
  "data": {
    "accepted": true
  },
  "meta": {
    "cached": false
  },
  "error": null
}
```

限制：

- 同 IP 每 10 分钟最多 3 次。
- 邮件字段必须校验。
- 消息内容做长度限制和基础清洗。

### 3D 场景布局

`GET /api/v1/scene-layouts/current`

后续可以把 `Sence_layout.json` 存进数据库，支持后台调整场景。

```json
{
  "data": {
    "version": 2,
    "camera": {
      "position": { "x": 1.901, "y": 15.316, "z": 18.701 },
      "target": { "x": 2.007, "y": 5.788, "z": 0.25 }
    },
    "items": []
  },
  "meta": {
    "cached": true
  },
  "error": null
}
```

## Docker 一键部署

推荐服务：

```text
nginx       # 反向代理和静态资源服务
web         # TypeScript 前端构建产物
api         # Go 后端
postgres    # PostgreSQL
redis       # Redis
migrate     # 数据库迁移任务
```

目标命令：

```bash
docker compose up -d --build
```

建议环境变量：

```env
APP_ENV=production
APP_PUBLIC_URL=https://example.com
POSTGRES_DB=meo_blog
POSTGRES_USER=meo
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgres://meo:change_me@postgres:5432/meo_blog?sslmode=disable
REDIS_ADDR=redis:6379
JWT_SECRET=change_me
GITHUB_TOKEN=github_pat_xxx
MAIL_SMTP_HOST=smtp.example.com
MAIL_SMTP_PORT=587
MAIL_SMTP_USER=me@example.com
MAIL_SMTP_PASS=change_me
```

部署策略：

- `web` 构建为静态文件，由 `nginx` 服务。
- `/api/*` 反向代理到 Go 服务。
- `/model/*` 使用强缓存和 gzip / brotli。
- PostgreSQL 和 Redis 使用 volume 持久化。
- migration 容器在 API 启动前执行。

## Nginx 静态资源缓存

模型资源建议：

```nginx
location /model/ {
  root /usr/share/nginx/html;
  add_header Cache-Control "public, max-age=31536000, immutable";
  gzip_static on;
}
```

API 不做强缓存：

```nginx
location /api/ {
  proxy_pass http://api:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 安全和权限

- 管理后台必须登录。
- JWT 放 HttpOnly Cookie。
- 联系表单加限流。
- GitHub token 只放后端环境变量。
- CORS 只允许正式域名和本地开发域名。
- 后台写接口必须校验 CSRF 或使用 SameSite Cookie。

## 后续实施路线

1. 保持当前 TypeScript 3D 预览，继续用 `Sence_layout.json` 校准场景。
2. 初始化正式 `web/` React + TypeScript 应用。
3. 抽出 `scene` 模块：模型缓存、布局解析、相机、热点、运镜。
4. 做 Switch UI 首页：横向卡片、底部工具栏、键盘 / 手柄操作。
5. 初始化 Go API：健康检查、配置、PostgreSQL、Redis。
6. 增加数据库迁移和基础表。
7. 接入文章、游戏、项目、GitHub 数据接口。
8. 编写 Dockerfile、compose、nginx 配置。
9. 加模型 hash、CDN / 静态强缓存、Cache Storage 版本管理。
10. 最后再做后台管理和内容发布流程。
