# Mindmap PPT

把文章、报告、演讲稿或笔记交给 Agent，生成一个可播放的思维导图 PPT。

你只需要关心“要讲什么、讲给谁、想要什么风格”。Agent 会负责拆结构、写导图内容、整理配图、启动预览和检查结果。

在线演示：[https://agegr.github.io/mindmap-ppt/](https://agegr.github.io/mindmap-ppt/)

## 推荐用法

1. 准备你的原始材料：文章、会议纪要、产品文档、课程笔记、汇报提纲都可以。
2. 让 Agent 使用 `mindmap-ppt-builder` 生成 Mindmap PPT。可以指定目标受众、演示时长、希望风格、重点信息等。
3. 打开本地预览，继续让 Agent 调整结构、文案或配图。

如果需要手动修改思维导图的内容，可以编辑：

- `project/source.js`：导图内容
- `project/` 下的图片素材：节点插图

## 安装 Agent Skill

安装到当前环境：

```bash
npx skills add agegr/mindmap-ppt --skill mindmap-ppt-builder
```

安装到 Codex 全局 skill：

```bash
npx skills add agegr/mindmap-ppt --skill mindmap-ppt-builder --agent codex --global
```


## 本地预览

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173/
```

## 播放操作

- 上一个 / 下一个节点：方向键、Page Up / Page Down、滚轮或顶部按钮
- 跳到指定节点：拖动进度滑条
- 调整画布大小：拖动 Zoom 滑条
- 临时查看节点：点击可见节点移动视角，不改变当前播放进度

## 部署

这是一个静态网页项目。确认预览效果后，可以直接部署到 GitHub Pages、Netlify、Vercel Static、Nginx、对象存储或任意 CDN。
