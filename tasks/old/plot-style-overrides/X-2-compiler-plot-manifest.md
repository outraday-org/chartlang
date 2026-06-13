# Task 2 — Compiler: emit `manifest.plots` static slot descriptors

> **Status: TODO**

## Goal

Make the compiler emit `ScriptManifest.plots` — one
`PlotSlotDescriptor` per `plot()` / `plot.*()` / `hline()` callsite,
in callsite order, carrying the already-issued `slotId`, the
statically-known plot `kind`, and a literal `title` when present.

## Prerequisites

Task 1 (`PlotSlotDescriptor` + `ScriptManifest.plots?` + the ambient
shim).

## Current Behavior

The callsite-rewrite pass `injectCallsiteIds` in
`packages/compiler/src/transformers/callsiteIdInjection.ts` (line 91
mints `const slotId = ` `${sourcePath}:${line + 1}:${character + 1}#0` `;`)
injects the compiler-issued `slotId` into every `plot()` / `hline()`
call (Task 2 of the original bring-up; see
`docs/primitives/plot/plot.md` "The compiler rewrites every callsite").

`buildManifest` lives at `packages/compiler/src/manifest.ts:33` and
already emits `inputs`, optional `outputs?` (current conditional spread
at line 128: `...(outputs === undefined ? {} : { outputs })`),
`dependencies?`, etc. It does **not** record a plot-slot list. The slot
ids and callee identities are known at rewrite time but discarded after
injection.

The compiler currently has **no** plot-namespace → `PlotKind` mapping:
the runtime's `buildStyle` (`packages/runtime/src/emit/plot.ts:26-84`)
owns the runtime-side mapping, but it operates on the resolved
`opts.style` discriminant at emit time, not on the static callee name.
The compiler must derive `kind` from the callee identifier
(`plot.histogram` → `"histogram"`, etc.), so Task 2 introduces a
**new, compiler-private** helper rather than refactoring a shared one.
A runtime↔compiler shared helper is not justified here (different
inputs, different timing).

## Desired Behavior

- During the callsite walk, accumulate a `PlotSlotDescriptor` for each
  plotting callsite:
  - **`slotId`** — the same id injected into the rewritten call (reuse
    the existing issuer; do not re-derive it independently — a second
    derivation path would risk drift from the runtime's emitted ids).
  - **`kind`** — resolved from the callee:
    - `plot(...)` → `"line"`.
    - `plot.histogram` / `plot.area` / `plot.marker` / `plot.shape` /
      `plot.character` / `plot.arrow` / `plot.candleColors` /
      `plot.bgColor` / `plot.barColor` / etc. → the corresponding
      `PlotKind` (one mapping table, shared with `buildStyle`'s kind
      knowledge — keep the table in one module, don't fork it).
    - `hline(...)` → `"horizontal-line"`.
    - A callsite whose kind is **not statically determinable**
      (`plot(x, { style: dynamicVar })`) records `kind: "line"` as a
      documented best-effort fallback (the slot is still listed so the
      embedder can target it; the live emission carries the true kind).
  - **`title`** — set only when the opts object literal has a
    string-literal `title` property. Dynamic / absent title ⇒ omit the
    field.
- `buildManifest` assigns the accumulated array to `manifest.plots`
  when non-empty; omits the field entirely when the script issues no
  plot/hline calls (mirror the `outputs?` omission rule).
- Ordering is deterministic: callsite source order (the construction
  guarantees in `docs/spec/manifest.md` require deterministic manifest
  output for identical source).

## Requirements

### 1. Slot-descriptor accumulation

Thread a `plotSlots: PlotSlotDescriptor[]` accumulator through the
`injectCallsiteIds` visitor in
`packages/compiler/src/transformers/callsiteIdInjection.ts` (same place
the `slotId` is minted at line 91). Push one entry per plotting
callsite. Create a new compiler-private helper
`packages/compiler/src/transformers/plotKindFromCallee.ts` (or whichever
file the callsite walker imports its small utilities from — check the
sibling files in `transformers/` and follow the existing convention)
exporting:

```ts
export function plotKindFromCallee(callee: ts.Expression): PlotKind | undefined;
```

The helper returns the `PlotKind` derived from the callee:
- bare `plot` ⇒ `"line"`
- `plot.histogram` ⇒ `"histogram"`, `plot.area` ⇒ `"area"`,
  `plot.marker` ⇒ `"marker"`, `plot.shape` ⇒ `"shape"`,
  `plot.character` ⇒ `"character"`, `plot.arrow` ⇒ `"arrow"`,
  `plot.candleColors` (alias of `plot.candle`) ⇒ `"candle-override"`,
  `plot.barColor` ⇒ `"bar-color"`, `plot.bgColor` ⇒ `"bg-color"`,
  `plot.barOverride` ⇒ `"bar-override"`,
  `plot.horizontalHistogram` ⇒ `"horizontal-histogram"`,
  `plot.filledBand` ⇒ `"filled-band"`, `plot.label` ⇒ `"label"`,
  `plot.stepLine` ⇒ `"step-line"`
  (mirror the full `PlotKind` union in
  `packages/core/src/plot/plot.ts:30-46`).
- `hline` ⇒ `"horizontal-line"`
- callsite kind not statically determinable (`plot(x, { style:
  dynamicVar })`) ⇒ helper returns `undefined`; the accumulator falls
  back to `"line"` with a `// best-effort dynamic-kind fallback` note.

### 2. `buildManifest` wiring

In `packages/compiler/src/manifest.ts:33` (function `buildManifest`),
mirror the existing `outputs` conditional pattern from line 128 — keep
both spreads co-located:

```ts
const plots =
    plotSlots.length === 0
        ? undefined
        : Object.freeze(plotSlots.map((s) => Object.freeze({ ...s })));
// ... in the returned object:
...(outputs === undefined ? {} : { outputs }),
...(plots === undefined ? {} : { plots }),
```

`buildManifest` needs a new optional input parameter
`plotSlots: ReadonlyArray<PlotSlotDescriptor>` (default `[]`) — the
caller in the bundler hands it the array accumulated by
`injectCallsiteIds`.

### 3. Tests (`packages/compiler/src/manifest.test.ts` + helper test)

`manifest.test.ts` currently has 4 tests (frozen-manifest, full-field
carry-through, drawing kind, alert-condition freezing) and no `outputs`
or `dependencies` test. Add a new `describe("plots")` block:

- A script with `plot(close)` + `plot.histogram(vol, { title: "Vol" })`
  + `hline(70)` → `manifest.plots` is a 3-entry array with:
  - entry 0: `{ slotId: <id0>, kind: "line" }` (no title).
  - entry 1: `{ slotId: <id1>, kind: "histogram", title: "Vol" }`.
  - entry 2: `{ slotId: <id2>, kind: "horizontal-line" }`.
- Each entry is `Object.freeze`-d; the array is `Object.freeze`-d.
- The `slotId`s equal the ids `injectCallsiteIds` mints from the same
  source positions (format: `` `${sourcePath}:${line + 1}:${col + 1}#0`
  ``). Use the same compile-then-inspect-bundle helper the
  rest of `manifest.test.ts` uses (or extend `manifest.test.ts` with
  the existing bundler harness used in `bundler.test.ts` if the
  manifest tests are pure-call). Cross-check the runtime side by
  loading the bundle in a quick `createScriptRunner` run and asserting
  `drain().plots[*].slotId` is a superset of `manifest.plots[*].slotId`.
- A script with **no** plot/hline calls → `manifest.plots` is `undefined`
  (field omitted), not `[]`.
- A `plot(x, { style: someEnumInput })` dynamic-style callsite → entry
  with `kind: "line"` (best-effort) and no title; assert the slot is
  still present and that `plotKindFromCallee` returns `undefined` for
  this callee shape via a unit test on the helper.
- Round-trip: bundle → JSON.stringify(manifest) → JSON.parse →
  deep-equal the original `manifest.plots`.
- Property test (per §16.3 compiler requires property tests): for a
  random callsite ordering (shuffle a fixed set of `plot()` and
  `hline()` calls inside the script source), the resulting
  `manifest.plots` ordering matches the source order of the input
  script (deterministic ordering).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Modify | Accumulate one `PlotSlotDescriptor` per plotting callsite alongside the existing `slotId` minting at line 91; expose the array to the caller (return value or a context out-param) |
| `packages/compiler/src/transformers/plotKindFromCallee.ts` | Create | New compiler-private helper: `plotKindFromCallee(callee: ts.Expression): PlotKind \| undefined` covering bare `plot`, every `plot.*` member, `hline`, and the dynamic fallback |
| `packages/compiler/src/transformers/plotKindFromCallee.test.ts` | Create | Unit coverage for every callee shape (bare, every `plot.*`, `hline`, dynamic) |
| `packages/compiler/src/manifest.ts` | Modify | Accept `plotSlots` parameter; spread `plots` adjacent to the existing `outputs` spread at line 128 |
| `packages/compiler/src/bundler.ts` (or whichever caller invokes `buildManifest` + `injectCallsiteIds` — verify via `grep -n "buildManifest" packages/compiler/src/`) | Modify | Wire the accumulated slots from `injectCallsiteIds` into the `buildManifest` call |
| `packages/compiler/src/manifest.test.ts` | Modify | New `describe("plots")` block: titled, untitled, hline, dynamic-style, empty, round-trip, property-test ordering |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-compiler test` (coverage 100%)
- `pnpm docs:check`

## Changeset

`.changeset/plot-overrides-2-compiler.md` —
`@invinite-org/chartlang-compiler` `minor`. Additive manifest field;
no change to compiled module source or existing manifest fields.

## Acceptance Criteria

- `manifest.plots` lists one entry per plotting callsite in source
  order, with correct `slotId`, `kind`, and literal `title` when present.
- Emitted `slotId`s match the runtime's emitted `PlotEmission.slotId`s
  for the same script (cross-checked via the `createScriptRunner` →
  `drain()` assertion in the test).
- Field omitted (not `[]`) when no plot/hline calls exist.
- Dynamic-style callsites still produce a listed slot (best-effort
  `kind: "line"`); `plotKindFromCallee` returns `undefined` for that
  callee, and the fallback is unit-tested.
- Each `PlotSlotDescriptor` entry and the enclosing array are
  `Object.freeze`-d to match `outputs?`'s freezing convention.
- `manifest.plots` survives `JSON.stringify` → `JSON.parse` round-trip
  unchanged.
- Property test confirms `manifest.plots` ordering = source order of the
  plot/hline callsites.
- Compiler coverage stays 100%; `pnpm docs:check` green (no new public
  exports — `plotKindFromCallee` is module-internal — so no new JSDoc
  burden on this task).
- Changeset `.changeset/plot-overrides-2-compiler.md` committed (`minor`
  for `@invinite-org/chartlang-compiler`).
