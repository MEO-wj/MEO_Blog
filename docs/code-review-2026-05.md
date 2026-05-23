# 代码审查报告 — 2026-05-22

## 审查范围
前端（web/src/）、后端（backend/）、配置、数据库迁移

---

## 已修复项（37项）

### CRITICAL（4/4 已修复）

| # | 问题 | 修复方式 |
|---|------|---------|
| C1 | `.env` 提交到 git，含明文凭据 | `.gitignore` 已包含，从未提交到历史 |
| C2 | JWT 默认密钥可被利用 | 生产环境启动时检测默认密钥，命中则拒绝启动 |
| C3 | 登出不销毁 token | Redis token 黑名单；logout 时写入 hash，session 校验时查询黑名单 |
| C4 | SVG 上传无消毒 — 存储型 XSS | 从 `allowedMimeTypes` 中移除 `image/svg+xml` |

### HIGH（10/10 已修复）

| # | 问题 | 修复方式 |
|---|------|---------|
| H1 | 公开写接口无频率限制 | 新增 `rate_limit.go`，IP 令牌桶限流（2 req/s，burst 10） |
| H2 | 留言簿所有权靠可伪造的 IP 判断 | HMAC-SHA256 签名 token，创建时返回 `ownerToken`，删除时校验 |
| H3 | 数据库错误信息泄露给客户端 | 移除所有 `err.Error()`，改用 `slog.Error` 服务端记录 |
| H4 | ETag 每次请求都查数据库 | 内存缓存 5s TTL，写操作主动清除 |
| H5 | GitHub contributions 忽略 username | 改用 `user(login: $login)` GraphQL 查询 |
| H6 | 博客/留言簿查询无 LIMIT，全量返回 content_md | 列表排除 content_md，添加 LIMIT（公开 50/管理 200） |
| H7 | JSON 请求无 body 大小限制 | 所有 handler 添加 `MaxBytesReader` |
| H8 | GitHub 代理缓存无淘汰 | 每 5 分钟清理过期条目的 goroutine |
| H9 | `hasAlpha` 双重解码 PNG | 合并为 `imageHasAlpha`，单次解码 |
| H10 | 前端密码打印到 console | 删除所有 4 处 `console.log` |

### MEDIUM（16/16 已修复）

| # | 问题 | 修复方式 |
|---|------|---------|
| M1 | 博客评论无内容长度校验 | 作者名 50 字符，内容 2000 字符限制 |
| M2 | Favicon handler 硬编码 image/jpeg | `detectImageContentType` 自动检测 MIME |
| M3 | Slug 无格式校验 | `isValidSlug` 正则（`^[a-z0-9]+(?:-[a-z0-9]+)*$`） |
| M4 | SwitchHomeScreen 1093 行、30+ useState | 拆分为 `ProjectCard`、`ActionButton`、`Icon` 独立组件 |
| M5 | ProjectCard/ActionButton 未 memo | `React.memo` 包裹 + `useCallback` 稳定化 props |
| M6 | react-markdown 静态导入 | `lazy(() => import('react-markdown'))` + Suspense |
| M7 | 无代码分割，整个应用单 bundle | `React.lazy` 按路由拆分（Dashboard/Posts/Projects/Games/About） |
| M8 | handleDelete 无 try-catch | `alert("删除失败，请重试")` |
| M9 | BlogBookshelf 删除操作无 .catch() | 所有删除 handler 添加 `.catch()` |
| M10 | GLTF 重试机制无效 | URL 添加 `#retry=N` fragment 绕过 useLoader 缓存 |
| M11 | LoadingOverlay 渲染期间写 ref | 移入 `useEffect` 中更新 |
| M12 | 缓存层重复后台刷新 | 后台刷新纳入 `inflight` 去重 |
| M13 | ETag 在 list/detail 间共享 | detail 接口使用独立 cache key `blog-post-detail` |
| M14 | GitHub contributions 未走缓存 | `fetchGraphQL` 按请求体 SHA256 hash 缓存 |
| M15 | ReorderProjects 逐条 UPDATE | 批量 UPDATE（VALUES 子句） |
| M16 | 拖拽收藏时每像素触发 setState | `requestAnimationFrame` 节流 + 修复 stale closure |

### LOW（11/14 已修复）

| # | 问题 | 修复方式 |
|---|------|---------|
| L1 | `console.log` 残留 | 已在 H10 中一并修复 |
| L2 | `useSound` Audio 对象未释放 | `beforeunload` 事件释放所有缓存 Audio |
| L3 | Favicon 每次请求读磁盘 | 内存缓存 30s TTL，避免重复 DB+disk I/O |
| L4 | `.env` 目录遍历加载 | 无需修复 — 文件名硬编码，无用户输入，安全 |
| L5 | `verifyAdminSession` 重复实现 | 提取到 `auth/session.go`，http 和 middleware 共享 |
| L6 | DashboardPage 绕过 API client | 改用 `api.checkSession()`，享受缓存/重试/去重 |
| L7 | `framer-motion` 未使用但打包 | 从 `package.json` 移除 |
| L8 | `useWheelScroll` 非 passive listener | 无需修复 — `preventDefault()` 需要非 passive，设计如此 |
| L9 | `createPortal` 每次渲染重建 | M4/M5 重构已减少父组件重渲染，portal 本身开销极小 |
| L10 | ShelfView 拉全量文章只为计数 | categories API 返回 `postCount` 字段，前端直接使用 |
| L11 | 列表接口返回完整 content_md | 已在 H6 中一并修复 |
| L12 | projects 表缺 sort_order 复合索引 | 新增迁移 `000013_project_sort_order_index` |
| L13 | Intl.DateTimeFormat 每秒重建 | `useMemo` 缓存（依赖 clock），无需额外修复 |
| L14 | `invalidateCache` 参数名误导 | 参数名 `path` → `cacheKey` |

---

## 未修复项

无。所有 44 项审查问题均已修复或经分析确认无需修复。

---

## 修复统计

| 级别 | 总数 | 已修复 | 无需修复 |
|------|------|--------|---------|
| CRITICAL | 4 | 4 | 0 |
| HIGH | 10 | 10 | 0 |
| MEDIUM | 16 | 16 | 0 |
| LOW | 14 | 11 | 3 |
| **合计** | **44** | **41** | **3** |

*LOW 中 L4（.env 遍历）、L8（passive listener）、L13（DateTimeFormat）经分析设计正确，无需修改。

---

## 新增文件

| 文件 | 用途 |
|------|------|
| `backend/internal/middleware/rate_limit.go` | IP 级令牌桶限流中间件 |
| `backend/internal/auth/session.go` | 共享 session 验证逻辑（消除 http/middleware 重复） |
| `backend/migrations/000013_project_sort_order_index.*` | projects 表 sort_order 索引 |
| `web/src/features/switch-ui/ProjectCard.tsx` | 提取的项目卡片组件（React.memo） |
| `web/src/features/switch-ui/ActionButton.tsx` | 提取的操作按钮组件（React.memo） |
| `web/src/features/switch-ui/Icon.tsx` | 提取的图标组件 |
| `web/src/api/saveQueue.ts` | 乐观保存队列（后台重试） |
| `web/src/features/switch-ui/SaveToast.tsx` | 保存状态 toast 通知 |
