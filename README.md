# 大象AI共学官网

官网地址：https://daxiangai.cc/

现有 HTML 页面继续直接部署到 GitHub Pages。Codex 阅读层使用离线 Markdown 快照生成静态 HTML，不需要运行时服务器、数据库或 VuePress。

## 文件与写入位置

- `index.html`：官网首页；`CODEX-ENTRY` 标记间的内容由生成器维护。
- 首页“开源教程（含 Codex 从 0 到 1）”是公开内容的统一入口（`#articles`），Codex 位于其中；`codex.html` 是这一入口下的独立内容中心。
- `course.html`：现有学习路线与课程地图。
- `codex.html`：Codex 内容中心，按任务、分类和关键词进入正文。
- `codex-start*.html`、`codex-advanced*.html`、`codex-recipes*.html`：自动生成的总览与正文，不直接编辑。
- `codex.css`、`codex.js`：阅读层样式、搜索、代码复制与目录交互。
- UI 适配：使用 `lucian-uxui-prompt` 的 008、039、044、050、058、092 六种交互，维护在 `codex.css`、`codex.js`，不加载整库脚本；许可在 `LUCIAN-UI-LICENSE.txt`。
- `data/codex-source.json`：完整 Markdown 快照、提交版本和内容校验值；保持原始内容。
- `tools/codex_editorial.mjs`：网站展示层的用户编辑规则；删除来源/核对说明与参考来源章节，并移除桌面宠物“2. 使用”的两张图片。文章标题下的摘要与信息栏不展示，原始快照继续保留。
- `data/codex-assets.json`：图片映射、体积和校验值。
- `data/codex-search.json`、`data/codex-manifest.json`：自动生成的搜索与页面索引。
- `assets/images/codex-*`：本次复制的文档截图与配图，放在既有资产目录。
- `tools/`：同步、构建、校验与打包脚本。
- `node_modules/`、`.pages/`：依赖与发布暂存目录，由主 Agent 或构建流程生成，不作为内容入口，不提交。

未新建内容目录；原始文档、图片、脚本分别复用既有 `data/`、`assets/images/`、`tools/`。第三方内容的版权与 MIT 许可保留在 `CODEXGUIDE-LICENSE.txt` 和原始快照中。源码仓库版本可能领先线上页面，采用固定提交进行同步。

## 构建与本地检查

需要 Node.js 20.19+（推荐 22）和 Python 3：

```sh
npm ci --ignore-scripts
npm run build
npm run check
python3 -m http.server 18140 --bind 127.0.0.1
```

本地预览：http://127.0.0.1:18140/codex.html

检查覆盖页面总量、链接与锚点、图片哈希、全文一致性、代码示例、搜索索引、许可证及首页入口。全文核对不代表工具步骤已在当前客户端逐项实测。

## 更新内容

指定精确提交 SHA，不自动追随远端最新版本：

```sh
python3 tools/sync_codex.py --commit <40位提交SHA>
python3 tools/sync_codex_assets.py
npm run build
npm run check
```

复核同步差异后再发布。同步只下载资料，不执行上游脚本，不自动提交或推送。由于正文含工具版本、套餐、第三方服务及安装命令，更新时需保留核对日期，并单独复核变化较大的章节。

## 发布

`main` 推送触发 GitHub Pages。Pages 发布模式已经由 `legacy` 改为 `workflow`，避免旧版分支发布绕过校验并覆盖新版本。CI 安装固定依赖、生成页面并完成内容校验后，由 `tools/package_site.mjs` 将公开页面与必要资源放入 `.pages/`。不上传 `node_modules`、工具脚本、原始 Markdown 快照或项目分析报告。打包保留 MIT 许可证。

上述工作流维护 GitHub Pages 镜像。官网主域名 `daxiangai.cc` 实际还有独立的 Cloudflare Pages 部署，已通过提交检查和浏览器回读确认；Cloudflare 控制台目前需要登录，其构建命令和输出目录尚未核对，不将 GitHub 镜像的发布设置当作主站配置。

官网将 `.html` 路径重定向到无扩展名地址。Codex 的 canonical 与站点地图使用实际的无扩展名地址；页面链接保留 `.html` 以兼容本地静态预览。

构建与展示分析见 `CODEX-SITE-ANALYSIS.md`。
