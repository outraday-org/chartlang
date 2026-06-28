# Task 6 — Adapters + conformance + converter emits dynamic color

> **Status: SHIPPED** — Deliverable 2 (Task 4) was ratified and built; this
> task landed alongside it (adapters consume `colorValue`, conformance pins
> `plotKindBgColorDynamic`, the converter emits the per-bar color expression).

> **Deliverable 2** (Series<Color> tier).

## Goal

Make **every** adapter consume the per-bar `colorValue`: the canvas2d
reference renderer prefers `colorValue` over the static color when present;
the adapter-kit contract documents the precedence (binding all conformant
adapters). Add a conformance scenario pinning the dynamic-color channel. Flip
the Pine converter to emit the **real dynamic color** (`bgcolor(close > open ?
color.green : color.red)`) instead of `plot(Number.NaN, …)`.

## Prerequisites

- Task 5 (runtime emits `colorValue`; validator accepts it).

## Current Behavior

- **Reference renderer reads the STATIC style color.**
  `renderBackgroundOverlays` (`…/createCanvas2dAdapter.ts:369-383`) →
  `drawBgColor` (`src/render/bgColor.ts:33`) reads `plot.style.color` +
  `plot.style.transp`; `renderBarOverlays` (`:385+`) reads `plot.style.color`
  for the `bar-color` case (`:410`). Neither reads `PlotEmission.colorValue`
  (it didn't exist).
- The adapter contract is `Adapter.onEmissions(RunnerEmissions)`
  (`adapter-kit/types.ts:834`), gated by `Capabilities.plots`; the
  `PlotEmission` JSDoc (`:469-530`) documents the static `color` but not a
  per-bar override (Task 4 adds the `colorValue` field + JSDoc).
- **Conformance** has four bg/bar-color scenarios
  (`plotKind{BgColor,BarColor}{,Gated}.scenario.ts`) pinning a `plot-hash`
  over `{ bar, value }` + diagnostic absence. None exercises a per-bar color
  (the `plot-hash` can't see color; a `colorValue` scenario needs a
  `plot-field` assertion — conformance CLAUDE.md "`plot-field` … to assert
  `visible` / `color` / `style.lineWidth` / `xShift`").
- **Converter** emits static color: `emitBackground`
  (`packages/pine-converter/src/transform/plotFamily.ts:349-359`) returns
  `plot(Number.NaN, { style: { kind, color } })` — a single static color,
  because there was no dynamic-color target. Pine `bgcolor`/`barcolor` take a
  per-bar series color, so this LOSES the per-bar semantics.

## Desired Behavior

- **Reference renderer prefers `colorValue`.** `drawBgColor` and the
  `bar-color` recolor read `emission.colorValue ?? style.color` (when
  `colorValue === null` → skip painting this bar, the explicit gap; when
  omitted → the static `style.color`). The per-bar color now paints
  correctly across bars.
- **Adapter contract documents precedence.** The `PlotEmission`/`PlotStyle`
  JSDoc + the adapter-kit contract state: an adapter MUST prefer
  `colorValue` over the static color for `(slotId, bar)` when `colorValue` is
  present; `null` is a per-bar gap; omitted is the static fallback. This
  binds all conformant adapters (only the canvas2d reference implements it
  here — others ported as they appear, per the deferred note).
- **Conformance** gains a `plot-kind-bg-color-dynamic` scenario: a script
  whose `bgcolor` color flips by bar condition; a `plot-field` assertion on
  `colorValue` per `(slotIndex, bar)` pins the per-bar color, and a reused
  `plot-hash` on the numeric `value` proves the value series is unchanged
  (byte-identical — `colorValue` is not hashed).
- **Converter emits real dynamic color.** `emitBackground` becomes
  `bgcolor(<color expr>)` / `barcolor(<color expr>)` (the Deliverable-1 sugar
  holes) carrying the converted Pine color expression — including a per-bar
  conditional / series — instead of `plot(Number.NaN, …)`.

## Requirements

### 1. Reference renderer (`examples/canvas2d-adapter/`)

- `src/render/bgColor.ts`: extend `BgColorArgs` (`:16-21`) with an optional
  `colorValue?: string | null` and resolve the paint color as `colorValue ??
  args.color`; when the per-bar color is the explicit `null` gap, skip the
  fill (no paint this bar). Update `drawBgColor` (`:33`) accordingly.
- `createCanvas2dAdapter.ts` `renderBackgroundOverlays` (`:369-383`): pass
  `colorValue: plot.colorValue` through (the ingested emission carries it).
  Same for `renderBarOverlays`' `bar-color` case (`:410`): prefer
  `plot.colorValue` over `plot.style.color`.
- Persist `colorValue` on the ingested plot-overlay store across frames (like
  the other per-mark fields). Where the adapter stores the overlay emission,
  carry `colorValue` through.
- Update `MockCanvas2DContext` call-log expectations only if the canonical
  call sequence changes (a different `fillStyle` value) — re-pin the affected
  `*.test.ts` per the example's hash convention.

### 2. Adapter-kit contract docs (`packages/adapter-kit/src/types.ts`)

- Strengthen the `PlotEmission.colorValue` JSDoc (from Task 4) with the
  normative adapter rule: "Adapters MUST prefer `colorValue` over the static
  color when present; `null` is a per-bar gap; omitted is the static
  fallback." If there is an adapter-contract doc page
  (`docs/spec/emissions.md` / a contract md), add the precedence row there
  too (`docs/spec/emissions.md:99-100` documents the bg/bar-color style
  rows — add a `colorValue` note).

### 3. Conformance scenario (`packages/conformance/`)

- Add `plotKindBgColorDynamic.scenario.ts` (mirror
  `plotKindBgColor.scenario.ts:1-37`): an inline source whose `bgcolor`
  color flips on a per-bar condition (e.g. `bgcolor(bar.close > bar.open ?
  "#16a34a" : "#dc2626")`). Assertions:
  - a `plot-field` assertion on `colorValue` for a known `(slotIndex, bar)`
    pair (asserting the expected per-bar color),
  - a reused `plot-hash` over `{ bar, value }` proving the numeric value
    series is byte-identical to the static run (`value` is `null` for every
    bar — confirm the hash matches the existing bg-color value series),
  - `diagnostic-code-absent: unsupported-plot-kind` / `malformed-emission`.
- Register it in `packages/conformance/src/index.ts` (alongside the existing
  bg-color scenarios `:115-120`) and the relevant `PHASE_*_SCENARIOS` group.
- Re-pin any hash via the harness's "expected vs actual" failure message
  (conformance CLAUDE.md). **Do NOT touch the existing four hashes** — the
  static-color scenarios stay byte-identical (`colorValue` is omitted there).

### 4. Converter emits dynamic color (`packages/pine-converter/`)

- `emitBackground` (`plotFamily.ts:349-359`): change the emission from
  `plot(Number.NaN, { style: { kind, color } })` to the Deliverable-1 sugar:
  `bgcolor(<color>)` / `barcolor(<color>)`, where `<color>` is the converted
  Pine color expression (`styleValue(color, ctx)` — which already handles a
  per-bar conditional / `color.new(...)` / enum). The per-bar semantics now
  survive: Pine `bgcolor(close > open ? color.green : color.red)` converts to
  `bgcolor(bar.close > bar.open ? "#4CAF50" : "#FF5252")`.
- Update `plot-family.test.ts` (`:165-176`): the expected output for
  `bgcolor(color.red)` becomes `bgcolor("#FF5252");` (and `barcolor(...)`),
  and a per-bar-conditional fixture asserts the full conditional rides
  through. The `bgcolor()`/`barcolor()` no-color → `null` case is unchanged.
- Update the converter round-trip / golden fixtures that exercise
  `bgcolor`/`barcolor` (the golden corpus pins emitted SOURCE — re-pin those
  lines) and any `pine-converter-round-trip-*` conformance scenario whose
  compiled emission changes (re-pin the `plot-hash`/`drawing-hash` via the
  harness message).
- Update `packages/pine-converter/CLAUDE.md` (the `plotFamily.ts` notes) +
  `docs/spec/pine-migration.md` §8 to reflect that `bgcolor`/`barcolor`
  convert to the sugar holes carrying real per-bar color.

### 5. Tests

- canvas2d render tests: per-bar `colorValue` paints the right `fillStyle`
  across bars; `colorValue: null` skips the fill; omitted → static
  `style.color`.
- adapter-kit: the contract JSDoc/doc is present (no logic test needed beyond
  Task 4's type test).
- conformance: the new dynamic scenario passes; the four existing scenarios
  are unchanged.
- pine-converter: `plot-family.test.ts` + golden + round-trip re-pins green.

## Edge cases

- **Pinned-hash safety:** the new `colorValue` field is NOT in the
  `plot-hash` tuple, and the static scenarios omit it — so the four existing
  bg/bar-color hashes MUST stay byte-identical. Any change to them signals an
  accidental wire-order or emission-order regression (conformance CLAUDE.md).
- The converter golden corpus pins SOURCE; the round-trip scenarios pin a
  compiled RUN. `bgcolor`/`barcolor` source lines change (now sugar), so both
  must be re-pinned — but ONLY the bgcolor/barcolor-bearing fixtures.
- `colorValue: null` (gap) renders as "skip this bar's fill", distinct from a
  static fallback — unit-test both the renderer paths.
- Other adapters (lightweight-charts ref doc, third-party) are deferred — the
  contract (Step 2) binds them; only the canvas2d reference implements
  `colorValue` here.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/render/bgColor.ts` | Modify | Prefer `colorValue` over static; `null` gap skip. |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | Thread `colorValue` to bg/bar overlays; persist on store. |
| `examples/canvas2d-adapter/src/**/*.test.ts` | Modify | Per-bar color render tests; re-pin call-log hashes if changed. |
| `packages/adapter-kit/src/types.ts` | Modify | Normative `colorValue` precedence in JSDoc. |
| `docs/spec/emissions.md` | Modify | `colorValue` precedence note. |
| `packages/conformance/src/scenarios/plotKindBgColorDynamic.scenario.ts` | Create | Dynamic-color scenario. |
| `packages/conformance/src/index.ts` | Modify | Register the scenario. |
| `packages/pine-converter/src/transform/plotFamily.ts` | Modify | `emitBackground` → `bgcolor`/`barcolor` sugar. |
| `packages/pine-converter/src/transform/plot-family.test.ts` | Modify | Updated expected output. |
| `packages/pine-converter/fixtures/**` + round-trip scenarios | Modify | Re-pin bgcolor/barcolor goldens + hashes. |
| `packages/pine-converter/CLAUDE.md` | Modify | `plotFamily.ts` emit-shape note. |
| `docs/spec/pine-migration.md` | Modify | §8 reflects sugar + per-bar color. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F chartlang-example-canvas2d-adapter test`
- `pnpm -F @invinite-org/chartlang-conformance test`
- `pnpm -F @invinite-org/chartlang-pine-converter test`
- `pnpm conformance` (new dynamic scenario green; existing four hashes
  unchanged; round-trip re-pins green)
- `pnpm converter:docs:check` (if any diagnostic-doc page is affected)
- `pnpm docs:check`

## Changeset

Covered by Task 4's Deliverable-2 changeset (`adapter-kit` + `runtime` +
`pine-converter` already listed). The canvas2d adapter is private
(unpublished) — no bump line for it.

## Acceptance Criteria

- The canvas2d reference renderer paints per-bar `colorValue`, falls back to
  the static color when omitted, and skips on `null`.
- The adapter-kit contract documents `colorValue` precedence normatively.
- A `plot-kind-bg-color-dynamic` conformance scenario pins the per-bar color
  (`plot-field`) and an unchanged numeric `plot-hash`; the four existing
  hashes are untouched.
- The Pine converter emits `bgcolor(...)`/`barcolor(...)` sugar carrying the
  real per-bar color (no more `plot(Number.NaN, …)`); goldens + round-trips
  re-pinned.
- Per-folder CLAUDE.md + docs updated; all gates green. **Deliverable 2
  complete.**
