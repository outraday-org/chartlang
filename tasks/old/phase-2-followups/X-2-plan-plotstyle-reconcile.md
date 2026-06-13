# PLAN.md §7.3 PlotStyle Reconcile

> **Status: TODO**

## Goal

Update `PLAN.md §7.3`'s `PlotStyle` discriminated union to mirror
`packages/adapter-kit/src/types.ts` exactly as it stands after Phase 2.
Phase 2 (Task `X-1-plotkind-expansion.md` and follow-ups Task
`X-21-volume-vol-vwap-anchoredvwap.md` + `X-26-sr-chandelier-chandekrollstop-fractal.md`)
split `area` into its own variant with `lineWidth + lineStyle +
fillAlpha`, ungrouped `horizontal-line` from the still-deferred
`vertical-line`, and shipped 6 new kinds end-to-end. The PLAN's
`PlotStyle` still describes the original Phase-0 grouping, which now
reads as a contract for code that doesn't exist. This task brings the
spec doc in line with the shipped types and annotates the
Phase-5-deferred kinds so the section reads correctly to a 0.2 reader.

## Prerequisites

None. Docs-only — no code dependency on Task 1.

## Current Behavior

`PLAN.md §7.3` declares (current text, verbatim):

```ts
type PlotStyle =
    | { kind: "line" | "step-line" | "area";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "histogram" | "bars"; baseline: number }
    | { kind: "horizontal-line" | "vertical-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "filled-band";
        upper: number | null; lower: number | null; alpha: number }
    | { kind: "label"; text: string;
        position: "above" | "below" | "anchor" }
    | { kind: "marker";
        shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
        size: number }
    | { kind: "cursors"; radius: number }
    | { kind: "shape";
        shape: "circle" | "triangle-up" | "triangle-down" | "square"
             | "diamond" | "cross" | "x" | "flag" | "arrow-up" | "arrow-down";
        size: "tiny" | "small" | "normal" | "large" | "huge";
        location: "above-bar" | "below-bar" | "at-price"; }
    | { kind: "character";
        character: string;
        size: "tiny" | "small" | "normal" | "large" | "huge";
        location: "above-bar" | "below-bar" | "at-price"; }
    | { kind: "arrow";
        direction: number;
        baseline?: number; }
    | { kind: "candle-override";
        open: number; high: number; low: number; close: number;
        wickColor?: string; borderColor?: string; }
    | { kind: "bar-override";
        open: number; high: number; low: number; close: number; }
    | { kind: "bg-color"; alpha: number }
    | { kind: "bar-color"; replaceCandleColor: boolean };
```

Drift vs `packages/adapter-kit/src/types.ts` (the shipped truth):

1. **`area` is grouped with `line | step-line`** under one variant
   that says only `lineWidth + lineStyle`. The shipped variant is
   its own arm with `lineWidth + lineStyle + fillAlpha` (Phase 2
   Task 1 + Task 21 confirmation).
2. **`horizontal-line` is grouped with `vertical-line`.** The shipped
   variant has `horizontal-line` alone (its own arm); `vertical-line`
   isn't in the union at all (Phase-5 deferred).
3. **`cursors`, `shape`, `character`, `arrow`, `candle-override`,
   `bar-override`, `bg-color`, `bar-color`** are inline in the union
   with no annotation that they're Phase-5-deferred and not part of
   the 0.2 surface.
4. The PLAN's `PlotStyle` doesn't link to either the per-port tasks
   that ship each kind in 0.2 or to `adapter-kit/src/types.ts` as the
   source of truth.

## Desired Behavior

`PLAN.md §7.3` `PlotStyle` mirrors the shipped union from
`packages/adapter-kit/src/types.ts` exactly for kinds present in 0.2.
Phase-5-deferred kinds stay in the section as the long-term roadmap,
clearly annotated with `// Phase 5 — not in 0.2 surface`. A short
"Phase-2 update (0.2)" note under the union points the reader at:

- `packages/adapter-kit/src/types.ts` as the canonical type source.
- `tasks/phase-2-indicator-parity/X-1-plotkind-expansion.md` as the
  task that introduced the histogram / bars / area / filled-band /
  label / marker kinds + the canvas2d renderers.
- `tasks/phase-2-indicator-parity/X-21-volume-vol-vwap-anchoredvwap.md`
  as the task that wired the runtime `histogram` emit path through
  `PlotOpts.style`.
- `tasks/phase-2-indicator-parity/X-26-sr-chandelier-chandekrollstop-fractal.md`
  as the task that wired the runtime `marker` emit path.

## Requirements

### 1. Read the shipped `PlotStyle` for the source of truth

Open `packages/adapter-kit/src/types.ts` and locate the
`export type PlotStyle` declaration. Copy the union verbatim,
preserving the per-arm JSDoc (the shipped types carry `@since 0.2` +
"Phase 2 — …" descriptions). The exact shipped form at task-write
time:

```ts
export type PlotStyle =
    | {
          readonly kind: "line";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
      }
    | {
          readonly kind: "step-line";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
      }
    | {
          readonly kind: "horizontal-line";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
      }
    /** Phase 2 — column rising from `baseline` to `value`. @since 0.2 */
    | {
          readonly kind: "histogram" | "bars";
          readonly baseline: number;
      }
    /** Phase 2 — filled polygon under a polyline. @since 0.2 */
    | {
          readonly kind: "area";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
          readonly fillAlpha: number;
      }
    /** Phase 2 — region between two polylines. `upper` / `lower` may be
     *  `null` to mark a per-bar gap; both `null` is rejected by
     *  {@link validateEmission}. @since 0.2 */
    | {
          readonly kind: "filled-band";
          readonly upper: number | null;
          readonly lower: number | null;
          readonly alpha: number;
      }
    /** Phase 2 — text annotation anchored above / below / at the value.
     *  @since 0.2 */
    | {
          readonly kind: "label";
          readonly text: string;
          readonly position: "above" | "below" | "anchor";
      }
    /** Phase 2 — discrete glyph at the value. @since 0.2 */
    | {
          readonly kind: "marker";
          readonly shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
          readonly size: number;
      };
```

If the shipped form has changed between task-write and task-execute
time, **always use the shipped form as the source of truth** — re-read
the file before editing PLAN.md.

### 2. Edit `PLAN.md §7.3` to replace the `PlotStyle` block

Locate the existing `type PlotStyle = …` code block in `PLAN.md §7.3`.
Replace its body with the shipped form (without the `readonly`
modifiers and without `LineStyle` — PLAN inlines `"solid" | "dashed"
| "dotted"` directly for readability — but with every per-arm field
and shape intact).

Final PLAN-style body (the docstring is allowed to drop `readonly` +
inline `LineStyle` for narrative readability; the spec is in the
adapter-kit file, not the PLAN):

```ts
type PlotStyle =
    // === Shipped in 0.2 ===
    | { kind: "line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "step-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "horizontal-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "histogram" | "bars"; baseline: number }
    | { kind: "area";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted";
        fillAlpha: number }
    | { kind: "filled-band";
        upper: number | null; lower: number | null; alpha: number }
    | { kind: "label"; text: string;
        position: "above" | "below" | "anchor" }
    | { kind: "marker";
        shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
        size: number }
    // === Phase 5 — not in 0.2 surface ===
    | { kind: "vertical-line";
        lineWidth: number; lineStyle: "solid" | "dashed" | "dotted" }
    | { kind: "cursors"; radius: number }
    | { kind: "shape";
        shape: "circle" | "triangle-up" | "triangle-down" | "square"
             | "diamond" | "cross" | "x" | "flag" | "arrow-up" | "arrow-down";
        size: "tiny" | "small" | "normal" | "large" | "huge";
        location: "above-bar" | "below-bar" | "at-price" }
    | { kind: "character";
        character: string;
        size: "tiny" | "small" | "normal" | "large" | "huge";
        location: "above-bar" | "below-bar" | "at-price" }
    | { kind: "arrow";
        direction: number;
        baseline?: number }
    | { kind: "candle-override";
        open: number; high: number; low: number; close: number;
        wickColor?: string; borderColor?: string }
    | { kind: "bar-override";
        open: number; high: number; low: number; close: number }
    | { kind: "bg-color"; alpha: number }
    | { kind: "bar-color"; replaceCandleColor: boolean };
```

### 3. Add a "Phase-2 update (0.2)" note under the union

Immediately after the code block, add a paragraph (or a small
bulleted list) describing the post-Phase-0 changes:

> **Phase-2 update (`0.2`).** The union above is the long-term shape.
> Code shipped in `0.2` covers the 8 kinds above the `Phase 5` line.
> The split of `area` into its own variant with `fillAlpha` and the
> separation of `horizontal-line` from the still-deferred
> `vertical-line` happened in `tasks/phase-2-indicator-parity/X-1-plotkind-expansion.md`.
> The runtime emit paths for `histogram` and `marker` land in their
> consuming-port tasks
> (`X-21-volume-vol-vwap-anchoredvwap.md`,
> `X-26-sr-chandelier-chandekrollstop-fractal.md`) via the
> `PlotOpts.style` widening — see `packages/core/src/plot/plot.ts`
> for the script-author-facing `PlotOptsStyle` at lines 63-71
> (narrower than this wire union; only the kinds whose runtime emit
> path is wired).
> The canonical type source is `packages/adapter-kit/src/types.ts`;
> this section is a narrative copy.

### 4. Sanity-walk the rest of §7.3

The rest of §7.3 (`PlotEmission`, `DrawingEmission`, the universal
payload rules) wasn't called out by the QA pass. Re-read the rest of
the section after editing `PlotStyle` and:

- Confirm `PlotEmission.style: PlotStyle` reference is still
  coherent.
- Confirm the "Phase 5+ adds …" sentence at the bottom of `PlotStyle`
  (if any) reads correctly after the rewrite.
- Don't touch `DrawingEmission` (Phase 3) or other sub-sections.

If you find additional drift while walking, **note it in the PR
description** but don't expand the task — separate follow-up.

### 5. No tests to add

Docs-only edit. The PLAN isn't gated by a test. The `pnpm
readme:check` script doesn't lint `PLAN.md`. The change is verified
by:

- A diff review (the rewritten block clearly reads against the
  shipped types).
- A reader sanity-check (a Phase-2 audience finds the section
  describes shipped reality).

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `PLAN.md` | Modify | Replace §7.3 `PlotStyle` body + add the "Phase-2 update (0.2)" note |

## Gates

- `pnpm readme:check` — root README size unchanged (`PLAN.md` is
  not the root README and is not gated, but run to confirm no
  collateral edit slipped in).
- No code gates relevant — docs-only.

## Changeset

No changeset required — `PLAN.md` is not a published package and
its changes don't drive a semver bump. The reconcile lands as a
plain commit on `main`.

(If repo policy later changes to gate `PLAN.md` edits behind a
changeset, add `.changeset/phase-2-followups-plan-plotstyle-reconcile.md`
as a `--empty` changeset.)

## Acceptance Criteria

- [ ] `PLAN.md §7.3` `PlotStyle` code block split into "Shipped in
      0.2" and "Phase 5 — not in 0.2 surface" sections with the
      `area` triple `lineWidth + lineStyle + fillAlpha` and
      `horizontal-line` as its own variant.
- [ ] `vertical-line` moved below the Phase-5 divider; no longer
      grouped with `horizontal-line`.
- [ ] "Phase-2 update (`0.2`)" note added under the code block
      pointing at the relevant `tasks/phase-2-indicator-parity/`
      tasks (with `X-` prefixes since those tasks are complete) and
      naming `packages/adapter-kit/src/types.ts` as the canonical
      source.
- [ ] No edits outside §7.3.
- [ ] Diff review confirms the rewritten union matches the shipped
      `PlotStyle` shape (ignoring `readonly` modifiers and inline
      `LineStyle`).
