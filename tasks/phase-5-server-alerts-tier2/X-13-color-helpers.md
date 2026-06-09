# Task 13 — Color helpers: `fromGradient` / `withAlpha` / `rgb` / `hsl`

> **Status: TODO**

## Goal

Ship the four dynamic-color helpers (Pine's `color.from_gradient`,
`color.new`, `color.rgb`, `color.hsl` analogues) on the existing
`color` namespace. Pure functions returning CSS-string `Color`
values; alpha clamped to `[0, 1]`; NaN-tolerant. Standalone task —
no runtime, adapter-kit, or conformance changes (the helpers are
called at compute time inside scripts; outputs flow through the
existing `color: Color` plumbing).

## Prerequisites

- Task 12: `draw.table` landed. (Phase-5 Tier-2 ergonomics nearing
  complete.)

## Current Behavior

- `packages/core/src/color/color.ts` (or wherever the namespace lives —
  confirm via Read; if not present, create) ships a static palette
  matching Phase-2 plus the named-palette mirror per PLAN §13.
- No `fromGradient` / `withAlpha` / `rgb` / `hsl` helpers.

## Desired Behavior

- The `color` namespace gains four pure functions:
  - `color.fromGradient(t: number, stops): Color` — linear
    interpolation between sorted stops, clamped at edges.
  - `color.withAlpha(c: Color, alpha: number): Color` — alpha in
    `[0, 1]`, clamped; returns CSS string with alpha applied.
  - `color.rgb(r, g, b, alpha?): Color` — components in `[0, 255]`,
    clamped; alpha defaults to `1`.
  - `color.hsl(h, s, l, alpha?): Color` — `h ∈ [0, 360)`,
    `s, l ∈ [0, 100]`, clamped; alpha defaults to `1`.
- All return CSS-string-clean `Color` values. The existing `Color = string`
  type contract is unchanged.
- NaN inputs produce documented fallbacks:
  - `fromGradient` with NaN `t` → returns the first stop's color.
  - `withAlpha` with NaN `alpha` → returns the input color unchanged.
  - `rgb` / `hsl` with NaN components → that component clamps to 0.
- Property tests pin idempotence + range invariants.

## Requirements

### 1. `packages/core/src/color/colorHelpers.ts` (new)

Two-line MIT header, then:

```ts
import type { Color } from "../types";

export type GradientStop = Readonly<{ at: number; color: Color }>;

/**
 * Dynamic color from a normalised position. `t` is clamped to
 * `[0, 1]`; out-of-range maps to the boundary stop. Stops must be
 * pre-sorted by `at` ascending — non-sorted input produces
 * undefined behaviour (no runtime sort; perf-sensitive call site).
 *
 * Pine's `color.from_gradient`.
 *
 * @since 0.5
 * @example
 *     // const blue = "#0000ff";
 *     // const red = "#ff0000";
 *     // color.fromGradient(0.5, [{ at: 0, color: blue }, { at: 1, color: red }]);
 *     // // → "#7f007f" (midpoint blend)
 */
export function fromGradient(t: number, stops: ReadonlyArray<GradientStop>): Color {
    // implementation
}

/**
 * Override an existing color's alpha channel. `alpha` in `[0, 1]`,
 * clamped. NaN → returns the input color unchanged. Pine's
 * `color.new(c, transp)`.
 *
 * @since 0.5
 * @example
 *     // color.withAlpha("#ff0000", 0.5); // → "rgba(255, 0, 0, 0.5)"
 */
export function withAlpha(c: Color, alpha: number): Color {
    // implementation
}

/**
 * Construct a color from RGB(A) components. Each component clamped
 * to `[0, 255]`; alpha defaults to `1`. NaN component clamps to 0.
 *
 * @since 0.5
 * @example
 *     // color.rgb(255, 0, 0); // → "rgb(255, 0, 0)"
 *     // color.rgb(255, 0, 0, 0.5); // → "rgba(255, 0, 0, 0.5)"
 */
export function rgb(r: number, g: number, b: number, alpha?: number): Color {
    // implementation
}

/**
 * Construct a color from HSL(A) components. `h ∈ [0, 360)`,
 * `s, l ∈ [0, 100]`. Alpha defaults to `1`. NaN component clamps to 0.
 *
 * @since 0.5
 * @example
 *     // color.hsl(0, 100, 50); // → "hsl(0, 100%, 50%)"
 *     // color.hsl(0, 100, 50, 0.5); // → "hsla(0, 100%, 50%, 0.5)"
 */
export function hsl(h: number, s: number, l: number, alpha?: number): Color {
    // implementation
}
```

Implementation notes:

- `fromGradient` parses each `stop.color` via a small private
  `parseColor` helper (handles `#rgb`, `#rrggbb`, `rgb(...)`,
  `rgba(...)`, `hsl(...)`, `hsla(...)`, and the named palette
  short-circuits). Interpolation runs in linear RGB space then
  re-emits as `rgb(r, g, b)` or `rgba(r, g, b, a)` if any stop has
  alpha < 1.
- `withAlpha` reuses `parseColor` to extract the existing RGB, then
  emits `rgba(...)`. Idempotent: `withAlpha(withAlpha(c, 0.5), 0.5)
  === withAlpha(c, 0.5)`.
- `rgb` / `hsl` are pure string builders — clamp + format.

### 2. `packages/core/src/color/parseColor.ts` (new, internal)

Pure parser returning `{ r, g, b, a }` ∈ `[0, 255] × [0, 255] × [0, 255] × [0, 1]`
or `null` on unparseable input. JSDoc `@internal`. Used by
`fromGradient` and `withAlpha`. Unit-tested separately.

### 3. `packages/core/src/color/index.ts` — extend

Re-export `{ fromGradient, withAlpha, rgb, hsl }` and the
`GradientStop` type. If the `color` namespace is currently
constructed as an `Object.freeze` block, append the four new
methods. Otherwise re-export top-level functions for consumers who
import them individually.

### 4. `packages/core/src/index.ts`

Re-export `GradientStop`.

### 5. Tests

#### `packages/core/src/color/colorHelpers.test.ts`

- `fromGradient`:
  - Single-stop: every `t` returns that stop's color.
  - Two-stop endpoint values match.
  - Midpoint blend matches expected linear interpolation (assert
    component-wise with a 1-unit tolerance).
  - Out-of-range `t` clamps to nearest stop.
  - `NaN` `t` returns first stop's color.
- `withAlpha`:
  - Idempotent (apply twice → same output).
  - `alpha < 0` clamps to 0; `alpha > 1` clamps to 1.
  - `NaN` alpha returns input unchanged.
  - Round-trip: `withAlpha("#ff0000", 0.5) === "rgba(255, 0, 0, 0.5)"`.
- `rgb`:
  - Each component clamps to `[0, 255]`.
  - `NaN` component → `0`.
  - Alpha-absent emits `rgb(...)`; alpha-present emits `rgba(...)`.
- `hsl`:
  - `h` clamps to `[0, 360)`.
  - `s` / `l` clamp to `[0, 100]`.
  - `NaN` component → `0`.

#### `packages/core/src/color/parseColor.test.ts`

- `#rgb` / `#rrggbb` / `rgb(...)` / `rgba(...)` / `hsl(...)` /
  `hsla(...)` parse correctly.
- Named-palette short-circuits (e.g. `"red"` → `{ r: 255, g: 0, b: 0, a: 1 }`).
- Unparseable input → `null`.

#### `packages/core/src/color/colorHelpers.property.test.ts`

`fast-check`-driven (pinned seed):

- `fromGradient(t, stops)` always returns a parseable CSS color
  string.
- `withAlpha(c, a)` is idempotent for parseable `c`.
- `rgb(r, g, b)` round-trips through `parseColor`.
- `hsl(h, s, l)` round-trips through `parseColor` (with a
  documented small tolerance from the HSL→RGB conversion).

### 6. JSDoc + ambient shim

- Each helper carries `@since 0.5`, `@example`, `@experimental`.
- `CORE_AMBIENT_SHIM` mirrors the new exports.

### 7. README + docs

Auto-generated `docs/primitives/color/` pages pick up the four
helpers + the `GradientStop` type. No manual doc files.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/color/colorHelpers.ts` | Create | Four helpers |
| `packages/core/src/color/parseColor.ts` | Create | Internal CSS parser |
| `packages/core/src/color/colorHelpers.test.ts` | Create | Unit tests |
| `packages/core/src/color/parseColor.test.ts` | Create | Unit tests |
| `packages/core/src/color/colorHelpers.property.test.ts` | Create | Property tests |
| `packages/core/src/color/index.ts` | Modify | Re-export |
| `packages/core/src/index.ts` | Modify | Re-export `GradientStop` |
| `packages/compiler/src/program.ts` | Modify | Mirror in `CORE_AMBIENT_SHIM` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100%)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-color-helpers.md` — `minor` bump for
`@invinite-org/chartlang-core` + `@invinite-org/chartlang-compiler`
(shim). Body cites PLAN §11.4.


- [x] Four helpers + `GradientStop` type exported from core.
- [x] Property tests pin idempotence, range clamping, round-trip.
- [x] NaN fallbacks behave per JSDoc.
- [x] 100% coverage on color helpers + parser.
- [x] `pnpm docs:check` green; auto-generated docs pages exist.
- [x] Changeset committed.
