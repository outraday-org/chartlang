# Categorized Demo Dialog & Docs Grouping

> **Status: TODO**

## Goal

Replace the flat `<select>` in the live demo with a "Browse examples"
button that opens a modal dialog: a left sidebar of categories and a
right pane listing the examples in the selected category (label +
description). Group the VitePress Examples sidebar by the same
categories. This makes the ~192-entry catalogue navigable. No primitive
examples are added here — this task only changes how the catalogue is
presented.

## Prerequisites

Task 1 (the `category` field on `DemoScript` + `CATEGORY_LABELS` /
`CATEGORY_ORDER` exports).

## Current Behavior

`apps/site/src/components/demo/DemoBody.tsx` renders a single
`<select>` over `DEMO_SCRIPTS` (lines ~103–117). `?script=<id>`
preselects an entry. The VitePress Examples sidebar
(`docs/.vitepress/config.ts`) is a flat `DEMO_SCRIPTS.map(...)`.

## Desired Behavior

- A "Browse examples" trigger button shows the current example's label
  and a count (e.g. "EMA Cross · 192 examples"). Clicking opens a modal.
- The modal has a left sidebar listing categories in `CATEGORY_ORDER`
  (using `CATEGORY_LABELS`), each with a count — `complex` (the curated
  showcase demos) sorts first; selecting one filters
  the right pane to that category's examples. Selecting an example sets
  the active script (same effect as the old `<select>` onChange:
  `setScriptId`, clear alerts + artifact) and closes the dialog.
- `?script=<id>` deep-linking still works and opens the demo on that
  example (dialog closed, that example active). The category of the
  deep-linked example is pre-highlighted when the dialog is next opened.
- Keyboard + a11y: dialog is focus-trapped, `Esc` closes, the trigger
  is a real `<button>`, options are keyboard-navigable. There is
  currently **no** `apps/site/src/components/ui/` dialog primitive, so
  the expected path is a minimal accessible native `<dialog>` element —
  do **not** add a new dialog dependency. (If a shared dialog primitive
  has since been added under `src/components/`, reuse it instead.)

## Requirements

### 1. Dialog component

- Add `apps/site/src/components/demo/ExampleBrowser.tsx` (2-space
  indent, no semicolons — `apps/**` Biome convention per `apps/CLAUDE.md`;
  MIT header required).
- Props: `{ scripts: ReadonlyArray<DemoScript>; activeId: string;
  onSelect: (id: string) => void }`.
- Derive the category list from `CATEGORY_ORDER`, counting
  `scripts.filter((s) => s.category === c)`. Skip empty categories
  (defensive — during population some categories fill in later).
- Internal state: `open`, `activeCategory` (defaults to the active
  script's category).

### 2. Wire into `DemoBody.tsx`

- Replace the `<label><select>…</select></label>` block with the
  `ExampleBrowser` trigger; keep the surrounding flexbox layout and the
  existing `setScriptId`/`setAlerts`/`setArtifact` reset semantics.
- Keep the `?script=` param logic (`pickInitialScript`) intact.

### 3. Styling

- Add styles to `apps/site/src/components/demo/demo.css` (sidebar +
  list + selected states), reusing existing CSS variables
  (`--border`, `--muted`, `--foreground`) for theme parity. No new
  global CSS.

### 4. VitePress sidebar grouping

- In `docs/.vitepress/config.ts`, group the `/examples/` sidebar by
  `CATEGORY_ORDER`: one collapsible section per non-empty category
  (text = `CATEGORY_LABELS[c]`), items = that category's examples
  (`{ text: label, link: /examples/<id> }`), preceded by the existing
  "Overview" → `/examples/`. Import `CATEGORY_LABELS`/`CATEGORY_ORDER`
  from the same `scripts.ts` re-export (keep it a pure module — no
  React import leak into the VitePress config).

### 5. Playwright

- Update `apps/site/tests/` demo specs: opening the browser dialog,
  selecting a category, picking an example switches the editor source;
  `?script=<id>#demo` still deep-links and renders. Keep the existing
  "clean gutter" / compile assertions.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/src/components/demo/ExampleBrowser.tsx` | Create | Category dialog. |
| `apps/site/src/components/demo/DemoBody.tsx` | Modify | Swap `<select>` for the dialog trigger. |
| `apps/site/src/components/demo/demo.css` | Modify | Dialog + sidebar styles. |
| `docs/.vitepress/config.ts` | Modify | Group Examples sidebar by category. |
| `apps/site/tests/*demo*.spec.ts` | Modify | Cover the dialog flow + deep-link. |

## Gates

- `pnpm typecheck`
- `pnpm lint` (note: Biome ignores `apps/**`; lint the docs config change)
- `apps/site` Playwright suite green
- `pnpm docs:build` succeeds (VitePress config valid)
- No coverage/README/changeset gate for `apps/**` (per `apps/CLAUDE.md`);
  the `docs/.vitepress/config.ts` change needs no changeset.

## Changeset

None required (touches only `apps/site` (private) + `docs` config). If
the lint/CI aggregate expects a changeset for the repo, add an empty
`.changeset/` note `examples-demo-dialog.md` with no package bump.

## Acceptance Criteria

- Demo shows a "Browse examples" dialog with a left category sidebar;
  selecting an example switches the script exactly as the old select did.
- `?script=<id>#demo` deep-link still works and renders clean.
- VitePress Examples sidebar is grouped by category and builds.
- Playwright demo specs updated and green.
