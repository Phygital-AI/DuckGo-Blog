# DuckGo

[中文博客](https://phygital-ai.github.io/DuckGo-Blog/?lang=zh) · [English blog](https://phygital-ai.github.io/DuckGo-Blog/?lang=en)

中英文项目展示站，包含 V3 动态赛道预览、可手动操作的 MuJoCo 仿真、技能演示、选定试跑榜单和结果分析。

## 本地运行

使用 Node.js 22.12 或更新版本。安装依赖后启动开发服务器。

```sh
npm ci
npm run dev
```

浏览器打开终端显示的地址。首页支持 `?lang=zh` 和 `?lang=en`，从赛道卡片可切换关卡，首页的「进入仿真」可启动完整物理场景。

```sh
npm run build
npm run preview
```

生产文件在 `dist/`，可交给静态文件服务器从站点根路径提供。静态部署时可为 `showcase-bundle/` 下的 JS、CSS 和 WASM 启用 gzip。已有 `/showcase.html` 入口的部署可将 `dist/index.html` 同时作为该路径的页面。推送到本仓库的 `main` 分支后，GitHub Actions 会构建并发布到 GitHub Pages。

## 在线预览与分享

从构建产物启动只读预览，不对外提供源码目录：

```sh
npm run build
python3 -m http.server 5197 --bind 127.0.0.1 --directory dist
```

安装 `cloudflared` 后，可在另一个终端创建临时 HTTPS 分享地址：

```sh
cloudflared tunnel --url http://127.0.0.1:5197 --no-autoupdate --protocol http2
```

在输出的地址后添加 `/?lang=zh` 或 `/?lang=en#results` 即可分享。访问者无需 GitHub 登录；地址为公开临时预览，仅在静态服务器与隧道均运行时有效，重建隧道会更换地址，不作为正式发布地址。

## 引用与发布检查

文末提供中英文引用说明、BibTeX 与下载链接，展示和下载均使用 `src/showcase/duckgo.bib`，避免内容不一致。

## 从哪里改

| 内容 | 文件 |
| --- | --- |
| 首页结构、图文与媒体入口 | `index.html` |
| 双语文案、关卡说明与交互 | `src/showcase/showcase.js`、`src/showcase/narrative.js` |
| 研究文章版式、响应式布局与图表样式 | `src/showcase/academic.css` |
| 首屏视频与静态封面 | `public/showcase/duckgo-benchmark-review-10.mp4`、`duckgo-benchmark-review-10-poster.jpg` |
| 目录高亮与阅读进度 | `src/showcase/articleNavigation.js` |
| 正文衬线与界面无衬线字体 | `public/showcase/typography.css` |
| 详细成绩页的共享样式 | `public/showcase/academic-document.css` |
| 动态赛道预览 | `showcase-course.html`、`src/showcase/courseViewer.js` |
| 手动仿真入口 | `simulator.html`、`src/race/main.js` |
| 共享赛道和障碍运动 | `src/envs/gauntletCircuit.js`、`src/envs/geometryPose.js` |
| 2026-11-20 选定单鸭展示榜 | `src/showcase/selected-standings.json` |
| 2026-11-09 七鸭同场试跑榜 | `src/showcase/multi-standings.json` |
| 单人榜导览视频与成本、延迟图表 | `public/showcase/single-agent-leaderboard-v4.mp4`、`public/showcase/solo-cost-progress-20261123.svg`、`public/showcase/solo-api-latency-progress-refined-20261124.svg` |
| 早期详细成绩快照 | `src/showcase/leaderboard-data.json`、`public/race-results.html` |
| 截图、技能录像与字体 | `public/showcase/` |
| 机器人模型、策略与场景贴图 | `public/robot/`、`public/policies/`、`public/assets/venue/` |

## 页面设计

当前版式参考 [Thinking Machines 的 Inkling 文章](https://thinkingmachines.ai/news/introducing-inkling/) 的阅读节奏：白底黑字、居中标题、660 px 正文栏、轻量目录和低装饰表格。首屏及后文的图片、视频、技能合集和交互赛道均不超出正文左右边界；手机按可用宽度缩放。删除重复的摘要标签、章节编号、装饰性眉题和重复小标题，以连续段落组织文章。赛道先呈现画面，再提供关卡选择。首页模型使用竞赛环境相同的展示名，原始模型 ID 与实测数据不变。

首屏使用 70 秒的 `public/showcase/duckgo-benchmark-review-10.mp4` 项目介绍视频，封面取自该视频内嵌的海报帧。点击才播放，不自动下载视频或启动 Agent；支持原生播放控制、键盘操作与结束后重播。影片介绍赛道、控制问题与选定成绩，不能当作完整赛事实录或正式同条件排名。环境章节保留仿真赛道截图、技能录像与按需启动的动态赛道预览。

参考页的正文使用 `Iowan Old Style BT`，界面使用 `GT America`。本站优先使用设备已安装的同名字体；未安装时分别回退到本地托管的开源 `Source Serif 4` 与 `Inter`，因此不保证各设备与参考页字形完全相同。不复制或分发参考页的商业字体；开源字体许可证随文件附带。中文正文保留宋体类回退。首页阅读目录支持 `#results`，原有 `#modes` 链接仍可使用。

视频封面将真实全局赛道截图与项目的 Microduck 三维模型合成，不是实际比赛帧。底部仅展示预览名单中七个模型提供方的标识，同一家族的模型不重复堆叠；标识来源见 `public/showcase/brands/README.md`，不表示品牌背书。生成脚本为 `tools/render-editorial-cover.mjs`，需可用的 Playwright / Chromium；可通过 `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/render-editorial-cover.mjs` 指定已有安装，避免影响网站运行依赖。

新版设计与浏览器检查记录见 [设计审核](docs/DESIGN_REVIEW.md)。

## 赛道来源

预览和手动仿真直接引用同一份 Microduck Race V3 源码。几何、物理控制与场景文件保留服务器导出的内容，浏览器入口使用手动模式。赛道内部 ID 沿用 `gauntlet_gp_v2`，物理修订为 `lift-extremes-20261106T165526Z`。文件散列记录在 `src/showcase/course-provenance.json`。

V3 的第 9 关改为四道交错窄门，第 11 关提高转盘转速，第 12 关提高逆向传送带速度，第 13 关收窄升降墙开口并按左、右、左排列。视频保留其历史版本。

首页选定榜采用服务器 `artifacts/final-selected-leaderboard-20261119/leaderboard.json` 和 `leaderboard-with-metrics.json`：Astra、DeepSeek 与 Gemini 为 V3 选定场次，其余 12 项为 V1 旧选定场次；V3 人类完赛成绩单独列示。该榜是混合版本展示，不是同条件重测或已完成物理有效性验证的正式排名。旧 `/race-results.html` 保留为 2026-10-29 的详细快照，不应与新选定榜混读。

多人赛展示的是 2026-11-09 的一场七鸭同场实时试跑，数据来自 `src/showcase/multi-standings.json` 中记录的服务器 `analysis.json`，按照检查点和精确路线进度排序。该分析文件标记执行记录有效，但物理有效性验证仍待完成，因此网页将其标为单场试跑结果，而不是正式同条件排名。来源对所有参赛者统一记录 `COURSE_BOUNDARY_OR_TIMEOUT`，网页不推断各自究竟是越界还是到时。

源码、素材、依赖锁文件和说明均在此目录。上传仓库时可直接使用本目录，生成的 `dist/` 和 `node_modules/` 已加入忽略规则。机器人模型、策略、字体和贴图的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 及对应素材目录。
