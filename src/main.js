const sourceMarkdown = `
- root
    - a
        - a0
            - a00
            - a01
            - a02
        - a1
            - a10
            - a11
            - a12
    - b
        - b0
            - b00
            - b01
            - b02
        - b1
            - b10
            - b11
            - b12
`;

const svg = document.querySelector("#mindmap");
const counter = document.querySelector("#counter");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const nodeSlider = document.querySelector("#nodeSlider");
const sliderLabel = document.querySelector("#sliderLabel");

const SVG_NS = "http://www.w3.org/2000/svg";
const layout = {
  nodeWidth: 112,
  nodeHeight: 44,
  pathGap: 76,
  rowGap: 58,
  stagePaddingX: 88,
  stagePaddingY: 72,
  centerBaseline: 520,
  viewWidth: 960,
  viewHeight: 620,
};

let activeIndex = 0;
let root = parseMarkdownTree(sourceMarkdown);
let preorder = [];
let idToNode = new Map();
let renderedNodes = new Map();
let renderedLinks = new Map();

assignTreeMetadata(root);
preorder = collectPreorder(root);
idToNode = new Map(preorder.map((node) => [node.id, node]));
nodeSlider.max = String(preorder.length - 1);

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
      const match = line.match(/^(\s*)-\s+(.+)$/);
      if (!match) {
        return;
      }

      const indent = match[1].replace(/\t/g, "    ").length;
      const depth = Math.floor(indent / 4);
      const node = {
        id: `node-${nextId++}`,
        label: match[2].trim(),
        children: [],
        parent: null,
        depth,
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
  render();
}

function render() {
  const activeNode = preorder[activeIndex];
  const model = buildVisibleModel(activeNode);
  const viewBox = computeViewBox(model);

  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  syncLinks(model.links);
  syncNodes(model.nodes, activeNode);
  updateControls();
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

  path.forEach((node, index) => {
    positions.set(node.id, {
      x: layout.stagePaddingX + index * (layout.nodeWidth + layout.pathGap),
      y: baseline,
    });
  });

  let cursorY = baseline - layout.rowGap - completedHeight;
  completedSubtrees.forEach((subtree) => {
    const parentPosition = positions.get(path[subtree.depthIndex].id);
    placeSubtree(subtree.child, visibleIds, positions, {
      x: parentPosition.x + layout.nodeWidth + layout.pathGap,
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
      depth: node.depth,
      preorderIndex: node.preorderIndex,
      isPath,
      isActive: node.id === activeNode.id,
      isComplete: !isPath,
    });

    if (node.parent && positions.has(node.parent.id)) {
      links.push({
        id: `${node.parent.id}->${node.id}`,
        from: positions.get(node.parent.id),
        to: position,
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
  if (visibleChildren.length === 0) {
    return { height: layout.nodeHeight };
  }

  const childHeights = visibleChildren.map((child) => measureSubtree(child, visibleIds).height);
  return {
    height: Math.max(
      layout.nodeHeight,
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
    placeSubtree(child, visibleIds, positions, {
      x: anchor.x + layout.nodeWidth + layout.pathGap,
      y: childY,
    });
    childCursor += height + layout.rowGap;
  });
}

function computeViewBox(model) {
  if (model.nodes.length === 0) {
    return { x: 0, y: 0, width: layout.viewWidth, height: layout.viewHeight };
  }

  const pathNodes = model.nodes.filter((node) => node.isPath);
  const pathMinX = Math.min(...pathNodes.map((node) => node.x - layout.nodeWidth / 2));
  const pathMaxX = Math.max(...pathNodes.map((node) => node.x + layout.nodeWidth / 2));
  const pathCenterX = (pathMinX + pathMaxX) / 2;

  return {
    x: pathCenterX - layout.viewWidth / 2,
    y: model.baseline - layout.viewHeight / 2,
    width: layout.viewWidth,
    height: layout.viewHeight,
  };
}

function syncNodes(nodes, activeNode) {
  const liveIds = new Set(nodes.map((node) => node.id));

  renderedNodes.forEach((entry, id) => {
    if (!liveIds.has(id)) {
      entry.group.classList.add("leaving");
      window.setTimeout(() => {
        entry.group.remove();
        renderedNodes.delete(id);
      }, 220);
    }
  });

  nodes
    .sort((a, b) => a.preorderIndex - b.preorderIndex)
    .forEach((node) => {
      let entry = renderedNodes.get(node.id);
      if (!entry) {
        entry = createNodeElement(node);
        renderedNodes.set(node.id, entry);
        svg.appendChild(entry.group);
      }

      entry.group.classList.toggle("active", node.isActive);
      entry.group.classList.toggle("path-node", node.isPath);
      entry.group.classList.toggle("complete-node", node.isComplete);
      entry.group.setAttribute("aria-current", node.id === activeNode.id ? "true" : "false");
      entry.group.style.transform = `translate(${node.x}px, ${node.y}px)`;
      entry.label.textContent = node.label;
    });
}

function createNodeElement(node) {
  const group = document.createElementNS(SVG_NS, "g");
  group.classList.add("mind-node", "entering");
  group.setAttribute("tabindex", "-1");

  const content = document.createElementNS(SVG_NS, "g");
  content.classList.add("node-content");

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", String(-layout.nodeWidth / 2));
  rect.setAttribute("y", String(-layout.nodeHeight / 2));
  rect.setAttribute("width", String(layout.nodeWidth));
  rect.setAttribute("height", String(layout.nodeHeight));
  rect.setAttribute("rx", "8");

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.textContent = node.label;

  content.append(rect, text);
  group.append(content);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => group.classList.remove("entering"));
  });

  return { group, label: text };
}

function syncLinks(links) {
  const liveIds = new Set(links.map((link) => link.id));

  renderedLinks.forEach((path, id) => {
    if (!liveIds.has(id)) {
      path.classList.add("leaving");
      window.setTimeout(() => {
        path.remove();
        renderedLinks.delete(id);
      }, 220);
    }
  });

  links.forEach((link) => {
    let path = renderedLinks.get(link.id);
    if (!path) {
      path = document.createElementNS(SVG_NS, "path");
      path.classList.add("mind-link", "entering");
      path.setAttribute("pathLength", "1");
      renderedLinks.set(link.id, path);
      svg.insertBefore(path, svg.firstChild);
      window.setTimeout(() => path.classList.remove("entering"), 980);
    }

    path.classList.toggle("path-link", link.isPathLink);
    path.setAttribute("d", linkPath(link.from, link.to));
  });
}

function linkPath(from, to) {
  const startX = from.x + layout.nodeWidth / 2;
  const endX = to.x - layout.nodeWidth / 2;
  const midX = startX + Math.max(36, (endX - startX) * 0.5);
  return `M ${startX} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${endX} ${to.y}`;
}

function updateControls() {
  const activeNode = preorder[activeIndex];
  counter.textContent = `${activeIndex + 1} / ${preorder.length}`;
  nodeSlider.value = String(activeIndex);
  nodeSlider.style.setProperty("--slider-progress", `${(activeIndex / (preorder.length - 1)) * 100}%`);
  sliderLabel.textContent = activeNode.label;
  prevButton.disabled = activeIndex === 0;
  nextButton.disabled = activeIndex === preorder.length - 1;
}
