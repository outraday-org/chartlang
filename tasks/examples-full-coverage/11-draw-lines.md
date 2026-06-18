# Draw — Lines & Rays

> **Status: TODO**

## Goal

One runnable example per line/ray `draw.*` kind, category `draw-lines`,
wired into `examples/scripts/`, the catalogue, demo, and docs; shrink
the coverage allowlist by these ids.

## Prerequisites

Tasks 1 and 2.

## Authoring playbook (draw.* — applies to Tasks 11–18)

Each example is `examples/scripts/<id>.chart.ts` following the base
rules in [Task 3](./3-ta-moving-averages.md) (MIT header; top-level
imports + destructured `compute({ bar, draw, … })`;
`defineIndicator({ apiVersion: 1, … })`; compiles clean + runs without
throwing; per-id catalogue entry + allowlist removal +
`pnpm examples:generate` + `pnpm examples:coverage`). Drawing examples
are `overlay: true`.

**Anchor construction (the core draw concern):**

- `draw.*` kinds take coordinate anchors `{ time, price }`. Build them
  from `bar.point(offset, price)` (the offset-anchored historical /
  future timestamp helper used in `pivot-high-ray.chart.ts` and
  `forecast-line.chart.ts`) or from tracked `state.*` swing points —
  **never** hardcode absolute epoch timestamps (they would fall off the
  demo's candle window).
- Anchor each example to data-derived points: e.g. a recent
  `ta.pivotsHighLow` swing, an EMA-slope projection, or fixed negative
  offsets from the current bar (`bar.point(-30, …)` … `bar.point(0, …)`).
- **Reuse one drawing handle** across bars where the kind is a single
  persistent object (store the handle in a `state` slot and update it),
  matching the `draw.horizontalRay` reuse pattern in `pivot-high-ray`.
  This keeps the per-bar emit count bounded.
- Consult each kind's `docs/primitives/draw/<kebab>.md` page for its
  exact required anchor count and option shape, and mirror it. The
  canonical primitive id is `draw.<camelKind>` (kebab → camelCase).

## Primitives

| Primitive id | Kind | Example concept |
|--------------|------|-----------------|
| `draw.line` | line | Trendline between two recent swing points. |
| `draw.arrow` | arrow | Arrow from a pivot low to current bar. |
| `draw.horizontalLine` | horizontal-line | Horizontal level at last swing high. |
| `draw.horizontalRay` | horizontal-ray | covered (`pivot-high-ray`) — verify; if covered, skip. |
| `draw.verticalLine` | vertical-line | Vertical marker at a detected event bar. |
| `draw.crossLine` | cross-line | Cross-hair at the latest pivot. |
| `draw.trendAngle` | trend-angle | Angled trend line with measured slope. |
| `draw.sineLine` | sine-line | Sine-wave line over a fixed range. |
| `draw.polyline` | polyline | Multi-point polyline through recent pivots. |
| `draw.path` | path | Open path through several anchor points. |

> If `draw.horizontalRay` is already covered by the migrated
> `pivot-high-ray` example, it will already be absent from the
> allowlist — skip it. Author only ids still in the allowlist.

> **Conditional — `draw.fillBetween` (cross-feature).** The in-flight
> `tasks/draw-fill-between/` feature lands a **new** primitive +
> `docs/primitives/draw/fill-between.md` page. If that feature has
> merged, the Task-1 gate auto-requires a `draw.fillBetween` example
> (and the id appears in the allowlist). Cover it **here**, in the
> "lines/fills" bucket: do **not** author a new script — fold in the
> `examples/scripts/fill-between-band.chart.ts` that `draw-fill-between`
> Task 5 already authors, and add an `ExampleMeta`
> `{ id: "fill-between-band", category: "draw-lines",
> primitives: ["draw.fillBetween"], … }` to this fragment. If
> `fill-between.md` does **not** exist (this feature runs first), the id
> is not a gate target — skip it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (≈9–10) | Create | One per uncovered kind. |
| `examples/catalogue/draw-lines.ts` | Create (own) | Add entries. |
| `examples/coverage-allowlist.json` | Modify | Remove these ids. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate`. |
| `docs/examples/<id>.md` | Regenerate | `examples:generate`. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm examples:gate`,
`pnpm examples:coverage`.

## Changeset

`.changeset/examples-draw-lines.md` — **patch**.

## Acceptance Criteria

- One compiling, runtime-clean example per uncovered kind, each anchored
  via `bar.point` / tracked state (no hardcoded epochs) and reusing one
  handle where applicable; catalogue + allowlist updated; generators
  re-run; gates green.
