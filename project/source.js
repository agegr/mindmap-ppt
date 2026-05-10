export const sourceMarkdown = `
- Mindmap PPT
  把文稿讲成可播放导图
  @image generated/product-overview.png
    - 它能帮你什么
      让复杂内容顺着讲
      @image generated/use-cases.png
        - 演讲汇报
          一步步展开论点脉络
        - 课程笔记
          把知识点连成路径
        - 产品说明
          用导图串起功能卖点
        - 长文提炼
          从文章变成演示大纲
    - 最重要操作
      顺着播放再按需调整
      @image generated/controls-navigation.png
        - 顺序推进
          上下键或滚轮前进后退
        - 跳到重点
          进度滑条定位任意节点
        - 调整视野
          缩放滑条调整画布距离
          - 临时查看
            点击节点只移动视角
    - 让 Agent 制作
      从材料到可播放导图
      @image generated/agent-workflow.png
        - 准备输入
          材料目标风格说清楚
          - 提供材料
            文稿笔记报告都可以
          - 说明重点
            受众用途风格越清楚越好
        - 自动产出
          更新 source.js 和配图
    - 你会拿到什么
      一个静态网站项目包
      @image generated/project-deliverable.png
        - 项目资产
          内容和图片都在 project
          - 内容文件
            source.js 管整棵树
          - 图片素材
            用 @image 引用本地资源
        - 使用方式
          本地预览或静态部署
          - 本地预览
            npm run dev
          - 静态部署
            GitHub Pages、Netlify、Nginx、CDN
`;
