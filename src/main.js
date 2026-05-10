import { sourceMarkdown } from "../project/source.js";

const mindmap = document.querySelector("#mindmap");
const mapLayer = document.querySelector("#mapLayer");
const linkLayer = document.querySelector("#linkLayer");
const nodeLayer = document.querySelector("#nodeLayer");
const deckSubtitle = document.querySelector("#deckSubtitle");
const deckTitle = document.querySelector("#deckTitle");
const counter = document.querySelector("#counter");
const controls = document.querySelector(".controls");
const controlsBody = document.querySelector("#controlsBody");
const controlsToggle = document.querySelector("#controlsToggle");
const nodeSlider = document.querySelector("#nodeSlider");
const zoomSlider = document.querySelector("#zoomSlider");
const zoomValue = document.querySelector("#zoomValue");
const activeScaleSlider = document.querySelector("#activeScaleSlider");
const activeScaleValue = document.querySelector("#activeScaleValue");
const nextNodePreview = document.querySelector("#nextNodePreview");
const nextNodeSubtitle = document.querySelector("#nextNodeSubtitle");
const nextNodeTitle = document.querySelector("#nextNodeTitle");
const imageViewer = createImageViewer();

const SVG_NS = "http://www.w3.org/2000/svg";
const layout = {
  minNodeWidth: 146,
  minNodeHeight: 57,
  pathGap: 99,
  rowGap: 75,
  stagePaddingX: 114,
  stagePaddingY: 72,
  centerBaseline: 520,
  cameraTargetCenterBand: 0.4,
};
const wheelNavigation = {
  threshold: 72,
  idleResetMs: 180,
};
const swipeNavigation = {
  intentDistance: 10,
  minDistance: 56,
  dominanceRatio: 1.25,
};

let activeIndex = 0;
let root = parseMarkdownTree(sourceMarkdown);
let preorder = [];
let idToNode = new Map();
let renderedNodes = new Map();
let renderedLinks = new Map();
let cameraTargetIndex = null;
let currentNodeMetrics = new Map();
let cameraZoom = Number(zoomSlider.value) / 100;
let activeScale = Number(activeScaleSlider.value) / 100;
let wheelDeltaBuffer = 0;
let wheelNavigationTimer = null;
let swipeStart = null;

assignTreeMetadata(root);
preorder = collectPreorder(root);
idToNode = new Map(preorder.map((node) => [node.id, node]));
nodeSlider.max = String(preorder.length);
updateDeckHeading(root.label);

controlsToggle.addEventListener("click", () => {
  const isCollapsed = controls.classList.toggle("collapsed");
  controlsBody.inert = isCollapsed;
  controlsBody.setAttribute("aria-hidden", String(isCollapsed));
  controlsToggle.setAttribute("aria-expanded", String(!isCollapsed));
  controlsToggle.setAttribute("aria-label", isCollapsed ? "展开控制面板" : "收起控制面板");
  controlsToggle.title = isCollapsed ? "展开控制面板" : "收起控制面板";
  controlsToggle.querySelector("span").textContent = isCollapsed ? "+" : "−";
});
nodeSlider.addEventListener("input", (event) => {
  setActiveIndex(Number(event.target.value));
});
zoomSlider.addEventListener("input", (event) => {
  cameraZoom = Number(event.target.value) / 100;
  render();
});
activeScaleSlider.addEventListener("input", (event) => {
  activeScale = Number(event.target.value) / 100;
  render();
});
window.addEventListener("keydown", handleKeydown);
window.addEventListener("wheel", handleWheel, { passive: false });
window.addEventListener("resize", () => render());
mindmap.addEventListener("touchstart", handleTouchStart, { passive: true });
mindmap.addEventListener("touchmove", handleTouchMove, { passive: false });
mindmap.addEventListener("touchend", handleTouchEnd, { passive: false });
mindmap.addEventListener("touchcancel", resetSwipeStart);

render();

function handleKeydown(event) {
  if (imageViewer.isOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      imageViewer.close();
    }

    return;
  }

  const stepByKey = {
    ArrowDown: 1,
    PageDown: 1,
    ArrowUp: -1,
    PageUp: -1,
  };
  const step = stepByKey[event.key];
  if (step) {
    event.preventDefault();
    setActiveIndex(activeIndex + step);
  }
}

function handleWheel(event) {
  if (imageViewer.isOpen() || event.ctrlKey || event.metaKey) {
    return;
  }

  const deltaY = normalizeWheelDeltaY(event);
  if (Math.abs(deltaY) < 1) {
    return;
  }

  event.preventDefault();

  if (wheelDeltaBuffer !== 0 && Math.sign(wheelDeltaBuffer) !== Math.sign(deltaY)) {
    wheelDeltaBuffer = 0;
  }
  wheelDeltaBuffer += deltaY;
  const step = Math.trunc(wheelDeltaBuffer / wheelNavigation.threshold);
  if (step === 0) {
    scheduleWheelBufferReset();
    return;
  }

  setActiveIndex(activeIndex + step);
  wheelDeltaBuffer -= step * wheelNavigation.threshold;
  scheduleWheelBufferReset();
}

function scheduleWheelBufferReset() {
  window.clearTimeout(wheelNavigationTimer);
  wheelNavigationTimer = window.setTimeout(() => {
    wheelDeltaBuffer = 0;
  }, wheelNavigation.idleResetMs);
}

function normalizeWheelDeltaY(event) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === 2) {
    return event.deltaY * getViewportSize().height;
  }

  return event.deltaY;
}

function handleTouchStart(event) {
  if (imageViewer.isOpen() || event.touches.length !== 1) {
    resetSwipeStart();
    return;
  }

  const touch = event.touches[0];
  swipeStart = {
    x: touch.clientX,
    y: touch.clientY,
    isVerticalSwipe: false,
  };
}

function handleTouchMove(event) {
  if (!swipeStart || event.touches.length !== 1) {
    return;
  }

  const touch = event.touches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  const isVerticalIntent =
    Math.abs(dy) >= swipeNavigation.intentDistance &&
    Math.abs(dy) > Math.abs(dx) * swipeNavigation.dominanceRatio;

  if (swipeStart.isVerticalSwipe || isVerticalIntent) {
    swipeStart.isVerticalSwipe = true;
    event.preventDefault();
  }
}

function handleTouchEnd(event) {
  if (!swipeStart || event.changedTouches.length === 0) {
    resetSwipeStart();
    return;
  }

  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  const isVerticalSwipe =
    swipeStart.isVerticalSwipe &&
    Math.abs(dy) >= swipeNavigation.minDistance &&
    Math.abs(dy) > Math.abs(dx) * swipeNavigation.dominanceRatio;

  if (isVerticalSwipe) {
    event.preventDefault();
    setActiveIndex(activeIndex + (dy < 0 ? 1 : -1));
  }

  resetSwipeStart();
}

function resetSwipeStart() {
  swipeStart = null;
}

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
          const continuationParent = findContinuationParent(stack, indent);
          const continuationText = continuationMatch[2].trim();

          if (continuationParent) {
            if (continuationText.startsWith("@image ")) {
              continuationParent.image = resolveImagePath(continuationText.slice("@image ".length).trim());
              return;
            }

            continuationParent.label = `${continuationParent.label}\n${continuationText}`;
          }
        }

        return;
      }

      const indent = itemMatch[1].replace(/\t/g, "    ").length;

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const depth = stack.length;
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
        const parent = stack[depth - 1].node;
        node.parent = parent;
        parent.children.push(node);
      }

      stack.push({ node, indent });
    });

  return parsedRoot;
}

function findContinuationParent(stack, indent) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].indent <= indent) {
      return stack[index].node;
    }
  }

  return stack[stack.length - 1]?.node ?? null;
}

function assignTreeMetadata(treeRoot) {
  collectPreorder(treeRoot).forEach((node, index) => {
    node.preorderIndex = index;
  });
}

function resolveImagePath(path) {
  if (/^(https?:|data:|\/|\.\/|\.\.\/)/.test(path)) {
    return path;
  }

  return `./project/${path}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function collectPreorder(node, list = []) {
  list.push(node);
  node.children.forEach((child) => collectPreorder(child, list));
  return list;
}

function setActiveIndex(index) {
  activeIndex = Math.max(0, Math.min(index, preorder.length));
  cameraTargetIndex = null;
  render();
}

function render() {
  const activeNode = preorder[activeIndex] ?? null;
  currentNodeMetrics = measureAllNodes(preorder, activeNode);
  const model = activeNode ? buildVisibleModel(activeNode) : buildEndModel();
  const viewport = computeViewport(model, cameraTargetIndex);

  syncLinks(model.links);
  syncNodes(model.nodes, activeNode);
  positionMapLayer(viewport, model);
  updateControls();
}

function measureAllNodes(nodes, activeNode) {
  const measurer = document.createElement("div");
  measurer.className = "node-measurer";
  document.body.appendChild(measurer);

  const metrics = new Map();
  nodes.forEach((node) => {
    const content = createNodeContent();
    updateNodeContent(content, node, node.id === activeNode?.id);
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

function buildEndModel() {
  const visibleIds = new Set(preorder.map((node) => node.id));
  const positions = new Map();
  const nodes = [];
  const links = [];
  const rootMetric = getNodeMetric(root);

  placeSubtree(root, visibleIds, positions, {
    x: layout.stagePaddingX + rootMetric.width / 2,
    y: layout.centerBaseline,
  });

  visibleIds.forEach((id) => {
    const node = idToNode.get(id);
    const position = positions.get(id);
    if (!position) {
      return;
    }

    nodes.push({
      id,
      label: node.label,
      x: position.x,
      y: position.y,
      width: getNodeMetric(node).width,
      height: getNodeMetric(node).height,
      depth: node.depth,
      preorderIndex: node.preorderIndex,
      isPath: false,
      isActive: false,
      isComplete: false,
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
        isPathLink: false,
      });
    }
  });

  return { nodes, links, baseline: layout.centerBaseline, isEnd: true };
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
  const viewportSize = getViewportSize();
  const logicalViewport = {
    width: viewportSize.width / cameraZoom,
    height: viewportSize.height / cameraZoom,
  };
  if (model.nodes.length === 0) {
    return { x: 0, y: 0, width: logicalViewport.width, height: logicalViewport.height };
  }

  if (model.isEnd) {
    return computeEndViewport(model, logicalViewport, targetIndex);
  }

  const pathNodes = model.nodes.filter((node) => node.isPath);
  const pathMinX = Math.min(...pathNodes.map((node) => node.x - node.width / 2));
  const pathMaxX = Math.max(...pathNodes.map((node) => node.x + node.width / 2));
  const pathCenterX = (pathMinX + pathMaxX) / 2;
  const activeNode = model.nodes.find((node) => node.isActive);
  const targetNode =
    targetIndex === null ? activeNode : model.nodes.find((node) => node.preorderIndex === targetIndex) ?? activeNode;
  let viewportX = pathCenterX - logicalViewport.width / 2;
  let viewportY = model.baseline - logicalViewport.height / 2;

  if (targetNode) {
    viewportX = keepNodeInCenterBand(viewportX, logicalViewport.width, targetNode.x, layout.cameraTargetCenterBand);
    viewportY = keepNodeInCenterBand(viewportY, logicalViewport.height, targetNode.y, layout.cameraTargetCenterBand);
  }

  return {
    x: viewportX,
    y: viewportY,
    width: logicalViewport.width,
    height: logicalViewport.height,
  };
}

function computeEndViewport(model, logicalViewport, targetIndex = null) {
  const bounds = computeModelBounds(model.nodes);
  const graphCenterX = (bounds.minX + bounds.maxX) / 2;
  const graphCenterY = (bounds.minY + bounds.maxY) / 2;
  const targetNode = model.nodes.find((node) => node.preorderIndex === targetIndex);
  let viewportX = graphCenterX - logicalViewport.width / 2;
  let viewportY = graphCenterY - logicalViewport.height / 2;

  if (targetNode) {
    viewportX = keepNodeInCenterBand(viewportX, logicalViewport.width, targetNode.x, layout.cameraTargetCenterBand);
    viewportY = keepNodeInCenterBand(viewportY, logicalViewport.height, targetNode.y, layout.cameraTargetCenterBand);
  }

  return {
    x: viewportX,
    y: viewportY,
    width: logicalViewport.width,
    height: logicalViewport.height,
  };
}

function computeModelBounds(nodes) {
  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x - node.width / 2),
      maxX: Math.max(bounds.maxX, node.x + node.width / 2),
      minY: Math.min(bounds.minY, node.y - node.height / 2),
      maxY: Math.max(bounds.maxY, node.y + node.height / 2),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    },
  );
}

function keepNodeInCenterBand(viewportStart, viewportSize, nodeCenter, centerBandRatio) {
  const bandPadding = (viewportSize * (1 - centerBandRatio)) / 2;
  const bandStart = viewportStart + bandPadding;
  const bandEnd = viewportStart + viewportSize - bandPadding;

  if (nodeCenter < bandStart) {
    return nodeCenter - bandPadding;
  }

  if (nodeCenter > bandEnd) {
    return nodeCenter - viewportSize + bandPadding;
  }

  return viewportStart;
}

function positionMapLayer(viewport, model) {
  const canvas = computeCanvasSize(model, viewport);

  mapLayer.style.width = `${canvas.width}px`;
  mapLayer.style.height = `${canvas.height}px`;
  linkLayer.setAttribute("viewBox", `0 0 ${canvas.width} ${canvas.height}`);
  mapLayer.style.transform = `scale(${cameraZoom}) translate(${-viewport.x}px, ${-viewport.y}px)`;
}

function computeCanvasSize(model, viewport) {
  const maxNodeRight = model.nodes.reduce((maxRight, node) => Math.max(maxRight, node.x + node.width / 2), 0);
  const maxNodeBottom = model.nodes.reduce((maxBottom, node) => Math.max(maxBottom, node.y + node.height / 2), 0);

  return {
    width: Math.max(viewport.x + viewport.width, maxNodeRight + layout.stagePaddingX),
    height: Math.max(viewport.y + viewport.height, maxNodeBottom + layout.stagePaddingY),
  };
}

function getViewportSize() {
  return {
    width: Math.max(1, mindmap.clientWidth),
    height: Math.max(1, mindmap.clientHeight),
  };
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
      if (activeNode && node.id === activeNode.id) {
        entry.group.setAttribute("aria-current", "true");
      } else {
        entry.group.removeAttribute("aria-current");
      }
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

  const imageWrap = document.createElement("button");
  imageWrap.type = "button";
  imageWrap.classList.add("node-image");
  imageWrap.addEventListener("click", (event) => {
    event.stopPropagation();
    const src = imageWrap.dataset.previewSrc;
    if (src) {
      imageViewer.open(src, imageWrap.dataset.previewAlt || "节点插图");
    }
  });
  imageWrap.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });

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
    content.imageWrap.disabled = false;
    content.imageWrap.dataset.previewSrc = node.image;
    content.imageWrap.dataset.previewAlt = content.image.alt;
    content.imageWrap.setAttribute("aria-label", `放大查看 ${content.image.alt}`);
  } else {
    content.image.removeAttribute("src");
    content.image.alt = "";
    content.imageWrap.disabled = true;
    delete content.imageWrap.dataset.previewSrc;
    delete content.imageWrap.dataset.previewAlt;
    content.imageWrap.removeAttribute("aria-label");
  }
}

function createImageViewer() {
  const overlay = document.createElement("div");
  overlay.classList.add("image-viewer");
  overlay.setAttribute("aria-hidden", "true");

  const frame = document.createElement("div");
  frame.classList.add("image-viewer-frame");
  frame.setAttribute("role", "dialog");
  frame.setAttribute("aria-modal", "true");
  frame.setAttribute("aria-label", "插图大图预览，点击任意位置关闭");

  const image = document.createElement("img");
  image.classList.add("image-viewer-img");
  let returnFocusTarget = null;

  frame.append(image);
  overlay.append(frame);
  document.body.append(overlay);

  function open(src, alt) {
    returnFocusTarget = document.activeElement;
    image.src = src;
    image.alt = alt;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("image-viewer-open");
  }

  function close() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("image-viewer-open");
    if (returnFocusTarget && document.contains(returnFocusTarget)) {
      returnFocusTarget.focus();
    }
    returnFocusTarget = null;
  }

  overlay.addEventListener("click", close);

  return {
    open,
    close,
    isOpen: () => overlay.classList.contains("open"),
  };
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
  const endIndex = preorder.length;
  const isEnd = activeIndex === endIndex;
  const sliderProgress = endIndex === 0 ? 0 : (activeIndex / endIndex) * 100;
  const label = getNextStepLabel(nextNode, isEnd);

  counter.textContent = `${activeIndex + 1} / ${endIndex + 1}`;
  nodeSlider.value = String(activeIndex);
  nodeSlider.style.setProperty("--slider-progress", `${sliderProgress}%`);
  zoomSlider.value = String(Math.round(cameraZoom * 100));
  zoomValue.textContent = `${Math.round(cameraZoom * 100)}%`;
  activeScaleSlider.value = String(Math.round(activeScale * 100));
  activeScaleValue.textContent = `${activeScale.toFixed(2)}x`;
  nodeLayer.style.setProperty("--active-node-scale", activeScale.toFixed(2));
  nextNodePreview.classList.toggle("has-subtitle", label.hasSubtitle);
  nextNodeSubtitle.textContent = label.subtitle;
  nextNodeTitle.textContent = label.title;
}

function getNextStepLabel(nextNode, isEnd) {
  if (isEnd) {
    return {
      hasSubtitle: true,
      subtitle: "当前",
      title: "结束总览",
    };
  }

  if (nextNode) {
    return splitLabel(nextNode.label);
  }

  return {
    hasSubtitle: true,
    subtitle: "下一步",
    title: "结束总览",
  };
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
  const hasSubtitle = titleLines.length > 0;

  return {
    hasSubtitle,
    subtitle,
    title: hasSubtitle ? titleLines.join("\n") : subtitle,
  };
}
