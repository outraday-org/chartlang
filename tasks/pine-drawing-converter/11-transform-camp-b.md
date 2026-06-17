# Task 11 — Transform: Camp B drawings (bounded ring buffer)

> **Status: TODO**

## Goal

Translate the second-most-common Pine drawing idiom — a `var
array<line>` / `var array<label>` / `var array<box>` filled by
`array.push(...)` with FIFO eviction via `array.shift(...)` once the
size exceeds K — into a chartlang ring where each `draw.<kind>(...)`
callsite lives at a **fixed source position** (not inside a runtime
`for` loop, which the compiler's `stateful-call-inside-loop` gate
rejects). Pine's data-driven `array.push(handle)` becomes a single
inline `draw.<kind>(...)` call wrapped in the original conditional
context (e.g. `if (pivotHighDetected)`); the ring helper from §2
stores the handle and rotates internally. The `subIdAllocator`
(`packages/runtime/src/emit/draw/subIdAllocator.ts`) supplies the
per-bar stable `slotId#subId` automatically because each callsite is
fixed. This covers pivot/S-R/order-block scripts that dominate
real-world drawing indicators.

**Important compile-time constraint:** The converter MUST NOT emit
`draw.<kind>(...)` calls inside a `for` loop body (Task 15 §1a covers
the general rule). The ring helper's `.at(i)?.update(...)` calls
inside loops are fine — `.update()` is a method, not a stateful
primitive.

## Prerequisites

Task 10 (Camp A — handle-slot helper + setter-fold infrastructure
reused here).

## Current Behavior

Camp B sites are classified by Task 5 (`DrawingCamp.kind ===
"camp-b"`) with an extracted `cap` (K). No transform exists.

## Desired Behavior

A package-internal `transformCampB(site: DrawingCallSite, analysis:
SemanticResult, scaffold: ScriptScaffold, diagnostics:
DiagnosticCollector): void` API in `src/transform/campB.ts` produces:

- A module-level ring helper allocation storing up to K handle
  references.
- A module-level write pointer inside the ring helper.
- A modulo-K write at each Pine `array.push(<collection>, …)` site:
  the new drawing replaces slot at `idx % K`, the old one (if any)
  is `remove()`'d, idx increments.
- The `array.shift` (eviction) site is **elided** — already implicit
  in the ring's FIFO behavior.
- All read sites (`array.get(<collection>, i)`, `array.size(...)`,
  `array.first/last`) translate into ring-aware accessors.

## Requirements

### 1. K choice (from Task 5 classification)

```ts
const K = Math.min(
    classification.cap ?? 50,           // explicit Pine cap or default
    CHARTLANG_BUCKET_CAP[bucket],       // chartlang bucket-side cap
);
```

`CHARTLANG_BUCKET_CAP` (in `src/transform/campB.ts`):
- `lines` → 500
- `boxes` → 500
- `labels` → 500
- `polylines` → 100

If `K <= 0` (zero OR negative — the latter possible when `K` comes
from `input.int` with a negative default), emit error
`ring-buffer-zero-cap` and skip the site.

### 2. Module-level handle ring

For each Camp B site:

```ts
// Helper allocation emitted at module scope
HandleRingIR { name: "__lvls_ring", drawingKind: "line", cap: 50 }
```

Implementation note: the ring is emitted via a single
`useDrawingHandleRing<K>(K)` helper (defined alongside the Task-10
`useDrawingHandleSlot` helper). The helper exposes `at(i)`, `push(h)`,
`size()`, `clear()`. Why a helper instead of `state.*` slots?
chartlang has no handle-typed state slot, and the existing mutable
drawing idiom uses module-level closures for handle persistence.

```ts
// helper module
type __HandleRing<K extends string> = {
    push(h: DrawingHandle): void;
    at(i: number): DrawingHandle | null;
    size(): number;
    clear(): void;
};
function useDrawingHandleRing<K extends string>(cap: number): __HandleRing<K> {
    const slots: (DrawingHandle | null)[] = Array(cap).fill(null);
    let writeIdx = 0;
    let filled = 0;
    return {
        push(h) {
            const old = slots[writeIdx % cap];
            if (old !== null) old.remove();
            slots[writeIdx % cap] = h;
            writeIdx++;
            if (filled < cap) filled++;
        },
        at(i) {
            if (i < 0 || i >= filled) return null;
            const start = (writeIdx - filled + cap) % cap;
            return slots[(start + i) % cap];
        },
        size() { return filled; },
        clear() {
            for (let i = 0; i < cap; i++) { slots[i]?.remove(); slots[i] = null; }
            writeIdx = 0; filled = 0;
        },
    };
}
```

### 3. Generated code shape

For:

```pinescript
var array<line> lvls = array.new<line>()
if pivotHighDetected
    ln = line.new(bar_index[N], ph, bar_index, ph, extend=extend.right)
    array.push(lvls, ln)
    if array.size(lvls) > 50
        line.delete(array.shift(lvls))
```

Emit:

```ts
const __lvls_ring = useDrawingHandleRing<"line">(50);

// inside compute
if (pivotHighDetected) {
    const __h = draw.line(
        { time: bar.time - (N * __BAR_INTERVAL_MS), price: ph },
        { time: bar.time, price: ph },
        { extendRight: true }
    );
    __lvls_ring.push(__h);
    // Pine's `if array.size > 50 → shift` is implicit in the ring.
}
```

The `array.shift` + `line.delete` Pine block is **detected and
removed** — its semantics are now in the ring. Emit info
`ring-eviction-implicit` once per ring telling the user the explicit
delete was removed.

### 4. Loop-driven update over the ring

Pine scripts often update the ring inside a loop:

```pinescript
for i = 0 to array.size(lvls) - 1
    ln = array.get(lvls, i)
    if not mitigated(ln)
        line.set_x2(ln, bar_index)
```

Convert to a chartlang literal-bounded `for`:

```ts
for (let i = 0; i < 50; i++) {
    const __h = __lvls_ring.at(i);
    if (__h === null) continue;
    // mitigation check translated as-is
    if (!__mitigated_local) {
        __h.update({ anchors: [/* prior anchor 0 */, { time: bar.time, price: /* prior price */ }] });
    }
}
```

Bound becomes the literal K (always). The `array.size` reference at
the loop bound is detected and rewritten to the literal cap; `at(i)`
gates on the actual filled count internally.

When the loop body references the anchor's prior values (which the
ring helper doesn't store), the converter emits an
`anchor-mirror-required` warning and a TODO comment. v1 falls back to
re-computing the anchor from the original creation expression where
possible; otherwise emits warning and leaves a `/* TODO */`. Task 17
ships the diagnostic; Task 19's tests use scripts where the create-
time anchor is recomputable.

### 5. Cap mismatch handling

When the Pine source's `max_lines_count` is N but the script's
eviction trigger is at M (different N), the converter chooses
`K = min(N, M)` and emits `cap-mismatch` info with both values.

### 6. `array.first` / `array.last` / `array.get(arr, -1)`

- `array.first(lvls)` → `__lvls_ring.at(0)` (oldest still in ring).
- `array.last(lvls)` → `__lvls_ring.at(__lvls_ring.size() - 1)`
  (newest).
- `array.get(lvls, -1)` → REJECT with `negative-array-index` error
  for v1; Pine permits negative indices, chartlang's ring doesn't.

### 7. Linefill across ring elements

`linefill.new(array.get(lvls, i), array.get(lvls, i+1))` → REJECT with
`linefill-over-ring` error; this is Camp C territory (Task 12). Just
detect and flag here; Task 12 finalizes the message.

### 8. Diagnostic codes (added this task)

- `ring-eviction-implicit` (info)
- `cap-mismatch` (info)
- `anchor-mirror-required` (warning)
- `ring-buffer-zero-cap` (error)
- `negative-array-index` (error)
- `linefill-over-ring` (error)

### 9. Tests (§16.3)

| File | Purpose |
|------|---------|
| `campB.test.ts` | Canonical pivot-line fixture: var array + push + size-gate + shift+delete. Asserts the generated ring helper, `HandleRingIR`, and that the eviction block is elided. |
| `campB.property.test.ts` | Property: K matches `min(pineCap, chartlangBucketCap)`. Property: no stale handle remains after the ring's `clear()`. |
| `ring-loop-update.test.ts` | Loop over `array.size(...) → i` becomes literal `i < K` bounded loop with `at(i)` gating. |
| `cap-mismatch.test.ts` | Explicit `max_lines_count=20` + size-gate-at-10 → K=10 + info diagnostic. |
| `array-first-last.test.ts` | Mapping for `array.first`/`array.last`/`array.get(arr, -1)`. |

Coverage 100% on `src/transform/campB.ts` and helpers.

### 10. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/campB.ts` | Create | Camp B transform entry. |
| `packages/pine-converter/src/transform/ringHelper.ts` | Create | IR-side ring synthesis. |
| `packages/pine-converter/src/transform/arrayBuiltinMap.ts` | Create | `array.first/last/get/size/push/shift` → ring/helper mapping. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-11 codes. |
| `packages/pine-converter/src/transform/campB.test.ts` | Create | Canonical pivot-line tests. |
| `packages/pine-converter/src/transform/campB.property.test.ts` | Create | Property tests. |
| `packages/pine-converter/src/transform/ring-loop-update.test.ts` | Create | Loop tests. |
| `packages/pine-converter/src/transform/cap-mismatch.test.ts` | Create | Cap mismatch tests. |
| `packages/pine-converter/src/transform/array-first-last.test.ts` | Create | Array builtins tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-camp-b.md` — patch bump.

## Acceptance Criteria

- The canonical pivot-line fixture produces:
  - One `useDrawingHandleRing<"line">(50)` allocation.
  - One `__lvls_ring.push(draw.line(...))` per pivot detection.
  - No emitted `array.shift` / `line.delete` for the eviction block
    (elided; one `ring-eviction-implicit` info diagnostic emitted).
- `cap-mismatch` triggers when explicit decl cap ≠ size-gate K.
- Loop over `for i = 0 to array.size - 1` becomes
  `for (let i = 0; i < 50; i++) { … at(i) … }`.
- `array.get(arr, -1)` emits `negative-array-index` error.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
