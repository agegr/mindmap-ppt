# AGENTS.md

## Project Overview

This is a small static front-end demo for a PPT-like animated mind map.

- Input data is an unordered-list Markdown tree embedded in `src/main.js`.
- The tree is traversed in preorder.
- The visible graph is rendered with SVG.
- The UI is plain HTML/CSS/JS, with no build step or runtime dependencies.

## Running And Checking

- Start local dev server: `npm run dev`
- Syntax check: `npm run check`
- Dev URL: `http://127.0.0.1:5173/`

The dev server is a Python static server. If `5173` is occupied by a stale process, restart that process before validating in the browser.

## Core Files

- `index.html`: page shell and top controls.
- `src/main.js`: Markdown parsing, preorder navigation, layout model, SVG DOM sync.
- `src/styles.css`: page styling, node/link styling, slider styling, animations.
- `p.md`: original product prompt/spec.

## Interaction Rules

- Up/down arrow keys move to previous/next preorder node.
- Top arrow buttons do the same.
- The range slider jumps directly to a preorder index.
- Slider label shows the currently selected node label.

Keep all navigation paths going through `setActiveIndex()` so buttons, keyboard, slider, graph, and counter stay synchronized.

## Layout Rules

- The current path from `root` to selected node is horizontal.
- Already visited but non-path branches appear above their parent and preserve tree structure.
- Unvisited nodes are completely hidden and occupy no layout space.
- The horizontal selected path should stay visually stable.
- The SVG camera uses a fixed close view:
  - `layout.viewWidth = 960`
  - `layout.viewHeight = 620`
  - `layout.centerBaseline = 520`
- Completed branches are allowed to exceed the viewport and be clipped. Do not enlarge the `viewBox` to fit them, because that makes later nodes look smaller.

## Animation Rules

- Node content is wrapped as:

```svg
<g class="node-content">
  <rect />
  <text />
</g>
```

- New nodes use a simple transition-based pop:
  - entering state: `scale(0.58)`, `opacity: 0`
  - active selected state: `scale(1.15)`, `opacity: 1`
  - normal unselected state: `scale(1)`
- Do not reintroduce keyframe-based transform fill for node pop. It previously prevented selected nodes from animating back down to normal size.
- Selected nodes keep a stable orange glow via `drop-shadow`; do not use a spreading ring effect unless explicitly requested.
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
