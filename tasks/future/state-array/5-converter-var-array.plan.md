# Plan — Task 5: Pine converter bounded numeric `var array` → `state.array`

## Context

Lower a **bounded numeric** Pine `var array<float|int>` (a Camp B FIFO ring of
numeric values, NOT drawing handles) to `const <name> = state.array<number>(K)`,
rewriting `array.push/get/size/last/first/clear` onto the slot's surface and
eliding the FIFO-eviction block. Tasks 1 (core type + `state.array` hole +
registry + shim) and 2 (runtime `ArrayStateSlot`) are DONE & green; the
runtime/author surface is `state.array<number>(capacity)` →
`push(v)`/`get(n)` (0 = newest)/`last()`/`size` (property)/`capacity`
(property)/`clear()`. Task 3 (compiler capacity-literal guard, cap 100_000) is
done; our emitted cap `K` is always a literal, satisfying it.

## Pre-existing work (validated against the workspace)

- **The numeric array produces NO `drawingSite`.** The pushed value (`close`)
  is not a drawing constructor, so the semantic drawing-camp classifier ignores
  it. Confirmed by tracing the target idiom through `convert(...)`: today the
  decl is swallowed by `transformOther`'s SCALAR-slot path
  (`isScalarSlotCandidate` → true), emitting the broken
  `const win = state.float(array.new()); array.push(win.value, bar.close); …`
  plus a `loop-bounds-not-literal-for-stateful-body` error on the
  `for i = 0 to array.size(win) - 1` loop. So the fix lives in `other.ts`'s
  scalar pipeline, NOT in a drawing-camp transform.
- **`state.series` lowering is the direct precedent** (`other.ts`:
  `scanHistorySeries` / `registerStateSlots` / `emitStateSlots` /
  `emitSeriesSlot`; `emitContext.ts` `seriesSlots` + `seriesSlotReceiver`;
  `30-var-series-history.*` fixture). The numeric-array lowering mirrors it:
  a pre-scan pass, a name registration via `scaffold.names.allocateForSymbol`,
  an `appendStateSlot({ name, initExpr: "state.array<number>(K)" })`, and a
  read-rewrite threaded through `EmitContext`.
- **`StateSlotIR` is `{ name, initExpr }`** and codegen
  (`emitHelpers.ts:emitSlotAllocations`) emits `const <name> = <initExpr>;` —
  no new IR needed; `state.array<number>(K)` is just an `initExpr`.
- **The `state` import + `compute({ state })` destructure** turn on
  automatically: `usage.ts:scanUsage` forces `state: true` when
  `stateSlots.length > 0`.
- **The eviction-elision info already exists**: `ring-eviction-implicit`
  (info, `diagnostics/codes.ts:307`). `other.ts:isEvictionGuard` /
  `evictionGuardCollection` / `isEvictionDelete` already DETECT and elide the
  `if array.size(coll) >|>= K → array.shift|remove(coll)` block for OWNED
  collections — I reuse this machinery by adding the numeric-array names to the
  `owned` set so the existing eviction-guard skip fires (it already accepts both
  `array.shift` AND `array.remove`).
- **`loop-bounds-not-literal-for-stateful-body` and the literal-loop path**
  (`controlFlow.ts:emitFor`/`emitLiteralLoop`) reject a `for` whose bound is
  `array.size(coll) - 1` (non-literal). chartlang only forbids STATEFUL calls
  in loops (`compiler/.../statefulCallInLoop.ts`), NOT non-literal runtime
  bounds — so a runtime `for (let i = 0; i < <slot>.size; i++)` with a
  non-stateful body (the fixture's `sum += win.get(i)`) is legal chartlang.
  `emitFor` must learn to emit that form for an array-size bound.
- **Next free fixture number is 31, NOT 30.** The task file says "30", but
  `ls fixtures` shows BOTH `30-explicit-plot-zorder.*` AND
  `30-var-series-history.*` are already committed (a pre-existing duplicate from
  two sibling task merges). The last numeric prefix in use is 30, so the next
  free is **31**.

## Issues found / decisions

1. **Fixture number collision** — use **31**, not 30 (see above).
2. **The `for`+`array.size` loop is the hard part.** The fixture as written in
   the task file (`for i = 0 to array.size(win) - 1` summation) cannot
   round-trip unless `emitFor` lowers an array-size-bounded non-stateful loop to
   a runtime `for (let i = 0; i < <slot>.size; i++)`. I implement that
   (threading `arraySlots` into `EmitContext`, consumed by `emitFor`) so the
   illustrative idiom converts + compiles cleanly. The bound forms accepted:
   `array.size(coll)` (→ `i <= <slot>.size - 1`? no — Pine `to N` is inclusive)
   and `array.size(coll) - 1` (→ `i < <slot>.size`). To keep it exact and
   simple I detect the canonical `array.size(coll) - 1` form → `i < <slot>.size`
   and the bare `array.size(coll)` form → `i <= <slot>.size`. Iterator var is a
   `localNames` shadow already.
3. **No new module vs `numericArray.ts`.** The classification + cap detection +
   the array-builtin call rewrite is non-trivial and belongs in its own file per
   the task. I add `transform/numericArray.ts` (classification, cap detection,
   diagnostics helpers) and wire it from `other.ts`. The CALL-rewrite
   (`array.get(coll,n)` → `coll.get(n)`) lives in `emitContext.ts`'s
   `rewriteTree` (where every call already routes), reading a new
   `ctx.arraySlots`.
4. **Non-numeric collection** — a `var array<string|bool|color>` /
   UDT collection emits the NEW `array-collection-non-numeric` info and keeps
   today's (non-lowered) behavior. Detected by the `array.new<T>()` type arg or
   the `array<T>` annotation.
5. **No-cap numeric ring** — a numeric `var array<float>` with `array.push` but
   NO detectable cap (no eviction guard, no `array.new<float>(K)` size arg)
   hard-rejects with the NEW `unbounded-array-collection` error (a numeric
   analogue of the handle-ring `unbounded-handle-collection`; that one is a
   `semantic/` code tied to drawing camps, so a numeric `transform/` analogue is
   the honest choice — APPEND, do not repurpose).
6. **Diagnostic codes are APPEND-only.** Append `array-collection-non-numeric`
   (info) and `unbounded-array-collection` (error) at the END of
   `DIAGNOSTIC_CODE_ENTRIES`. Reuse `ring-eviction-implicit` for elision and
   `negative-array-index` for `array.get(coll, -1)`.
7. **Identity discipline** — the numeric-array detection matches the decl + the
   eviction guard + the push by AST shape over the SPECIFIC collection name, and
   only fires for ROOT-level `var`/`varip` decls (the same root-only rule the
   handle-ring classifier uses). A handle ring (`var array<line>`) is a
   drawingSite and is `owned` → never enters the numeric path.

## Steps

1. **`diagnostics/codes.ts`** — APPEND two entries at the end of
   `DIAGNOSTIC_CODE_ENTRIES`:
   - `array-collection-non-numeric` (info): "Persistent non-numeric collections
     are not supported in chartlang v1 (only numeric `state.array`)."
   - `unbounded-array-collection` (error): "A persistent numeric array with no
     detectable capacity cannot be bounded; chartlang has no unbounded
     collection."
2. **`transform/numericArray.ts`** (new) — export:
   - `scanNumericArrays(analysis, owned): NumericArrayScan` — find top-level
     `var`/`varip` `array<float|int>` decls (init `array.new<float|int>()` or
     annotation), partition into `{ slots: Map<name, { decl, cap }>, nonNumeric:
     name set, unbounded: Map<name, span> }`. Cap detected from the eviction
     guard literal `K` (reuse the `array.size(coll) >|>= K` shape) or an
     `array.new<float>(K)` size arg.
   - `isNumericArrayDecl(stmt)` / element-type helpers / `resolveArrayCap`.
   - JSDoc + MIT header.
3. **`transform/emitContext.ts`** — add `arraySlots?: ReadonlyMap<string,
   string>` to `EmitContext`; in `rewriteTree`'s `call-expression` arm,
   before the generic recursion, try `rewriteArrayBuiltin(node, ctx)`:
   `array.push(coll,v)`→`<slot>.push(<v>)`, `array.get(coll,n)`→`<slot>.get(<n>)`
   (literal-negative `n` is left to the existing `negative-array-index` path? —
   no diagnostics here; emit `<slot>.get(<n>)` and let the rejection be reported
   in `numericArray`/`other` — see step 5), `array.size(coll)`→`<slot>.size`,
   `array.last(coll)`→`<slot>.last()`, `array.first(coll)`→`<slot>.get(<slot>.size - 1)`,
   `array.clear(coll)`→`<slot>.clear()`. Returns `null` for any non-arraySlot
   call so the generic path runs.
4. **`transform/controlFlow.ts`** — in `emitFor`, when the loop is
   non-stateful and `resolveBound(to)` is `null`, detect an `array.size(coll)`
   /`array.size(coll) - 1` bound where `coll ∈ ctx.arraySlots` and `from`
   resolves to `0`; emit a runtime `for (let i = 0; i < <slot>.size; i++)` (for
   the `- 1` form) or `i <= <slot>.size` (bare form) with the iterator as a
   `localNames` shadow and the body rendered via `emitBody`. Falls through to
   the existing reject otherwise.
5. **`transform/other.ts`** — wire it in:
   - run `scanNumericArrays` after `drawingOwnedSymbols`.
   - add the numeric-array slot names to `owned` BEFORE `scanHistorySeries`/
     `registerStateSlots`/the statement walk so the scalar path no longer
     swallows them AND the existing `isEvictionGuard` skip fires for the
     eviction block. (Add a small `ownedWithArrays` set; do not mutate the
     drawing `owned`'s identity contract — recompute one combined readonly set.)
   - register a slot name per numeric-array via `scaffold.names.allocateForSymbol`,
     `appendStateSlot({ name, initExpr: "state.array<number>(K)" })`, and push
     ONE `ring-eviction-implicit` per array (the eviction block is elided).
   - push `array-collection-non-numeric` per non-numeric collection and
     `unbounded-array-collection` per unbounded numeric array (skip — no slot).
   - thread `arraySlots: Map<name, slot>` into the `EmitContext`.
   - the decl + the `array.push` statement + the eviction `if` are skipped:
     decl via `owned`, push via `emitContext` rewrite emitting `<slot>.push(...)`
     (it's NOT drawing-owned, so it DOES emit — that is correct, we WANT the
     push), eviction via `isEvictionGuard`. Verify `array.push` over an
     arraySlot is NOT caught by `isDrawingOwnedCall` (it isn't: the array is not
     a drawing-owned symbol, so the push flows to `emitExpressionStatement` →
     generic emit → `emitContext` rewrite → `<slot>.push(<v>);`). 
6. **`transform/index.ts`** — re-export the new `numericArray.ts` public
   helpers (package-internal barrel).
7. **Fixture triple** `fixtures/31-var-array-window.{pine,expected.chart.ts,
   expected.diagnostics.json}` — the rolling-window idiom; the expected output
   has `const win = state.array<number>(20);`, `win.push(bar.close);`, the
   eviction `if` elided, the loop as `for (let i = 0; i < win.size; i++) { sum =
   sum + win.get(i); }`, `plot(sum / win.size)`; diagnostics = one
   `ring-eviction-implicit`. KEEP it OUT of `KNOWN_NON_COMPILING`.
8. **Tests** — `numericArray.test.ts` (classification: numeric lowers; non-numeric
   info; no-cap reject; cap from eviction guard AND from `array.new<T>(K)`;
   `array.remove` eviction accepted; root-only rule), extend
   `emit-context.test.ts` (each array-builtin rewrite + non-arraySlot
   passthrough), extend `controlFlow.test.ts` (array-size loop forms),
   `numericArray.synthetic.test.ts` for any defensive arms unreachable from real
   parser output. Keep 100% line/branch/function.
9. **`CLAUDE.md`** (pine-converter) — add a "Transform: numeric arrays" section
   noting numeric Camp B rings now lower to `state.array`; map/matrices/
   non-numeric collections stay gaps.
10. **`docs/converter/supported.md`** — note the numeric `var array` support.
11. **Changeset** — `.changeset/state-array.md` already exists (Task 1's
    feature changeset includes pine-converter as minor); confirm pine-converter
    is listed, append a line if needed.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/diagnostics/codes.ts` | Modify | APPEND `array-collection-non-numeric` + `unbounded-array-collection`. |
| `src/transform/numericArray.ts` | Create | Classify + cap-detect numeric Camp B arrays; diagnostics helpers. |
| `src/transform/emitContext.ts` | Modify | `arraySlots` set; `array.*(coll,…)` → `coll.<method>` rewrite. |
| `src/transform/controlFlow.ts` | Modify | `for i = 0 to array.size(slot)[- 1]` → runtime `i < slot.size` loop. |
| `src/transform/other.ts` | Modify | Wire scan; own the names; emit slot + elision; thread `arraySlots`. |
| `src/transform/index.ts` | Modify | Re-export numericArray helpers. |
| `fixtures/31-var-array-window.*` | Create | Fixture triple. |
| `src/transform/numericArray.test.ts` | Create | Classification coverage. |
| `src/transform/numericArray.synthetic.test.ts` | Create | Defensive-arm coverage. |
| `src/transform/emit-context.test.ts` | Modify | Array-builtin rewrite coverage. |
| `src/transform/controlFlow.test.ts` | Modify | Array-size loop coverage. |
| `src/tests/fixtures-compile.test.ts` | Verify | 31 stays OUT of KNOWN_NON_COMPILING. |
| `packages/pine-converter/CLAUDE.md` | Modify | KNOWN GAPS / numeric-array prose. |
| `docs/converter/supported.md` | Modify | Document numeric `var array` support. |
| `.changeset/state-array.md` | Verify/append | pine-converter minor. |

## Gates to keep green

- `pnpm --filter @invinite-org/chartlang-pine-converter test` (coverage 100%).
- `pnpm typecheck`, `pnpm lint` (scoped runs only; not full-workspace).

## Changeset

`.changeset/state-array.md` (exists) — ensure `@invinite-org/chartlang-pine-converter: minor`.

## Acceptance criteria

- A bounded numeric `var array<float|int>` Camp B ring lowers to
  `state.array<number>(K)` with `push`/`get`/`size`/`last`/`first`/`clear`
  rewrites and eviction elision; `31-var-array-window` converts + COMPILES
  (round-trip green, not in KNOWN_NON_COMPILING).
- A non-numeric collection emits `array-collection-non-numeric`; a no-cap
  numeric ring emits `unbounded-array-collection`.
- Handle-ring Camp B lowering is byte-unchanged.
- CLAUDE.md + supported.md updated; converter tests green at 100%.
</content>
</invoke>
