# Task 1 — Core types + compiler manifest propagation

> **Status: TODO**

## Goal

Persist `defineIndicator({ overlay })` onto `ScriptManifest.overlay`
so the runtime can use it as the script-level default pane signal.
Add `pane?: "overlay" | "new" | string` to `HLineOpts` so hlines
participate in the same pane router the next task wires up. Update
the compiler's ambient shim + manifest builder so the field round-
trips through `compile()` → `__manifest` → re-import.

## Prerequisites

None.

## Current Behavior

- `DefineIndicatorOpts.overlay?: boolean` (`packages/core/src/define/defineIndicator.ts:27`)
  is accepted by the constructor but **never spread onto the manifest**
  (`defineIndicator.ts:69-80`). Authors who write `overlay: false` see
  the flag silently dropped — `defineIndicator({ overlay: false })()`
  produces a manifest identical to the no-`overlay` form.
- `ScriptManifest` (`packages/core/src/types.ts:266-369`) has no
  `overlay` field.
- `HLineOpts` (`packages/core/src/plot/plot.ts:251-256`) has no `pane`
  field. The runtime hline emit (`packages/runtime/src/emit/hline.ts:41`)
  is hard-pinned to `pane: "overlay"`.
- The compiler's ambient core shim
  (`packages/compiler/src/program.ts:1280-1298`) declares
  `ScriptManifest` without the `overlay` field; `DefineIndicatorOpts`
  at lines 1302-1309 lists `overlay?: boolean` (so it passes type
  checks already), but the field has no destination.
- `packages/compiler/src/manifest.ts` builds the JSON manifest from
  the `defineIndicator` call expression; it does not read `overlay`.

## Desired Behavior

- `ScriptManifest.overlay?: boolean` is a documented optional field
  (Phase 2+ surface). Absent / `true` mean "overlay" (matches
  existing default); explicit `false` means "subpane routing
  requested" — the runtime in Task 2 reads it as the script-level
  default pane.
- `HLineOpts.pane?: "overlay" | "new" | string` lets hlines opt into
  a non-overlay pane in the same shape as `PlotOpts.pane`. JSDoc
  notes that omitting `pane` defaults to the script's
  manifest-resolved default (which is `"overlay"` unless `overlay:
  false` was set), so existing scripts are unaffected.
- `defineIndicator({ overlay })` spreads the flag onto the frozen
  manifest object.
- The compiler's `buildManifest` reads `overlay` from the
  `defineIndicator(...)` opts AST node and emits the field on the
  `__manifest` JSON.
- The ambient shim's `ScriptManifest` type carries the `overlay?:
  boolean` field so downstream packages (runtime, host-worker)
  type-check against the same shape.

## Requirements

### 1. `packages/core/src/types.ts` — add the field to `ScriptManifest`

Append a new optional field with JSDoc:

```ts
/**
 * `overlay: false` on `defineIndicator(...)` is persisted here as the
 * script-level default pane signal. Absent / `true` means the script
 * defaults to the price overlay pane; `false` means the runtime
 * routes every `plot()` / `hline()` call without an explicit `pane`
 * opt into a per-script subpane key.
 *
 * @since 0.2
 * @stable
 * @example
 *     const m: Pick<ScriptManifest, "overlay"> = { overlay: false };
 *     void m;
 */
readonly overlay?: boolean;
```

Place alphabetically after `maxLookback` and before `maxDrawings` to
keep the JSDoc-driven docs page ordering stable.

### 2. `packages/core/src/define/defineIndicator.ts` — store `overlay`

Spread `overlay` into the manifest builder block (lines 69-80):

```ts
const manifest = {
    ...base,
    ...(opts.overlay === undefined ? {} : { overlay: opts.overlay }),
    ...(opts.maxDrawings === undefined ? {} : { maxDrawings: opts.maxDrawings }),
    // ... existing spreads stay
};
```

Conditional spread — absent stays absent, present (including `true`)
is preserved. Matches the existing `maxDrawings` / `maxBarsBack` /
etc. pattern.

### 3. `packages/core/src/define/defineIndicator.test.ts` — round-trip test

Add two cases:

- `defineIndicator({ name: "x", apiVersion: 1, overlay: false,
  compute() {} }).manifest.overlay === false`
- `defineIndicator({ name: "x", apiVersion: 1, compute() {} })
  .manifest.overlay === undefined` (absence preserved).

### 4. `packages/core/src/plot/plot.ts` — extend `HLineOpts`

Add `pane?: "overlay" | "new" | string` with JSDoc:

```ts
/**
 * Styling options accepted by `hline(...)`. `pane` follows the same
 * shape as {@link PlotOpts.pane}: omit to fall back to the script's
 * manifest-resolved default (overlay unless `defineIndicator({
 * overlay: false })` was declared); `"overlay"` pins the line to the
 * price pane; `"new"` opens / joins the per-script subpane; named
 * panes route to a shared subpane key.
 *
 * @since 0.1
 * @example
 *     const opts: HLineOpts = {
 *         color: "#ef4444",
 *         title: "RSI 70",
 *         lineStyle: "dashed",
 *         pane: "new",
 *     };
 */
export type HLineOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    pane?: "overlay" | "new" | string;
}>;
```

### 5. `packages/core/src/plot/plot.types.test.ts` — type round-trip

Add `expectType<HLineOpts>({ pane: "new" })` and
`expectType<HLineOpts>({ pane: "rsi" })` lines under the existing
HLine type assertions (if the file already pattern-matches HLine
shape; otherwise add the standard `void` pattern used elsewhere in
that file).

### 6. `packages/compiler/src/manifest.ts` — emit `overlay`

Locate the manifest object builder (the function that walks the
`defineIndicator({...})` argument literal and copies recognised
fields onto the emitted `__manifest`). Add a read for the `overlay`
property; when present and statically `true` / `false`, copy it onto
the manifest JSON. When the property is absent or not a boolean
literal, do not emit the field (matches existing handling for
`maxBarsBack`, `format`, etc.).

The shape mirrors `defineIndicator.ts` — copy the conditional spread
idiom.

### 7. `packages/compiler/src/manifest.test.ts` — bundle round-trip

Add a test that compiles a minimal `defineIndicator({ overlay: false,
... })` source via `compile()`, dynamically `import()`s the bundle,
and asserts `__manifest.overlay === false`. Add a sibling test
asserting `overlay: true` round-trips. Add a third test asserting
that omitting the property leaves `__manifest.overlay` absent.

### 8. `packages/compiler/src/program.ts` ambient shim

Update the `ScriptManifest` declaration block (~lines 1280-1298) to
include `readonly overlay?: boolean;`. The shim is the compiler's
authoritative view of core's types — keep it in lockstep with
`packages/core/src/types.ts` per the package CLAUDE.md invariant.

### 9. `packages/core/README.md`

Bump the "Public surface" section's stability marker line for
`HLineOpts` if it lists a field count; ensure the `ScriptManifest`
example block (if one exists) covers `overlay`. Stay under the 100-
line cap.

### Edge cases

- **`overlay: true` is preserved** — the field is round-tripped
  faithfully even though `true` is the existing implicit default;
  Task 2's runtime resolves the pane key from absence vs explicit
  `false`, not from `true`.
- **JSDoc gate** — every new field and new option carries `@since`,
  stability marker (`@stable`), and `@example`. The
  `packages/core/src/types.types.test.ts` is updated to typecheck the
  new field.
- **Coverage gate** — the conditional-spread branch in
  `defineIndicator.ts` adds one new branch; the new round-trip test
  covers both arms.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | Add `overlay?: boolean` to `ScriptManifest` |
| `packages/core/src/types.types.test.ts` | Modify | Cover the new field |
| `packages/core/src/define/defineIndicator.ts` | Modify | Spread `overlay` onto the manifest |
| `packages/core/src/define/defineIndicator.test.ts` | Modify | Round-trip + absence tests |
| `packages/core/src/plot/plot.ts` | Modify | Add `pane?` to `HLineOpts` + JSDoc |
| `packages/core/src/plot/plot.types.test.ts` | Modify | Type assertion for `HLineOpts.pane` |
| `packages/core/README.md` | Modify (if needed) | Reflect new optional fields |
| `packages/compiler/src/manifest.ts` | Modify | Emit `overlay` on `__manifest` JSON |
| `packages/compiler/src/manifest.test.ts` | Modify | Bundle round-trip for `overlay` |
| `packages/compiler/src/program.ts` | Modify | Ambient shim — add `overlay?` to `ScriptManifest` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core test` (coverage 100%)
- `pnpm -F @invinite-org/chartlang-compiler test` (coverage 100%)
- `pnpm docs:check`
- `pnpm readme:check`

## Changeset

`.changeset/subpane-1-core-compiler.md` — `@invinite-org/chartlang-core`
and `@invinite-org/chartlang-compiler` get a `minor` bump; the
`ScriptManifest` shape change is additive (existing consumers keep
working without the new field).

## Acceptance Criteria

- `defineIndicator({ overlay: false }).manifest.overlay === false`
  asserted by unit test.
- `defineIndicator({ overlay: true }).manifest.overlay === true`
  asserted.
- Omitting `overlay` produces `manifest.overlay === undefined` —
  no implicit `true` injection.
- `compile()` of a script with `overlay: false` produces a bundle
  whose `__manifest.overlay === false` after dynamic import.
- The ambient shim's `ScriptManifest` carries `overlay?: boolean`;
  `packages/runtime/` continues to type-check against the shim
  unchanged.
- `HLineOpts.pane` accepts `"overlay" | "new" | "<id>"` per the
  type assertion test.
- Coverage stays at 100% on `core` and `compiler`.
- `pnpm docs:check` + `pnpm readme:check` green.
- Changeset committed; semver bump is `minor`.
