# 手机端 Nintendo App 风格适配设计文档

## 目标

为 `MEO_Blog` 增加一套手机端首页体验：在保留桌面端 3D 首页的前提下，手机端直接进入轻量 2D App 布局，不加载 Three.js 场景和 `.glb` 模型。

当前移动端范围以“项目展示 + GitHub + 简历 + 留言 + 管理入口”为主，不包含照片墙和博客书柜入口。

## 核心决策

- 桌面端 `/` 继续保留 3D 场景、Switch 屏幕和完整桌面端交互。
- 手机端 `/` 在 `<= 760px` 视口下直接渲染 `MobileSwitchAppHome`。
- 项目只展示为横向滑动的方形图标卡片。
- 项目图标必须完整显示，使用 `object-fit: contain`，不裁成圆形。
- 点击项目卡片打开现有 `ProjectDetail`。
- 右上角头像打开个人菜单，可进入 GitHub 或管理后台。
- 底部 Dock 只保留 `GitHub / 简历 / 留言`。
- 手机端不提供照片墙和博客书柜入口。

## 页面结构

```text
web/src/features/switch-ui/
|-- MobileSwitchAppHome.tsx
|-- MobileActionDock.tsx
|-- mobile-switch-app.css
```

路由分流位于：

```text
web/src/App.tsx
```

建议逻辑：

```tsx
const isMobile = window.matchMedia("(max-width: 760px)").matches;
return isMobile ? <MobileSwitchAppHome /> : <SceneEntry />;
```

## 信息架构

手机端首页从上到下分为四个区域：

| 区域 | 作用 |
| --- | --- |
| 顶部栏 | 品牌标识、留言快捷入口、头像菜单 |
| 项目区 | 横向滑动方形项目图标，点击打开项目详情 |
| 我的空间 | GitHub、简历、留言三个快捷入口 |
| 底部 Dock | 固定底部的 GitHub、简历、留言入口 |

## 项目区

项目区是手机端主要内容区。

视觉规格：

- 卡片为方形，建议 `128px - 142px`。
- 圆角控制在 `8px`。
- 项目图标完整显示，不裁切、不放大溢出。
- 有图标时使用 `object-fit: contain`。
- 无图标时使用项目首字母和 `accentColor` 兜底。
- 当前选中卡片使用外圈高亮和轻微上浮。

行为：

| 操作 | 行为 |
| --- | --- |
| 左右滑动 | 浏览项目 |
| 点击项目 | 打开 `ProjectDetail` |
| 项目有 `slug` | 先用摘要打开，再请求完整详情 |
| 项目请求失败 | 保留摘要内容，不白屏 |

## 入口区

手机端入口区只保留：

| 入口 | 行为 |
| --- | --- |
| GitHub | 打开 `GitHubProfile`，无法解析用户名时跳转默认 GitHub |
| 简历 | 打开 `ResumeModal` |
| 留言 | 打开 `MessageWallModal` |

不保留：

- 收藏 / 照片墙
- 博客 / 书柜
- Power 退出按钮

管理后台入口放在头像菜单中，不占用底部 Dock。

## 管理入口

点击右上角头像打开菜单：

```text
GitHub
管理后台
关闭
```

点击管理后台：

1. 已登录时直接打开 `AdminPanel`。
2. 未登录时调用 `api.checkSession()`。
3. Session 无效时打开移动端登录弹窗。
4. 登录仍复用现有 `api.login(password, sequence)`。

## 数据复用

手机端复用现有能力：

- `api.getProjectSummaries(true)`
- `api.getProjectDetail(slug)`
- `api.getPublicProfile()`
- `useAdminStore`
- `useSound`
- `ProjectDetail`
- `GitHubProfile`
- `ResumeModal`
- `MessageWallModal`
- `AdminPanel`
- `SaveToast`

## 验收标准

功能验收：

- `<= 760px` 进入 `/` 时不加载 3D Canvas、Three.js 场景或 `.glb` 模型。
- 桌面端 `/` 仍加载原有 3D 首页。
- 手机端项目区只出现方形项目卡片，不出现圆形项目头像列。
- 项目图标完整显示，不被圆形裁切。
- 手机端不出现照片墙和书柜入口。
- 底部 Dock 只显示 GitHub、简历、留言。
- 头像菜单可以进入 GitHub 和管理后台。

视觉验收：

- `375x812`、`390x844`、`430x932` 视口下无横向页面滚动。
- 底部 Dock 不遮挡正文内容。
- 可点击区域不小于 `44px`。
- 安全区适配底部 Home Indicator 和顶部刘海区域。

性能验收：

- 手机端首屏资源压力明显低于桌面 3D 首页。
- API 失败时显示空状态，不导致白屏。
