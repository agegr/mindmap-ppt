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

- If the repository is not available locally, clone `https://github.com/agegr/mindmap-ppt` into the current working directory by default, then enter the cloned repo.
- After cloning or opening the repo, run this skill from the repo root that contains `package.json`, `index.html`, `src/`, and `project/`.
- Keep the application repository outside the skill folder. Do not copy or clone `index.html`, `src/`, or `project/` into `.agents/skills/mindmap-ppt-builder/`.
- Normal skill output should modify only `project/source.js` and local asset files under `project/`.
- Do not edit `src/`, `index.html`, or application behavior unless the user explicitly asks for implementation changes.

## Workflow

1. Get the user's source document:
   - Use pasted text from the conversation when provided.
   - If the user gives a local file path, read that file and use its contents.
   - If neither pasted text nor a readable local file is available, ask the user for the document before generating `project/source.js`.
2. Read the document and identify the presentation thesis.
3. Build a shallow tree:
   - root: document/source name or presentation topic
   - level 1: 2-4 major sections
   - level 2: 2-4 subpoints per section
   - level 3: only when needed for concrete examples, evidence, or workflow steps
4. Write each node as one unordered-list item plus an optional continuation line:

```md
- 副标题
  主标题
```

Use the first line as a short category label and the second line as the main message. Keep each line under about 30 Chinese characters or 8 English words.

5. Choose image nodes sparingly:
   - Node images are optional.
   - A mind-map necessarily omits a lot of source detail; use images to preserve or explain the omitted detail on high-information nodes.
   - Pick 3-8 high-information nodes for a typical deck.
   - Prefer nodes that summarize a process, architecture, comparison, timeline, metric, or conceptual model.
   - Do not image every leaf.
   - Avoid images for purely transitional or obvious nodes.
6. Generate illustrations for chosen nodes with GPT Image 2 or the available image generation tool. Save them under `project/` or a subfolder of `project/`.
   - If API details are needed, consult current official OpenAI image generation docs before writing code or commands.
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

9. Run `npm run check`.
10. If possible, run or refresh the local page and inspect several early, middle, and late preorder nodes.

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

## Authoring Rules

- Preserve the user's argument. Do not flatten important causal relationships into generic slogans.
- Keep the preorder reveal useful: each next node should add a clear idea.
- Put implementation details and examples in leaves; put conclusions in ancestors.
- Use `@image` only after the node's title line, before its children.
- Use PNG, JPG/JPEG, or SVG assets.
- Save image files under `project/` or a subfolder of `project/`.
- Prefer short `@image` values relative to `project/`, e.g. `@image user-journey.png`, `@image diagrams/user-journey.png`, or `@image image-asset-1/a.jpg`.
- If no image-generation tool is available, still add good `@image` filenames only if you create placeholder assets; otherwise omit `@image` and tell the user images were not generated.

## Validation Checklist

- `project/source.js` exports `sourceMarkdown`.
- Markdown indentation uses 4 spaces per level for child nodes.
- Continuation lines use the same indentation as metadata/text for that node.
- `@image` values are short paths relative to `project/`, unless a full URL or explicit relative path is required.
- Asset files exist for every `@image`.
- Root has two lines: eyebrow/subtitle then main title.
- `npm run check` passes.
