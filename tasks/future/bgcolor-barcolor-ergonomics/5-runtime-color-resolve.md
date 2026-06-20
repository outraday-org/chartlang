# Task 5 — Runtime per-bar `colorValue` resolve + validator + dedup

> **Status: TODO** — **GATED on Deliverable 2 (see Task 4).**

> **Deliverable 2** (Series<Color> tier).

## Goal

Thread the per-bar color through the runtime: resolve the
`bgcolor`/`barcolor`/`plot` color argument into `PlotEmission.colorValue`
each bar, validate it (`validateEmission`), and let it ride the existing
last-write-wins dedup per `(slotId, bar)`. Omitted ⇒ byte-identical to a
static-color emission.

## Prerequisites

- Task 4 (the `PlotEmission.colorValue` wire field + decision).

## Current Behavior

- `plotImpl` (`packages/runtime/src/emit/plot.ts:88-131`) builds the static
  emission: `color: opts.color ?? null` (`:124`), `value: resolveValue(value)`
  (`:123`, finite → number, else `null`), and conditionally spreads `xShift`
  (`:127`). It capability-gates (`:96`) and pushes via `pushPlot`.
- `pushPlot` validates via `validateEmission` and dedups last-write-wins per
  `(slotId, bar)` by reverse-linear-scan (runtime CLAUDE.md "`pushPlot` /
  `pushAlert` validate via … `validateEmission`; … same `(slotId, bar)`
  collapses last-write-wins").
- `validatePlotEmission` (`…/validateEmission.ts:447-459+`) checks `slotId`,
  `title`, `style`, `bar`, `time`, and `value` (finite-or-null, `:456-459`).
  `bg-color`/`bar-color` styles validate their static `color` via
  `validateBgColorStyle` (`:371`) / `validateSingleColorStyle` (`:435`),
  reusing `validateColor` (`:350`, non-empty string). There is no
  `colorValue` check.
- The `bgcolor`/`barcolor` runtime impls (Task 2) build a `bg-color`/
  `bar-color` style with a STATIC `opts.color` and dispatch to `plotImpl`.

## Desired Behavior

- `plotImpl` resolves a per-bar color into `colorValue` and spreads it onto
  the emission **only when present** (`...(colorValue === undefined ? {} :
  { colorValue })`), mirroring the `xShift` omit-when-default pattern. A
  static-only emission (no dynamic color) omits `colorValue` entirely →
  byte-identical to today.
- The `bgcolor`/`barcolor` impls (Task 2) set the per-bar color through
  `colorValue` instead of (or in addition to) the static `style.color`. For
  a per-bar conditional scalar the value is whatever the expression evaluated
  to **this bar**; for a pre-computed `Series<Color>` (only if Task 4 added
  `ColorSeries`) it is `series.current`.
- `validateEmission` validates `colorValue` when present: a non-empty color
  string OR `null` (sibling to the `value` finite-or-null check). A malformed
  `colorValue` drops the emission with `malformed-emission` (the existing
  failure sink), never a throw.
- `colorValue` rides the same dedup: re-emitting the same `(slotId, bar)`
  with a new `colorValue` collapses last-write-wins, exactly like `value`.

## Requirements

### 1. Resolve per-bar color in `plotImpl` (`packages/runtime/src/emit/plot.ts`)

- Decide how the per-bar color reaches `plotImpl`. Two options, pick per the
  Task-4 author-type decision:
  - **Scalar conditional (default):** the color is already a resolved
    `Color` string by the time `plotImpl` runs (the conditional was evaluated
    in the script). Add a `resolveColor(color): Color | null` helper
    (mirroring `resolveValue` `:23-26`): a non-empty string → that string,
    else `null`. Set `colorValue` from it for `bgcolor`/`barcolor` (and for
    `plot` when a dynamic color is signalled).
  - **`Series<Color>` (only if Task 4 added `ColorSeries`):** if the color
    arg is a color-series view, read `.current`. Mirror `resolveValue`'s
    series branch.
- Spread conditionally: `...(colorValue === undefined ? {} : { colorValue })`
  — and define "undefined" as "no dynamic color was supplied" so plain
  static `plot(x, { color: "#fff" })` (a constant) still omits `colorValue`
  and stays byte-identical. (Distinguish a per-bar-dynamic color from a
  literal-constant color: a constant `opts.color` continues to ride the
  static `color` field; only a genuinely per-bar color sets `colorValue`.
  Simplest implementable rule — see Edge cases.)

### 2. `bgcolor`/`barcolor` impls set `colorValue` (`emit/bgcolor.ts`, `barcolor.ts`)

- Update the Task-2 thin impls so the per-bar color flows to `colorValue`
  (not just the static `style.color`). The `bg-color`/`bar-color` style still
  carries a color (for the static fallback / older adapters), but the live
  per-bar color is `colorValue`. Keep `value: null`.

### 3. Validate `colorValue` (`…/validateEmission.ts`)

In `validatePlotEmission`, after the `value` check (`:456-459`), add:

```ts
const colorValue = e.colorValue;
if (colorValue !== undefined && colorValue !== null) {
    const cv = validateColor(colorValue, "plot.colorValue");
    if (!cv.ok) return cv;
}
```

(`validateColor` already enforces non-empty string `:350`. `undefined` =
omitted, `null` = explicit gap — both pass.)

### 4. Tests

- **Runtime** (`emit/plot.test.ts` / `bgcolor.test.ts`): a `bgcolor(cond ?
  "#16a34a" : "#dc2626")` across bars where the condition flips → the drained
  emissions carry the per-bar `colorValue`; a static `bgcolor("#1d4ed8")`
  omits `colorValue` (byte-identical to Deliverable-1).
- **Dedup**: two `bgcolor` writes at the same `(slotId, bar)` collapse to the
  last `colorValue`.
- **Validator** (`validateEmission.test.ts`): `colorValue: "#fff"` passes,
  `null` passes, `undefined` passes, `""` / non-string → `malformed-emission`
  (emission dropped). 100% branch coverage on the new arm.
- **Byte-identity**: a no-dynamic-color run produces emissions byte-identical
  to the Deliverable-1 baseline (no `colorValue` key).

## Edge cases

- **Distinguishing a constant color from a per-bar color** is the subtle part.
  A literal `plot(x, { color: "#fff" })` must NOT start emitting `colorValue`
  (that would change the wire for every existing plot and is unnecessary).
  Simplest rule: `bgcolor`/`barcolor` ALWAYS route their color through
  `colorValue` (their whole purpose is per-bar color, and they emit
  `value: null` so they never collided with the numeric channel anyway);
  ordinary `plot` keeps using the static `color` field unless/until a
  separate dynamic-color opt is introduced. Confirm this scoping with Task 4
  — it keeps the `plot`-path wire untouched while giving `bgcolor`/`barcolor`
  true per-bar color.
- `colorValue: null` (explicit gap) vs omitted — preserve the distinction
  through dedup and validation.
- The `bg-color` `transp` stays on the style; Deliverable 2 carries only a
  per-bar COLOR, not a per-bar transparency (fold alpha into the color hex if
  needed — README deferred note).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/plot.ts` | Modify | `resolveColor` + conditional `colorValue` spread. |
| `packages/runtime/src/emit/bgcolor.ts` / `barcolor.ts` | Modify | Route per-bar color to `colorValue`. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | Validate `colorValue` (color-or-null). |
| `packages/runtime/src/emit/*.test.ts` | Modify | Per-bar / dedup / byte-identity tests. |
| `packages/adapter-kit/src/validation/*.test.ts` | Modify | `colorValue` validation tests. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-runtime test` (100% coverage)
- `pnpm -F @invinite-org/chartlang-adapter-kit test` (100% coverage on the
  new validator branch)
- `pnpm conformance` (existing bg/bar-color hashes unchanged — `colorValue`
  is not in the `{ bar, value }` hash, and the static-fallback path stays
  byte-identical)

## Changeset

Covered by Task 4's Deliverable-2 changeset (`runtime` + `adapter-kit`
already listed).

## Acceptance Criteria

- `plotImpl` resolves and conditionally emits `colorValue`; static-only
  emissions omit it (byte-identical).
- `bgcolor`/`barcolor` carry the live per-bar color via `colorValue`.
- `validateEmission` accepts color-or-null `colorValue`, drops malformed.
- Dedup collapses `colorValue` last-write-wins per `(slotId, bar)`.
- Existing conformance hashes unchanged; runtime + adapter-kit 100% coverage.
