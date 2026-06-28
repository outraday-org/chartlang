# Task 5 — Pine converter: bounded numeric `var array` → `state.array`

> **Status: TODO**

## Goal

Lower a bounded **numeric** Pine `var array<float>` / `var array<int>` (a
Camp B FIFO ring of values, not drawing handles) to
`const a = state.array<number>(K)`, mapping `array.push` → `a.push`,
`array.get(coll, n)` → `a.get(a.size - 1 - n)` (**index inverted** — Pine
indexes from the oldest, chartlang `get(0)` is the newest; see §Desired
Behavior), `array.size(coll)` → `a.size`, `array.last(coll)` → `a.last()`,
`array.clear(coll)` → `a.clear()`, and
eliding the FIFO-eviction block (the ring rotates internally). This gives the
**numeric** Camp B ring a lowering target — today only **drawing-handle** Camp
B rings convert (`transform/campB.ts`, which synthesizes `draw.*` handle
rings). Add a fixture proving it, register diagnostics, and keep the
converter's 100% coverage gate green.

## Prerequisites

Tasks 1–2 (`state.array` exists end-to-end: type, runtime). Task 3 is optional
but, if shipped, means the emitted capacity **must** be a literal — which the
Camp B cap detection already guarantees (the cap is a literal `K`).

## Current Behavior

- The converter classifies a `var array<line|label|box>` Camp B ring of
  **drawing handles** (`packages/pine-converter/src/transform/campB.ts`;
  classification in `packages/pine-converter/CLAUDE.md` drawing-camp rules:
  `array.push`'d handles with an `if array.size(coll) >|>= K` →
  `*.delete(array.shift|remove(coll))` eviction → `camp-b` with literal `K`).
  It synthesizes a **local** ring (`__lvls_ring`, via `registerRing` /
  `ringHelper.ts`) of `draw.*` handles and elides the eviction block.
- There is **no** lowering for a `var array<float>` / `var array<int>` holding
  **numeric values** — a numeric Camp B ring. `array.push`/`array.get` on a
  numeric collection has no converter target; it currently falls through to a
  Camp-C reject or an unsupported-`array.*` path.
- `var`/`varip` **scalars** lower to `state.*` slots
  (`transform/other.ts:registerStateSlots` / `emitStateSlots`); collections are
  filtered OUT of `registerStateSlots` (they are not scalar). The scalar path
  is NOT the place for this — array collections need their own lowering.
- Diagnostic codes live in `packages/pine-converter/src/diagnostics/codes.ts`;
  `KNOWN_NON_COMPILING` lives in `src/tests/fixtures-compile.test.ts`. Fixtures
  are numbered; the next free number is **30** (`29-plot-offset.*` is the last).

## Desired Behavior

- A **bounded numeric** `var array<float>`/`var array<int>` with the Camp B
  eviction signature (`array.push` + `if array.size(coll) >|>= K` →
  `array.shift(coll)`, NO `*.delete` because there is no handle to delete)
  lowers to `const <name> = state.array<number>(K);`:
  - `array.push(coll, v)` → `<name>.push(v)`
  - `array.get(coll, n)` → `<name>.get(<name>.size - 1 - (n))` — **the index
    MUST be inverted.** Pine `array.get(coll, n)` indexes from the OLDEST
    element (index `0` = first pushed; `array.shift` evicts index `0`), but
    chartlang `state.array.get(n)` indexes from the NEWEST (`n = 0` newest).
    Emitting `<name>.get(n)` verbatim is a silent miscompile (it reads the
    n-th newest instead of Pine's n-th oldest). `array.last`/`array.first`
    below already account for this; `get` must too.
  - `array.size(coll)` → `<name>.size`
  - `array.last(coll)` → `<name>.last()` (newest — matches Pine `array.last`)
  - `array.first(coll)` → `<name>.get(<name>.size - 1)` (oldest — matches Pine
    `array.first`; document the mapping) — or push a "not supported" info if
    `first` is rare; prefer the mapping.
  - `array.clear(coll)` → `<name>.clear()`
  - the eviction block (`if array.size > K` → `array.shift`) is **elided**
    (the ring rotates internally) + an info notes the elision (reuse the
    existing Camp B eviction-elision info if one exists, else APPEND one).
- The **cap `K`** is detected exactly as the handle-ring Camp B path detects it
  (`resolveRingCap` / `ringHelper.ts`): the literal in the `array.size > K`
  guard, an `array.new<float>(K)`-style size arg, a literal loop bound, or a
  straight-line push count. A numeric Camp B ring with **no** detectable cap
  hard-rejects `unbounded-handle-collection` (or a numeric analogue), exactly
  like Camp C handle rings — chartlang has no unbounded collection.
- A non-numeric collection (`array<string>`, `array<bool>`, `array<color>`,
  UDT) keeps its current behavior + a clear
  `array-collection-non-numeric` (or reuse an existing) info: "Persistent
  non-numeric collections are not supported in chartlang v1 (only numeric
  `state.array`)." No silent broken output.
- The new fixture round-trips: convert → compile (`fixtures-compile.test.ts`)
  is clean.

## Requirements

### 1. Classify the numeric Camp B ring (`transform/`)

Add a numeric-value Camp B classification path. The cleanest factoring is a
sibling to `campB.ts` (e.g. `transform/numericArray.ts`) that reuses the cap
detection (`ringHelper.ts:resolveRingCap`) and the eviction-signature
detection but emits a `state.array` slot instead of a synthesized `draw.*`
handle ring. Decide whether to:
- extend `campB.ts` to branch on `site` element type (handle vs numeric), or
- add a dedicated pass that runs on `var array<float|int>` collections the
  drawing-camp classifier ignores.

Follow the existing **identity-match-against-the-classified-node** discipline
(`isPushOf` etc. in `campB.ts` match by AST node identity, never a re-derived
shape). Detect the element type from the `array.new<float>()` /
`array.new<int>()` declaration (or the `var array<float>` annotation).

### 2. Emit the `state.array` slot + rewrite the operations (`transform/` + `emitContext.ts`)

- Register the numeric collection's Pine name → a chartlang `state.array` slot
  (mirror how `registerStateSlots` registers scalar slots, but in the
  collection path; reuse the name allocator `scaffold.names.allocate` /
  `allocateForSymbol` per the CLAUDE.md allocator rules so two push sites into
  one ring resolve to one chartlang name).
- Emit the declaration `const <name> = state.array<number>(<K>);` once
  (`emitStateSlots`-style, or the collection equivalent).
- Rewrite every `array.*(coll, …)` operation on that collection to the
  `<name>.<method>` form (§Desired Behavior mapping). Thread the
  numeric-array-slot set into `EmitContext` (e.g. `arraySlots: ReadonlySet
  <string>`) so `exprEmit.ts` knows to rewrite `array.get(coll, n)` →
  `coll.get(coll.size - 1 - (n))` (index inverted, per §Desired Behavior)
  rather than the unsupported-`array.*` path.
- Elide the eviction `if` block; push the elision info.

### 3. Diagnostics (`diagnostics/codes.ts`)

- **`array-collection-non-numeric`** (info): APPEND one new code (no reorder),
  namespaced `pine-converter/transform/array-collection-non-numeric`, message
  ~"Persistent non-numeric collections are not supported in chartlang v1 (only
  numeric `state.array`)."
- **Eviction-elision info:** reuse the existing Camp B eviction-elision info if
  one exists (grep the codes registry); else APPEND
  `state-array-eviction-elided` (info).
- **No-cap reject:** reuse the existing `unbounded-handle-collection` reject if
  it fits a numeric ring; else APPEND a numeric analogue (error). Do NOT change
  any existing code's severity or message (codes are the stable public
  contract).
- `code-coverage-grep.test.ts` walks `makeDiagnostic`/`pushCode` literals —
  ensure every new key is registered so it passes automatically.

### 4. Fixture (`packages/pine-converter/fixtures/`)

Add `30-var-array-window.pine` (next number) exercising the idiom:

```pine
//@version=6
indicator("Rolling window array", overlay=true)
var array<float> win = array.new<float>()
array.push(win, close)
if array.size(win) > 20
    array.shift(win)
sum = 0.0
for i = 0 to array.size(win) - 1
    sum := sum + array.get(win, i)
plot(sum / array.size(win))
```

Add `30-var-array-window.expected.chart.ts` (the converted output — `win`
becomes `const win = state.array<number>(20); … win.push(bar.close...);` the
eviction block elided; the `for` loop rewritten to
`win.get(win.size - 1 - (i))` / `win.size`) and
`30-var-array-window.expected.diagnostics.json` (the emitted
diagnostics, e.g. the eviction-elision info). The golden corpus +
`fixtures-compile.test.ts` round-trip guard it compiles.

Keep `30-var-array-window.pine` **OUT** of `KNOWN_NON_COMPILING`
(`src/tests/fixtures-compile.test.ts`) — it must round-trip and compile.

### 5. Tests

- `numericArray.*.test.ts` (or `campB.*.test.ts` if extended): a bounded
  numeric `var array<float>` lowers to `state.array<number>(K)` with the
  operation rewrites + eviction elision; a non-numeric collection emits
  `array-collection-non-numeric`; a no-cap numeric ring hard-rejects.
- `exprEmit` / `emitContext` tests: `array.get(coll, n)` on a collection in
  `arraySlots` emits `coll.get(coll.size - 1 - (n))` (index inverted);
  `array.size` emits `.size`; `array.last` emits `.last()`.
- Defensive arms unreachable from real parser output covered by synthetic-AST
  tests (the established `*.synthetic.test.ts` precedent in `campB.synthetic
  .test.ts` / `campC.synthetic.test.ts`).

### 6. Update KNOWN GAPS

- Update `packages/pine-converter/CLAUDE.md` (per the repo rule: a behavior
  change in a folder updates that folder's CLAUDE.md): note that **numeric**
  Camp B rings now lower to `state.array` (previously only **handle** rings
  converted). Leave `state.map`, matrices, and non-numeric collections as
  documented gaps.

## Edge cases

- A `var array<float>` that is **never** read with `array.get` but only
  `array.push`'d (a pure accumulator with eviction) still lowers — the cap +
  eviction signature is the trigger, not a read.
- `array.first` maps to the oldest element (`get(size - 1)`); `array.last` to
  the newest (`get(0)` / `.last()`). Pine's `array.get(coll, -1)` (negative
  index) is already a documented reject (`translating-from-pine.md` gotchas
  table) — keep that reject; `state.array` has no negative index.
- A numeric ring whose eviction uses `array.remove(coll, 0)` instead of
  `array.shift(coll)` is the same FIFO signature — accept both (the handle-ring
  path already accepts `array.shift|remove`).
- A collection declared only inside an `if`/`for` block (not top-level) does
  not resolve to a `var` and falls to a reject — same as the handle-ring rule.
- Mixed handle + numeric collections in one script: each classifies
  independently; do not let the numeric path swallow handle rings or vice
  versa (identity-match the classified node).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/numericArray.ts` (or extend `campB.ts`) | Create/Modify | Classify + lower the numeric Camp B ring to `state.array`. |
| `packages/pine-converter/src/transform/emitContext.ts` | Modify | `arraySlots` set; collection-name resolution. |
| `packages/pine-converter/src/transform/exprEmit.ts` | Modify | Rewrite `array.*(coll,…)` → `coll.<method>` for `arraySlots`. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `array-collection-non-numeric` (+ elision/no-cap codes as needed). |
| `packages/pine-converter/fixtures/30-var-array-window.*` | Create | Fixture + expected output + diagnostics. |
| `packages/pine-converter/src/transform/*.test.ts` | Modify | Coverage for the new lowering. |
| `packages/pine-converter/src/tests/fixtures-compile.test.ts` | Modify | Keep `30-var-array-window.pine` OUT of `KNOWN_NON_COMPILING`. |
| `packages/pine-converter/CLAUDE.md` | Modify | KNOWN GAPS prose. |

## Gates

- `pnpm -F @invinite-org/chartlang-pine-converter test` (coverage **100%**)
- `pnpm typecheck`, `pnpm lint`

## Changeset

Covered by Task 1's feature changeset (pine-converter included as minor).

## Acceptance Criteria

- A bounded numeric `var array<float|int>` Camp B ring lowers to
  `state.array<number>(K)` with `push`/`get`/`size`/`last`/`clear` rewrites
  and eviction-block elision; the new fixture converts + compiles cleanly.
- A non-numeric collection emits `array-collection-non-numeric`; a no-cap
  numeric ring hard-rejects.
- Handle-ring Camp B lowering is byte-unchanged (numeric path does not
  intercept it).
- KNOWN_NON_COMPILING + CLAUDE.md updated; converter tests green at 100%.
