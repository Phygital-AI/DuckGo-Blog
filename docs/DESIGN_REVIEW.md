# Blog 研究文章版式审核

日期：2026-11-10。

## 设计

- 当前版本参考 [Thinking Machines · Introducing Inkling](https://thinkingmachines.ai/news/introducing-inkling/)：白底、黑灰文字、居中标题、660 px 正文；首屏与后文的全部图片、视频和交互预览均不超出正文边界。不复制其研究内容、品牌、插图或源码。
- 此前版本参考过 [AWSM](https://phygital-ai.github.io/agentic-world-simulation-and-mapping/#results) 及本地 `/home/yaofangliu/astra-world-model-blog/style.css`；当前不再使用其暖白深绿配色。
- 主标题自然换行。正文开头以普通段落概括评测对象、仿真设置与单一机器人形态的适用范围，不再重复标注 TL;DR。删除装饰性编号、眉题、摘要标签；重复目标整合为赛道章节的自然段落。
- 核实参考页字体为正文 `Iowan Old Style BT` 与界面 `GT America`，替代之前全站 Times New Roman 的处理。优先使用设备本地字体；本地不存在时分别使用自托管开源 Source Serif 4 与 Inter。二者是回退字体，不宣称与参考字形完全一致。中文正文使用宋体类回退；商业字体文件未复制或分发。
- 首屏现使用竞赛仓库提供的 `broadcast-preview.mp4`，20 秒、1920 × 1080，保留原文件；附 1280 × 720 VP9 WebM 和 1440 × 810 JPEG 海报。旧概念插画保留在素材目录，但不再用作首图。
- 环境章节使用 `public/showcase/article-hero.jpg`：来自本仓库手动仿真器的安全预览，截图时状态为 `ready`、tick 为 0；只隐藏截图中的操作面板，不启动比赛或调用模型。
- 保留原中英文文案、历史结果、技术有效性说明、技能录像、动态赛道预览与手动仿真入口。比赛代码与 Blog 分属独立仓库，本次仅修改 Blog。
- 主页代码链接改为 `HandsomeWuuu/Microduck-Agent-Race`。原 `#modes` 锚点保留，新增 `#results`，支持直接进入结果部分。
- 首页榜单优先展示排名、参赛配置、路线进度、仿真时间、跌倒及终止状态；恢复时间、请求数与动作数仍保留在源数据和完整结果页，不在文章概览表中重复展开。

## 本次细节改进

- 删除重复的首屏项目标签与三项元信息；正文与全部媒体统一宽度，不使用向两侧溢出的宽幅画面。
- 正文改为连续段落，统一标题、段落、章节间距与图注字号；保留中英文原意和单一机器人形态的范围说明。
- 技能缩略图统一顶边与比例。赛道从狭窄侧栏改成宽幅画面＋三列关卡选择；长评测说明只展示当前选中关卡，保留全部 16 关入口。DOM 与视觉阅读顺序一致。
- 平板和手机不再丢失目录，而是提供横向滚动导航；移动端关卡选择为两列，数据表仅在容器内滚动，不使整页横向溢出。
- 首页榜单优先展示 AI 成绩，人类参考移至表后；模型名大字、Harness 小字，使用与竞赛转播相同的展示名，不修改数据中的原始 ID。完整结果页增加返回文章入口，并放宽容器，避免桌面端无必要的表格截断。
- 首屏视频默认不播放、不请求视频文件。点击后使用原生暂停、进度与全屏控制；结束后恢复重播按钮，页面隐藏时暂停。中英文图注与无障碍名称均明确：仅为赛道和转播界面预览，未启动 Agent，非实测比赛。
- 视频内的 14 个配置为该转播预览名单；历史结果中的 16 项 AI 配置属于历史记录，不将二者描述为同一轮比赛。

## 历史版本验证

`npm run build` 通过；`git diff --check` 通过。通过 Git 差异检查确认 `leaderboard-data.json`、`course-provenance.json`、`src/envs/`、`src/scene/` 与 `src/race/` 未修改。

当前版本使用 Chromium 浏览器完成 28 项检查，未出现页面脚本错误或 HTTP 失败：

- 1512、1280、1024、768、600、390、320 px 七种宽度，分别检查中英文，共 14 项：正文居中、无页面水平溢出、标题无强制换行、TL;DR 在正文首部、全部 DOM 使用 Times New Roman 首选字体、封面正常、16 条成绩与 6 个概览列保留。宽屏标题单行；手机自然换行。宽屏概览表不截断，窄屏表格可内部横向滚动。
- 语言切换、`#summary` / `#results` / `#modes` 深链接与目录定位，共 4 项。
- 技能弹窗打开、Escape 关闭、Agent 家族展开、多人赛待测状态展开，共 4 项。
- 赛道未激活时不加载；激活后能显示画布并切换关卡，共 2 项。
- 详细成绩页和历史报告页共享白底配色与 Times New Roman，共 2 项。
- 减少动态效果偏好生效；全程无页面错误与 HTTP 失败，共 2 项。

页面检查仅验证展示与交互，不代表新的 Agent 比赛或新的物理有效性验证。成绩源数据未重新计算。

### 接续审核

2026-11-10 接续检查了已提交的 `2569ca4` 设计版本，保留现有排版与内容，修复了语言切换复用初始 URL、覆盖用户当前章节锚点的问题。现在从正文进入 `#results` 后切换语言，仍保留当前章节链接。

修复后的生产构建重新通过 28 项 Chromium 检查：七种宽度 × 两种语言的 14 项布局检查、2 项语言切换锚点回归、3 项深链接、1 项目录定位、3 项弹窗与折叠交互、1 项延迟加载赛道及关卡切换、2 项详细结果与历史报告页面、1 项减少动态效果、1 项页面错误与 POST 请求检查。全部通过，无页面脚本错误、HTTP 失败或 POST 请求。`npm run build` 与 `git diff --check` 通过；未修改实验数据或仿真代码。

本机逐项结果与新截图：`/home/yaofangliu/.codex/visualizations/2026/11/10/blog-followup/`。其中 `review.json` 为检查结果，`1512-en-home.png` / `1512-zh-home.png` 为桌面首页，`390-en-home.png` / `390-zh-home.png` 为手机首页。

## 上一轮生产构建验证

`npm run build` 与 `git diff --check` 通过。生产预览 `http://127.0.0.1:5197` 完成 32 项 Chromium 检查，全部通过：

- 七种宽度（1512 / 1280 / 1024 / 768 / 600 / 390 / 320）× 中英文：无页面水平溢出、正文居中、Times New Roman 首选、视频不自动加载或播放、16 行与六个概览列保留、赛道延迟加载。
- 视频键盘启动、暂停、播放至结束和重播；MP4 不支持时使用 VP9 WebM。海报与视频可正常加载，WebM Range 请求返回 206。
- 模型展示名、AI 榜单先于人类参考、桌面概览表完整显示；手机目录可滚动定位、数据表支持键盘横向滚动。
- 语言切换保留当前锚点、三种深链接、目录跟随、技能弹窗 Escape 关闭、参赛家族与多人待测展开、动态赛道启动和关卡切换。
- 减少动态效果偏好、完整成绩与历史报告页面；全程零页面脚本错误、零 HTTP 失败、零 POST 请求。

MP4 与竞赛仓库源文件 SHA-256 一致：`7e6d2f063af4ded8931d866647c47a3f4737fb5286c50d9831bdc313b6b2df5c`。`leaderboard-data.json`、`course-provenance.json`、`src/envs/`、`src/scene/`、`src/race/` 均未改动；完整成绩页嵌入的 `results-data` 块逐字不变。未启动新比赛或调用模型。

本机截图及机器可读检查结果：`/home/yaofangliu/.codex/visualizations/2026/11/10/blog-refined/`，其中 `review.json` 包含全部 32 项结果；`1512-*-home.png` / `390-*-home.png` 为双语桌面与手机首屏，其他文件覆盖正文、技能、赛道、评测对象和榜单。

## 最新版：同宽媒体与精简排版

- 全文统一 660 px 阅读栏；图片、视频、技能合集、赛道预览及表格容器不越过正文两侧。手机保留相同边距，表格在自身容器内横向滚动。
- 去掉 TL;DR 标签、章节编号、装饰性眉题、重复小标题与多余首屏入口；保留关键方法、自动起身辅助、历史赛道版本与单一机器人形态的范围说明。
- 衬线正文与无衬线界面分工；设备未安装参考字体时，使用自托管的开源回退字体，许可证随附。
- 封面由真实赛道截图与 Microduck 三维模型合成；底部一排 OpenAI、Claude、DeepSeek、Qwen、Z.ai、Moonshot、Google 标识，对应预览名单的七个模型提供方，不代表赞助或正式比赛结果。素材来源随 SVG 记录。生成脚本为 `tools/render-editorial-cover.mjs`。
- 生产构建与 Chromium 共 33 项检查通过：七种宽度 × 双语的媒体边界和字体分工、海报尺寸、简化层级、视频播放与重播、原有目录/锚点/弹窗/关卡交互、详细成绩与报告。零脚本错误、零 HTTP 失败、零 POST 请求。
- 检查结果与截图：`/home/yaofangliu/.codex/visualizations/2026/11/10/blog-editorial-qa/`。实验源数据、嵌入成绩 JSON 与仿真代码未改动；未运行新比赛。
- 移除中英文导航、结果入口、报告、来源链接与返回顶部中的装饰箭头，保留链接地址、新窗口安全属性和技能播放按钮。流程及检查点表示中的箭头不是链接装饰，不改动原始数据。

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
