# Task 2 — Compiler: thread `visible` into `manifest.plots`

> **Status: TODO**

## Goal

Make the compiler recognise the new `visible` plot opt at a `plot(...)`
callsite and, when it is a **compile-time constant**, record it as
`defaultVisible` on the matching `manifest.plots[*]` descriptor (for host
legend / visibility UI). Confirm callsite-id injection and
`plotKindFromCallsite` are unaffected by the new opt. No runtime behaviour
here — that is Task 3.

## Prerequisites

Task 1 (core `PlotOpts.visible` + shim).

## Current Behavior

- `injectCallsiteIds` / `callsiteIdInjection.ts` mints a stable `slotId`
  (`<sourcePath>:<line>:<col>#<callIndex>`) per `plot()`/`hline()` callsite and
  accumulates one `PlotSlotDescriptor` per callsite into `manifest.plots`
  (compiler CLAUDE.md §`manifest.plots[*].slotId`).
- `plotKindFromCallsite` derives the plot `kind` from the callsite's `style`
  object, mirroring the runtime's `buildStyle`.
- `manifest.plots[*]` records static, host-facing descriptor fields (slotId,
  kind, title) — the **per-bar** numeric value is NOT in the manifest; it
  flows through emissions at runtime.

## Desired Behavior

- A `plot(x, { visible: false })` (or `{ visible: <literal/true> }`) callsite
  records `defaultVisible: false` (or `true`) on its `manifest.plots[*]`
  descriptor — a static hint a host can use to pre-toggle a legend entry.
- A `plot(x, { visible: <non-literal expr> })` (e.g. `{ visible: showSlope }`,
  an input-driven boolean) records **no** `defaultVisible` (it is resolved per
  run at runtime); the manifest stays silent rather than guessing.
- Callsite-id injection, `slotId` minting, and `plotKindFromCallsite` are
  unchanged — the `visible` opt is just another recognised property.

## Requirements

### 1. `PlotSlotDescriptor.defaultVisible` (compiler manifest types)

Add an optional `defaultVisible?: boolean` to the plot descriptor type that
backs `manifest.plots[*]`. Omitted ⇒ "no static hint, defaults to visible".
Append-only — do not reorder existing descriptor fields.

### 2. Extract a literal `visible` (`callsiteIdInjection.ts` / the plot-opts scan)

Where the injector reads the callsite's opts object to populate the descriptor
(the same place it reads `style`/`title`), detect a `visible` property whose
value is a boolean literal (`true`/`false`) and set `defaultVisible`
accordingly. A non-literal `visible` value sets nothing.

> Reuse the existing literal-detection used for `title`/`style` rather than a
> new walker. A computed `title` already maps to "no static value" — mirror
> that for `visible`.

### 3. Dependency graph / plot-producer scan

If `extractDependencyGraph.ts` (or equivalent) enumerates plot-producing
callees and their opts, ensure the `visible` property does not perturb the
scan (it is a plain opt, not a series input). Add a regression test if the
scan is opt-sensitive.

### 4. Tests (`packages/compiler/src/compile.test.ts` + manifest tests)

- A `plot(bar.close, { visible: false })` fixture → `manifest.plots[0]
  .defaultVisible === false`.
- A `plot(bar.close, { visible: showSlope })` (input-bool) fixture → no
  `defaultVisible` on the descriptor; still compiles, still gets a `slotId`.
- A plain `plot(bar.close)` fixture → manifest byte-identical to pre-change
  (no `defaultVisible` key).

## Edge cases

- `visible: true` literal → record `defaultVisible: true` (explicit) — a host
  may still want the explicit signal; document this so it is not mistaken for
  "omitted".
- Do not infer `defaultVisible` from a ternary, even a constant-folding one —
  only a direct boolean literal. Keep it conservative (mirrors the
  computed-title rule).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/.../manifest` types | Modify | Add `PlotSlotDescriptor.defaultVisible?`. |
| `packages/compiler/src/.../callsiteIdInjection.ts` | Modify | Extract literal `visible` → `defaultVisible`. |
| `packages/compiler/src/analysis/extractDependencyGraph.ts` | Modify (if opt-sensitive) | Ignore `visible` in series scan. |
| `packages/compiler/src/compile.test.ts` | Modify | Manifest assertions. |
| `packages/compiler/CLAUDE.md` | Modify | Document `defaultVisible` in the `manifest.plots` section. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-compiler test` (100% coverage)
- `pnpm docs:check`

## Changeset

Covered by Task 1's shared T8 changeset (compiler is minor).

## Acceptance Criteria

- Literal `visible` → `manifest.plots[*].defaultVisible`; non-literal → absent.
- `slotId` minting + `plotKindFromCallsite` unchanged; a plain plot's manifest
  is byte-identical.
- compiler CLAUDE.md updated; tests + docs:check green.
