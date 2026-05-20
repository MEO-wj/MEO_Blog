# Switch 界面 1 设计文档

## 目标

`Switch 界面 1` 是博客 3D 首页中的默认内容界面。用户进入 `/` 后，Nintendo Switch 显示屏默认展示该界面；点击左侧 NS 模型时，显示屏切回或唤起该界面；点击 Switch 显示屏时，镜头推进并放大观看该界面。

这个界面不是照搬 Nintendo Switch 系统 UI，而是借用它的结构语言：横向内容卡片、清晰的焦点态、底部工具栏、右上角状态区、柔和弹性动效。内容上服务于个人博客和项目展示。

## 使用场景

| 场景 | 触发 | 结果 |
| --- | --- | --- |
| 初始进入 | 打开首页 `/` | Switch 显示屏默认显示界面 1 |
| 回到首页界面 | 点击左侧 NS 模型 | 当前屏幕内容切换为界面 1，焦点回到第一张项目卡 |
| 放大查看 | 点击 Switch 显示屏 | 相机推进到屏幕正前方，界面 1 进入可读、可操作状态 |
| 退出放大 | 点击返回按钮 / Esc / B 键 | 相机回到初始场景视角，界面仍显示在屏幕上 |

## 3D 场景绑定

建议绑定对象：

| 场景对象 | 当前模型 ID | 交互职责 |
| --- | --- | --- |
| 中央 Switch 掌机屏幕 | `nintendo-switch-handheld-split` | 展示界面 1；点击后镜头放大 |
| 左侧 NS / Dock 小模型 | `nintendo-switch-dock-set-split` | 切换到界面 1，并给屏幕一个轻微启动反馈 |

界面 1 应放在 Switch 显示屏平面上方，而不是直接替换 3D 模型材质。推荐使用 R3F + Drei 的 `Html transform` 或独立 3D 平面承载 DOM UI：

- 设计尺寸：`1280 x 720`，16:9。
- 放置方式：以 Switch 屏幕中心为锚点，沿屏幕法线略微前移，避免 z-fighting。
- 默认状态：UI 随 3D 屏幕透视显示，整体缩小但仍能辨认结构。
- 放大状态：相机对齐屏幕正面，UI 达到可读尺寸。
- 后续如果需要更真实的屏幕反光，可在 UI 下方保留暗色玻璃材质，UI 上方叠一层低透明度高光。

## 信息架构

界面 1 分为四个区域：

1. 顶部用户区
2. 项目横向卡片区
3. 底部功能栏
4. 底部操作提示区

### 顶部用户区

位置参考 NS 主界面左上角，但内容更贴合个人站点：

| 元素 | 内容 | 说明 |
| --- | --- | --- |
| 头像 | 个人头像 | 圆形，带轻微蓝绿描边和玻璃高光 |
| 名字 | `MEO` 或自定义昵称 | 头像右侧，主文本 |
| 状态 | `Building worlds / Blog online` | 小号辅助文本，可后续替换为 GitHub 活跃状态 |

右上角状态区保留主机系统感：

| 元素 | 内容 |
| --- | --- |
| 时间 | 当前本地时间 |
| 网络 | Wi-Fi 图标 |
| 电量 | 百分比 + 电池图标 |

### 项目横向卡片区

参考图中的“游戏卡片列”改造为“项目卡片列”。当前不使用游戏图标，避免误导；每张卡片代表一个博客入口、项目或仓库。

卡片字段：

| 字段 | 示例 | 用途 |
| --- | --- | --- |
| title | `MEO Blog` | 项目名称 |
| subtitle | `React + R3F personal world` | 简短说明 |
| category | `Frontend` / `Backend` / `Game Lab` | 分类标签 |
| cover | 项目封面图 | 之后替换为我的项目图标或项目截图 |
| repoUrl | GitHub 仓库地址 | 选中后可跳转仓库 |
| route | `/projects/meo-blog` | 站内详情页 |

默认卡片建议：

| 顺序 | 标题 | 行为 |
| --- | --- | --- |
| 1 | `MEO Blog` | 进入博客主入口或项目详情 |
| 2 | `3D Scene Lab` | 展示当前 3D 场景工程 |
| 3 | `Backend API` | 跳转后端服务/仓库说明 |
| 4 | `Game Experiments` | 进入游戏实验集合 |
| 5 | `Dev Notes` | 进入开发日志 |

卡片视觉：

- 横向滚动排列。
- 当前选中卡片放大约 `1.08`。
- 选中边框使用蓝绿到紫色的细描边，不使用厚重霓虹。
- 卡片封面可先用抽象色块、项目首字母、技术栈符号占位，后续替换为真实项目图。
- 非选中卡片降低亮度和饱和度，保留可识别轮廓。

卡片行为：

| 操作 | 行为 |
| --- | --- |
| 左右方向键 / 手柄方向 | 切换选中卡片 |
| Enter / A | 打开站内详情页 |
| X / 仓库按钮 | 打开对应 GitHub 仓库 |
| 鼠标悬停 | 临时聚焦卡片 |
| 鼠标点击 | 选中；二次点击打开 |

## 底部功能栏

底部功能栏参考 NS 圆角工具区，但功能改为博客站点入口。

建议按钮：

| 图标语义 | 名称 | 行为 |
| --- | --- | --- |
| Home | 首页 | 回到界面 1 第一张卡 |
| Article | 文章 | 进入 `/posts` |
| Repo | 仓库 | 进入 `/projects` 或当前选中项目 GitHub |
| Lab | 实验 | 进入 `/games` 或 `/lab` |
| Profile | 关于 | 进入 `/about` |
| Settings | 设置 | 打开站点设置面板 |
| Power | 退出 | 关闭放大视图，回到 3D 场景 |

设置入口第一阶段只需要设计，不必实现完整功能。建议预留：

- 画质：高 / 标准 / 省电
- 音效：开 / 关
- 动效：完整 / 减弱
- 主题：深色 / OLED 黑 / 亮色
- 语言：中文 / English

## NS2 风格 UI 原则

这里的 `NS2 效果` 指更现代、更轻、更顺滑的主机 UI 感，而不是复刻具体品牌资源。

视觉原则：

- 大块深色背景，接近 OLED 黑。
- 重点元素使用清亮蓝绿、Switch 红、柔和白。
- 边框细、亮度克制，避免赛博朋克式强霓虹。
- 圆角适中，卡片圆角建议 `18px - 28px`，功能栏可更圆。
- 文字层级清晰，卡片标题大于描述，描述不抢焦点。

动效原则：

| 状态 | 动效 |
| --- | --- |
| 初始显示 | 屏幕轻微亮起，UI 从 96% 缩放到 100%，透明度淡入 |
| 卡片切换 | 当前卡片弹性放大，边框光线短暂扫过 |
| 按钮悬停 | 图标上浮 `2px`，底部出现柔和圆形光晕 |
| 点击确认 | 元素快速缩小到 98%，再回弹到 100% |
| 放大屏幕 | 相机推进，同时 UI 提高清晰度和对比度 |
| 退出放大 | UI 保持在屏幕上，相机回到 3D 初始视角 |

推荐动效参数：

```text
focus transition: 180ms - 240ms
screen zoom: 700ms - 1100ms
easing: cubic-bezier(0.2, 0.8, 0.2, 1)
button press: 90ms down + 160ms rebound
```

## 交互状态

### 1. Ambient / 默认屏幕态

首页加载后进入该状态。

- UI 贴在 Switch 显示屏上。
- 卡片区默认选中第一张 `MEO Blog`。
- 屏幕亮度比环境略高，但不能像独立网页浮在空中。
- OrbitControls 可以保留，但悬停屏幕时建议轻微降低镜头漂移。

### 2. Focus / 放大查看态

点击 Switch 显示屏进入。

- 相机移动到屏幕正面。
- UI 变成主要操作层。
- 鼠标、键盘、手柄操作都作用于界面 1。
- 场景其它物件降低亮度或被景深弱化。
- 左下角可以显示 `B 返回` / `Esc 返回`。

### 3. Repository Jump / 仓库跳转态

当用户选择某张项目卡并触发仓库按钮：

- 如果存在 `repoUrl`，新标签打开 GitHub。
- 如果没有 `repoUrl`，按钮置灰或显示 `Coming soon`。
- 首阶段不需要 GitHub API，只需要前端数据结构预留。

### 4. Settings Panel / 设置面板态

点击底部设置按钮后：

- 从右侧或底部弹出半透明面板。
- 面板不要覆盖项目卡片全部区域，保留主界面上下文。
- 首阶段可以只做静态选项和关闭按钮。

## 导航与可访问性

键盘映射：

| 键位 | 行为 |
| --- | --- |
| ArrowLeft / ArrowRight | 切换项目卡 |
| ArrowUp / ArrowDown | 在项目卡和底部功能栏之间切换 |
| Enter | 确认 |
| Esc | 退出放大或关闭面板 |
| G | 打开当前项目仓库 |

手柄映射：

| 按键 | 行为 |
| --- | --- |
| D-pad / Left Stick | 移动焦点 |
| A | 确认 |
| B | 返回 |
| X | 打开仓库 |
| Plus | 打开选项 |

可访问性：

- 所有可点击项必须有 `aria-label`。
- 焦点态不能只依赖颜色，要有尺寸、边框或阴影变化。
- 支持 `prefers-reduced-motion`，开启后减少镜头和弹性动效。
- 字体在放大查看态下必须清晰可读。

## 数据结构草案

```ts
export interface SwitchHomeProject {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  coverUrl?: string;
  accentColor: string;
  repoUrl?: string;
  route?: string;
  status?: "ready" | "soon" | "external";
}

export interface SwitchHomeUser {
  name: string;
  avatarUrl: string;
  statusText: string;
}
```

首阶段可以先在前端写本地静态数据，后续再替换为后端 API。

## 组件拆分建议

```text
web/src/features/switch-ui/
|-- SwitchHomeScreen.tsx        # 界面 1 主组件
|-- SwitchProfileStrip.tsx      # 左上角头像和名字
|-- SwitchStatusBar.tsx         # 右上角时间 / 网络 / 电量
|-- SwitchProjectRail.tsx       # 横向项目卡片列
|-- SwitchProjectCard.tsx       # 单张项目卡
|-- SwitchActionDock.tsx        # 底部功能栏
|-- SwitchSettingsPanel.tsx     # 设置面板
|-- switchHomeData.ts           # 首阶段静态数据
|-- switch-ui.css               # 局部样式
```

3D 挂载建议：

```text
web/src/scene/
|-- SwitchScreenOverlay.tsx     # 把 SwitchHomeScreen 挂到 3D 屏幕上方
|-- sceneInteractions.ts        # 屏幕点击、左侧 NS 点击、相机状态切换
```

## 第一阶段实现范围

必须完成：

- 默认在 Switch 显示屏上显示界面 1。
- 点击左侧 NS 模型后显示/切回界面 1。
- 点击 Switch 显示屏后相机放大观看界面 1。
- 横向项目卡片列。
- 当前选中卡片焦点态。
- 底部功能栏和设置入口视觉。
- 仓库跳转字段和按钮行为。

可以延后：

- 真实 GitHub API 同步。
- 设置项持久化。
- 手柄 API 输入。
- 屏幕玻璃高级 shader。
- 完整页面路由内容。

## 验收标准

- 首屏进入时，Switch 屏幕能看到界面 1，而不是黑屏。
- 点击左侧 NS 模型后，屏幕内容回到界面 1，选中第一张项目卡。
- 点击 Switch 屏幕后，相机平滑推进，界面可读。
- 项目卡片不是游戏图标，而是项目入口占位设计。
- 当前卡片能打开站内详情或 GitHub 仓库。
- 底部工具栏有设置入口，并具备 NS 风格焦点和点击反馈。
- 桌面视口下布局接近参考图节奏；移动端可裁切，但核心卡片和按钮不能完全不可见。
