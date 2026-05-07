# AGENTS.md

## Project Overview

This is a small static front-end demo for a PPT-like animated mind map.

- Input data is an unordered-list Markdown tree embedded in `src/main.js`.
- The tree is traversed in preorder.
- Nodes are rendered as HTML elements so their boxes can grow to contain text.
- Links are rendered as SVG curves behind the HTML nodes.
- The UI is plain HTML/CSS/JS, with no build step or runtime dependencies.

## Markdown Data Rules

- Each tree node is one unordered-list Markdown item.
- A list item may use an indented continuation line for a two-line label:

```md
- Markdown Mindmap
  项目汇报思维导图演示
    - 需求分析
      用户目标与演示场景
```

- For two-line labels, the first line is the subtitle and the second line is the main title.
- The top-left deck heading uses the root node the same way:
  - root first line -> eyebrow/subtitle
  - root second line -> main title
- Node boxes also use the same two-line convention:
  - first line -> small subtitle
  - second line -> normal-size title
- Single-line labels render as a normal one-line node title.
- Control readouts may collapse multiline labels into an inline preview such as `副标题 / 主标题`.
- A node may optionally attach one illustration with an `@image` metadata continuation line:

```md
- 展示设计
  画布布局与动画策略
  @image ./assets/illustrations/layout.svg
```

- `@image` lines are metadata only:
  - They do not appear in node text.
  - A node may have at most one image.
  - Supported image formats are whatever browser `<img>` supports; use PNG, JPG/JPEG, or SVG for project assets.
  - Prefer local project-relative paths such as `./assets/illustrations/example.svg`, `./assets/illustrations/example.png`, or `./assets/illustrations/example.jpg`.
  - If multiple `@image` lines are added to one node, the latest parsed value wins.
- Illustrations render inside their node card:
  - selected image nodes show the image expanded below the node text
  - non-selected image nodes show a small thumbnail below the node text
  - nodes without `@image` do not reserve image space
- Image expansion follows the real selected preorder node only. Clicking a node to move the camera must not expand its image unless it also changes `activeIndex`.

## Running And Checking

- Start local dev server: `npm run dev`
- Syntax check: `npm run check`
- Dev URL: `http://127.0.0.1:5173/`

The dev server is a Python static server. If `5173` is occupied by a stale process, restart that process before validating in the browser.

## Core Files

- `index.html`: page shell and top controls.
- `src/main.js`: Markdown parsing, preorder navigation, layout model, HTML node sync, SVG link sync.
- `src/styles.css`: page styling, node/link styling, slider styling, animations.
- `assets/illustrations/`: optional local illustration assets referenced by `@image`.
- `p.md`: original product prompt/spec.

## Interaction Rules

- Up/down arrow keys move to previous/next preorder node.
- Top arrow buttons do the same.
- The range slider jumps directly to a preorder index.
- The second control row shows the current node label and next node label.
- Clicking a visible node moves the camera to that node's current-layout position without changing the selected node or expanded image.

Keep all navigation paths going through `setActiveIndex()` so buttons, keyboard, slider, graph, and counter stay synchronized.

## Layout Rules

- The current path from `root` to selected node is horizontal.
- Already visited but non-path branches appear above their parent and preserve tree structure.
- Unvisited nodes are completely hidden and occupy no layout space.
- The horizontal selected path should stay visually stable.
- The camera uses a fixed close view:
  - `layout.viewWidth = 960`
  - `layout.viewHeight = 620`
  - `layout.centerBaseline = 520`
- Completed branches are allowed to exceed the viewport and be clipped. Do not enlarge the camera view to fit them, because that makes later nodes look smaller.
- When long path labels push leaf nodes toward the right edge, the camera should shift right and clip older left-side nodes so the selected node remains fully visible.
- Image nodes participate in normal layout. The node box must grow to contain the thumbnail or expanded image.
- Expanded images may increase node height; camera logic should keep the selected node fully visible vertically and horizontally.
- SVG links should connect from node border to node border, using the full node box dimensions.
- Node images should use `object-fit: contain` so oversized images shrink to the configured thumbnail/expanded bounds without cropping.
- Image expand/collapse should be animated smoothly when selection changes. Preserve CSS transitions for the image container size and image transform.
- Do not rebuild the node image DOM on every render; reuse stable `img` elements and toggle classes so browser transitions can interpolate thumbnail-to-expanded size changes.

## Animation Rules

- Node content is HTML and is wrapped as:

```html
<div class="mind-node">
  <div class="node-content">
    <span class="node-subtitle"></span>
    <span class="node-title"></span>
  </div>
</div>
```

- New nodes use a simple transition-based pop:
  - entering state: `scale(0.58)`, `opacity: 0`
  - active selected state: `scale(1.15)`, `opacity: 1`
  - normal unselected state: `scale(1)`
- Do not reintroduce keyframe-based transform fill for node pop. It previously prevented selected nodes from animating back down to normal size.
- Selected nodes keep a stable orange glow via box-shadow; do not use a spreading ring effect unless explicitly requested.
- Link reveal animation is still keyframe-based and should be preserved:
  - `pathLength="1"` in JS
  - `link-draw` in CSS

## Important Edge Cases

- Rapid navigation with the slider can expose delayed-removal races. If editing `syncNodes()` or `syncLinks()`, be careful with timeout-based removals:
  - Clear pending removal timers when an item becomes visible again, or
  - Check that the item is still not live inside the timeout before removing it.
- For a one-node tree, slider progress must not divide by zero. Guard `preorder.length - 1` if making the demo data configurable.

## Style Notes

- Keep the visual style light, presentation-friendly, and restrained.
- Existing palette:
  - dark selected node: `#183a4a`
  - orange accent: `#d8894f`
  - completed node fill: `#eef7f3`
  - path node fill: `#fffdf8`
- Cards and buttons use small `8px` radii.
- Avoid adding heavy decorative effects or large layout shifts.

## Development Notes

- Prefer editing with `apply_patch`.
- Keep the app dependency-free unless there is a clear reason to add tooling.
- Browser cache can retain old `src/main.js` because it is loaded as a module. If a normal refresh looks stale, use a hard refresh.
