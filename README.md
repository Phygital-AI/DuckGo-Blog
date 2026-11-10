# Microduck Benchmark Blog

中英文项目展示站，包含 V3 动态赛道预览、可手动操作的 MuJoCo 仿真、技能演示和历史试跑成绩。

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

生产文件在 `dist/`，可交给静态文件服务器从站点根路径提供。静态部署时可为 `showcase-bundle/` 下的 JS、CSS 和 WASM 启用 gzip。已有 `/showcase.html` 入口的部署可将 `dist/index.html` 同时作为该路径的页面。带仓库名的 GitHub Pages 子路径需要额外配置资源路径。

## 从哪里改

| 内容 | 文件 |
| --- | --- |
| 首页结构、图文与媒体入口 | `index.html` |
| 双语文案、关卡说明与交互 | `src/showcase/showcase.js`、`src/showcase/narrative.js` |
| 展示样式 | `src/showcase/presentation.css` |
| 动态赛道预览 | `showcase-course.html`、`src/showcase/courseViewer.js` |
| 手动仿真入口 | `simulator.html`、`src/race/main.js` |
| 共享赛道和障碍运动 | `src/envs/gauntletCircuit.js`、`src/envs/geometryPose.js` |
| 历史试跑数据与详细成绩 | `src/showcase/leaderboard-data.json`、`public/race-results.html` |
| 截图、技能录像与字体 | `public/showcase/` |
| 机器人模型、策略与场景贴图 | `public/robot/`、`public/policies/`、`public/assets/venue/` |

## 赛道来源

预览和手动仿真直接引用同一份 Microduck Race V3 源码。几何、物理控制与场景文件保留服务器导出的内容，浏览器入口使用手动模式。赛道内部 ID 沿用 `gauntlet_gp_v2`，物理修订为 `lift-extremes-20261106T165526Z`。文件散列记录在 `src/showcase/course-provenance.json`。

V3 的第 9 关改为四道交错窄门，第 11 关提高转盘转速，第 12 关提高逆向传送带速度，第 13 关收窄升降墙开口并按左、右、左排列。页面的成绩和试跑视频保留各自的历史版本。

源码、素材、依赖锁文件和说明均在此目录。上传仓库时可直接使用本目录，生成的 `dist/` 和 `node_modules/` 已加入忽略规则。机器人模型、策略、字体和贴图的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 及对应素材目录。
