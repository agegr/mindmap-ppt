---
name: mindmap-ppt-builder
description: Create or update content for the agegr/mindmap-ppt static presentation project from a prose draft, article, speech, report, or notes. Use when Codex needs to turn a written document into the project's project/source.js Markdown mind-map data, choose which nodes need illustrations, generate or request GPT Image 2 illustrations matching the project's restrained presentation style, place assets under project/, and validate the result with npm run check.
---

# Mindmap PPT Builder

## Goal

Turn a user-provided source document into a presentation-ready `project/source.js` for this repo. The source document may be pasted text in the conversation or a local text/Markdown file path supplied by the user. The output is a preorder mind-map: concise two-line nodes, optional node images, and local assets that match the current light PPT style.

Read `references/project-format.md` when you need exact project file conventions or visual constraints.

## Workspace Requirement

Use this skill inside the `agegr/mindmap-ppt` repository root.

- If the current directory already contains `package.json`, `index.html`, `src/`, and `project/`, treat it as the repo root.
- If the repo is not present, clone `https://github.com/agegr/mindmap-ppt` into the current working directory as a folder named `mindmap-ppt`, then enter that folder.
- If a `mindmap-ppt` path already exists but is not this repo, stop and ask the user where to place the clone.
- Keep the application repository outside the skill folder. Do not copy or clone `index.html`, `src/`, or `project/` into `.agents/skills/mindmap-ppt-builder/`.
- Normal skill output should modify only `project/source.js` and local asset files under `project/`.
- Do not delete existing project assets unless the user explicitly asks for cleanup.
- Do not edit `src/`, `index.html`, or application behavior unless the user explicitly asks for implementation changes.

## Workflow

1. Get the user's source document:
   - Use pasted text from the conversation when provided.
   - If the user gives a local file path, read only that explicitly provided document file and use its contents.
   - If neither pasted text nor a readable local file is available, ask the user for the document before generating `project/source.js`.
2. Read the document and identify the presentation thesis.
   - Follow the source language by default: Chinese input -> Chinese output; English input -> English output.
   - For English output, still use an eyebrow/headline structure for two-line nodes when natural.
   - Do not silently correct facts. If the source has obvious contradictions or questionable claims, preserve the claim carefully or mention the conflict to the user.
   - For very long documents, preserve the original chapter structure first. If the material is too broad to reduce confidently, draft a high-level outline and ask the user to confirm priorities before finalizing.
3. Build a clear logic tree:
   - root: document/source name or presentation topic
   - major branches: usually 2-4 sections, but follow the source logic when another structure is clearer
   - child nodes: use them for causes, consequences, evidence, examples, process steps, contrasts, or supplements
   - depth: add levels only when nesting makes the author's logic easier to understand
4. Write each node as one unordered-list item plus an optional continuation line:

```md
- 副标题
  主标题
```

Use the first line as a short category label and the second line as the main message. Keep each line under about 30 Chinese characters or 8 English words. Prefer two-line labels for all visible nodes; use a single-line node only when the label is already extremely short and clear.

5. Choose image nodes sparingly:
   - Node images are optional.
   - A mind-map necessarily omits a lot of source detail; use images to preserve or explain the omitted detail on high-information nodes.
   - Pick 3-8 high-information nodes for a typical deck; short drafts may use 0-2 images.
   - Prefer nodes that summarize a process, architecture, comparison, timeline, metric, or conceptual model.
6. Generate illustrations for chosen nodes with GPT Image 2 or the available image generation tool. Save them under `project/` or a subfolder of `project/`.
   - Prefer PNG for generated raster illustrations, SVG for simple diagram placeholders, and JPG only for photo-like assets.
   - If image generation is unavailable, either omit images or create simple SVG placeholder diagrams under `project/` using the same restrained palette. Use 16:10 composition, no text inside images, and descriptive kebab-case filenames such as `project/demo-flow.svg`.
7. Reference images in Markdown metadata lines:

```md
  @image process-overview.png
```

8. Replace `project/source.js` with:

```js
export const sourceMarkdown = `
- ...
`;
```

Escape backticks and `${...}` sequences before writing user-derived text inside the JavaScript template string.

9. Run `npm run check`.
10. Optional visual validation: run `npm run dev` and inspect `http://127.0.0.1:5173/` when browser inspection is available.

## Mindmap Authoring Rules

- Do not force every deck into a strict `root -> level 1 -> level 2 -> level 3` taxonomy. That shape is only a useful default, not a rule.
- Let the hierarchy express the author's logic structure. If cause A leads to result B, B can be a child node of A; if B further leads to result C, form an `A -> B -> C` subtree.
- The only hard principle is clarity: a reader should understand why each child node belongs under its parent and what relationship is being expressed.
- Follow the source order. This app reveals nodes in preorder: parent first, then all children. Do not move conclusions from later text into earlier parent labels.
- Do not repeat the root topic in child nodes. If the root already states the problem or theme, children should advance the story.
- Group nearby meanings under one parent. Keep backgrounds, criteria, risks, product/tool inventories, recommendations, and conclusions in their own coherent branches.
- Main nodes carry judgments; child nodes carry evidence, reasons, examples, or supplements. If a node explains another node, make it a child, not a sibling.
- Keep each parent to at most 5 children. If there are more, add grouping nodes.
- Split tools/products only when the source analyzes them one by one. Merge them when the source merely lists options in passing.
- Do not split sentence by sentence. One node should carry one complete small point.
- Each node should correspond to about 10-80 Chinese characters of source material. Less than 10 is usually too fragmented; more than 80 usually needs splitting.
- Node text may be slightly longer than a normal title, but one node should not contain multiple independent ideas.
- Parent labels should summarize and navigate; child labels should reveal specifics. Avoid parent labels that spoil later details.
- Put images on high-information nodes, such as framework, comparison, inventory, recommendation, or risk-model nodes. Avoid images on very small detail nodes.

## Markdown And Image Example

Use `@image` as a metadata continuation line after the node's visible two-line label. The `@image` line is not displayed as node text.

```js
export const sourceMarkdown = `
- 产品发布
  三分钟讲清楚新功能
  @image overview.png
    - 用户痛点
      当前流程成本很高
      @image image-asset-1/pain-points.jpg
    - 解决方案
      自动整理文稿和插图
    - 演示效果
      像 PPT 一样逐步展开
      @image diagrams/demo-flow.svg
`;
```

Image paths are relative to `project/` by default:

- `@image overview.png` -> `./project/overview.png`
- `@image image-asset-1/pain-points.jpg` -> `./project/image-asset-1/pain-points.jpg`
- `@image diagrams/demo-flow.svg` -> `./project/diagrams/demo-flow.svg`

## Image Prompt Pattern

Use this style prompt for GPT Image 2:

```text
Create a clean presentation illustration for a light PPT mind-map node.
Subject: <node main idea>.
Include: <2-4 concrete visual elements from the source text>.
Style: restrained vector-like editorial illustration, warm off-white background, dark teal #183a4a, muted green #eef7f3, orange accent #d8894f, simple geometric shapes, thin shadows, small 8px-radius card-like forms, no photorealism, no text, no logos, no busy decorations.
Composition: centered, generous whitespace, readable at thumbnail size, aspect ratio 16:10.
```

If the source needs a real chart, diagram, or screenshot, create a simple diagrammatic illustration instead of inventing precise numbers. Do not put text in images; labels belong in nodes.

## SVG Placeholder Pattern

When no image-generation tool is available but an illustration is still useful, a simple SVG placeholder is acceptable:

- Size: `1280x800`.
- Style: warm off-white background, dark teal `#183a4a`, muted green `#eef7f3`, orange accent `#d8894f`.
- Content: abstract process blocks, arrows, cards, or timeline shapes based on the node idea.
- No readable text, logos, dense decoration, or photorealism.

## Authoring Rules

- Preserve the user's argument. Do not flatten important causal relationships into generic slogans.
- Keep the preorder reveal useful: each next node should add a clear idea.
- Use `@image` only after the node's title line, before its children.
- Use PNG, JPG/JPEG, or SVG assets.
- Save image files under `project/` or a subfolder of `project/`.
- Prefer short `@image` values relative to `project/`, e.g. `@image user-journey.png`, `@image diagrams/user-journey.png`, or `@image image-asset-1/a.jpg`.

## Validation Checklist

- `project/source.js` exports `sourceMarkdown`.
- Asset files exist for every `@image`.
- `npm run check` passes.
