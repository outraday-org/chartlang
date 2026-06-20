# Task 5 — Example script, demo entry, changeset, CLAUDE.md sweep

> **Status: TODO**

## Goal

Surface `draw.fillBetween` to users: ship an author example script, a
live demo entry (which regenerates the docs Examples page), the single
feature changeset, and finish the cross-folder CLAUDE.md sweep.

## Prerequisites

Tasks 1–4. Task 2 makes the primitive callable so the example compiles
and the demo renders; Task 3 determines the converter package changeset;
Task 4 keeps all user-facing docs consistent before the final sweep.

## Current Behavior

No example, demo, or changeset references `draw.fillBetween`.

> **Cross-feature note (`tasks/examples-full-coverage/`).** `draw.fillBetween`
> is a **new primitive**, so it generates a new `docs/primitives/draw/fill-between.md`
> page. The `examples-full-coverage` coverage gate enumerates the required
> example set directly from that `docs/primitives/**` tree, so once this
> primitive lands the gate **auto-requires** a `fill-between` example —
> but no draw-family task there owns it (those lists predate the
> primitive). Two consequences:
> - If `examples-full-coverage` Task 1 has **already** landed, its
>   `scripts.ts` is **generated** from `examples/catalogue.ts` — do **not**
>   hand-add a `FILL_BETWEEN_BAND` constant to `scripts.ts` (req 2 below);
>   instead add the `.chart.ts` + a `examples/catalogue/<draw-fills>.ts`
>   fragment entry (category in the draw `polylines`/fills bucket), then
>   run `pnpm examples:generate`. The hand-edited constant would be
>   overwritten by the generator.
> - Either way, the `fill-between-band` script authored here is the one
>   `examples-full-coverage` should catalogue for `fill-between` coverage —
>   it should fold this script in, not author a second example.

## Desired Behavior

- An `examples/scripts/*.chart.ts` band example listed in the CLI e2e
  gate.
- A `DEMO_SCRIPTS` entry whose regenerated `docs/examples/<id>.md` is
  committed.
- One changeset bumping every published package this feature touches.
- All remaining CLAUDE.md files updated.

## Requirements

### 1. Example script (`examples/scripts/fill-between-band.chart.ts`)

- MIT header (repo-wide rule for committed `.ts`).
- A `defineIndicator` (overlay) that draws a filled band between two
  computed series — e.g. a fast and slow EMA. Accumulate `{ time, price }`
  into two persistent edge arrays each bar (`state.*` slots or
  module-level arrays), then **re-emit `draw.fillBetween(edgeA, edgeB,
  opts)` at a fixed callsite every bar.** This per-bar-re-emit-at-a-stable-
  callsite idiom is the proven one: the runtime keys each `draw.*` callsite
  by its injected slot id and merges the re-emission into the same
  persistent drawing (`createDrawingHandle`, runtime
  `emit/draw/handle.ts`). It is exactly how the shipped multi-bar examples
  work — `pivot-high-ray.chart.ts` re-emits one reused
  `draw.horizontalRay` each bar, `forecast-line.chart.ts` re-emits one
  `draw.line` with an updated slope each bar. **Do not reach for
  `handle.update(...)`:** although Task 2's handle exposes `.update` /
  `.remove`, **no example script uses it** (grep `handle.update` in
  `examples/scripts/` — zero hits), and `fib-retracement.chart.ts` is a
  single-bar trigger (`if (bar.time === …)`), **not** a per-bar
  accumulator — don't cite it as the accumulation pattern. Keep the script
  minimal; it **must compile + run** through the CLI e2e gate.
- Both **top-level import** of `draw` (and any `ta`) **and** the
  destructured `compute({ bar, ta, draw })` params, per
  `examples/scripts/CLAUDE.md`.
- Add the path to `EXAMPLE_SCRIPTS` in `packages/cli/src/e2e.test.ts`
  (the array at line 13) so the round-trip gate covers it. Do **not**
  hand-write the `.chart.{js,d.ts,manifest.json}` sidecars — the newer
  examples (`base-trend`, `htf-trend-filter`, `sma-offset`) ship only the
  `.chart.ts`; follow that shape.

### 2. Demo entry (`apps/site/src/components/demo/scripts.ts`)

- Add a `const FILL_BETWEEN_BAND = \`…\`` source string (a self-contained
  `defineIndicator` like the other entries — it can mirror the example
  script) and a `DEMO_SCRIPTS` entry:
  ```ts
  {
      id: "fill-between-band",
      label: "Fill between series (band)",
      description: "A filled ribbon between two EMAs via draw.fillBetween — the native linefill / fill() equivalent.",
      source: FILL_BETWEEN_BAND,
  }
  ```
- Run `pnpm examples:generate` and commit the regenerated
  `docs/examples/fill-between-band.md` + any `docs/examples/index.md`
  delta. `pnpm examples:gate` must byte-match (no hand-edits to
  `docs/examples/*`).
- Optionally verify it renders in the demo (`ChartPane`) — the canvas2d
  renderer from Task 1 draws the band; confirm no console error. Not a
  CI gate, but a good smoke check.

### 3. Changeset (`.changeset/draw-fill-between.md`)

Create one changeset. Bump every published package the feature changes —
confirm the exact set with `pnpm changeset status`, but expect:

```markdown
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add the `draw.fillBetween(edgeA, edgeB, opts?)` drawing primitive — a
native filled ribbon between two edges (the closed polygon `edgeA`
forward then `edgeB` reversed). It is the chartlang equivalent of Pine's
`linefill.new(line1, line2, color)` / `fill(plot1, plot2)`. The
pine-converter now lowers static two-line `linefill.new` to it instead of
approximating with `draw.rotatedRectangle`, retiring the
`linefill-rotatedrect-approximated` diagnostic.
```

`examples/canvas2d-adapter` is **private** (`"private": true`, name
`chartlang-example-canvas2d-adapter`) — it is **never** in
`changeset status`, so it takes no bump even though Task 1 changed it.
`@invinite-org/chartlang-cli` is published, but this feature does not
change `packages/cli/src/` (only runs its `docs` generator), so it needs
a bump **only if** `changeset status` flags a real cli source change.
Confirm the exact set with `pnpm changeset status` and match it.

### 4. CLAUDE.md sweep

Confirm every touched folder's CLAUDE.md is current (Tasks 1–3 handle
core / runtime / pine-converter / adapter; this task covers the rest):

- `apps/CLAUDE.md` — the `DEMO_SCRIPTS` source-of-truth note already
  covers regeneration; add the new entry to any enumerated example list
  if one exists.
- `examples/CLAUDE.md` / `examples/scripts/CLAUDE.md` — if they list the
  example inventory, add `fill-between-band`.
- `skills/chartlang-coding/` — `references/primitives.md` was regenerated
  in Task 2 (the authoritative per-primitive surface). `SKILL.md` does
  **not** enumerate individual `draw.*` methods — it lists categories
  abstractly (~line 210: "lines, boxes, curves, Fibonacci, Gann,
  pitchforks, harmonic patterns, Elliott waves, cycles"). Add a
  "fills/bands" category to that abstract list so the skill mentions the
  new capability. Per the root `CLAUDE.md` skills-mirror rule, the skill
  must not go stale.
- Root `CLAUDE.md` — only if its index needs the new primitive (likely
  not).

### 5. Final verification

Run the full gate set once more end-to-end (all five tasks combined):
`pnpm typecheck && pnpm lint && pnpm test && pnpm docs:check &&
pnpm docs:gate && pnpm skills:gate && pnpm examples:gate &&
pnpm conformance && pnpm changeset status`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/fill-between-band.chart.ts` | Create | author example |
| `packages/cli/src/e2e.test.ts` | Modify | add example path to gate |
| `apps/site/src/components/demo/scripts.ts` | Modify | `DEMO_SCRIPTS` entry |
| `docs/examples/fill-between-band.md` | Generate | via `examples:generate` |
| `docs/examples/index.md` | Generate (if changed) | nav delta |
| `.changeset/draw-fill-between.md` | Create | feature changeset |
| `apps/CLAUDE.md`, `examples/CLAUDE.md`, `examples/scripts/CLAUDE.md`, `skills/chartlang-coding/SKILL.md` | Modify (as needed) | inventories / skill mirror |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- `pnpm examples:gate` (regenerated example docs byte-match)
- `pnpm skills:gate`, `pnpm docs:gate`
- `pnpm conformance`
- CLI e2e (`packages/cli/src/e2e.test.ts`) green with the new path
- `pnpm changeset status` shows the expected bumps

## Changeset

`.changeset/draw-fill-between.md` — `minor` on core, runtime,
conformance, pine-converter (verify with `changeset status`).

## Acceptance Criteria

- Example script compiles + passes the CLI e2e round-trip gate.
- Demo entry added; `docs/examples/fill-between-band.md` regenerated and
  gate-clean.
- Changeset present and `changeset status` clean.
- All relevant CLAUDE.md files updated; skill surface mirrors the new
  primitive.
- Full gate set green end-to-end.
