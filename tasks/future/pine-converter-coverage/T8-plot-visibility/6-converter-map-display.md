# Task 6 — Converter: map Pine `display=` → `{ visible }`

> **Status: TODO**

## Goal

Teach the Pine converter to map a `plot(...)`'s `display=` named argument onto
the new chartlang `{ visible }` opt: `display = <expr> ? display.all :
display.none` → `{ visible: <expr> }`, the constants `display.all`/`display.none`
→ `true`/`false`. Ship the fixture triple and the compile round-trip. This is
the converter half of T8 and the one that unblocks Trend Wizard's ~20
display-toggled plots.

## Prerequisites

Task 1 (core `PlotOpts.visible`). Tasks 3–4 (so the emitted `{ visible }`
actually renders) — the converter change can be authored against Task 1's type
but the compile round-trip needs the runtime/adapter side present.

## Current Behavior (evidence — ran built converter)

Pine `plot(close, display = show ? display.all : display.none)` →
`plot(bar.close)` — `display=` is silently dropped (unmapped named arg), so the
plot is always visible. No diagnostic.

- Plot emission lives in `packages/pine-converter/src/transform/plotFamily.ts`
  (`emitPlot`), which maps `title`/`color`/`lineWidth` onto a `{ … }` opts
  object and drops unrecognised named args.
- `display.all` / `display.none` are Pine enum members; the converter's enum
  mapping table is `src/mapping/enums.ts` (`ENUM_VALUE_MAP`).

## Desired Behavior

```pine
plot(maSlope, display = show ? display.all : display.none)
plot(rsi,     display = display.none)
plot(close,   display = display.all)
```
→
```ts
plot(maSlope, { visible: (inputs.show as boolean) });
plot(rsi, { visible: false });
plot(close);                      // display.all ⇒ visible default ⇒ omit
```

- `display = <cond> ? display.all : display.none` → `{ visible: <cond> }`.
- `display = <cond> ? display.none : display.all` (inverted) →
  `{ visible: !(<cond>) }`.
- `display = display.none` → `{ visible: false }`.
- `display = display.all` → omit `visible` (the default) for byte-clean output.
- A `display=` referencing an unsupported target (`display.status_line`,
  `display.price_scale`, `display.pane`, `display.data_window`, or a bitmask
  combination) → drop with a new `plot-display-approximated` (warning), keeping
  the plot visible.

## Requirements

### 1. Recognise `display=` in `emitPlot` (`plotFamily.ts`)

Add a `display` named-arg handler to the plot opts mapping. Resolve the
argument shape:

- ternary `cond ? display.all : display.none` → `visible: <emit(cond)>`
- ternary `cond ? display.none : display.all` → `visible: !(<emit(cond)>)`
- bare `display.none` → `visible: false`
- bare `display.all` → no `visible` key
- anything else → `plot-display-approximated` warning, no `visible` key

Emit the `cond` expression through the existing `emitWithContext` so input
references (`inputs.show as boolean`) and scalar reads lower correctly.

### 2. Enum mapping (`src/mapping/enums.ts`)

Add `display.all` / `display.none` entries to `ENUM_VALUE_MAP` (or a small
dedicated `DISPLAY_MAP`) so the recogniser reads them from the table, not an
inline string compare (repo invariant: mapping decisions route through
`src/mapping/`). Mark the other `display.*` members as approximated/unmapped.

### 3. Diagnostic (`src/diagnostics/codes.ts`)

Append `plot-display-approximated` (severity `warning`) — append-only, do not
reorder. Message: the Pine `display=` target has no chartlang analogue beyond
`all`/`none`; the plot is left visible.

### 4. Fixture triple (`packages/pine-converter/fixtures/`)

`NN-plot-display-toggle.pine` + `.expected.chart.ts` + `.expected.diagnostics
.json` covering: input-bool toggle, `display.none`, `display.all`, inverted
ternary, and an unsupported target (→ warning). Wire it into the
`fixtures-compile.test.ts` round-trip (must compile — do NOT add to
`KNOWN_NON_COMPILING`).

### 5. Converter CLAUDE.md + docs

Document the `display=` mapping in `packages/pine-converter/CLAUDE.md`
(plotFamily section) and `docs/converter/supported.md`; the generated
`docs/converter/diagnostics.md` picks up the new code.

## Edge cases

- `display` combined with `offset=`/`color=` on the same plot — the `display`
  handler is independent; ensure it composes with the existing offset/color
  threading.
- A non-ternary truthy expression (`display = show`) is not valid Pine for
  `display=` (it expects a `display.*` value); treat as approximated.
- `display.all` must OMIT the field (not emit `visible: true`) so a fully-shown
  Trend Wizard plot converts byte-clean.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/plotFamily.ts` | Modify | `display=` → `{ visible }` in `emitPlot`. |
| `packages/pine-converter/src/mapping/enums.ts` | Modify | `display.all`/`display.none` entries. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `plot-display-approximated`. |
| `packages/pine-converter/fixtures/NN-plot-display-toggle.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Fixture triple. |
| `packages/pine-converter/src/transform/plot-family.test.ts` | Modify | Unit coverage for each `display` shape. |
| `packages/pine-converter/CLAUDE.md`, `docs/converter/supported.md` | Modify | Document the mapping. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage)
- Fixture compile round-trip (`fixtures-compile.test.ts`) green for the new
  fixture.
- `pnpm docs:check`

## Changeset

Covered by Task 1's shared T8 changeset (pine-converter is patch).

## Acceptance Criteria

- Trend Wizard's `display = <bool> ? display.all : display.none` plots convert
  to `{ visible: <bool> }`; `display.none` → `false`; `display.all` → omitted.
- Unsupported `display.*` targets warn `plot-display-approximated` and stay
  visible.
- New fixture converts AND compiles; converter coverage + docs:check green.
