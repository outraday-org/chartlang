# Task 2 — Compiler callsite handling + `manifest.plots` + dep-graph — PLAN

> Audit artifact. Validated against the tree on 2026-06-22.

## Context

Deliverable 1, Task 2. Task 1 (uncommitted) landed core's `bgcolor`/`barcolor`
sentinel holes (`packages/core/src/plot/plot.ts:373/390`), `BgColorOpts` /
`BarColorOpts` types, registry entries `{ name: "bgcolor"|"barcolor", slot:
true }` (`statefulPrimitives.ts:120-121`), the `program.ts` ambient shim, and a
shared changeset `.changeset/bgcolor-barcolor.md`. This task teaches the
COMPILER to treat `bgcolor`/`barcolor` exactly like a styled `plot()` callsite:
inject a callsite slot id, list each in `manifest.plots` with the right `kind`,
and count them as plot-producing callees in the dependency-graph scan.

## Pre-existing work (do NOT touch)

- Task 1 (core holes + opts + registry + shim + changeset) — uncommitted.
- state-array + multi-symbol-security batches — uncommitted.
- Task 1 already widened `callsiteIdInjection.test.ts`'s "rewrites every
  slot:true primitive" loop to include `bgcolor("#000")` / `barcolor("#000")`
  and added a `compile.test.ts` shim type-check for the aliases. My diff does
  NOT modify those additions.

## Issues found / decisions

1. **`ComputeContext` gap (core).** Task 1 declared core's `bgcolor`/`barcolor`
   holes + registry but did NOT add them to `ComputeContext`
   (`packages/core/src/types.ts:773-778` carries only `plot`/`hline`). The
   runtime emit impls (Requirement 4) cannot bind on `ComputeContext`
   type-safely without that. Flagged to team-lead — runtime + core piece held
   pending decision (see "Open").
2. **No separate Deliverable-1 runtime task.** Task 5 (runtime) is
   Deliverable-2/gated. So Requirement 4 (runtime thin emit impls) has no other
   home; without it `bgcolor`/`barcolor` compile but throw the core sentinel at
   runtime. Held pending team-lead decision.
3. **dep-graph semantics.** `bgcolor`/`barcolor` carry a `title` opt that is a
   plot LABEL, not a `.output()`-referenceable series-number. So they set
   `hasUntitledPlot = true` (count as plot production) but never add a titled
   output nor trip `duplicate-output-title`. A dedicated branch before the
   `plot` branch encodes this.
4. **`optsArg` index.** `bgcolor`/`barcolor`'s opts is `arguments[1]` (color is
   `arguments[0]`), identical to `plot`'s opts index — so the generic
   `node.arguments[1]` + `plotKindFromCallsite` / `readLiteralTitle` reach the
   right node with no callee-specific offset. Confirmed.

## Steps (compiler — DONE + green)

1. `plotKindFromCallsite.ts:75` — add `if (calleeName === "bgcolor") return
   "bg-color";` / `if (calleeName === "barcolor") return "bar-color";` before
   the `plot` guard; JSDoc updated. (Direct return like `hline`; the aliases
   carry no `style` object.)
2. `callsiteIdInjection.ts:138` — widen the `manifest.plots` descriptor guard
   to `plot | hline | bgcolor | barcolor`. Slot-id minting + the
   `slotsSeen` conflict path are already callee-generic (registry-driven) — no
   change there. The minted slot id is reused for the injected leading literal
   AND `manifest.plots[*].slotId` (existing code; not re-derived).
3. `extractDependencyGraph.ts:230` — add a `callee === "bgcolor" || callee ===
   "barcolor"` branch that sets `hasUntitledPlot = true` (before the `plot`
   branch), so a bgcolor-only producer "produces plots".
4. Tests:
   - `plotKindFromCallsite.test.ts` — `bgcolor`→`bg-color`, `barcolor`→
     `bar-color` (string-callee form, opts unread).
   - `manifest.test.ts` — compiled `COLOR_ALIASES_SOURCE`: bgcolor lists
     `kind:"bg-color"` + literal `title:"Heat"`; barcolor lists
     `kind:"bar-color"` + omitted title; slotIds match the injected literals.
   - `callsiteIdInjection.test.ts` — `callsite-id-conflict` fires for a
     `bgcolor` sharing a seeded slot id (registry-driven, mirrors the `ta.ema`
     conflict test).
   - `extractDependencyGraph.test.ts` — a `bgcolor`-only producer consumed via
     `.output("Heat")` trips `dep-output-not-titled` (proves plot-production)
     and never trips `duplicate-output-title`.

## Requirement 4 — runtime + core (team-lead approved Option B — DONE)

5. Core: added `bgcolor`/`barcolor` to `ComputeContext` (`types.ts`, by hole
   identity) + a `types.types.test.ts` assertion. Completes a Task 1 gap (Task 1
   added the holes + registry but not the context fields).
6. Runtime: exported `plotImpl` from `emit/plot.ts`; added `emit/bgcolor.ts` /
   `emit/barcolor.ts` thin overloaded impls building the `bg-color`/`bar-color`
   `PlotOpts` (`value = NaN`, `style = { kind, ...(transp) }`, conditional
   `title`) and dispatching to `plotImpl` verbatim; wired `emit/index.ts`,
   `primitives.ts`, `buildComputeContext.ts`. Did NOT set `colorValue` (the
   Deliverable-2 channel) — the wire stays byte-identical.
   Tests: `emit/bgcolor.test.ts` / `emit/barcolor.test.ts` (emission-equivalence
   vs verbose `plot(NaN,{style})`, transp/title spreads, capability gate
   `unsupported-plot-kind`, overload seam — bare / opts-bag / null-ctx /
   non-string-arg1 sentinel) + `buildComputeContext.test.ts` wiring.
   bgcolor.ts + barcolor.ts: 100% coverage; runtime suite 3122 tests green.

## Files

| File | Action | Status |
|------|--------|--------|
| `packages/compiler/src/transformers/plotKindFromCallsite.ts` | Modify | done |
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Modify | done |
| `packages/compiler/src/analysis/extractDependencyGraph.ts` | Modify | done |
| `packages/compiler/src/transformers/plotKindFromCallsite.test.ts` | Modify | done |
| `packages/compiler/src/manifest.test.ts` | Modify | done |
| `packages/compiler/src/transformers/callsiteIdInjection.test.ts` | Modify | done |
| `packages/compiler/src/analysis/extractDependencyGraph.test.ts` | Modify | done |
| `packages/core/src/types.ts` (`ComputeContext`) | Modify | done |
| `packages/core/src/types.types.test.ts` | Modify | done |
| `packages/runtime/src/emit/plot.ts` (export `plotImpl`) | Modify | done |
| `packages/runtime/src/emit/bgcolor.ts` / `barcolor.ts` | Create | done |
| `packages/runtime/src/emit/index.ts` | Modify | done |
| `packages/runtime/src/primitives.ts` / `buildComputeContext.ts` | Modify | done |
| `packages/runtime/src/emit/bgcolor.test.ts` / `barcolor.test.ts` | Create | done |
| `packages/runtime/src/buildComputeContext.test.ts` | Modify | done |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint` (lint on touched files: clean).
- `pnpm -F @invinite-org/chartlang-compiler test` — 605 passed, 100% coverage.
- (If runtime lands) `pnpm -F @invinite-org/chartlang-runtime test`,
  `pnpm conformance` (four bg/bar-color hashes unchanged).

## Changeset

Covered by Task 1's `.changeset/bgcolor-barcolor.md`. Confirm `compiler` minor
(and, if runtime lands, `runtime` minor) is listed before commit.

## Acceptance criteria

- bgcolor/barcolor get a slot id injected + appear in `manifest.plots` with
  `kind:"bg-color"`/`"bar-color"` + literal title. ✅
- `extractDependencyGraph` counts them as plot production. ✅
- `plotKindFromCallsite` maps both callees. ✅
- (Requirement 4) runtime impls reuse `plotImpl`, emit byte-identical wire,
  overload seam holds. PENDING decision.
