# Task 3 — Canvas2d adapter pane layout + render helpers (pure)

> **Status: TODO**

## Goal

Ship the pure render-helper building blocks the next task (4)
composes into the canvas2d adapter's render loop: a pane-layout
math helper that splits a canvas into a price pane + N uniform
subpanes, a pane-clear helper that fills one rect, and a
pane-separator helper that draws the divider line between panes.
Each helper is pure on `RenderCtx` and ships with the
Phase-2-mandated unit-test layer; none of them are wired into
`createCanvas2dAdapter.ts` in this task — that's task 4.

## Prerequisites

Task 2 (runtime emits non-overlay `PlotEmission.pane` strings). The
helpers themselves don't read emissions, but the task ordering
keeps the feature shippable in halves: Task 2 + Task 3 is a no-op
visually (helpers exist but aren't called); Task 4 lights it up.

## Current Behavior

- `examples/canvas2d-adapter/src/render/` has no pane-layout
  helper. `computeViewport` (in `createCanvas2dAdapter.ts:146-188`)
  computes one viewport over the whole canvas.
- `src/render/clear.ts` provides `clear(ctx, viewport, palette)`
  that fills the full canvas (uses `viewport.pxWidth/pxHeight`).
  No pane-rect variant exists.
- No separator-line helper exists.

## Desired Behavior

- `src/render/paneLayout.ts` exports `computePaneLayout(paneOrder,
  canvas)` and the `PaneRect` / `PaneLayoutEntry` types.
  - 0 subpanes → overlay pane fills the canvas.
  - ≥ 1 subpanes → overlay pane gets the top 70%; remaining 30%
    splits uniformly across subpanes in `paneOrder` order; last
    subpane absorbs any rounding remainder so the band fills the
    canvas exactly.
  - Returns a frozen array.
- `src/render/clearPaneRect.ts` exports `clearPaneRect(ctx, rect,
  palette)` — fills the pane rect with the palette's background
  colour. Pure on `RenderCtx`; canonical call sequence pinned by
  test.
- `src/render/paneSeparator.ts` exports `drawPaneSeparator(ctx,
  rect, palette)` — draws a 1px horizontal line at `rect.y` (the
  top of the subpane). Uses the palette's grid colour.
- All three helpers are re-exported from `src/render/index.ts`.

## Requirements

### 1. `examples/canvas2d-adapter/src/render/paneLayout.ts` — new module

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const PRICE_PANE_FRACTION = 0.7;

export type PaneRect = Readonly<{
    x: number;
    y: number;
    w: number;
    h: number;
}>;

export type PaneLayoutEntry = Readonly<{
    paneKey: string;
    rect: PaneRect;
}>;

/**
 * Split a canvas into one overlay (price) pane and N uniform
 * subpanes. The overlay pane gets the top 70%; subpanes share the
 * bottom 30% in `paneOrder` order. With zero subpanes the overlay
 * pane uses the full height. The last subpane absorbs the rounding
 * remainder so the rendered band fills the canvas exactly.
 *
 * @since 0.2
 * @stable
 * @example
 *     const layout = computePaneLayout(
 *         ["overlay", "rsi"],
 *         { width: 800, height: 400 },
 *     );
 *     // layout[0].rect.h === 280
 *     // layout[1].rect.h === 120
 *     void layout;
 */
export function computePaneLayout(
    paneOrder: ReadonlyArray<string>,
    canvas: { readonly width: number; readonly height: number },
): ReadonlyArray<PaneLayoutEntry> {
    const subpaneKeys = paneOrder.filter((k) => k !== "overlay");
    if (subpaneKeys.length === 0) {
        return Object.freeze([
            {
                paneKey: "overlay",
                rect: { x: 0, y: 0, w: canvas.width, h: canvas.height },
            },
        ]);
    }
    const priceHeight = Math.floor(canvas.height * PRICE_PANE_FRACTION);
    const subpaneBand = canvas.height - priceHeight;
    const subpaneHeight = Math.floor(subpaneBand / subpaneKeys.length);
    const entries: PaneLayoutEntry[] = [
        {
            paneKey: "overlay",
            rect: { x: 0, y: 0, w: canvas.width, h: priceHeight },
        },
    ];
    let y = priceHeight;
    subpaneKeys.forEach((paneKey, i) => {
        const last = i === subpaneKeys.length - 1;
        const h = last ? canvas.height - y : subpaneHeight;
        entries.push({
            paneKey,
            rect: { x: 0, y, w: canvas.width, h },
        });
        y += h;
    });
    return Object.freeze(entries);
}
```

### 2. `examples/canvas2d-adapter/src/render/paneLayout.test.ts` — unit tests

Cases:

- `["overlay"]`, 800×400 → one entry; rect = full canvas; frozen.
- `["overlay", "rsi"]`, 800×400 → overlay h=280; subpane h=120;
  subpane y=280; total height = canvas.height.
- `["overlay", "a", "b", "c"]`, 800×400 → overlay h=280; subpanes
  ≈ 40 each; last absorbs remainder; sum of all `rect.h` === 400.
- `["overlay", "a", "b", "c", "d", "e"]`, 800×400 → overlay h=280;
  subpanes ≈ 24 each + remainder on last; sum === 400.
- `["rsi"]` (no `"overlay"` in input) — `subpaneKeys.length === 1`,
  overlay entry still emitted at index 0 with the price-pane rect;
  this is the contract the adapter relies on (the adapter ensures
  `"overlay"` is pre-seeded in `paneOrder`, but the helper itself
  is robust to absence).
- Frozen-ness: `expect(Object.isFrozen(layout)).toBe(true)`.
- `paneOrder` input order is preserved among subpanes.

### 3. `examples/canvas2d-adapter/src/render/clearPaneRect.ts` — new helper

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import type { PaneRect } from "./paneLayout.js";

/**
 * Fill a pane rect with the palette's background colour. Used by
 * the per-pane render walk to clear each pane independently before
 * drawing its content (so subpanes don't bleed into the price
 * pane and vice versa).
 *
 * @since 0.2
 * @stable
 * @example
 *     // declare const ctx: RenderCtx;
 *     // declare const palette: Palette;
 *     // clearPaneRect(ctx, { x: 0, y: 0, w: 800, h: 280 }, palette);
 */
export function clearPaneRect(
    ctx: RenderCtx,
    rect: PaneRect,
    palette: Palette,
): void {
    ctx.fillStyle = palette.background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}
```

### 4. `examples/canvas2d-adapter/src/render/clearPaneRect.test.ts`

Pin the canonical call sequence via `MockCanvas2DContext.calls`:

```ts
const ctx = new MockCanvas2DContext();
clearPaneRect(ctx, { x: 0, y: 280, w: 800, h: 120 }, palette);
expect(ctx.calls).toEqual([
    { kind: "set", prop: "fillStyle", value: palette.background },
    { kind: "fillRect", x: 0, y: 280, w: 800, h: 120 },
]);
```

Add a second case for the overlay rect (`{ x: 0, y: 0, w: 800, h:
280 }`) to cover both top + bottom rects. (One `it` is enough if
the test is parameterised, but match the file convention used by
the sibling render tests.)

### 5. `examples/canvas2d-adapter/src/render/paneSeparator.ts` — new helper

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Palette } from "../palette.js";
import type { RenderCtx } from "./clear.js";
import type { PaneRect } from "./paneLayout.js";

/**
 * Draw a 1px horizontal divider at the top of a subpane rect.
 * Visually separates the subpane from the pane above it (price
 * pane or another subpane).
 *
 * @since 0.2
 * @stable
 * @example
 *     // declare const ctx: RenderCtx;
 *     // declare const palette: Palette;
 *     // drawPaneSeparator(ctx, { x: 0, y: 280, w: 800, h: 120 }, palette);
 */
export function drawPaneSeparator(
    ctx: RenderCtx,
    rect: PaneRect,
    palette: Palette,
): void {
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + 0.5);
    ctx.lineTo(rect.x + rect.w, rect.y + 0.5);
    ctx.stroke();
}
```

`+ 0.5` keeps the line crisp on integer-aligned canvases (standard
HTML canvas half-pixel convention). `horizontalLine.ts` itself does
NOT currently use this offset for its strokes — this helper is
introducing the convention for the pane divider specifically,
because subpane dividers are visually thin and must hit a single
device pixel.

### 6. `examples/canvas2d-adapter/src/render/paneSeparator.test.ts`

Pin the canonical call sequence: set `strokeStyle`, set
`lineWidth`, `beginPath`, `moveTo`, `lineTo`, `stroke`. Use the
same `MockCanvas2DContext` pattern as sibling tests.

### 7. `examples/canvas2d-adapter/src/render/index.ts` — re-exports

Append:

```ts
export { computePaneLayout, type PaneLayoutEntry, type PaneRect } from "./paneLayout.js";
export { clearPaneRect } from "./clearPaneRect.js";
export { drawPaneSeparator } from "./paneSeparator.js";
```

### 8. `examples/canvas2d-adapter/src/render/clear.ts` — `RenderCtx` shape

`clearPaneRect` and `drawPaneSeparator` import `RenderCtx` from
`clear.ts`. The type (lines 26-47) already includes `fillStyle`,
`fillRect`, `strokeStyle`, `lineWidth`, `beginPath`, `moveTo`,
`lineTo`, `stroke` — every method these two helpers touch. **No
`translate` method exists yet** — that's required by Task 4's
render-loop rewrite (per-pane `ctx.save / translate / restore`)
and the matching `MockCanvas2DContext` extension. Task 3 does NOT
need `translate`; if Task 3 lands first, the Task-4 PR adds the
type + mock surface together. Do not pre-add `translate` here.

### Edge cases

- **Canvas height not divisible by subpane count** — remainder
  goes to the last subpane; sum of `rect.h` equals canvas.height
  exactly (test pinned).
- **No `"overlay"` in paneOrder** — helper still emits the overlay
  pane entry at index 0 sized to the price-pane fraction. The
  adapter contract (Task 4) is to pre-seed `"overlay"`, but the
  helper is forgiving.
- **Frozen output** — call sites should not mutate the layout;
  enforced by `Object.freeze` on the outer array. Individual
  entries are object-literal-frozen via the Readonly types but
  not `Object.freeze`d at runtime (the type system is the gate).
- **JSDoc gate** — every export carries `@since`, `@stable`,
  `@example`.
- **Coverage gate** — `paneLayout.ts` has two branches (0
  subpanes vs ≥ 1); both covered. The `forEach` + `last`
  conditional is covered by the multi-subpane cases.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/render/paneLayout.ts` | Create | Layout math helper + types |
| `examples/canvas2d-adapter/src/render/paneLayout.test.ts` | Create | Layout cases for 0/1/3/5 subpanes + remainder |
| `examples/canvas2d-adapter/src/render/clearPaneRect.ts` | Create | Pane-bound clear helper |
| `examples/canvas2d-adapter/src/render/clearPaneRect.test.ts` | Create | Canonical call sequence |
| `examples/canvas2d-adapter/src/render/paneSeparator.ts` | Create | 1px separator line |
| `examples/canvas2d-adapter/src/render/paneSeparator.test.ts` | Create | Canonical call sequence |
| `examples/canvas2d-adapter/src/render/index.ts` | Modify | Re-export new helpers + types |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F chartlang-example-canvas2d-adapter test` (coverage 100%)
- `pnpm docs:check`

## Changeset

`.changeset/subpane-3-canvas2d-helpers.md` — the canvas2d adapter
package is private; include unscoped entry for the changelog
stream. No semver impact on published packages.

## Acceptance Criteria

- `computePaneLayout` returns the correct rects for 0 / 1 / 3 / 5
  subpanes; remainder lands on the last subpane; output is frozen.
- `clearPaneRect` emits the pinned `(set fillStyle, fillRect)`
  call sequence for arbitrary rects.
- `drawPaneSeparator` emits the pinned stroke sequence at
  `rect.y + 0.5`.
- All three helpers are re-exported from `src/render/index.ts`.
- Coverage stays at 100% on `chartlang-example-canvas2d-adapter`.
- `pnpm docs:check` green.
- Changeset committed.
