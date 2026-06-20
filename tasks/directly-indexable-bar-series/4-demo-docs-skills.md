# Task 4 — Demo, generated docs, language guide, skills

> **Status: DONE**

## Goal

Replace the `ta.ema(bar.close, 1)` identity-trick helper everywhere it is shown
or described — the live demo, the generated example docs, the language guide,
and the chartlang-coding skill — with direct `bar.close[N]` indexing, and
document the `Number.isFinite` / `===` migration. Regenerate all
machine-generated artifacts and update the per-folder `CLAUDE.md` invariants.

## Prerequisites

Task 1 (types) and Task 2 (runtime) — the demo must actually run with direct
indexing before its docs are regenerated.

## Current Behavior

- `apps/site/src/components/demo/scripts.ts` — `MANUAL_SMA` uses
  `const src = ta.ema(bar.close, 1);` with a comment explaining the scalar→series
  workaround; the catalogue description (~line 468) and top-of-file comment
  (~lines 1–11) repeat it.
- `docs/examples/manual-sma.md` + `docs/examples/index.md` are **auto-generated**
  by `pnpm examples:generate` (`scripts/gen-examples-docs.ts`) from `DEMO_SCRIPTS`
  — never hand-edited.
- `docs/language/series-and-indexing.md` (~lines 27–30) states "`bar.close` you
  receive each step is the scalar value."
- `docs/examples/forecast-line.md`, `docs/examples/htf-trend-filter.md` use real
  EMAs (genuine indicators) but may frame EMA as "kept as an indexable series."
- `skills/chartlang-coding/**` (incl. generated
  `references/primitives.md`) may describe `bar.close` as a non-indexable scalar.
- `packages/runtime/CLAUDE.md` §6.7 invariant pins `bar.X === series.X[0]`.

## Desired Behavior

- The demo and all docs/skills show `bar.close[N]` directly; the `ta.ema(_,1)`
  trick is gone from the repo. The series-and-indexing guide documents bar OHLCV
  fields as series + the scalar-coercion footgun.

## Requirements

### 1. Demo (`apps/site/src/components/demo/scripts.ts`)

Rewrite `MANUAL_SMA`'s `compute` body:

```ts
compute({ bar, plot, ta }) {
    // `bar.close` is a price series — index it directly. `bar.close[0]` is
    // the current close, `bar.close[1]` is one bar ago, and so on (indices
    // must be literal integers). Out-of-range reads are NaN, so this warms
    // up over 4 bars — bar-for-bar identical to ta.sma(close, 5).
    const manual = (bar.close[0] + bar.close[1] + bar.close[2] +
        bar.close[3] + bar.close[4]) / 5;

    plot(manual, { color: "#26a69a", title: "Manual SMA(5)" });
    plot(ta.sma(bar.close, 5), { color: "#ef5350", title: "ta.sma(5)" });
}
```

- Delete the `ta.ema(_, 1)` line + its multi-line explanatory comment.
- Update the catalogue `description` (~line 468) to e.g. "Define an SMA by hand
  straight from the price series — index `bar.close` directly at literal
  lookbacks and watch it overlay `ta.sma(5)` exactly."
- Update the top-of-file catalogue comment (~lines 1–11) to drop the
  "length-1 MA as an identity to expose bar.close" wording.
- Consider keeping the demo `id`/`label` as `manual-sma` / "Manual SMA" so the
  `?script=manual-sma` deep link and existing references stay valid.

### 2. Regenerate example docs

Run `pnpm examples:generate`, then verify with `pnpm examples:gate`. This
rewrites `docs/examples/manual-sma.md` + `docs/examples/index.md` from the demo.
Do **not** hand-edit those files.

### 3. Language guide (`docs/language/series-and-indexing.md`)

- Replace the "`bar.close` … is the scalar value" paragraph with: OHLCV +
  derived fields (`bar.close`, `bar.open`, `bar.hl2`, …) are **price series** —
  index them directly (`bar.close[1]`), read `bar.close.current`, or use them as
  a plain number (`bar.close * 2`). `ta.*` accept them as the source arg.
- Add a short footgun note: because `bar.close` is now an object,
  `Number.isFinite(bar.close)` is always `false` and `bar.close === 100` is
  `false` — use `bar.close.current` or `+bar.close` for raw-number contexts.
- Ensure any code fence still compiles (it is checked by `pnpm docs:snippets` /
  `pnpm docs:check`). Add a tiny `bar.close[1]` example fence if helpful.

### 4. Other example framing

- `docs/examples/forecast-line.md`, `docs/examples/htf-trend-filter.md`: these
  use real EMAs — keep the logic, but if their prose says the EMA is "kept as an
  indexable series" purely to enable lookback, soften it (the EMA is a genuine
  trend line; lookback now works on any series). These are generated from
  `DEMO_SCRIPTS` too, so edit the demo descriptions, not the `.md`.

### 5. Skills

- Update `skills/chartlang-coding/**` prose that describes `bar.close` as a
  non-indexable scalar to show direct indexing + the coercion footgun.
- Run `pnpm skills:generate` to refresh
  `skills/chartlang-coding/references/primitives.md`; verify with
  `pnpm skills:gate`.

### 6. CLAUDE.md invariants

- `packages/runtime/CLAUDE.md`: update the §6.7 invariant line from
  `bar.X === series.X[0]` to the coerced form, and note bar OHLCV/derived fields
  are now number-coercible series views (no per-bar scalar copy).
- `packages/core/CLAUDE.md` / `packages/compiler/CLAUDE.md`: note the
  `PriceSeries`/`VolumeSeries` types and the `Bar`-shim lockstep (per the repo
  rule "when you change behavior in a folder, update that folder's CLAUDE.md").

## Edge cases

- The generated `[Try it live]` link (`?script=manual-sma`) must keep working —
  keep the demo `id`.
- `pnpm examples:gate` / `pnpm skills:gate` fail CI if generation is stale —
  always regenerate, never hand-edit generated files.
- Demo + conformance script (Task 3) should stay logically identical so they
  don't drift.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/src/components/demo/scripts.ts` | Modify | Rewrite `MANUAL_SMA` body + description + catalogue comment. |
| `docs/examples/manual-sma.md`, `docs/examples/index.md` | Regenerate | `pnpm examples:generate`. |
| `docs/language/series-and-indexing.md` | Modify | Bar fields are series; footgun note. |
| `skills/chartlang-coding/**` (+ `references/primitives.md`) | Modify + regenerate | Direct indexing; `pnpm skills:generate`. |
| `packages/runtime/CLAUDE.md` | Modify | §6.7 coerced invariant. |
| `packages/core/CLAUDE.md`, `packages/compiler/CLAUDE.md` | Modify | New types + shim lockstep note. |

## Gates

- `pnpm examples:gate`, `pnpm skills:gate`
- `pnpm docs:check`, `pnpm docs:gate`, `pnpm docs:snippets`, `pnpm hover:check`
- `pnpm readme:check`
- `pnpm -F site build` / `pnpm -F site typecheck` (demo still compiles)

## Changeset

Covered by Task 1's feature changeset.

## Acceptance Criteria

- No `ta.ema(_, 1)` / `ta.sma(...)`-as-identity workaround remains in repo
  (grep clean).
- Manual SMA demo runs with direct `bar.close[N]` indexing and overlays
  `ta.sma(5)` exactly in `apps/site`.
- `docs/examples/*.md` regenerated; series-and-indexing guide updated with the
  footgun note; skills + `primitives.md` regenerated.
- CLAUDE.md invariants updated.
- `examples:gate`, `skills:gate`, `docs:check`, `docs:snippets`, `hover:check`,
  `readme:check` all green.
