# Pine Converter: `explicit_plot_zorder` Reclassification

> **Status: TODO**

## Goal

Stop the Pine→chartlang converter from warning on the
`explicit_plot_zorder` indicator flag. Because chartlang already orders
marks by declaration within a group (Task 1's normative contract),
Pine's `explicit_plot_zorder=true` is **already the chartlang default** —
so the flag should be recognized as a satisfied no-op, not dropped with
an `indicator-arg-not-mapped` warning. The converter never *emits* a
numeric `z` (Pine has no per-element z source construct).

## Prerequisites

- Task 1 (normative declaration-order contract — the justification for
  treating the flag as a no-op).

## Current Behavior

`packages/pine-converter/src/transform/declarationArgs.ts` (≈line 92)
holds an `UNMAPPED_ARGS` set including `"explicit_plot_zorder"`,
`"timeframe"`, `"dynamic_requests"`, `"linktoseries"`, etc. Any arg in
this set raises an `indicator-arg-not-mapped` diagnostic (warning) and
is dropped. So a Pine script using `explicit_plot_zorder=true` converts
with a spurious warning even though chartlang's behavior already matches.

## Desired Behavior

- `explicit_plot_zorder` is **recognized**: no `indicator-arg-not-mapped`
  warning. The converter emits no chartlang option for it (there is no
  `defineIndicator` flag — declaration order is implicit and always on).
- Optionally, emit an **informational** diagnostic (not a warning) noting
  "Pine `explicit_plot_zorder` is the default in chartlang; no flag
  needed" — only if the converter has an `info`/`note` severity tier;
  otherwise emit nothing.
- `explicit_plot_zorder=false` (the Pine default) also converts cleanly:
  chartlang cannot reproduce Pine's *non*-explicit z behavior exactly,
  but the difference is presentation-only and below the converter's
  fidelity contract — recognize it as no-op too, optionally with the
  same info note. Do **not** raise a warning.

## Requirements

### 1. Remove `explicit_plot_zorder` from `UNMAPPED_ARGS`

In `declarationArgs.ts`, drop `"explicit_plot_zorder"` from the
`UNMAPPED_ARGS` set so it no longer triggers `indicator-arg-not-mapped`.

### 2. Add explicit recognition

Add a `RECOGNIZED_NOOP_ARGS` set (or extend an existing
recognized-but-unmapped path) containing `"explicit_plot_zorder"`. When
`mapDeclarationArgs` encounters it:
- Do not add anything to `ScaffoldOptions`.
- If an `info`-severity diagnostic channel exists, push a one-line note
  with a stable diagnostic code (e.g. `explicit-plot-zorder-default`).
  If only `warning`/`error` exist, emit nothing (silent recognition) —
  do not invent a new severity in this task.

Keep the change minimal and localized; do not touch the per-plot codegen
(Pine `plot()` has no `zorder` argument, so there is nothing to map
there).

### 3. Fixtures (the converter's test contract)

Add a fixture trio under `packages/pine-converter/fixtures/`. The next
free fixture number is **`30`** (existing fixtures run `01`–`29`, the
last being `29-plot-offset.pine`):
- `30-explicit-plot-zorder.pine` — a minimal indicator using
  `indicator("X", explicit_plot_zorder=true)` with two `plot()` calls.
- `30-explicit-plot-zorder.expected.chart.ts` — the converted output:
  a normal two-`plot` indicator with **no** z option and **no** warning
  artifact.
- `30-explicit-plot-zorder.expected.diagnostics.json` — either empty
  `[]` (if silent) or the single `info` note (if the info channel
  exists). It MUST NOT contain `indicator-arg-not-mapped` for
  `explicit_plot_zorder`.

The existing fixture runner
(`packages/pine-converter/src/tests/fixtures-compile.test.ts`)
round-trips each `.pine` fixture through `convert(...)` and then compiles
clean conversions via the chartlang `compile(...)` — ensure the output is
valid chartlang (it should not need to join the `KNOWN_NON_COMPILING`
skip list).

### 4. Unit test

Add/extend a converter unit test asserting:
- Converting `indicator("X", explicit_plot_zorder=true)` produces **no**
  `indicator-arg-not-mapped` diagnostic.
- The `ScaffoldOptions` is unchanged (no phantom field).

### 5. Edge cases / invariants

- Other `UNMAPPED_ARGS` entries (`timeframe`, etc.) keep warning —
  only `explicit_plot_zorder` is reclassified.
- Do not regress existing fixtures: a global re-run of the converter
  over all fixtures must produce no diffs except the new trio.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/declarationArgs.ts` | Modify | Reclassify `explicit_plot_zorder` as recognized no-op |
| `packages/pine-converter/fixtures/30-explicit-plot-zorder.pine` | Create | Input fixture |
| `packages/pine-converter/fixtures/30-explicit-plot-zorder.expected.chart.ts` | Create | Expected output (no warning, no z) |
| `packages/pine-converter/fixtures/30-explicit-plot-zorder.expected.diagnostics.json` | Create | Expected diagnostics (no unmapped warning) |
| `packages/pine-converter/src/**/*.test.ts` | Modify | Unit test for the reclassification |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify (or defer to Task 8) | Note `explicit_plot_zorder` is the default |
| `.changeset/plot-draw-z-order.md` | Modify | Append `@invinite-org/chartlang-pine-converter: minor` |

> The `translating-from-pine.md` note can live here or in Task 8 — to
> avoid a double-edit, **defer it to Task 8** (which already touches that
> file) and keep this task code-only. Pick one; do not edit it twice.

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (converter unit + fixture round-trip; 100% coverage on
  `packages/pine-converter`)

## Changeset

Append `"@invinite-org/chartlang-pine-converter": minor` to
`.changeset/plot-draw-z-order.md`, extending the body to mention the
`explicit_plot_zorder` reclassification. (`pine-converter` is at
`0.0.0`; a `minor` bump takes it to `0.1.0`. If its `package.json` is
`private`, changesets will skip it — confirm and drop the line if so.)

## Acceptance Criteria

- `explicit_plot_zorder` no longer raises `indicator-arg-not-mapped`;
  it is recognized as a no-op (silent or an `info` note).
- New fixture trio added; its `expected.chart.ts` compiles via the
  round-trip test; diagnostics contain no unmapped warning for the flag.
- Other unmapped args still warn; no existing fixture diffs.
- 100% coverage on `packages/pine-converter`; changeset updated.
