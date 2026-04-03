# Public Models

这个目录存放布局编辑器直接读取的最终模型资产。

这里的文件应当满足：

- 路径稳定
- 命名清晰
- 比例大致可信
- 贴图引用完整
- 适合在编辑器中实时加载

## 放什么

- 已整理好的 `.glb`
- 可稳定加载的 `.gltf`
- 必要时保留 `.fbx` 或 `.obj`

## 不要放什么

- 原始下载压缩包
- 未确认授权的外部资源
- 还没清洗的中间版本
- 只适合 Blender 打开的工作文件

## 约定

- 原始外部资源先放到 `external-assets/raw/`
- 清洗中间产物放到 `external-assets/processed/`
- 最终进入编辑器的模型才放到 `public/models/`

每次更新这个目录后，建议重新生成清单：

```bash
npm run models:manifest
```
