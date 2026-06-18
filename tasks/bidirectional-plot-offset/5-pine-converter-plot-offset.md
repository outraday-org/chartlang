# Task 5 — Pine converter: map `plot(..., offset=N)` to the ta `offset`

> **Status: TODO**

## Goal

Make the pine-converter carry Pine's `plot(series, offset=N)` argument
through to chartlang now that bidirectional `offset` is a real
language surface. Today the converter **silently drops** the `offset=`
arg — no mapping, no diagnostic. After this task a Pine plot whose
value is a direct `ta.*` call threads the (signed) offset onto that
call's opts; any other plotted value emits a documented diagnostic and
drops the offset (chartlang has no plot-level offset — that is the
deferred `plot(series, { offset })` follow-up).

## Prerequisites

Task 1 (the `offset` semantics — bidirectional, signed, living on the
`ta.*` opts — must be final so the emitted source is correct) and
Task 3 (runtime makes a negative offset a real x-shift, so emitted
fixtures behave as documented). The converter only emits chartlang
*source*, so it does not depend on the adapter (Task 4).

## Current Behavior

- `emitPlot` (`packages/pine-converter/src/transform/plotFamily.ts`,
  ~line 188) reads only `pos[0]` (the value) and `commonOptions(args,
  pos, ctx)` — which maps **only** `title` / `color` / `linewidth`
  (the named args + positionals 1/2/3). A Pine `offset=` named arg is
  never read; it is dropped from the output with no diagnostic.
- `emitPlot` does **not** currently receive the `DiagnosticCollector`
  (only `emitPlotFamily` and the conditional/background emitters do), so
  emitting a diagnostic from the `plot` path requires threading
  `diagnostics` into `emitPlot` (and `commonOptions`/`emitHline` if the
  offset handling is shared — note `hline` has no `offset` in Pine, so
  scope the new handling to `plot`).
- There is no converter fixture exercising `plot(..., offset=)`. The
  hand-authored `docs/converter/supported.md` lists the mapped plot
  options; `docs/converter/rejects.md` lists the dropped/rejected
  constructs; `docs/converter/diagnostics.md` is **generated** from
  `DIAGNOSTIC_CODE_ENTRIES` and byte-gated by `pnpm
  converter:docs:check`.

## Desired Behavior

For a Pine `plot(<value>, offset=N, …)`:

1. **`<value>` is a direct `ta.*` call** (e.g. `plot(ta.sma(close, 20),
   offset=5)`) → thread the signed offset onto that call's opts:
   ```ts
   plot(ta.sma(bar.close, 20, { offset: 5 }), { /* title/color/… */ });
   // negative passes through unchanged:
   plot(ta.sma(bar.close, 20, { offset: -5 }));
   ```
   Merge with any options object the emitted chartlang ta call already
   carries. **Collision rule:** Pine `plot(..., offset=N)` is the source
   of truth for this transform, so if a future ta-call emitter has already
   produced an `offset` property, replace it with the plot-level `offset=`
   value and emit a warning diagnostic
   `plot-offset-overrides-ta-offset`. `offset=0` is omitted
   (byte-identical to the no-offset path).
2. **`<value>` is anything else** (a bare series like `plot(close,
   offset=5)`, a variable, an arithmetic expression) → chartlang has no
   plot-level offset, so **drop the offset and push a new diagnostic**
   (severity `warning`, e.g. `plot-offset-needs-ta-call`): "Pine plot
   `offset=` only maps when the plotted value is a direct `ta.*` call;
   chartlang's offset lives on the `ta.*` opts. Offset dropped." Suggest
   wrapping the value in a `ta.*` primitive or applying the offset on
   the indicator call.
3. A **non-literal** `offset=` (e.g. `offset=myInput`) on a `ta.*` call
   still threads — `offset` accepts a non-literal in chartlang (Task 2
   already removed the literal-only lookback path). Emit the expression
   verbatim into the opts. Only the *non-ta-value* case (rule 2) drops.

## Requirements

1. **`emitPlot` rewrite** (`plotFamily.ts`): read the `offset` named arg
   (`named(args, "offset")`). When present and non-zero, detect whether
   `pos[0]` is a direct `ta.*` call (a `call-expression` whose callee is
   a member access rooted at `ta` — use the existing `dottedCallee`
   helper from `packages/pine-converter/src/transform/callArgs.ts`,
   which is the ta-passthrough dispatch shape, instead of open-coding a
   second member-chain detector). If so, render that ta call with
   `{ offset: <expr> }` merged into its trailing chartlang opts object or
   appended as a new one. If an existing emitted opts object already has
   `offset`, replace it with the plot-level value and emit
   `plot-offset-overrides-ta-offset`. Otherwise push
   `plot-offset-needs-ta-call` and emit the value unchanged.
2. **Thread `diagnostics`** into `emitPlot` (and update the
   `emitPlotFamily` `case "plot"` call site to pass it). Keep `hline`
   /background/conditional paths unchanged.
3. **New diagnostic codes** (`src/diagnostics/codes.ts`): add
   `plot-offset-needs-ta-call` with
   `code: "pine-converter/transform/plot-offset-needs-ta-call"`,
   `severity: "warning"`, a `defaultMessage` + `defaultSuggestion`
   following the existing entry shape (see `dynamic-bar-index`). Add
   `plot-offset-overrides-ta-offset` with
   `code: "pine-converter/transform/plot-offset-overrides-ta-offset"`,
   `severity: "warning"`, and text explaining that Pine's plot-level
   offset replaced an existing chartlang ta-call offset. `codes.test.ts`
   auto-derives `DIAGNOSTIC_CODES.size` from the entries, so the count
   assertion stays green; only touch it if it pins the new code
   explicitly.
4. **Regenerate** `docs/converter/diagnostics.md` via **`pnpm
   converter:docs:generate`** and commit it (never hand-edit) — `pnpm
   converter:docs:check` must byte-match.
5. **Fixtures + tests**: add the next numbered converter fixture (the
   current fixture list ends at `28-keltner.*`; use
   `29-plot-offset.*` unless new fixtures landed first) covering both
   branches — `plot(ta.sma(close, 20),
   offset=5)` (threads onto the ta call) and `plot(close, offset=5)`
   (diagnostic + dropped), plus a focused unit case for the existing
   ta-offset collision rule. Regenerate via `UPDATE_FIXTURES=1` (the
   `src/tests/golden.test.ts` mechanism). Add/extend the
   `plot-family.test.ts` unit test asserting the threaded opts and the
   diagnostics. 100% coverage on pine-converter.
6. **Hand-authored converter docs**: update `docs/converter/supported.md`
   (the plot section — `offset=` now maps when the value is a `ta.*`
   call) and `docs/converter/rejects.md` (the non-`ta.*` case drops the
   offset with the new diagnostic). These are hand-authored, not
   generated.
7. **CLAUDE.md** (`packages/pine-converter/CLAUDE.md`): note the plot
   `offset=` mapping rule and the new diagnostic.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/plotFamily.ts` | Modify | read `offset=`, thread onto `ta.*` call or diagnose |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | add `plot-offset-needs-ta-call` + `plot-offset-overrides-ta-offset` |
| `packages/pine-converter/src/diagnostics/codes.test.ts` | Modify (only if it pins the new code) | severity/count |
| `docs/converter/diagnostics.md` | Regenerate (`pnpm converter:docs:generate`) | generated — reflects the new code |
| `packages/pine-converter/src/transform/plot-family.test.ts` | Modify | assert threaded opts + diagnostic |
| `packages/pine-converter/fixtures/29-plot-offset.{pine,expected.chart.ts,expected.diagnostics.json}` | Create + Regenerate | both branches (`ta.*` thread + non-ta drop); use next number if fixture list changed |
| `docs/converter/supported.md`, `docs/converter/rejects.md` | Modify | plot `offset=` mapping + the dropped case |
| `packages/pine-converter/CLAUDE.md` | Modify | plot offset rule + diagnostic |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (100% coverage on pine-converter; fixtures-compile green —
  emitted `ta.sma(…, { offset })` compiles only because Task 1 landed)
- `pnpm converter:docs:check` (regenerated `diagnostics.md` byte-matches)
- `pnpm docs:check` (if JSDoc on changed exports)

## Changeset

Deferred to Task 6 — the bidirectional changeset adds a `minor` bump on
`pine-converter` there (new diagnostic + new mapping).

## Acceptance Criteria

- `plot(ta.sma(close, 20), offset=N)` threads the signed offset onto the
  ta call's opts (positive and negative), proven by `plot-family.test.ts`
  and a fixture.
- `plot(<non-ta value>, offset=N)` drops the offset and emits
  `plot-offset-needs-ta-call`; `diagnostics.md` regenerated and `pnpm
  converter:docs:check` green.
- `docs/converter/supported.md` + `rejects.md` describe the mapping and
  the dropped case; `packages/pine-converter/CLAUDE.md` updated.
- 100% coverage on pine-converter; all fixture tests green.
