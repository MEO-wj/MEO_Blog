# CI/CD：让部署变成一件"不用动脑"的事

> 每次发版都要 SSH 上服务器手动拉代码、构建、重启？太累了。CI/CD 就是来解决这个问题的。

---

## 什么是 CI/CD

CI/CD 是两个概念的组合：

- **CI（Continuous Integration）持续集成** — 代码一推，自动跑构建和测试，告诉你"有没有搞坏东西"
- **CD（Continuous Deployment）持续部署** — 测试过了？好，自动部署到服务器，线上直接生效

合在一起就是：**你只管 push 代码，剩下的全自动**。

### 有和没有的区别

**没有 CI/CD 的一天：**

```
写完代码 → 本地测试（可能忘了） → git push
→ SSH 登录服务器 → git pull → npm run build
→ 重启服务 → 检查日志 → 发现报错 → 回滚
→ 重新来一遍……
```

每次发版 10-30 分钟，半夜出问题更是折磨。

**有 CI/CD 的一天：**

```
写完代码 → git push → ☕ 喝杯咖啡
→ 手机通知："部署成功 ✅"
```

2 分钟搞定，全程不用碰服务器。

---

## 它能做什么

不只是"自动部署"这么简单，CI/CD 可以帮你自动化整个开发流程中的重复劳动：

| 场景 | 做什么 |
|---|---|
| **代码检查** | push 后自动跑 ESLint、TypeScript 类型检查 |
| **自动测试** | 跑单元测试、集成测试，PR 合并前必须通过 |
| **自动构建** | 前端 `npm build`、后端 `go build`，产物自动打包 |
| **Docker 部署** | 构建镜像 → 推送到 Registry → 服务器拉取启动 |
| **多环境发布** | dev → staging → production，分阶段上线 |
| **定时任务** | 每天凌晨自动跑数据备份、缓存清理 |
| **PR 预览** | 每个 PR 自动生成一个预览地址，审查更方便 |
| **自动回滚** | 部署后健康检查失败？自动回退到上一个版本 |

---

## 主流工具

| 工具 | 适合谁 |
|---|---|
| **GitHub Actions** | GitHub 用户首选，配置最简单，免费额度够用 |
| GitLab CI/CD | GitLab 用户，内置 Docker Registry |
| Jenkins | 企业内网，需要高度自定义 |

如果你的代码托管在 GitHub，**GitHub Actions** 是最自然的选择——仓库里加一个 YAML 文件就能跑。

---

## 怎么用（GitHub Actions）

### 核心思路

```
1. 在仓库里写一个 .github/workflows/deploy.yml
2. 配置好 Secrets（服务器密码等）
3. push 代码，GitHub 自动执行你定义的流程
```

### 一个最简例子

```yaml
name: Deploy
on:
  push:
    branches: [main]           # push 到 main 时触发

jobs:
  deploy:
    runs-on: ubuntu-latest     # GitHub 提供的免费虚拟机
    steps:
      - uses: actions/checkout@v6
      - run: echo "代码已拉取，开始部署！"
```

就这么简单，push 之后 GitHub 会自动执行这些步骤。

### 真实场景：SSH 部署到服务器

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}      # 服务器 IP
          username: ${{ secrets.SERVER_USER }}   # SSH 用户名
          key: ${{ secrets.SSH_KEY }}            # SSH 私钥
          script: |
            cd /opt/my-app
            git pull
            docker compose up -d --build
```

只需在 GitHub 仓库 Settings → Secrets 里配三个值，之后每次 push 就自动部署。

---

## 一个完整的部署流程长什么样

```
开发者 push 到 main
        │
        ▼
  ┌──────────┐    ┌──────────┐
  │ 前端构建   │    │ 后端构建   │    ← 并行执行，节省时间
  │ npm build │    │ go build  │
  └─────┬────┘    └─────┬────┘
        │               │
        └───────┬───────┘
                │
                ▼
        ┌──────────────┐
        │   SSH 部署     │
        │ docker build  │
        │ docker up -d  │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │   健康检查     │    ← curl /health，失败则自动回滚
        └──────────────┘
```

---

## Docker 镜像为什么要"多阶段构建"

直接在服务器上 `npm run build` 会占大量内存和时间，而且构建工具会留在最终镜像里，体积膨胀。

多阶段构建的思路：**在一个容器里编译，把产物复制到另一个干净的容器里运行**。

```dockerfile
# 阶段 1：编译（有 node、npm、源码）
FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# 阶段 2：运行（只有 Nginx + 静态文件，镜像很小）
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

最终镜像只有 ~20MB，而不是 ~800MB。

---

## 本项目的生产部署配置

仓库中的实际工作流分为两段：

- `.github/workflows/ci.yml`：前端构建、Go 测试与静态检查、Compose 校验、生产镜像构建。
- `.github/workflows/deploy.yml`：仅在 `main` 的 CI 成功后部署该次通过验证的精确提交。

### GitHub production Environment

在仓库的 `Settings → Environments` 创建 `production`，并限制只有 `main` 可以部署。建议开启 required reviewer。

Environment secrets：

| 名称 | 用途 |
|---|---|
| `DEPLOY_HOST` | 服务器地址 |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_SSH_KEY` | SSH 私钥 |
| `DEPLOY_PORT` | SSH 端口，可选，默认 22 |

部署客户端协商使用的服务器主机指纹固定在 `.github/workflows/deploy.yml` 中；服务器重装或 SSH 主机密钥轮换后，应先通过可信渠道核对新指纹，再更新工作流。

Environment variable：

| 名称 | 示例 |
|---|---|
| `DEPLOY_PATH` | `/home/ubuntu/Web_and_APP/Blog` |

### 服务器准备

1. 安装 Git、Docker Engine、Docker Compose 插件和 `flock`。
2. 创建 `DEPLOY_PATH` 并放置 `.env`；首次部署会自动初始化 Git 仓库并检出通过 CI 的提交，确保部署用户可运行 Docker。
3. 复制 `.env.example` 为 `.env`，填写所有生产密码；不要提交 `.env`。
4. 创建 `data/uploads`、`data/postgres`、`data/redis` 和 `data/backups`，并赋予正确权限。
5. 配置 DNS、80/443 防火墙规则和 `/etc/letsencrypt/live/meowj.top/` 证书。
6. 不要向公网开放 PostgreSQL 5432 或 Redis 6379。

部署前会在 `data/backups` 生成 PostgreSQL 自定义格式备份。备份不会自动删除，需要按服务器磁盘容量配置独立的保留策略和异地备份。

手动运行 Deploy 工作流时，必须填写一个已经通过 CI、且属于远端 `main` 的完整 commit SHA；这避免手动发布绕过验证。

---

## 写在最后

CI/CD 不是什么高深技术，本质上就是**把你在终端里手动敲的命令写成一个 YAML 文件，让机器帮你自动跑**。

一开始可能觉得"我手动部署也挺快的"，但当你体验过 push 完就不用管的自由感，就再也回不去了。

---

*2026-06-02*
