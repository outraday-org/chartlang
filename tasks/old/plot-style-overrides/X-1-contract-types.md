# Task 1 — Contract types: PlotSlotDescriptor, PlotOverride, PlotEmission.visible, resolvePlotOverrides

> **Status: TODO**

## Goal

Land the additive type contract in `core` + `adapter-kit` that the
compiler (Task 2), runtime + hosts (Task 3), and conformance (Task 4)
build on:

- `PlotSlotDescriptor` + `ScriptManifest.plots?` (static slot list).
- `PlotOverride` (presentation override record).
- `PlotEmission.visible?` (optional, omitted ⇒ visible).
- `Adapter.resolvePlotOverrides?` (mount-time override resolver).
- `validateEmission` accepts the optional `visible` flag.

No behavior changes ship here — only types + the validator arm. Other
packages stay green because every field is optional.

## Prerequisites

None.

## Current Behavior

- `packages/core/src/types.ts:266-422` — `ScriptManifest` has `inputs`
  (270) and optional `outputs?` (384) but no plot-slot list.
- `packages/adapter-kit/src/types.ts:457-468` — `PlotEmission` has no
  `visible` field. `:727-758` — `Adapter` has `resolveInputs?` (744) but
  no plot-override resolver.
- `packages/adapter-kit/src/validation/validateEmission.ts` — validates
  plot emissions with no `visible` arm.

## Desired Behavior

### 1. `packages/core/src/types.ts` — new types + manifest field

```ts
/**
 * One plotted-slot descriptor in `ScriptManifest.plots`. The compiler
 * emits one entry per `plot()` / `plot.*()` / `hline()` callsite so an
 * embedder can build a style/visibility UI keyed by the stable
 * `slotId` before the first emission. `title` is present only when the
 * call's opts carries a string-literal `title`.
 *
 * @since <minor>
 * @stable
 * @example
 *     const slot: PlotSlotDescriptor = {
 *         slotId: "ema.ts:12:5#0",
 *         kind: "line",
 *         title: "EMA",
 *     };
 *     void slot;
 */
export type PlotSlotDescriptor = {
    readonly slotId: string;
    readonly kind: PlotKind;
    readonly title?: string;
};

/**
 * Host-supplied presentation override for a single plot slot, keyed by
 * `PlotEmission.slotId`. Applied by the runtime at emit time; never
 * affects `compute`. `lineWidth` / `lineStyle` apply only to the
 * line-family plot kinds (`line`, `step-line`, `horizontal-line`,
 * `area`); ignored as a silent no-op on other kinds.
 *
 * @since <minor>
 * @stable
 * @example
 *     const override: PlotOverride = {
 *         visible: false,
 *         color: "#ff0000",
 *         lineWidth: 2,
 *         lineStyle: "dashed",
 *     };
 *     void override;
 */
export type PlotOverride = {
    readonly visible?: boolean;
    readonly color?: string;
    readonly lineWidth?: number;
    readonly lineStyle?: LineStyle;
};
```

Add to `ScriptManifest` (after `outputs?`, ~line 384):

```ts
/**
 * Static plot-slot descriptors — one per `plot()` / `hline()` callsite,
 * in callsite order. Lets an embedder enumerate plottable slots (and
 * key per-slot style/visibility overrides) without waiting for the
 * first emission. Absent on scripts that issue no plot/hline calls.
 * @since <minor>
 */
readonly plots?: ReadonlyArray<PlotSlotDescriptor>;
```

`LineStyle` (`packages/core/src/types.ts:140`) and `PlotKind`
(`packages/core/src/plot/plot.ts:30-46`) already exist in core — import,
don't redeclare. Both new types must be JSON-clean (no functions / class
instances) per the manifest + emission wire rules. `@example` blocks
are executed by `scripts/docs-check.ts`; the `void <name>;` pattern
keeps them runnable without side effects.

### 2. `packages/adapter-kit/src/types.ts` — re-exports + emission + adapter

- Re-export from core beside `PlotKind = CorePlotKind` (~line 78):
  ```ts
  export type PlotSlotDescriptor = CorePlotSlotDescriptor;
  export type PlotOverride = CorePlotOverride;
  ```
- `PlotEmission` (457-468) gains, after `pane`:
  ```ts
  /** Omitted ⇒ visible. Set to `false` by the runtime when a host
   *  override hides this slot; the adapter SHOULD skip rendering and
   *  y-scale inclusion but keep the slot listed. @since <minor> */
  readonly visible?: boolean;
  ```
  Update the `@example` block (`:444-456`) — leave `visible` out of the
  example to document the omitted-by-default shape.
- `Adapter` (727-758) gains, after `resolveInputs?` (744):
  ```ts
  /**
   * Optional per-script plot-override resolver. Called by hosts at
   * mount with the script id/name; returns a `slotId → PlotOverride`
   * map the runtime applies to emissions. Presentation-only — never
   * affects `compute`. Hosts may also push live updates after mount
   * (see `ScriptHost.setPlotOverrides`).
   * @since <minor>
   * @stable
   * @example
   *     const resolvePlotOverrides: Adapter["resolvePlotOverrides"] =
   *         () => ({ "ema.ts:12:5#0": { visible: false } });
   *     void resolvePlotOverrides;
   */
  readonly resolvePlotOverrides?: (
      scriptId: string,
  ) => Readonly<Record<string, PlotOverride>>;
  ```

### 3. `packages/adapter-kit/src/validation/validateEmission.ts` — accept `visible`

Add a single optional arm to the plot-emission validator: if `visible`
is present it MUST be a boolean, else reject with the existing
malformed-emission path. Absence is valid. No other change — `color`,
`style`, `pane` validation is untouched.

### 4. Ambient shim

`packages/compiler/src/program.ts` carries the ambient core types as a
**template-string** constant `CORE_AMBIENT_SHIM` (declared via `declare
module "@invinite-org/chartlang-core" { ... }`). The `ScriptManifest`
shim is at lines 1045-1068; `OutputDeclaration` is shimmed just above
it at lines 1032-1035. Add two new declarations inside the same shim
string:

```ts
export type PlotSlotDescriptor = Readonly<{
    readonly slotId: string;
    readonly kind: PlotKind;
    readonly title?: string;
}>;
```

(place beside `OutputDeclaration` for symmetry), then add
`readonly plots?: ReadonlyArray<PlotSlotDescriptor>;` to the
`ScriptManifest` shim immediately after `readonly outputs?:` (line 1064).
`PlotKind` is already shimmed at lines 711-727 — reuse it. `PlotOverride`
is **not** read inside `compute` / `defineIndicator`, so it does **not**
need to be added to the ambient shim.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Modify | `PlotSlotDescriptor`, `PlotOverride`, `ScriptManifest.plots?` (with executable `@example` blocks) |
| `packages/core/src/types.types.test.ts` | Modify | Type-level round-trip / JSON-clean `expectTypeOf` assertions for the two new types and the manifest field |
| `packages/adapter-kit/src/types.ts` | Modify | Re-exports (beside `PlotKind` / `DrawingCounts` at lines 78 / 188), `PlotEmission.visible?` after `pane`, `Adapter.resolvePlotOverrides?` after `resolveInputs?` (744) |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | Optional `visible` boolean arm in the plot-emission validator |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | Accept `visible: false`; accept omitted `visible`; reject `visible: "no"` |
| `packages/compiler/src/program.ts` | Modify | `CORE_AMBIENT_SHIM` template string — declare `PlotSlotDescriptor` beside `OutputDeclaration` (lines 1032-1035) and add `plots?` to the `ScriptManifest` shim (after line 1064) |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-core -F @invinite-org/chartlang-adapter-kit test` (coverage 100%)
- `pnpm docs:check`

## Changeset

`.changeset/plot-overrides-1-types.md` — `minor` bump for
`@invinite-org/chartlang-core` and `@invinite-org/chartlang-adapter-kit`.
Purely additive optional fields; no existing emission shape changes.

## Acceptance Criteria

- `PlotSlotDescriptor` + `PlotOverride` exported from core (each with a
  JSDoc block carrying `@since <minor>`, `@stable`, and an executable
  `@example` — `scripts/docs-check.ts` runs every example block) and
  re-exported from adapter-kit.
- `ScriptManifest.plots?` typed and JSON-clean; absence is valid.
- `PlotEmission.visible?` is optional; the existing `@example` block
  (adapter-kit/src/types.ts:443-455) is left as-is (omitted ⇒ visible).
- `Adapter.resolvePlotOverrides?` typed mirroring `resolveInputs`
  (`(scriptId: string) => Readonly<Record<string, PlotOverride>>`) with
  its own `@since` + `@stable` + executable `@example`.
- `validateEmission` accepts `visible: false`, accepts omission, rejects
  a non-boolean `visible` via the existing malformed-emission path.
- Ambient `CORE_AMBIENT_SHIM` template string in
  `packages/compiler/src/program.ts` carries the new
  `PlotSlotDescriptor` declaration and the `ScriptManifest.plots?`
  field; `PlotOverride` is intentionally **not** shimmed (not used in
  script-side `compute`).
- All touched packages stay at 100% coverage; `pnpm docs:check` green
  (the executor in `scripts/docs-check.executor.ts` runs every
  `@example` body and fails the gate on any throw).
- Changeset `.changeset/plot-overrides-1-types.md` committed (`minor`
  for `@invinite-org/chartlang-core` and
  `@invinite-org/chartlang-adapter-kit`).
