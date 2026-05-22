# 代码审查报告 — 2026-05-22

## 审查范围
前端（web/src/）、后端（backend/）、配置、数据库迁移

---

## 已修复项（16项）

### C1. `.env` 提交到 git，含明文凭据
- **文件**: `.env`
- **问题**: `POSTGRES_PASSWORD`、`JWT_SECRET`、`ADMIN_PASSWORD`、`GITHUB_TOKEN` 明文存储并提交到仓库
- **影响**: 任何有仓库访问权限的人可获取所有密钥
- **状态**: 已在 `.gitignore` 中，且从未被提交到 git 历史

### C2. JWT 默认密钥可被利用
- **文件**: `backend/internal/config/config.go:34`
- **问题**: `JWT_SECRET` 未设置时回退到 `"dev-secret-change-me"`
- **影响**: 攻击者可伪造管理员 token
- **修复**: `backend/cmd/server/main.go` — 生产环境启动时检测默认密钥，命中则拒绝启动并退出

### C3. 登出不销毁 token（Redis session store 是死代码）
- **文件**: `backend/internal/http/admin_auth.go`、`router.go`
- **问题**: Redis 参数被 `_` 丢弃，token 无法撤销
- **影响**: 被盗 token 在 7 天内持续有效
- **修复**: Redis 客户端传入 router；logout 时将 token hash 写入 Redis 黑名单（TTL = token 剩余有效期）；session 校验时查询黑名单

### C4. SVG 上传无消毒 — 存储型 XSS
- **文件**: `backend/internal/http/handlers_upload.go:23-29`
- **问题**: 允许上传 SVG，可嵌入 `<script>` 执行恶意代码
- **影响**: 攻击者上传 SVG 后在其他用户浏览器执行 JS
- **修复**: 从 `allowedMimeTypes` 中移除 `image/svg+xml`

---

### H1. 公开写接口无频率限制
- **文件**: `backend/internal/http/router.go`
- **问题**: 评论、留言簿端点无任何频率限制，可被灌水/DoS
- **修复**: 新增 `backend/internal/middleware/rate_limit.go`，基于 IP 的令牌桶限流（2 请求/秒，突发容量 10），应用于所有公开写接口

### H3. 数据库错误信息泄露给客户端
- **文件**: `handlers_blog.go`、`handlers_projects.go`、`handlers_github.go`
- **问题**: `err.Error()` 直接拼入 API 响应，暴露表名、列名、约束信息
- **修复**: 所有 `err.Error()` 从响应中移除，改用 `slog.Error` 服务端记录详情，客户端只返回通用错误消息

### H4. ETag 每次请求都查数据库
- **文件**: `backend/internal/http/etag.go`
- **问题**: 304 和 200 的数据库开销相同，缓存机制效果减半
- **修复**: ETag 计算结果缓存到内存（TTL 5 秒），避免每次请求查库；新增 `InvalidateETagCache` 函数供写操作主动清除

### H5. GitHub contributions 忽略 username 参数
- **文件**: `backend/internal/http/handlers_github.go:167`
- **问题**: GraphQL 用 `viewer{}` 查询，始终返回 token 持有者数据
- **影响**: 贡献图始终显示 token 拥有者，非目标用户
- **修复**: 改用 `user(login: $login)` GraphQL 查询，支持查询任意用户

### H6. 博客/留言簿查询无 LIMIT，全量返回 content_md
- **文件**: `backend/internal/repository/blog.go`、`guestbook.go`
- **问题**: 无分页，列表接口返回完整 markdown 内容
- **影响**: 数据增长后响应变慢、带宽浪费
- **修复**: 列表查询排除 `content_md`（用空字符串代替），添加 LIMIT（公开 50 条、管理 200 条）；留言簿限制 100 条消息、500 条回复

### H7. JSON 请求无 body 大小限制
- **文件**: 多个 handler
- **问题**: `json.NewDecoder` 无大小限制，攻击者可发送 GB 级 payload 导致 OOM
- **修复**: 所有 JSON handler 添加 `http.MaxBytesReader`（博客文章 1MB，评论/留言 64KB，项目/分类 256KB，收藏位置 1KB）

### H8. GitHub 代理缓存无淘汰，无限增长
- **文件**: `backend/internal/http/handlers_github.go:22-28`
- **问题**: `map` 无大小限制，过期条目不清理，长期运行内存泄漏
- **修复**: 启动时开启 goroutine，每 5 分钟清理过期缓存条目

### H9. `hasAlpha` 双重解码 PNG
- **文件**: `backend/internal/http/handlers_upload.go:172-187`
- **问题**: 整张图解码两次（`hasAlpha` 用 `png.Decode`，`compressImage` 用 `image.Decode`），大图上传时内存翻倍
- **修复**: 合并为 `imageHasAlpha` 函数，复用 `compressImage` 已解码的 `image.Image`

### H10. 前端密码打印到 console
- **文件**: `web/src/features/switch-ui/SwitchHomeScreen.tsx:702`
- **问题**: `console.log("[admin-login] password:", ...)` 明文密码暴露在 DevTools
- **修复**: 删除所有 4 处 `console.log`（含 284、687、702、803 行）

---

### M1. 博客评论无内容长度校验
- **文件**: `handlers_blog.go:81-101`
- **问题**: 仅校验非空，无最大长度，可提交无限内容
- **修复**: 作者名限制 50 字符，内容限制 2000 字符

### M2. Favicon handler 硬编码 image/jpeg
- **文件**: `handlers_profile.go:72`
- **问题**: 不管实际格式都返回 `image/jpeg`，PNG/WebP 头像显示异常
- **修复**: 新增 `detectImageContentType` 函数，根据文件扩展名（`mime.TypeByExtension`）和内容（`http.DetectContentType`）自动检测 MIME 类型

### M3. Slug 无格式校验
- **文件**: `handlers_blog.go`、`handlers_projects.go`
- **问题**: Slug 可含 `../`、大写字母、特殊字符，存在路径遍历风险
- **修复**: 新增 `isValidSlug` 正则校验（`^[a-z0-9]+(?:-[a-z0-9]+)*$`），应用于所有创建和更新接口

---

## 未修复项（20项）

### HIGH — 需要较大改动

#### H2. 留言簿所有权靠可伪造的 IP 判断
- **文件**: `handlers_guestbook.go:15-26,113-124`
- **问题**: `X-Forwarded-For` 可伪造，用户删除权限基于 IP 匹配
- **影响**: 任何人可伪造 Header 删除他人留言
- **为什么未修**: 需要引入签名 token 或登录机制，改动留言簿整体架构

---

### MEDIUM — 前端性能优化（需重构）

#### M4. SwitchHomeScreen 1093 行、30+ useState
- **文件**: `SwitchHomeScreen.tsx`
- **问题**: 整个首页组件 1000+ 行，30 多个 `useState`，任何状态变化导致整棵树重渲染
- **为什么未修**: 需要将组件拆分为多个独立子组件，或用 `useReducer` / Zustand store 集中管理状态。改动范围大，涉及组件结构重构

#### M5. ProjectCard/ActionButton 未 memo，inline props
- **文件**: `SwitchHomeScreen.tsx:243-362`
- **问题**: 子组件未用 `React.memo` 包裹，父组件传 inline 函数/对象作为 props，导致父组件渲染时子组件连带重渲染
- **为什么未修**: 依赖 M4 的组件拆分，需先完成拆分后再对子组件逐个 memo 化

#### M6. react-markdown 静态导入
- **文件**: `BlogBookshelf.tsx:3`、`ProjectDetail.tsx:2`
- **问题**: `react-markdown` 库体积 ~100KB+，直接 import 打入主 bundle
- **为什么未修**: 需要改为 `lazy(() => import('react-markdown'))` 动态导入，涉及添加 Suspense 边界和加载状态处理

#### M7. 无代码分割，整个应用单 bundle
- **文件**: `App.tsx:1-9`
- **问题**: three.js、react-markdown 等大库全量打包，首屏加载慢
- **为什么未修**: 需要用 `React.lazy` 按路由/功能拆分，涉及路由结构改造和加载状态设计

#### M8. handleDelete 无 try-catch
- **文件**: `AdminPanel.tsx:296-301`
- **问题**: 删除操作失败时无用户反馈，静默失败
- **为什么未修**: 需要添加错误提示 UI，涉及管理面板的消息通知机制

#### M9. BlogBookshelf 删除操作无 .catch()
- **文件**: `BlogBookshelf.tsx:228,395,525`
- **问题**: Promise 拒绝未处理，控制台报错
- **为什么未修**: 需要为每处添加 `.catch()` 并给用户反馈，涉及多个删除流程

#### M10. GLTF 重试机制无效
- **文件**: `ModelItem.tsx:110-118`
- **问题**: `useLoader` 按 URL 缓存，重试时命中同一缓存，永远无法真正重试
- **为什么未修**: 需要改用带缓存 key 的加载策略或自定义 loader，涉及 3D 模型加载逻辑重构

#### M11. LoadingOverlay 渲染期间写 ref
- **文件**: `LoadingOverlay.tsx:16`
- **问题**: `readyRef.current = ready` 在渲染阶段执行，React 18 并发模式下可能异常
- **为什么未修**: 需要改为 `useEffect` 中更新 ref，但当前逻辑依赖 ref 同步值，需重新设计加载状态流程

#### M12. 缓存层重复后台刷新
- **文件**: `client.ts:82-90`
- **问题**: 两个组件同时请求同一 URL 会发两次网络请求
- **为什么未修**: 需要将后台刷新也纳入 `inflight` 去重机制，涉及缓存层架构调整

#### M13. ETag 在 list/detail 间共享
- **文件**: `router.go:34`
- **问题**: `/blog/posts` 和 `/blog/posts/{id}` 共用同一个 ETag 计算函数，任一文章更新所有 ETag 失效
- **为什么未修**: 需要为 detail 接口实现按文章 ID 的 ETag 计算，涉及 ETag 中间件支持参数化

#### M14. GitHub contributions 未走缓存
- **文件**: `handlers_github.go:151-281`
- **问题**: 每次请求直接打 GitHub GraphQL API，未使用代理缓存
- **为什么未修**: contributions 用的是 GraphQL POST 请求，当前缓存按 URL key 存储，需要为 GraphQL 设计请求体 hash 缓存策略

#### M15. ReorderProjects 逐条 UPDATE
- **文件**: `repository/projects.go:195-209`
- **问题**: N 个项目 N 次数据库往返，拖拽排序时延迟明显
- **为什么未修**: 需要改为批量 UPDATE（如 `UPDATE ... FROM (VALUES ...) AS v(id, sort_order) WHERE ...`），涉及 SQL 改写

#### M16. 拖拽收藏时每像素触发 setState
- **文件**: `FavoritesModal.tsx:156-188`
- **问题**: 拖拽期间每像素移动触发一次 setState，高频重渲染
- **为什么未修**: 需要用 `requestAnimationFrame` 节流或 CSS transform 替代 setState，涉及拖拽逻辑重构

---

### LOW — 小优化

| # | 问题 | 文件 | 说明 |
|---|------|------|------|
| L1 | `console.log` 残留 | SwitchHomeScreen.tsx | 已在 H10 中一并修复 |
| L2 | `useSound` Audio 对象未释放 | useSound.ts:11-19 | 组件卸载时未调用 `audio.pause()`，长期使用可能泄漏 |
| L3 | Favicon 每次请求读磁盘 | handlers_profile.go:60-79 | 可加内存缓存避免每次 `os.ReadFile` |
| L4 | `.env` 目录遍历加载 | config.go:49-64 | `godotenv.Load` 可被利用加载任意文件 |
| L5 | `verifyAdminSession` 重复实现 | admin_auth.go + middleware/ | 两个文件各有一份验证逻辑，应合并 |
| L6 | DashboardPage 绕过 API client | DashboardPage.tsx:11-27 | 直接 `fetch` 而非用 `api` 客户端，绕过缓存和重试 |
| L7 | `framer-motion` 未使用但打包 | package.json:14 | 依赖声明但代码中未引用，白白增加 bundle 体积 |
| L8 | `useWheelScroll` 非 passive listener | useWheelScroll.ts:37 | 未设 `passive: true`，可能阻塞滚动性能 |
| L9 | `createPortal` 每次渲染重建 | SwitchHomeScreen.tsx:1051-1089 | portal 内容应在 state 变化时更新，非每次渲染重建 |
| L10 | ShelfView 拉全量文章只为计数 | BlogBookshelf.tsx:191-201 | 应用 `SELECT COUNT(*)` 而非拉全部数据 |
| L11 | 列表接口返回完整 content_md | blog.go | 已在 H6 中一并修复 |
| L12 | projects 表缺 sort_order 复合索引 | migrations | 排序查询可能走全表扫描 |
| L13 | Intl.DateTimeFormat 每秒重建 | SwitchHomeScreen.tsx:457 | 应用 `useMemo` 缓存，避免每秒重新创建 |
| L14 | `invalidateCache` 参数名误导 | client.ts:50 | 参数名 `path` 实为 cache key 前缀，应改为 `prefix` |

---

## 修复统计

| 级别 | 总数 | 已修复 | 未修复 |
|------|------|--------|--------|
| CRITICAL | 4 | 4 | 0 |
| HIGH | 10 | 9 | 1 |
| MEDIUM | 16 | 3 | 13 |
| LOW | 14 | 2 | 12 |
| **合计** | **44** | **18** | **26** |

---

## 修复顺序记录

1. [x] H10 — 删除密码 console.log（4处）
2. [x] C1 — .env 已在 .gitignore，从未提交
3. [x] C2 — 生产环境拒绝默认 JWT 密钥
4. [x] C4 — 禁止 SVG 上传
5. [x] H3 — 错误信息不泄露给客户端
6. [x] H7 — JSON body 大小限制
7. [x] H1 — 公开接口频率限制
8. [x] H6 — 查询分页 + 排除 content_md
9. [x] H4 — ETag 内存缓存
10. [x] C3 — Session 撤销机制（Redis 黑名单）
11. [x] H5 — GitHub contributions 修复 username 查询
12. [x] H8 — GitHub 代理缓存定期清理
13. [x] H9 — hasAlpha 合并为单次解码
14. [x] M1 — 博客评论内容长度校验
15. [x] M2 — Favicon content-type 自动检测
16. [x] M3 — Slug 格式正则校验

---

## 新增文件

- `backend/internal/middleware/rate_limit.go` — IP 级令牌桶限流中间件
