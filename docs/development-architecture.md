# MEO_Blog 开发架构文档

## 目标定位

`MEO_Blog` 不是传统文章列表型博客，而是一个以外部 3D 场景作为入口、以 Switch 主界面式 2D 操作层承接内容的个人站点。用户进入网站时先看到一个夜间桌面 / 主机收藏场景，点击 Switch 屏幕、PS5、柜子、植物等对象后进入真正可阅读、可检索、可互动的博客系统。

当前阶段：

- 前端已用 TypeScript + React 19 + R3F 搭建完成，3D 场景和 Switch UI 均可用。
- 场景布局由 `Sence_layout.json` 驱动，避免硬编码场景坐标。
- Switch 主界面风格的信息架构已实现：横向卡片承载项目、GitHub、简历、留言、博客等模块。
- 后端使用 Go + Chi + pgx + go-redis，数据库 PostgreSQL 16，缓存 Redis 7。
- Docker Compose 一键部署前端、后端、PostgreSQL、Redis、Nginx 反向代理和 Certbot HTTPS。
- 模型资源通过浏览器 Cache Storage 缓存，二次访问不重复下载大体积 GLB。

## 前端开发

### 启动方式

```bash
cd web
npm install
npm run dev
# → http://127.0.0.1:5174/
```

### 已采用技术栈

| 模块 | 技术 |
| --- | --- |
| 语言 | TypeScript |
| 构建 | Vite 6 |
| UI 框架 | React 19 |
| 3D 渲染 | Three.js + React Three Fiber + Drei |
| 路由 | React Router v7 |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS v4 |
| 内容渲染 | react-markdown + remark-gfm |
| 音效 | 自定义 `useSound` Hook，Switch 风格音效 |

### 前端目录

```text
web/
├── src/
│   ├── main.tsx                        # React 入口
│   ├── App.tsx                         # 路由定义 + 桌面/手机端分流（≤760px 切手机端）
│   ├── styles/
│   │   └── global.css                  # Tailwind v4 导入 + 自定义主题色
│   ├── app/
│   │   └── Layout.tsx                  # 页面布局：顶部导航栏 + Outlet
│   ├── scene/                          # 3D 场景模块
│   │   ├── types.ts                    # Vec3, LayoutItem, SceneLayout 类型
│   │   ├── SceneEntry.tsx              # 3D 场景页面：Canvas + OrbitControls + 加载覆盖层
│   │   ├── NightStage.tsx              # 夜景灯光：地面、网格、月光、屏幕辉光、暖光
│   │   ├── SceneLoader.tsx             # 加载 Sence_layout.json，构建父子层级树
│   │   ├── ModelItem.tsx               # 单个模型：Cache Storage 加载 + 原点居中
│   │   ├── SwitchScreenOverlay.tsx     # Switch 屏幕叠加层（3D→UI 桥接）
│   │   ├── LoadingOverlay.tsx          # 加载进度条（图标优先加载）
│   │   ├── modelUtils.ts               # 模型路径映射 + Cache Storage 缓存逻辑
│   │   └── useSceneLayout.ts           # Hook：获取并解析 Sence_layout.json
│   ├── features/switch-ui/             # Switch 主界面 + 手机端 App
│   │   ├── SwitchHomeScreen.tsx        # 桌面端 Switch 主界面
│   │   ├── MobileSwitchAppHome.tsx     # 手机端 App 首页
│   │   ├── MobileBlogReader.tsx        # 手机端博客阅读器
│   │   ├── MobileActionDock.tsx        # 手机端底部导航栏
│   │   ├── ActionButton.tsx            # 功能按钮组件
│   │   ├── AdminPanel.tsx              # 管理后台（终端窗口风格）
│   │   ├── BlogBookshelf.tsx           # 博客书架 + 卷轴阅读器
│   │   ├── FavoritesModal.tsx          # 收藏展示（任务布告栏）
│   │   ├── MessageWallModal.tsx        # 留言墙
│   │   ├── GitHubProfile.tsx           # GitHub 个人资料 + 热力图
│   │   ├── ProjectCard.tsx             # 项目卡片
│   │   ├── ProjectDetail.tsx           # 项目详情弹窗
│   │   ├── ResumeModal.tsx             # 简历展示
│   │   ├── SaveToast.tsx               # 保存提示
│   │   ├── Icon.tsx                    # 图标组件
│   │   ├── switchHomeData.ts           # 首页数据
│   │   ├── entryPermissions.ts         # 入口权限工具
│   │   ├── useSound.ts                 # 音效 Hook
│   │   ├── useWheelScroll.ts           # 滚轮滚动 Hook
│   │   ├── switch-ui.css               # Switch UI 样式
│   │   └── mobile-switch-app.css       # 手机端样式
│   ├── api/
│   │   ├── types.ts                    # API 契约类型
│   │   ├── client.ts                   # fetch 封装
│   │   └── saveQueue.ts               # 保存请求队列
│   └── stores/
│       ├── sceneStore.ts               # 场景加载状态
│       └── adminStore.ts               # 管理员登录状态
├── public/
│   └── Sence_layout.json               # 3D 场景布局数据
├── vite.config.ts                      # Vite 配置：React、Tailwind、模型代理中间件
└── package.json
```

## 3D 场景设计

3D 外部场景负责「进入感」和「导航隐喻」，不承担文章长阅读。它应该做到：

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

模型文件是博客首屏性能的主要风险。当前已实现浏览器 Cache Storage 缓存：

1. 第一次加载模型时，前端通过 `fetch` 获取 GLB。
2. 成功后写入 `caches.open("meo-blog-model-cache-v1")`。
3. 再把响应转成 `Blob URL` 交给 `GLTFLoader`。
4. 第二次打开同一路径模型时优先从 Cache Storage 读取，不再重复下载大文件。

当前策略还包括：

- 模型文件名带内容 hash，例如 `ps5-console.ab12cd.glb`。
- `manifest.json` 记录模型版本、大小、hash 和用途。
- Cache key 使用完整 URL + hash。
- 大模型采用懒加载：可见、点击、空闲时再加载。
- 加载进度条分阶段显示，图标优先加载。
- 模型加载超时保护，修复首次加载卡住问题。
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

2D 内容层参考 Switch 主界面，核心原则是横向卡片、当前选中项放大、高亮边框、底部圆角工具栏、右上角状态区。

主界面模块：

| Switch 卡片 | 内容 |
| --- | --- |
| 项目展示 | 个人项目、Demo、实验作品 |
| GitHub 动态 | commit、contribution 记录、仓库 |
| 博客文章 | 魔法书架主题的博客系统 |
| 留言墙 | 社区留言与回复 |
| 收藏展示 | 任务布告栏主题的收藏 |
| 简历 | 个人简历图片展示 |
| 管理后台 | 终端窗口风格的管理面板 |

底部工具栏（桌面端）：

- Home：回到主界面
- Posts：博客书架
- Projects：项目
- GitHub：开发记录
- Mail：联系 / 留言

交互：

- 左右键 / 手柄方向键切换卡片。
- Enter / A 键进入。
- Esc / B 键返回。
- 首屏卡片最多加载摘要，详情进入页面后再请求。
- 移动端改为水平滑动卡片，底部工具栏压缩为图标。

## 手机端适配

视口 ≤ 760px 自动切换为轻量 2D App 布局：

- 不加载 Three.js / GLB 模型，节省流量和加载时间。
- Nintendo App 风格首页：项目图标横向滑动、我的空间快捷入口。
- 底部 Dock：GitHub / 简历 / 留言。
- 独立博客阅读入口，支持分类和文章浏览。
- 分类简介溢出时自动省略，支持展开/收起。

## 功能设计

### 博客系统（魔法书架）

- 书架视图：分类以书本形式展示，自定义图标、颜色和文章计数。
- 卷轴视图：文章以羊皮纸卷轴样式呈现。
- 阅读器：羊皮纸风格，GFM Markdown 渲染，带装饰性边框。
- 评论系统：昵称 + 邮箱 + 内容，管理员可删除。
- 管理功能：分类 CRUD，文章 CRUD，草稿/发布切换。

### 留言墙

- 发帖：昵称本地缓存 + 内容（500 字限制）。
- 回复：多层回复，管理员回复有专属徽章。
- 审核：管理员可审核留言，审核通过后公开可见，拒绝后仅作者可见。
- 删除：用户可删除自己的留言和回复，管理员可删除任意内容。

### 收藏展示（任务布告栏）

- 布局：Knuth 乘法哈希的确定性伪随机布局。
- 视觉：铁钉固定 + 羊皮纸背景 + 火漆印章装饰。
- 灯箱：点击图片全屏查看。
- 管理：上传、拖拽排序、删除。

### 项目展示

- 卡片：图标、标题、副标题、分类标签、主题色。
- 详情：Markdown 简介 + 技术栈图标（700+ 可选）+ 状态徽章。
- 缓存优先策略加速加载。
- 合作伙伴展示：横向滑动图标和链接。

### GitHub 集成

- 个人资料：头像、昵称、简介、位置、邮箱、关注者/关注数。
- 贡献热力图：最近 90 天，GitHub 绿色系配色，动画入场。
- 公开仓库：名称、描述、语言、Star、Fork、最后更新。
- 数据融合：GitHub 缺少的信息自动从管理员资料补充。

### 简历展示

- 图片形式简历，支持放大预览。
- 管理员可上传/替换。
- 加载状态动画和错误重试机制。

### 管理后台

- 双重验证登录：密码 + 手柄按键序列（方向键 + ABXY 组合）。
- 终端窗口风格面板。
- Session 过期自动重新登录。
- 功能：个人资料、项目管理（含拖拽排序）、博客管理、留言审核、收藏管理、合作伙伴管理、入口权限配置。

### 游客入口权限

- 可配置游客是否可见 3D 场景入口。
- 无权限时显示友好提示。
- 管理员可随时切换开关。

## 后端技术栈

已采用：

| 模块 | 技术 |
| --- | --- |
| 语言 | Go |
| HTTP 框架 | Chi |
| 数据库 | PostgreSQL 16 |
| 数据库驱动 | pgx (pgxpool 连接池) |
| 缓存 | Redis 7 (go-redis) |
| 数据迁移 | golang-migrate |
| 配置 | 环境变量 |
| 日志 | slog |
| 鉴权 | JWT + HttpOnly Cookie |

后端目录：

```text
backend/
├── cmd/server/
│   └── main.go                     # 程序入口：加载配置、启动 HTTP 服务、优雅关闭
├── internal/
│   ├── config/
│   │   └── config.go               # 从环境变量读取配置
│   ├── http/
│   │   ├── router.go               # Chi 路由注册
│   │   └── responses.go            # 统一 JSON 响应 {data, meta, error}
│   ├── middleware/
│   │   └── middleware.go           # RequestID、CORS、Logging、Recovery、Auth
│   └── repository/
│       ├── db.go                   # pgxpool 连接池初始化
│       └── redis.go                # go-redis 客户端初始化
├── migrations/                     # 16 个数据库迁移版本
│   ├── 000001_init.up.sql          # 初始建表
│   ├── ...
│   └── 000016_guestbook_moderation.up.sql
├── go.mod
├── go.sum
└── Dockerfile                      # 多阶段构建
```

## 数据库表

当前已实现的核心表：

```text
admin_profiles         # 管理员资料（头像、昵称、GitHub URL、联系方式等）
posts                  # 博客文章
post_categories        # 文章分类
post_comments          # 文章评论
guestbook_messages     # 留言墙消息
guestbook_replies      # 留言回复
projects               # 项目展示
project_icons          # 项目技术栈图标
favorites              # 收藏图片
partners               # 合作伙伴
resume                 # 简历图片
scene_layouts          # 场景布局
site_permissions       # 站点权限配置（游客入口等）
```

## Redis 缓存设计

Redis 主要用于：

- API 列表页缓存。
- GitHub 同步结果缓存。
- 邮件 / 联系表单限流。
- 首页聚合数据缓存。
- 项目摘要缓存（缓存优先策略）。

建议 key：

```text
home:switch-dashboard:v1
posts:list:{queryHash}
posts:detail:{slug}
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

### 已实现的主要端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/v1/health | 健康检查 |
| GET | /api/v1/admin/profile | 获取管理员资料 |
| PATCH | /api/v1/admin/profile | 更新管理员资料 |
| POST | /api/v1/admin/login | 管理员登录 |
| GET | /api/v1/projects | 项目列表（支持缓存优先） |
| GET | /api/v1/projects/{id} | 项目详情 |
| POST/PATCH/DELETE | /api/v1/admin/projects/* | 项目管理 |
| GET | /api/v1/posts | 文章列表 |
| GET | /api/v1/posts/{slug} | 文章详情 |
| POST/PATCH/DELETE | /api/v1/admin/posts/* | 文章管理 |
| GET | /api/v1/categories | 分类列表 |
| POST/PATCH/DELETE | /api/v1/admin/categories/* | 分类管理 |
| GET | /api/v1/guestbook/messages | 留言列表（公开） |
| POST | /api/v1/guestbook/messages | 发布留言 |
| DELETE | /api/v1/guestbook/messages/{id} | 删除留言 |
| POST | /api/v1/guestbook/replies | 发布回复 |
| DELETE | /api/v1/guestbook/replies/{id} | 删除回复 |
| PATCH | /api/v1/admin/guestbook/* | 留言审核与管理 |
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

分页：

```json
{
  "page": 1,
  "pageSize": 12,
  "total": 42,
  "hasNext": true
}
```

## Docker 部署

已实现的服务：

```text
nginx       # 反向代理 + 静态资源服务 + HTTPS (Certbot)
backend     # Go 后端 API
postgres    # PostgreSQL 16
redis       # Redis 7
migrate     # 数据库迁移（golang-migrate）
```

启动命令：

```bash
cp .env.example .env   # 编辑密码等配置
docker compose up -d --build
# → http://localhost/
```

服务器部署（含 HTTPS）：

```bash
docker compose -f docker-compose.server.yml up -d --build
```

环境变量：

```env
APP_ENV=production
POSTGRES_DB=meo_blog
POSTGRES_USER=meo
POSTGRES_PASSWORD=change_me
POSTGRES_PASSWORD_URL=url_encoded_password
DATABASE_URL=postgres://meo:password@postgres:5432/meo_blog?sslmode=disable
REDIS_ADDR=redis:6379
JWT_SECRET=change_me
ADMIN_PASSWORD=change_me
ADMIN_SEQUENCE=change_me
GITHUB_TOKEN=github_pat_xxx
UPLOAD_DIR=/app/uploads
```

## Nginx 静态资源缓存

模型资源：

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
  proxy_pass http://backend:8080;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 安全和权限

- 管理后台必须通过双重验证登录（密码 + 手柄按键序列）。
- JWT 放 HttpOnly Cookie。
- 留言表单加限流。
- 游客入口权限可配置。
- GitHub token 只放后端环境变量。
- CORS 只允许正式域名和本地开发域名。
- 后台写接口校验 CSRF 或使用 SameSite Cookie。

## 后续计划

- [ ] 3D 场景热点交互优化（hover 高亮、点击运镜增强）
- [ ] PlayStation 路线内容入口
- [ ] 文章标签系统与全文搜索
- [ ] CI/CD 自动部署流水线
- [ ] 模型 hash 化与 CDN 分发
- [ ] 后台管理的内容发布流程完善
- [ ] 更多彩蛋和交互细节
