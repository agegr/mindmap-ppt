const sourceMarkdown = `
- Markdown Mindmap
  项目汇报思维导图演示
  @image ./assets/illustrations/overview.svg
    - 需求分析
      用户目标与演示场景
        - 核心流程
          从根节点开始逐步展开
          @image ./assets/illustrations/flow.svg
            - 入口说明
              先展示项目整体目标
            - 交互说明
              键盘与滑条同步切换
            - 视觉要求
              保持轻量演示风格
        - 内容结构
          Markdown 列表驱动节点
            - 文本解析
              支持副标题和主标题
            - 顺序规则
              按前序遍历依次展示
            - 层级关系
              保留父子连接和路径
    - 展示设计
      画布布局与动画策略
      @image ./assets/illustrations/layout.svg
        - 路径布局
          当前路径保持横向稳定
            - 主线节点
              选中路径清晰突出
            - 完成分支
              已访问分支保留在上方
            - 未访问内容
              隐藏且不占布局空间
        - 节点弹出与曲线绘制
          @image ./assets/illustrations/animation.svg
            - 节点动画
              进入时轻微缩放淡入
            - 曲线动画
              连接线顺滑绘制出现
            - 高亮效果
              当前节点保持橙色光感
`;

const mindmap = document.querySelector("#mindmap");
const mapLayer = document.querySelector("#mapLayer");
const linkLayer = document.querySelector("#linkLayer");
const nodeLayer = document.querySelector("#nodeLayer");
const deckSubtitle = document.querySelector("#deckSubtitle");
const deckTitle = document.querySelector("#deckTitle");
const counter = document.querySelector("#counter");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const nodeSlider = document.querySelector("#nodeSlider");
const currentNodeText = document.querySelector("#currentNodeText");
const nextNodeText = document.querySelector("#nextNodeText");

const SVG_NS = "http://www.w3.org/2000/svg";
const layout = {
  minNodeWidth: 112,
  minNodeHeight: 44,
  pathGap: 76,
  rowGap: 58,
  stagePaddingX: 88,
  stagePaddingY: 72,
  centerBaseline: 520,
  viewWidth: 960,
  viewHeight: 620,
  activeNodeViewportPadding: 72,
  activeNodeVerticalPadding: 64,
};

let activeIndex = 0;
let root = parseMarkdownTree(sourceMarkdown);
let preorder = [];
let idToNode = new Map();
let renderedNodes = new Map();
let renderedLinks = new Map();
let cameraTargetIndex = null;
let currentNodeMetrics = new Map();

assignTreeMetadata(root);
preorder = collectPreorder(root);
idToNode = new Map(preorder.map((node) => [node.id, node]));
nodeSlider.max = String(preorder.length - 1);
updateDeckHeading(root.label);

prevButton.addEventListener("click", () => setActiveIndex(activeIndex - 1));
nextButton.addEventListener("click", () => setActiveIndex(activeIndex + 1));
nodeSlider.addEventListener("input", (event) => {
  setActiveIndex(Number(event.target.value));
});
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveIndex(activeIndex + 1);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveIndex(activeIndex - 1);
  }
});
window.addEventListener("resize", () => render());

render();

function parseMarkdownTree(markdown) {
  const stack = [];
  let nextId = 0;
  let parsedRoot = null;

  markdown
    .split("\n")
    .filter((line) => line.trim())
    .forEach((line) => {
      const itemMatch = line.match(/^(\s*)-\s+(.+)$/);
      if (!itemMatch) {
        const continuationMatch = line.match(/^(\s+)(\S.*)$/);
        if (continuationMatch && stack.length > 0) {
          const indent = continuationMatch[1].replace(/\t/g, "    ").length;
          const depth = Math.floor(indent / 4);
          const continuationParent = stack[Math.min(depth, stack.length - 1)];
          const continuationText = continuationMatch[2].trim();

          if (continuationParent) {
            if (continuationText.startsWith("@image ")) {
              continuationParent.image = continuationText.slice("@image ".length).trim();
              return;
            }

            continuationParent.label = `${continuationParent.label}\n${continuationText}`;
          }
        }

        return;
      }

      const indent = itemMatch[1].replace(/\t/g, "    ").length;
      const depth = Math.floor(indent / 4);
      const node = {
        id: `node-${nextId++}`,
        label: itemMatch[2].trim(),
        children: [],
        parent: null,
        depth,
        image: "",
        preorderIndex: 0,
      };

      if (depth === 0) {
        parsedRoot = node;
      } else {
        const parent = stack[depth - 1];
        node.parent = parent;
        parent.children.push(node);
      }

      stack[depth] = node;
      stack.length = depth + 1;
    });

  return parsedRoot;
}

function assignTreeMetadata(treeRoot) {
  collectPreorder(treeRoot).forEach((node, index) => {
    node.preorderIndex = index;
  });
}

function collectPreorder(node, list = []) {
  list.push(node);
  node.children.forEach((child) => collectPreorder(child, list));
  return list;
}

function setActiveIndex(index) {
  activeIndex = Math.max(0, Math.min(index, preorder.length - 1));
  cameraTargetIndex = null;
  render();
}

function render() {
  const activeNode = preorder[activeIndex];
  currentNodeMetrics = measureAllNodes(preorder, activeNode);
  const model = buildVisibleModel(activeNode);
  const viewport = computeViewport(model, cameraTargetIndex);

  syncLinks(model.links);
  syncNodes(model.nodes, activeNode);
  positionMapLayer(viewport);
  updateControls();
}

function measureAllNodes(nodes, activeNode) {
  const measurer = document.createElement("div");
  measurer.className = "node-measurer";
  document.body.appendChild(measurer);

  const metrics = new Map();
  nodes.forEach((node) => {
    const content = createNodeContent();
    updateNodeContent(content, node, node.id === activeNode.id);
    measurer.appendChild(content.root);

    const rect = content.root.getBoundingClientRect();
    metrics.set(node.id, {
      width: Math.max(layout.minNodeWidth, Math.ceil(rect.width)),
      height: Math.max(layout.minNodeHeight, Math.ceil(rect.height)),
    });

    content.root.remove();
  });

  measurer.remove();
  return metrics;
}

function buildVisibleModel(activeNode) {
  const path = pathToRoot(activeNode);
  const pathIds = new Set(path.map((node) => node.id));
  const visibleIds = new Set(preorder.slice(0, activeIndex + 1).map((node) => node.id));
  const positions = new Map();
  const nodes = [];
  const links = [];
  const completedSubtrees = [];

  path.forEach((node, depthIndex) => {
    const completeChildren = node.children.filter(
      (child) => visibleIds.has(child.id) && !pathIds.has(child.id),
    );

    completeChildren.forEach((child) => {
      completedSubtrees.push({
        child,
        depthIndex,
        height: measureSubtree(child, visibleIds).height,
      });
    });
  });

  const completedHeight =
    completedSubtrees.reduce((total, subtree) => total + subtree.height, 0) +
    Math.max(0, completedSubtrees.length - 1) * layout.rowGap;
  const baseline = layout.centerBaseline;
  let pathCursorX = layout.stagePaddingX;

  path.forEach((node, index) => {
    const metric = getNodeMetric(node);
    positions.set(node.id, {
      x: pathCursorX + metric.width / 2,
      y: baseline,
    });
    pathCursorX += metric.width + layout.pathGap;
  });

  let cursorY = baseline - layout.rowGap - completedHeight;
  completedSubtrees.forEach((subtree) => {
    const parentPosition = positions.get(path[subtree.depthIndex].id);
    const parentMetric = getNodeMetric(path[subtree.depthIndex]);
    const childMetric = getNodeMetric(subtree.child);
    placeSubtree(subtree.child, visibleIds, positions, {
      x: parentPosition.x + parentMetric.width / 2 + layout.pathGap + childMetric.width / 2,
      y: cursorY + subtree.height / 2,
    });
    cursorY += subtree.height + layout.rowGap;
  });

  visibleIds.forEach((id) => {
    const node = idToNode.get(id);
    const position = positions.get(id);
    if (!position) {
      return;
    }

    const isPath = pathIds.has(id);
    nodes.push({
      id,
      label: node.label,
      x: position.x,
      y: position.y,
      width: getNodeMetric(node).width,
      height: getNodeMetric(node).height,
      depth: node.depth,
      preorderIndex: node.preorderIndex,
      isPath,
      isActive: node.id === activeNode.id,
      isComplete: !isPath,
    });

    if (node.parent && positions.has(node.parent.id)) {
      const parentMetric = getNodeMetric(node.parent);
      const nodeMetric = getNodeMetric(node);
      links.push({
        id: `${node.parent.id}->${node.id}`,
        from: positions.get(node.parent.id),
        fromWidth: parentMetric.width,
        to: position,
        toWidth: nodeMetric.width,
        isPathLink: pathIds.has(node.parent.id) && pathIds.has(node.id),
      });
    }
  });

  return { nodes, links, baseline };
}

function pathToRoot(node) {
  const path = [];
  let current = node;

  while (current) {
    path.unshift(current);
    current = current.parent;
  }

  return path;
}

function measureSubtree(node, visibleIds) {
  const visibleChildren = node.children.filter((child) => visibleIds.has(child.id));
  const metric = getNodeMetric(node);
  if (visibleChildren.length === 0) {
    return { height: metric.height };
  }

  const childHeights = visibleChildren.map((child) => measureSubtree(child, visibleIds).height);
  return {
    height: Math.max(
      metric.height,
      childHeights.reduce((total, height) => total + height, 0) + (childHeights.length - 1) * layout.rowGap,
    ),
  };
}

function placeSubtree(node, visibleIds, positions, anchor) {
  const visibleChildren = node.children.filter((child) => visibleIds.has(child.id));
  positions.set(node.id, { x: anchor.x, y: anchor.y });

  if (visibleChildren.length === 0) {
    return;
  }

  const childMeasures = visibleChildren.map((child) => ({
    child,
    height: measureSubtree(child, visibleIds).height,
  }));
  const totalHeight =
    childMeasures.reduce((total, item) => total + item.height, 0) + (childMeasures.length - 1) * layout.rowGap;

  let childCursor = anchor.y - totalHeight / 2;
  childMeasures.forEach(({ child, height }) => {
    const childY = childCursor + height / 2;
    const nodeMetric = getNodeMetric(node);
    const childMetric = getNodeMetric(child);
    placeSubtree(child, visibleIds, positions, {
      x: anchor.x + nodeMetric.width / 2 + layout.pathGap + childMetric.width / 2,
      y: childY,
    });
    childCursor += height + layout.rowGap;
  });
}

function getNodeMetric(node) {
  return currentNodeMetrics.get(node.id) ?? {
    width: layout.minNodeWidth,
    height: layout.minNodeHeight,
  };
}

function computeViewport(model, targetIndex = null) {
  if (model.nodes.length === 0) {
    return { x: 0, y: 0, width: layout.viewWidth, height: layout.viewHeight };
  }

  const pathNodes = model.nodes.filter((node) => node.isPath);
  const pathMinX = Math.min(...pathNodes.map((node) => node.x - node.width / 2));
  const pathMaxX = Math.max(...pathNodes.map((node) => node.x + node.width / 2));
  const pathCenterX = (pathMinX + pathMaxX) / 2;
  const activeNode = model.nodes.find((node) => node.isActive);
  const targetNode =
    targetIndex === null ? activeNode : model.nodes.find((node) => node.preorderIndex === targetIndex) ?? activeNode;
  let viewportX = pathCenterX - layout.viewWidth / 2;
  let viewportY = model.baseline - layout.viewHeight / 2;

  if (targetNode) {
    const activeRightEdge = targetNode.x + targetNode.width / 2 + layout.activeNodeViewportPadding;
    const activeLeftEdge = targetNode.x - targetNode.width / 2 - layout.activeNodeViewportPadding;

    if (activeRightEdge > viewportX + layout.viewWidth) {
      viewportX = activeRightEdge - layout.viewWidth;
    }

    if (activeLeftEdge < viewportX) {
      viewportX = activeLeftEdge;
    }

    const targetTopEdge = targetNode.y - targetNode.height / 2 - layout.activeNodeVerticalPadding;
    const targetBottomEdge = targetNode.y + targetNode.height / 2 + layout.activeNodeVerticalPadding;

    if (targetBottomEdge > viewportY + layout.viewHeight) {
      viewportY = targetBottomEdge - layout.viewHeight;
    }

    if (targetTopEdge < viewportY) {
      viewportY = targetTopEdge;
    }
  }

  return {
    x: viewportX,
    y: viewportY,
    width: layout.viewWidth,
    height: layout.viewHeight,
  };
}

function positionMapLayer(viewport) {
  const frameWidth = mindmap.clientWidth || layout.viewWidth;
  const frameHeight = mindmap.clientHeight || layout.viewHeight;
  const scale = Math.min(frameWidth / viewport.width, frameHeight / viewport.height);

  mapLayer.style.width = `${layout.viewWidth}px`;
  mapLayer.style.height = `${layout.viewHeight}px`;
  linkLayer.setAttribute("viewBox", `0 0 ${layout.viewWidth} ${layout.viewHeight}`);
  mapLayer.style.transform = `translate(${frameWidth / 2}px, ${frameHeight / 2}px) scale(${scale}) translate(${
    -viewport.x - viewport.width / 2
  }px, ${-viewport.y - viewport.height / 2}px)`;
}

function syncNodes(nodes, activeNode) {
  const liveIds = new Set(nodes.map((node) => node.id));

  renderedNodes.forEach((entry, id) => {
    if (!liveIds.has(id)) {
      entry.group.classList.add("leaving");
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = window.setTimeout(() => {
        entry.group.remove();
        renderedNodes.delete(id);
      }, 220);
      return;
    }

    if (entry.removalTimer) {
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = null;
      entry.group.classList.remove("leaving");
    }
  });

  nodes
    .sort((a, b) => a.preorderIndex - b.preorderIndex)
    .forEach((node) => {
      let entry = renderedNodes.get(node.id);
      if (!entry) {
        entry = createNodeElement(node);
        renderedNodes.set(node.id, entry);
        nodeLayer.appendChild(entry.group);
      }

      entry.group.classList.toggle("active", node.isActive);
      entry.group.classList.toggle("path-node", node.isPath);
      entry.group.classList.toggle("complete-node", node.isComplete);
      entry.group.classList.toggle("camera-target", node.preorderIndex === cameraTargetIndex);
      entry.group.dataset.nodeId = node.id;
      entry.group.setAttribute("aria-current", node.id === activeNode.id ? "true" : "false");
      entry.group.setAttribute("aria-label", `查看 ${formatInlineLabel(node.label)} 的视角`);
      entry.group.style.width = `${node.width}px`;
      entry.group.style.height = `${node.height}px`;
      entry.group.style.transform = `translate(${node.x - node.width / 2}px, ${node.y - node.height / 2}px)`;
      updateNodeContent(entry.content, idToNode.get(node.id), node.isActive);
    });
}

function createNodeElement(node) {
  const group = document.createElement("div");
  group.classList.add("mind-node", "entering");
  group.setAttribute("role", "button");
  group.setAttribute("tabindex", "0");
  group.addEventListener("click", () => focusCameraOnNode(node.id));
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusCameraOnNode(node.id);
    }
  });

  const content = createNodeContent();
  updateNodeContent(content, node, node.preorderIndex === activeIndex);
  group.append(content.root);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => group.classList.remove("entering"));
  });

  return { group, content, removalTimer: null };
}

function focusCameraOnNode(nodeId) {
  const node = idToNode.get(nodeId);
  if (!node) {
    return;
  }

  cameraTargetIndex = node.preorderIndex === activeIndex ? null : node.preorderIndex;
  render();
}

function createNodeContent() {
  const content = document.createElement("div");
  content.classList.add("node-content");

  const subtitle = document.createElement("span");
  subtitle.classList.add("node-subtitle");

  const title = document.createElement("span");
  title.classList.add("node-title");

  const imageWrap = document.createElement("span");
  imageWrap.classList.add("node-image");

  const image = document.createElement("img");
  imageWrap.appendChild(image);
  content.append(subtitle, title, imageWrap);

  return { root: content, subtitle, title, imageWrap, image };
}

function updateNodeContent(content, node, isActive) {
  const [subtitle, ...titleLines] = node.label.split("\n");
  const title = titleLines.length > 0 ? titleLines.join(" / ") : subtitle;

  content.root.classList.toggle("has-subtitle", titleLines.length > 0);
  content.root.classList.toggle("has-node-image", Boolean(node.image));
  content.root.classList.toggle("image-expanded", Boolean(node.image) && isActive);
  content.subtitle.textContent = subtitle;
  content.title.textContent = title;

  if (node.image) {
    if (content.image.getAttribute("src") !== node.image) {
      content.image.src = node.image;
    }

    content.image.alt = `${formatInlineLabel(node.label)} 插图`;
  } else {
    content.image.removeAttribute("src");
    content.image.alt = "";
  }
}

function syncLinks(links) {
  const liveIds = new Set(links.map((link) => link.id));

  renderedLinks.forEach((entry, id) => {
    if (!liveIds.has(id)) {
      entry.path.classList.add("leaving");
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = window.setTimeout(() => {
        entry.path.remove();
        renderedLinks.delete(id);
      }, 220);
      return;
    }

    if (entry.removalTimer) {
      window.clearTimeout(entry.removalTimer);
      entry.removalTimer = null;
      entry.path.classList.remove("leaving");
    }
  });

  links.forEach((link) => {
    let entry = renderedLinks.get(link.id);
    if (!entry) {
      const path = document.createElementNS(SVG_NS, "path");
      path.classList.add("mind-link", "entering");
      path.setAttribute("pathLength", "1");
      entry = { path, removalTimer: null };
      renderedLinks.set(link.id, entry);
      linkLayer.appendChild(path);
      window.setTimeout(() => path.classList.remove("entering"), 980);
    }

    entry.path.classList.toggle("path-link", link.isPathLink);
    entry.path.setAttribute("d", linkPath(link));
  });
}

function linkPath(link) {
  const startX = link.from.x + link.fromWidth / 2;
  const startY = link.from.y;
  const endX = link.to.x - link.toWidth / 2;
  const endY = link.to.y;
  const midX = startX + Math.max(36, (endX - startX) * 0.5);

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function updateControls() {
  const activeNode = preorder[activeIndex];
  const nextNode = preorder[activeIndex + 1];
  const sliderProgress = preorder.length <= 1 ? 0 : (activeIndex / (preorder.length - 1)) * 100;

  counter.textContent = `${activeIndex + 1} / ${preorder.length}`;
  nodeSlider.value = String(activeIndex);
  nodeSlider.style.setProperty("--slider-progress", `${sliderProgress}%`);
  currentNodeText.textContent = formatInlineLabel(activeNode.label);
  nextNodeText.textContent = nextNode ? formatInlineLabel(nextNode.label) : "结束";
  prevButton.disabled = activeIndex === 0;
  nextButton.disabled = activeIndex === preorder.length - 1;
}

function updateDeckHeading(label) {
  const heading = splitLabel(label);

  deckSubtitle.textContent = heading.subtitle;
  deckTitle.textContent = heading.title;
}

function formatInlineLabel(label) {
  return label.replace(/\s*\n\s*/g, " / ");
}

function splitLabel(label) {
  const [subtitle, ...titleLines] = label.split("\n");
  return {
    subtitle,
    title: titleLines.length > 0 ? titleLines.join("\n") : subtitle,
  };
}
