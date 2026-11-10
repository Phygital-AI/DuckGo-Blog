# Blog 研究文章版式审核

日期：2026-11-10。

## 设计

- 当前版本参考 [Thinking Machines · Introducing Inkling](https://thinkingmachines.ai/news/introducing-inkling/)：白底、黑灰文字、居中标题、740 px 正文、轻量目录和封面下方的胶囊入口，去除展示面板式卡片与大号章节编号。不复制其研究内容、品牌、插图或源码。
- 此前版本参考过 [AWSM](https://phygital-ai.github.io/agentic-world-simulation-and-mapping/#results) 及本地 `/home/yaofangliu/astra-world-model-blog/style.css`；当前不再使用其暖白深绿配色。
- 主标题不插入强制换行；宽屏单行，窄屏自然换行。正文开头提供中英文 TL;DR，概括评测对象、仿真设置与单一机器人形态的适用范围。
- 所有 DOM 文本以 Times New Roman 为首选，包括按钮、表格和详细成绩页。Times New Roman 不含中文字形，中文使用 Songti / Noto Serif CJK / 思源宋体等衬线回退；不重新分发商业字体。
- 首图 `public/showcase/editorial-cover.svg` 为原创技术概念插画，明确标注非仿真画面，不表示实际机器人几何、障碍布局或实测轨迹。
- 环境章节使用 `public/showcase/article-hero.jpg`：来自本仓库手动仿真器的安全预览，截图时状态为 `ready`、tick 为 0；只隐藏截图中的操作面板，不启动比赛或调用模型。
- 保留原中英文文案、历史结果、技术有效性说明、技能录像、动态赛道预览与手动仿真入口。比赛代码与 Blog 分属独立仓库，本次仅修改 Blog。
- 主页代码链接改为 `HandsomeWuuu/Microduck-Agent-Race`。原 `#modes` 锚点保留，新增 `#results`，支持直接进入结果部分。
- 首页榜单优先展示排名、参赛配置、路线进度、仿真时间、跌倒及终止状态；恢复时间、请求数与动作数仍保留在源数据和完整结果页，不在文章概览表中重复展开。

## 验证

`npm run build` 通过；`git diff --check` 通过。通过 Git 差异检查确认 `leaderboard-data.json`、`course-provenance.json`、`src/envs/`、`src/scene/` 与 `src/race/` 未修改。

当前版本使用 Chromium 浏览器完成 28 项检查，未出现页面脚本错误或 HTTP 失败：

- 1512、1280、1024、768、600、390、320 px 七种宽度，分别检查中英文，共 14 项：正文居中、无页面水平溢出、标题无强制换行、TL;DR 在正文首部、全部 DOM 使用 Times New Roman 首选字体、封面正常、16 条成绩与 6 个概览列保留。宽屏标题单行；手机自然换行。宽屏概览表不截断，窄屏表格可内部横向滚动。
- 语言切换、`#summary` / `#results` / `#modes` 深链接与目录定位，共 4 项。
- 技能弹窗打开、Escape 关闭、Agent 家族展开、多人赛待测状态展开，共 4 项。
- 赛道未激活时不加载；激活后能显示画布并切换关卡，共 2 项。
- 详细成绩页和历史报告页共享白底配色与 Times New Roman，共 2 项。
- 减少动态效果偏好生效；全程无页面错误与 HTTP 失败，共 2 项。

页面检查仅验证展示与交互，不代表新的 Agent 比赛或新的物理有效性验证。成绩源数据未重新计算。

## 本地预览

```sh
npm ci
npm run dev -- --port 5196 --strictPort
```

打开 `http://127.0.0.1:5196/?lang=en` 或 `http://127.0.0.1:5196/?lang=zh#results`。

Mac 远程预览（服务器需保持上述预览进程运行）：

```sh
for local_port in {53200..53300}; do
  if lsof -nP -iTCP:"${local_port}" -sTCP:LISTEN >/dev/null 2>&1; then
    continue
  fi
  if ssh -fN \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -L "127.0.0.1:${local_port}:127.0.0.1:5196" \
    yaofangliu@100.101.89.16; then
    url="http://127.0.0.1:${local_port}/?lang=zh"
    echo "Microduck Agent Race Blog：${url}"
    open "${url}"
    break
  fi
done
```

## 页面截图

本次浏览器截图保存在本机目录：

`/home/yaofangliu/.codex/visualizations/2026/11/10/01a1c4a5-c1e4-7091-b238-4b2769fbb3f0/`

- 当前版本：`blog-editorial-desktop-en.png` / `-zh.png`（首页）。
- 当前版本：`blog-editorial-reading-en.png` / `-zh.png`（正文）。
- 当前版本：`blog-editorial-environment-en.png` / `-zh.png`（环境）。
- 当前版本：`blog-editorial-results-en.png` / `-zh.png`（榜单）。
- 当前版本：`blog-editorial-mobile-en.png` / `-zh.png`（390 px 手机）。
- 前一版本的 `blog-academic-*` 截图仅作为历史对照。

## 发布与分享

- 源码通过 `HandsomeWuuu/Agent-Race-Blog` 的 `main` 分支交付；`dist/` 和 `node_modules/` 不提交。
- 当前仓库为私有仓库，执行账号有推送权限但没有 Pages 设置管理权限，因此不自动配置 GitHub Pages，也不改变仓库可见性。
- 分享预览仅提供 `dist/` 构建产物，通过本机 `5197` 端口的静态服务器与 Cloudflare Quick Tunnel 暴露 HTTPS 页面，不暴露源码目录。
- 临时链接可直接转发，无需访问者登录 GitHub；仅在服务器与隧道运行时有效，无可用性保证。正式长期发布需单独配置托管。
- 启动与分享命令见 [README](../README.md#在线预览与分享)。
