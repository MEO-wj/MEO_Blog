# 本站游戏运行文件修改

2026-10-05。上游修订、下载地址与下载文件的 SHA-256 留存于仓库 `third_party/games/sources.json`。目前未生成最终发布文件的独立校验表；`zplayer.js` 已应用下述暂停补丁，修改后的文件不能直接使用原始下载校验值比对。

## FullScreenMario（CC BY-NC-SA 3.0）

完整原始源码保留在仓库 `third_party/games/mario/upstream` 及本目录 `mario/v1/source-96a1e362.zip`，组件自己的许可也保留在源码归档中。

使用 `scripts/build-games.mjs`，按原始 `index.html` 引用顺序拼接 42 个 JavaScript 文件，以 esbuild 压缩空格及语法，不压缩标识符。原项目用字符串引用构造函数，不可任意压缩名称。未使用原始 UserWrappr 启动页。

`mario/v1/adapter.js` 增加键盘、音频 Promise 兼容、画布缩放和关卡/区域入口存档；不修改碰撞和关卡内容。发布资源仅使用 MP3 和 WOFF，原始 OGG、TypeScript 和其他源码仍在源码归档。

## ZQuest Classic（GPL v3）

官方 Web 部署的原始 JavaScript/数据/WASM 内容按 SHA-256 固定；引擎打印版本为 `3.0.0-prerelease.212+2026-08-16`，官方版本标签对应 `877f744fd939a1d25c093d8a926e92d0d4d5235e`。源码归档包含上游源文件、依赖及 CMake/emscripten 构建配置。本次使用官方预编译 Web 运行文件，没有在本机重新编译 C++，因此不声称验证了逐字节可复现构建。

`zplayer.js` 的 `_emscripten_sleep` 中，仅将：

```js
let innerFunc=()=>new Promise(resolve=>setTimeout(resolve,ms));return Asyncify.handleAsync(innerFunc)
```

替换为：

```js
let innerFunc=()=>globalThis.MEORuntime?globalThis.MEORuntime.sleep(ms):new Promise(resolve=>setTimeout(resolve,ms));return Asyncify.handleAsync(innerFunc)
```

这个修改使主线程的 Asyncify 游戏循环可以停在帧间；pthread 工作线程仍保留原始睡眠。暂停同时清理按键并暂停 AudioContext。重建脚本只接受这一个准确模式，版本不匹配会停止。

`zelda/v1/adapter.js` 覆盖上游挂载回调、资源来源、存储同步及 canvas 尺寸，固定一个本地初代任务；不启动官方目录、分析脚本、自动 Service Worker 或编辑器。native save 以 `.sav/.zsv` 文件实际修改并完成 IndexedDB 事务为确认条件。

## 本地复现

仓库内运行资源已留存，普通 `npm --prefix web run build` 不访问游戏第三方服务。

在完整仓库基础上，如需恢复上游下载或重建引擎：先 `python scripts/vendor-games.py`，再 `node scripts/build-games.mjs`。下载脚本拒绝与已固定 SHA-256 不同的上游内容。重新引入引擎版本时，应创建新的资源版本目录和 buildId，不能覆盖访客现有存档格式。

这两个脚本不生成本站的游戏适配代码、通用消息桥、塞尔达运行页、许可页面、发布目录的 `LICENSE.txt` 或马里奥源码 ZIP。上述文件随仓库保留，删除后应从版本库恢复；这两条命令不能用于从空目录完整生成发布资源。

完整 C++ 引擎重编译遵循源码归档的 `CMakeLists.txt`、`README.md`、`scripts` 与上游 Web 构建流程；本仓库不要求安装 Emscripten 才能构建博客。
