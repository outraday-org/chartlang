# Plan — Task 3: Compiler capacity-literal guard for `state.array`

> Audit artifact for `3-compiler-capacity-guard.md`. Validated against the
> live workspace on 2026-06-22.

## Context

Add a compile-time analysis pass that requires `state.array<T>(capacity)`'s
`capacity` argument to resolve to a numeric literal (or a `const`
numeric-literal binding) and to fall within a sane integer range. A
non-resolvable capacity emits `state-array-capacity-not-literal`; a resolvable
capacity that is `<= 0`, non-integer, or `> MAX_STATE_ARRAY_CAPACITY` emits
`state-array-capacity-exceeds-max`. This pins the bounded-execution +
bounded-snapshot invariant at the compiler boundary, mirroring how series
index bounds are validated (`resolveIndexBound.ts`).

The runtime ring self-bounds regardless, so this guard converts a latent
footgun (non-deterministic snapshot size) into a clear compile error.

## Pre-existing work (Task 1, landed)

- `state.array` registered `{ name: "state.array", slot: true }`
  (`packages/core/src/statefulPrimitives.ts:193`), so `resolveCalleeName`
  returns `"state.array"` and `STATEFUL_PRIMITIVES_BY_NAME` includes it.
- Shim `StateNamespace.array<T>(capacity): MutableArraySlot<T>`
  (`packages/compiler/src/program.ts:1017`) + `MutableArraySlot<T>`
  (`program.ts:1003`).
- `compile.test.ts:179` positive case (`state.array<number>(20)` + in-loop
  `.get(i)`). Must stay green.
- `callsiteIdInjection` injects the slot id as the **leading** argument, so
  post-injection the capacity is `arguments[1]`. The new pass runs on the
  **original** AST (pre-injection), so the capacity is `arguments[0]`.

## Reuse decisions

1. **Capacity resolution reuses `resolveIndexUpperBound` +
   `collectConstNumberEnv`** (`analysis/resolveIndexBound.ts`), exactly as
   `extractMaxLookback.ts:80-81` does for series indices. This gives:
   - bare numeric literal `state.array(20)` → resolves,
   - `const K = 20; state.array(K)` → resolves (const path, for free),
   - `let K = 20; state.array(K)` / input / runtime expr → `null` →
     `state-array-capacity-not-literal`.
   No number-parsing is re-implemented; the resolver already over-approximates
   soundly and unwraps parens / unary `±` / affine forms. A resolved bound is
   the interval **upper** endpoint — correct for the max-capacity check.
2. **`unwrapParens`** is consumed transitively by the resolver; the pass does
   not need it directly.
3. **Diagnostic emission mirrors `statefulCallInLoop.ts`** (`createDiagnostic`,
   `severity: "error"`, freeze the slice).
4. **Pipeline wiring mirrors `runStatefulCallInLoop`** — invoked in
   `api.ts:transformAndAnalyse` next to it (lines 139-146), result spread into
   `earlyDiagnostics` (lines 184-190). It runs on the original `sourceFile`
   (pre-injection), satisfying the §-"static analysis on the original AST"
   invariant AND the `arguments[0]` edge case.

## Issues found

- **Double-report on the const-resolution upper-endpoint vs literal.** Using
  `resolveIndexUpperBound` means an affine `const`-based expression
  (`const K = 10; state.array(K * 2)`) would resolve to `20` and be accepted.
  That is *more* permissive than "numeric literal only" but strictly sound
  (the value is a compile-time constant, bounded, deterministic) and matches
  the const-acceptance the task explicitly green-lights ("accepted as a
  literal IF you reuse the existing const-numeric resolution"). Documented as
  the accepted v1 behaviour.
- **`<= 0` / non-integer.** `resolveIndexUpperBound` returns a `number` that
  may be `0`, negative, or non-integer (e.g. a `const f = 2.5`). The guard
  rejects `bound <= 0`, `!Number.isInteger(bound)` as
  `state-array-capacity-exceeds-max` (a capacity must be a positive integer).
- **In-loop allocation double-diagnostic.** A `state.array(...)` inside a loop
  already errors `stateful-call-inside-loop`; the capacity pass may also fire.
  Two diagnostics for one obviously-wrong callsite is acceptable per the task
  edge-case (mirrors element-access collecting multiple codes). No
  short-circuit — each pass is independent.
- **Element-access form** `state["array"](cap)` is rejected upstream as
  `stateful-call-element-access`; it does not match `resolveCalleeName(...) ===
  "state.array"`, so the new pass never double-reports it.

## `MAX_STATE_ARRAY_CAPACITY`

Choose **`100_000`** — generous (the dominant rolling-window / event-log cases
are ≤ a few hundred), but a hard ceiling that caps the per-tick two-ring
`Float64Array` copy (Task 2) and the snapshot size. Exported `as const` from
the pass module with JSDoc so Task 6 docs can reference it. (Higher than the
`5000` series `dynamicFallback` because a deliberate collection capacity is a
different intent than an un-sized series buffer; both are bounded.)

## Steps

1. Create `packages/compiler/src/analysis/stateArrayCapacity.ts`:
   - MIT header.
   - `export const MAX_STATE_ARRAY_CAPACITY = 100_000;` (JSDoc + `@since 1.3`
     + `@stable`).
   - `export function runStateArrayCapacity(sourceFile, checker, sourcePath):
     ReadonlyArray<CompileDiagnostic>` — walk the original AST; for each
     `CallExpression` with `resolveCalleeName === "state.array"`, read
     `node.arguments[0]`; if missing → `state-array-capacity-not-literal` at
     the call node; else resolve via `resolveIndexUpperBound` + the same
     `collectConstNumberEnv(arg, sourceFile)` scope; `null` →
     `state-array-capacity-not-literal` at the arg span; resolved but
     `<= 0 || !Number.isInteger || > MAX` →
     `state-array-capacity-exceeds-max` at the arg span; otherwise accept.
   - JSDoc with `@since 1.3`, `@example`.
2. Register both codes in `diagnostics.ts:CompileDiagnosticCode` (append-only,
   end of union) + extend the doc-comment note.
3. Export `runStateArrayCapacity` + `MAX_STATE_ARRAY_CAPACITY` from
   `analysis/index.ts`.
4. Wire into `api.ts:transformAndAnalyse`: import, invoke next to
   `runStatefulCallInLoop`, spread into `earlyDiagnostics`.
5. Create `stateArrayCapacity.test.ts` — accept (literal, const), reject
   (let, missing-arg synthetic AST, over-max, zero, negative, non-integer),
   the in-loop double-diagnostic, element-access non-match. 100% coverage.
6. `compile.test.ts` — end-to-end negative (`state.array<number>(len)` →
   `CompileError` carrying `state-array-capacity-not-literal`); the Task 1
   positive still compiles.
7. Extend `.changeset/state-array.md` body (compiler already minor) — note the
   capacity guard + the new diagnostic codes.
8. Update `packages/compiler/CLAUDE.md` — new invariant bullet for the
   capacity guard (codes, the `arguments[0]` pre-injection edge, the
   resolver-reuse, the const-acceptance).

## Files to create / modify

| File | Action |
|------|--------|
| `packages/compiler/src/analysis/stateArrayCapacity.ts` | Create |
| `packages/compiler/src/analysis/stateArrayCapacity.test.ts` | Create |
| `packages/compiler/src/analysis/index.ts` | Modify (re-export) |
| `packages/compiler/src/diagnostics.ts` | Modify (two codes + doc note) |
| `packages/compiler/src/api.ts` | Modify (wire pass) |
| `packages/compiler/src/compile.test.ts` | Modify (e2e negative) |
| `.changeset/state-array.md` | Modify (note guard) |
| `packages/compiler/CLAUDE.md` | Modify (invariant) |

## Gates to keep green

- `pnpm -F @invinite-org/chartlang-compiler test` (100% coverage on the new
  file)
- `pnpm typecheck`, `pnpm lint`, `pnpm docs:check`

## Changeset

`.changeset/state-array.md` — already exists; compiler is `minor`. Extend the
body only (no new file).

## New diagnostic codes

- `state-array-capacity-not-literal` (error)
- `state-array-capacity-exceeds-max` (error)

## Acceptance criteria

- [ ] Numeric-literal / `const`-numeric capacity compiles clean.
- [ ] Non-resolvable capacity errors `state-array-capacity-not-literal` at the
      arg span (call node when the arg is missing).
- [ ] Over-`MAX` / zero / negative / non-integer literal errors
      `state-array-capacity-exceeds-max`.
- [ ] `.push`/`.get` method calls and the Task 1 positive case unaffected.
- [ ] New analysis at 100% coverage; typecheck/lint/docs green.
- [ ] Both codes registered append-only; CLAUDE.md invariant added.
