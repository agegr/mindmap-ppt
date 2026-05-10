# Mindmap PPT

一个 PPT 式动态思维导图演示工具。它适合把演讲汇报、课程笔记、产品说明和长文稿，变成可以逐步讲述的图文导图。

## 静态网站

这个项目本质上是一个静态网站：页面由 `index.html`、`src/styles.css`、`src/main.js`、`project/source.js` 和 `project/` 里的图片素材组成。

它没有构建步骤、运行时依赖、后端 API 或数据库。`npm run dev` 只是本地预览用的静态文件服务器；正式使用时可以部署到 GitHub Pages、Netlify、Vercel Static、Nginx、对象存储或任意 CDN/静态托管服务。

## 在线演示

https://agegr.github.io/mindmap-ppt/

## 适合谁用

- 需要把复杂文稿讲清楚的人
- 想用导图做演示，而不是只放静态图片的人
- 希望让 Agent 自动整理内容和插图的人

## 你会看到

- 像 PPT 一样逐步展开的思维导图
- 当前重点节点自动进入视野
- 重点节点可以展示插图
- 支持滑条、键盘和按钮切换

## 本地预览

```bash
npm run dev
```

然后打开：

```text
http://127.0.0.1:5173/
```

## 安装 Skill

这个仓库包含一个面向中文用户的 Codex skill：`mindmap-ppt-builder`。安装后，你可以把文稿交给 Agent，让它生成适合本项目展示的思维导图内容，并为重点节点整理插图。

安装命令：

```bash
npx skills add agegr/mindmap-ppt --skill mindmap-ppt-builder
```

安装到 Codex 全局 skill：

```bash
npx skills add agegr/mindmap-ppt --skill mindmap-ppt-builder --agent codex --global
```

## 使用方式

1. 打开或 clone 这个仓库。
2. 把文稿交给已安装 `mindmap-ppt-builder` 的 Agent。
3. 让 Agent 生成或更新 `project` 内容。
4. 打开在线演示或本地预览查看效果。

正常情况下，Agent 只会更新 `project` 里的内容和图片素材。除非你明确要求修改展示功能，否则不需要改应用代码。
