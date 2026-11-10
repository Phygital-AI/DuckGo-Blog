# Blog 学术文章版式审核

日期：2026-11-10。

## 设计

- 参考 [AWSM](https://phygital-ai.github.io/agentic-world-simulation-and-mapping/#results) 及本地 `/home/yaofangliu/astra-world-model-blog/style.css` 的文章布局；不复制其研究内容、图像或结果。
- 暖白纸面、深绿文字、细分隔线、大幅标题与插图、桌面粘性目录、阅读进度及移动端单栏。
- 所有 DOM 文本以 Times New Roman 为首选，包括按钮、表格和详细成绩页。Times New Roman 不含中文字形，中文使用 Songti / Noto Serif CJK / 思源宋体等衬线回退；不重新分发商业字体。
- 首图 `public/showcase/article-hero.jpg` 来自本仓库手动仿真器的安全预览，截图时状态为 `ready`、tick 为 0；只隐藏截图中的操作面板，不启动比赛或调用模型。
- 保留原中英文文案、历史结果、技术有效性说明、技能录像、动态赛道预览与手动仿真入口。比赛代码与 Blog 分属独立仓库，本次仅修改 Blog。
- 主页代码链接改为 `HandsomeWuuu/Microduck-Agent-Race`。原 `#modes` 锚点保留，新增 `#results`，支持直接进入结果部分。

## 验证

`npm run build` 通过；`git diff --check` 通过。通过 Git 差异检查确认 `leaderboard-data.json`、`course-provenance.json`、`src/envs/`、`src/scene/` 与 `src/race/` 未修改。

使用 Chromium 浏览器完成 11 组检查，未出现页面脚本错误或 HTTP 失败：

1. 英文：9 个文章章节、16 条成绩行、所有 DOM 文本的首选字体为 Times New Roman、图片正常、无水平溢出。
2. 中文：与英文相同的结构、成绩数、字体规则与图片检查。
3. 直接访问 `#results` 可定位结果，左侧目录正确高亮。
4. 切换中英文后保留成绩表。
5. 技能弹窗可打开，并支持 Escape 关闭。
6. Agent 家族详情可展开。
7. 赛道 iframe 按需加载，关卡选择可切换镜头；默认预览速度为 1×。
8. 390 px 英文移动端无水平溢出。
9. 390 px 中文移动端无水平溢出。
10. 详细成绩页标题与表格使用 Times New Roman。
11. 历史报告页标题与表格使用 Times New Roman。

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

- `blog-academic-desktop-en.png`、`blog-academic-desktop-zh.png`
- `blog-academic-results-en.png`、`blog-academic-results-zh.png`
- `blog-academic-mobile-en.png`、`blog-academic-mobile-zh.png`
- `blog-academic-mobile-cover-en.png`、`blog-academic-mobile-cover-zh.png`

## 发布与分享

- 源码通过 `HandsomeWuuu/Agent-Race-Blog` 的 `main` 分支交付；`dist/` 和 `node_modules/` 不提交。
- 当前仓库为私有仓库，执行账号有推送权限但没有 Pages 设置管理权限，因此不自动配置 GitHub Pages，也不改变仓库可见性。
- 分享预览仅提供 `dist/` 构建产物，通过本机 `5197` 端口的静态服务器与 Cloudflare Quick Tunnel 暴露 HTTPS 页面，不暴露源码目录。
- 临时链接可直接转发，无需访问者登录 GitHub；仅在服务器与隧道运行时有效，无可用性保证。正式长期发布需单独配置托管。
- 启动与分享命令见 [README](../README.md#在线预览与分享)。
