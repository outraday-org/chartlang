# Konva adapter: drawings + conformance

> **Status: TODO**

## Goal

Complete the Konva adapter: render all 63 drawing kinds by mapping
`decomposeDrawing(emission, viewport)` → Konva nodes
(`Line`/`Rect`/`Text`/`Arc`/`Path`) on a dedicated drawings layer, using
the adapter's self-computed overlay `Viewport`. Add the recorded-node
integration test, wire conformance, ship README + docs.

## Prerequisites

- Task 11 (Konva scaffold + series + self-computed viewport).
- Tasks 1–3.

## Current Behavior

After Task 11 the adapter renders candles/plots/panes and buffers drawings
without rendering them.

## Desired Behavior

Drawings render as Konva nodes on the drawings layer; adapter is
full-surface, conformance-green.

## Requirements

### 1. Primitive → Konva node mapper — `src/primitiveToNode.ts`

Konva is scene-graph, not ctx — map the IR to nodes (`konva` injected via
the factory seam so the mock works):

```ts
import type { DrawPrimitive } from "@invinite-org/chartlang-adapter-kit";

export function primitiveToNode(K: KonvaLike, p: DrawPrimitive): KonvaNode {
    switch (p.kind) {
        case "polyline": return new K.Line({
            points: p.points.flatMap(pt => [pt.x, pt.y]),
            closed: p.closed,
            stroke: p.stroke?.color, strokeWidth: p.stroke?.width,
            dash: p.stroke?.dash?.length ? p.stroke.dash : undefined,
            opacity: p.stroke?.alpha,
            fill: p.fill?.color,  // Konva fills closed lines
        });
        case "arc":   return new K.Arc({ x: p.cx, y: p.cy, innerRadius: p.r, outerRadius: p.r,
                                  angle: ..., rotation: ..., stroke: ... });   // or K.Path for partial arcs
        case "text":  return new K.Text({ x: p.x, y: p.y, text: p.text, fill: p.color,
                                  // font parsed from p.font; align/baseline → offset
                                });
        case "marker": return markerNode(K, p);   // small Line/Rect/Circle per shape
    }
}
```

Honor dash, alpha (`opacity`), fill, and text background (a backing
`K.Rect` or `K.Label`+`K.Tag`). Konva positions in pixels — exactly what
`decomposeDrawing` produces.

### 2. Render drawings — extend `createKonvaAdapter`

On each drain, rebuild the drawings layer:

```ts
import { decomposeDrawing } from "@invinite-org/chartlang-adapter-kit";

drawingsLayer.destroyChildren();
const view = overlayViewport(state);   // from Task 11 paneLayout
for (const d of state.drawings.values()) {
    if (d.op === "remove") continue;
    for (const prim of decomposeDrawing(d, view)) {
        drawingsLayer.add(primitiveToNode(state.konva, prim));
    }
}
drawingsLayer.batchDraw();
```

### 3. Integration test — `src/integration.test.ts`

Inline indicator emitting plots + drawings, driven through the factory
with `MockKonva`; assert the recorded node tree for representative kinds
(line→Line, rectangle→closed Line, fib→multiple Lines+Texts, marker), with
a stable hash (4-dp float canonicalisation via the adapter-kit canonicaliser).

### 4. Conformance test — `src/conformance.test.ts`

`runConformanceSuite(default)` → `failed === 0`.

### 5. README + docs

- `README.md` (≤ 100 lines): purpose, install, public surface,
  node-mapping note, license, "interactive-drawings follow-up" pointer.
- `docs/adapters/reference/konva.md` (per-library pages live under
  `docs/adapters/reference/`, matching the established vitepress
  convention; Task 13 wires the nav).

### Edge cases

- `op: "remove"` skipped; layer rebuilt each drain (matches canvas2d
  stateless redraw).
- NaN anchors → skip node (filter non-finite points) — document divergence
  from ctx no-op.
- Closed vs open polyline → `closed: true/false`.
- `arc` partial sweeps may need `K.Path` (`A` arc command) rather than
  `K.Arc`; pick per primitive and document.
- Text align/baseline → Konva `offsetX/offsetY` (Konva has no native
  baseline) — port the mapping from `paintPrimitive`'s text handling.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `.../src/primitiveToNode.ts` (+test) | Create | IR → Konva node |
| `.../src/createKonvaAdapter.ts` | Modify | rebuild drawings layer from `decomposeDrawing` |
| `.../src/integration.test.ts` | Create | hashed node-tree integration |
| `.../src/conformance.test.ts` | Create | conformance green |
| `.../README.md` | Modify | full surface docs |
| `docs/adapters/reference/konva.md` | Create | adapter guide |
| `examples/konva-adapter/CLAUDE.md` | Modify | node-mapping; arc/text caveats |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm conformance`
- `pnpm docs:check` / `pnpm readme:check`

## Changeset

Private example → no public changeset (patch if repo changesets privates).

## Acceptance Criteria

- All 63 drawings map to Konva nodes via
  `decomposeDrawing`+`primitiveToNode`; hashed integration test pinned.
- `runConformanceSuite(default)` → `failed === 0`.
- README ≤ 100 lines; docs page added; CLAUDE.md updated.
- 100% coverage; all gates green.
