# Unify compiled manifest + centralize module loader

> **Status: TODO**

## Goal

Kill the "two-manifest" footgun. A compiled `.chart.js` today exports a
`default` whose `.manifest` is a **zeroed stub** and a separate
`export const __manifest` holding the real one. Feeding `mod.default`
straight into `createScriptRunner` silently collapses series capacity to
`1` (every `[n]` read → NaN forever, MTF feeds drop) with **no error**.
Make the emitted `default` carry the real manifest, and centralize the
module→runnable merge behind one loader that fails loud on a stub.

## Prerequisites

None.

## Current Behavior

- **Stub source** — `defineIndicator` builds `.manifest` at author-eval
  time with hard zeros (`packages/core/src/define/defineIndicator.ts:68-79`):
  `maxLookback: 0`, `seriesCapacities` `{}`, `requestedIntervals` `[]`,
  no `plots`. This is *correct* for the author/test context, which
  cannot know lookback/plots before the compiler's static analysis (JSDoc
  at `defineIndicator.ts:46-51` says so). `defineAlert` / `defineDrawing`
  / `defineAlertCondition` carry the identical stub.
- **Real manifest** — the compiler computes it and appends
  `export const __manifest = {...}` via `formatManifestAssignment`
  (`packages/compiler/src/bundle.ts:223-230`) at
  `packages/compiler/src/api.ts:772-776`. The emitted `default` is a
  frozen object returned by `defineIndicator(...)`
  (`examples/scripts/ema-cross.chart.js:919,936-939`), so its `.manifest`
  is the stub.
- **Capacity collapse** — `resolveCapacity`
  (`packages/runtime/src/createScriptRunner.ts:214-224`) computes
  `Math.max(1, ohlcv ?? (maxLookback + 1), dynamicFallback ?? 0)`. Stub →
  `Math.max(1, 1, 0) = 1`. Every `Float64RingBuffer` sized to 1 retains
  only the head; `series[1]` is out-of-range → NaN on every bar; empty
  `requestedFeeds` → zero secondary streams. Nothing throws.
- **Triplicated merge** — the correct behavior (`{ ...mod.default,
  manifest: mod.__manifest }`) is re-implemented in three places:
  `packages/host-worker/src/createWorkerBoot.ts:95-96`,
  `packages/conformance/src/runConformanceSuite.ts:718-723`, and
  host-quickjs's dispatcher. Every shipped path is correct; the footgun
  is only for an **external integrator** who bypasses them.

## Desired Behavior

1. `mod.default.manifest` on a **compiled** bundle equals the real
   manifest (`=== __manifest` in value), so feeding `mod.default`
   directly to the runner Just Works.
2. A single shared loader helper is the documented module→runnable
   bridge; it prefers `__manifest`, and **throws a clear error** if
   handed a stub-shaped manifest with no `__manifest` sidecar.
3. The manifest *values* are unchanged (byte-identical JSON); only the
   compiled-bundle tail and the shared load path change.

## Design

Two complementary changes; land both.

### A. Compiler emits `default` carrying the real manifest

You **cannot** mutate the frozen stub in place — `defineIndicator`
returns `Object.freeze(...)` with a frozen `.manifest`
(`defineIndicator.ts:94-99`), and compiled ESM runs in strict mode, so
`default.manifest = __manifest` throws `TypeError: Cannot assign to read
only property`. Instead, rebuild-and-re-export at the emit seam
(`packages/compiler/src/api.ts:776`, right after the `__manifest`
append). Emit, after both the default binding and the `__manifest`
const:

```js
// <slug>_chart_default is the emitted default binding (capture its name
// from the bundle, as callsiteId capture already does)
var <slug>_chart_default_compiled = Object.freeze({
    ...<slug>_chart_default,
    manifest: __manifest,
});
export { <slug>_chart_default_compiled as default };
```

Notes:
- Spread copies own enumerable props (`compute`, dep-accessor sentinels)
  off the frozen stub; re-freezing preserves the immutability contract.
- Codegen must capture the emitted default binding name (esbuild-derived
  `<slug>_chart_default`) — reuse the mechanism the bundler already uses
  to know the default export identifier; do **not** hardcode a name.
- For the **multi-manifest** (siblings) case (`api.ts:772-775`,
  `result.siblings !== undefined`), `default` is a single script — attach
  the primary `result.manifest` (the array form is the sidecar only). Do
  not attach an array to `default.manifest`.

### B. Centralize the merge into one loader + loud guard

Promote the duplicated `buildBundleFromModule` into a single shared
helper (in `runtime`, or a small `loader` module core+runtime can share)
and have host-worker, conformance, and host-quickjs call it. It receives
the raw module namespace (`mod.default` + `mod.__manifest`) and:

- prefers `mod.__manifest` when present (single) / the sibling array
  (multi);
- returns `Object.freeze({ ...mod.default, manifest })`;
- **throws** `ChartlangError("manifest-stub: module default carries a
  stub manifest (maxLookback 0, no plots/feeds) and no __manifest sidecar
  was found — pass a compiled bundle, not an author-eval object")` when
  `mod.__manifest` is absent AND `mod.default.manifest` is stub-shaped
  (`maxLookback === 0 && plots` empty `&& seriesCapacities` empty `&&
  requestedFeeds` empty).

This removes the triple-implementation drift and gives one authoritative
place to fail loud. Document this helper in `packages/runtime/CLAUDE.md`
(and host CLAUDE files) as THE module→runner entry; note in
`createScriptRunner`'s JSDoc that a raw author-eval `defineIndicator`
object is not a valid input.

> Rationale for both: **A** protects external integrators who call
> `createScriptRunner(mod.default)` directly (the actual footgun); **B**
> dedupes the shipped hosts and turns any remaining stub misuse into a
> clear error instead of silent all-NaN.

## Requirements

### 1. Compiler codegen (`packages/compiler/src/api.ts`, `bundle.ts`)

Emit the rebuilt, re-frozen `default` carrying the real manifest at the
`__manifest` append seam (`api.ts:772-776`). Add a `bundle.ts` helper
alongside `formatManifestAssignment` (`bundle.ts:223-230`) if the
default-rebuild string is non-trivial. Handle single + siblings cases.

### 2. Shared loader helper (`packages/runtime/src/` or new `loader`)

Extract `buildBundleFromModule(mod)` with the prefer-`__manifest` +
stub-guard logic above; export it. Point
`host-worker/src/createWorkerBoot.ts:80-96`,
`conformance/src/runConformanceSuite.ts:714-723`, and host-quickjs's
dispatcher at it (delete the local copies).

### 3. Runtime guard doc (`createScriptRunner.ts`)

Add JSDoc to `createScriptRunner` stating the manifest must be the
compiled one (from `__manifest` / the shared loader), not a raw
`defineIndicator` return. Optionally add a lightweight dev-only
`console.warn` if `resolveCapacity` sees the exact stub shape — but the
authoritative guard lives in the loader (§2), which has the `__manifest`
to disambiguate; `createScriptRunner` alone cannot tell a stub from a
legitimately-trivial script.

### 4. Tests

- **Compiler:** a test that compiles a script with `maxLookback > 0` /
  plots / a secondary feed and asserts `mod.default.manifest` deep-equals
  `mod.__manifest` (not the stub). Extend the existing e2e that greps for
  `/__manifest/` (`packages/cli/src/e2e.test.ts:42-44`).
- **Loader:** unit tests for `buildBundleFromModule` — (a) merges
  `__manifest` over default, (b) throws on stub-without-sidecar, (c)
  passes a legitimately-trivial compiled script (has `__manifest`, small
  manifest) without throwing.
- **Runtime regression:** run a compiled multi-`[1]` / MTF script through
  the shared loader and assert finite history reads + registered
  secondary streams (guards against a future re-collapse).
- **Core stays green:** `defineIndicator.test.ts:24`
  (`manifest.maxLookback === 0`) and siblings pin the *author* stub —
  they must remain unchanged and passing (this task does not touch the
  core factory).

### 5. Regenerate committed compiled artifacts + snapshots

- Regenerate the committed `examples/scripts/*.chart.js` (7 files:
  `ema-cross`, `bollinger-bands`, `rsi-divergence-alert`,
  `fib-retracement`, `daily-rsi-divergence`, `session-high-alert`,
  `mintick-snapped-entry`) — they carry the `default` + `__manifest`
  tail.
- Update the compiler bundle snapshots/substring assertions that pin the
  emitted tail: `packages/compiler/src/compile.test.ts:42`,
  `bundle.test.ts:151`, `bundle.property.test.ts`, and the `__manifest`
  round-trip in `manifest.test.ts:150-169`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/api.ts` (~772-776) | Modify | emit rebuilt+re-frozen `default` with real manifest |
| `packages/compiler/src/bundle.ts` (~223-230) | Modify | helper for the default-rebuild emission |
| `packages/runtime/src/loadBundle.ts` (or `loader/`) | Create | shared `buildBundleFromModule` + stub guard |
| `packages/host-worker/src/createWorkerBoot.ts` (80-96) | Modify | call shared loader; delete local merge |
| `packages/conformance/src/runConformanceSuite.ts` (714-723) | Modify | call shared loader |
| host-quickjs dispatcher | Modify | call shared loader |
| `packages/runtime/src/createScriptRunner.ts` | Modify | JSDoc: require compiled manifest |
| `examples/scripts/*.chart.js` (7) | Generate | regenerate compiled tail |
| compiler snapshot/substring tests | Modify | re-pin emitted tail |
| loader + compiler manifest-equality tests | Create | see §4 |

## Non-Goals

- **No manifest value change.** The JSON in `__manifest` is unchanged;
  `default.manifest` merely stops being the stub. No golden *values*
  shift — only the compiled-bundle text and its snapshots.
- **No change to the author-context stub.** `defineIndicator` keeps
  returning `maxLookback: 0`; `defineIndicator.test.ts` stays green.
- **No `apiVersion` bump.** Additive within `apiVersion: 1`.

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm format`.
- `pnpm test` — compiler, runtime, conformance, host packages (incl. new
  loader tests); coverage 100%.
- `pnpm conformance` + `pnpm conformance:check` — unchanged results
  (values identical; only the load path centralized).
- Rebuild + re-run the earlier repro: `createScriptRunner` fed the
  freshly compiled `mod.default` of an MTF / `[1]`-heavy script produces
  finite output (previously all-NaN).

## Changeset

`.changeset/manifest-unify.md` — `"@invinite-org/chartlang-compiler":
minor`, `"@invinite-org/chartlang-runtime": minor` (+ host packages
patch). Body: "Compiled bundles now carry the real manifest on their
`default` export (no longer a stub), and a shared `buildBundleFromModule`
loader merges `__manifest` and throws on a stub-shaped manifest instead
of silently collapsing series capacity to 1."

## Acceptance Criteria

- For a compiled script with `maxLookback > 0` / plots / a secondary
  feed, `mod.default.manifest` deep-equals `mod.__manifest`; the emitted
  `default` is frozen; `compute` and dep-accessor sentinels survive the
  rebuild.
- Feeding that `mod.default` straight into `createScriptRunner` yields
  finite history reads and registered secondary streams (no capacity
  collapse).
- One shared `buildBundleFromModule` is the single merge implementation;
  host-worker, conformance, and host-quickjs call it; it throws a clear
  error on a stub-without-sidecar and passes a trivial compiled script.
- `defineIndicator.test.ts` (author stub) unchanged and green; manifest
  JSON byte-identical; conformance results unchanged.
- Committed compiled artifacts + compiler snapshots regenerated; all
  gates green; changeset committed.
