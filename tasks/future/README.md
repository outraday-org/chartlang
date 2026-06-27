# `tasks/future/` — execution order & parallelization plan

Ten task folders live here. This file is the **cross-folder** orchestration
plan: the order to execute them in, what can run **in parallel**, and where the
hard dependencies and file-contention hotspots are. Each folder keeps its own
`README.md` with the **intra-folder** task DAG (`1-*.md`, `2-*.md`, …) — follow
that once a folder is in flight.

## Execution status — COMPLETE (updated 2026-06-27)

> **TL;DR for a new chat:** **ALL folders are done** — folder waves A, B, and C
> are fully `X-`-prefixed. Wave C (`pine-converter-coverage`) closed on
> 2026-06-27: its final five groups (`X-T7`, `X-T11`, `X-T5`, `X-T8`, `X-T12`)
> landed via `/execute-tasklist`, each graded Complete/Ship by a per-folder
> quality pass. **Nothing is committed** — everything is in the working tree.
> To finish, run the full-workspace gates (`pnpm typecheck/lint/test`) and
> `pnpm conformance` (adapter rebuild — **T8** is the only adapter-touching
> group; it added the `plot-visible` conformance scenario), then commit.

**Folder waves A (7 folders), B (2 folders), and C (`pine-converter-coverage`,
12 task groups) are ALL COMPLETE** — every task file `X-`-prefixed, folders
`X-`-prefixed, all graded Complete/Ship, changes **uncommitted in the working
tree**. Per-package gates ran green at 100% throughout; the full-workspace gates
+ `pnpm conformance` are the final CI proof before committing.

> ⚠️ **Run the full gates before committing.** Execution used per-package gates
> only (`pnpm -F @invinite-org/chartlang-pine-converter test`, etc.) — the
> full-workspace `pnpm typecheck/lint/test` and `pnpm conformance` (adapter
> rebuild) were deliberately **not** run and remain the final CI proof. Each
> folder shipped its own changesets.

**Completed — folder wave B (both `X-`-prefixed, 2026-06-26; all tasks
Complete/Ship, 0 quality fixes needed):**

- ✅ `X-array-analytics` — reduction methods on `MutableArraySlot<number>`
  (`sum/avg/min/max/stdev/variance/median/percentile/sort/indexOf/includes/range`)
  + a thin frozen `array.*` namespace that **delegates 1:1** (no second impl).
  Skip-NaN policy (empty/all-NaN → NaN); stdev/variance population-default;
  percentile = linear interpolation; `sort()` returns a copy. Converter `array.*`
  mapping (fixture **35**, `array-reduction-not-mapped`/`array-sort-returns-copy`
  codes); conformance `array-rolling-stats`; example `rolling-zscore`. `@since 1.4`.
- ✅ `X-map-collection` — `state.map<K extends string|number, V=number>(cap)`,
  the keyed sibling of `state.array`. Runtime `MapStore` reuses the state.array
  committed/tentative snapshot lifecycle (`:map` suffix); insertion-order FIFO
  eviction. v1 surface = `set/get/has/delete/clear/size/keyAt` (**iterators
  deferred**). Reused (not forked) the literal-capacity guard
  (`CAPACITY_GUARDED_NAMES`). Converter `map.*` mapping with **capacity
  synthesis** → `state.map<number,number>(1000)` + `map-capacity-synthesized`;
  `map.get` na-bridged (`?? NaN`). Fixture **36**, conformance `map-accumulator`,
  example `volume-by-level`. `@since 1.4`.

**Completed — folder wave A (all `X-`-prefixed, `/execute-tasklist` auto-skips
them on resume):**

- ✅ `X-state-array`
- ✅ `X-multi-symbol-security`
- ✅ `X-bgcolor-barcolor-ergonomics` — **Deliverable 2 (the per-bar
  `colorValue` channel) was RATIFIED and built; do NOT re-ask the product
  gate.**
- ✅ `X-calendar-session-helpers` — `time_close` was **folded in here** (shipped
  as `time.timeClose`), per this plan's note.
- ✅ `X-math-utilities` — `math.*` scalar namespace (2026-06-25). `@since`
  corrected to **1.4** (the shipping minor; task files' literal `1.2` was
  overridden — match 1.4 for any sibling namespace). Pine `na(x)` deliberately
  **left as the inline context-aware predicate** (not rewritten to `math.na`);
  latent invalid-JS `Math.avg`/`Math.sum` mappings fixed; converter wires
  `math` import-only + `syminfo` destructure-only. Conformance:
  `math-round-to-mintick`.
- ✅ `X-str-utilities` — `str.*` namespace (2026-06-25). `@since` **1.4**.
  Formatter is **hand-rolled** (no `Intl`/`toLocaleString`/locale — byte-stable
  across hosts). Converter lowers `str.*` to **native JS** (no `str` import
  UsageFlag needed, unlike `math`). Conformance: `str-formatted-table`.
- ✅ `X-drawing-handles` — **RFC only, no code.** Shipped
  `docs/rfcs/0001-mutable-drawing-handles.md` (+ `docs/rfcs/README.md`
  bootstrapping the RFC convention). **KEY FINDING:** the README premise below
  ("create-once-mutate-across-bars does not exist") is **stale** — a Phase-3
  mutable `DrawingHandle` substrate already shipped (`core/draw/handle.ts`,
  `runtime/emit/draw/handle.ts`, wire `handleId`+`op`+full-state, all 6 adapters
  honor `op:"remove"`, converter `drawingCamp.ts` lowers `line.new`/`set_*`).
  RFC recommends **Option C (Hybrid)**: keep declarative `draw.*` default, add a
  thin opt-in `draw.line.new()`/`draw.text.new()` + bounded
  `state.drawings(maxCount)`, **no wire change, no adapter migration**; v1 =
  line+label. The future `drawing-handles-impl/` folder is authored only after
  this RFC is accepted; its main work is the §7 snapshot/two-ring gap.

**RESUME HERE — folder wave C, the `pine-converter-coverage` capstone (8 of 12
groups remain):**

- **Done (`X-T*`-prefixed, auto-skipped):** `X-T9` (leading-op continuation),
  `X-T10` (loop break/continue + the `.current`→`state.series` promotion for
  history-indexed ta-series), `X-T2` (nested `ta.*` `.current` lowering), `X-T1`
  (UDF declarations).
- **Remaining:** **T3, T4, T6, T7, T11** (converter-internal, any order), then
  the cross-folder-gated **T5** (needs T4) and **T8** (needs the landed bgcolor
  D2), and core-spanning **T12**.
- **Order swap on resume:** the prose elsewhere says "T1 → T2", but T1's Task 4/5
  genuinely depend on T2's nested-`ta.*` lowering while T2 has no hard dep on T1
  — so **T2 was run before T1** to break the cycle. T2 and T1 are both done now,
  so this only matters as the rationale recorded in `pine-converter-coverage/README.md`.
- **Carry-forward follow-ups surfaced by T1/T2 (see capstone README for detail):**
  parked fixture `46` (history-indexed inlined-UDF-arg → `state.series` promotion);
  `cf_ma` switch-as-value belongs to **T3**; and a **pre-existing** stale
  `transform/other.ts` CLAUDE.md note claims `14-polyline-rebuild` was unparked
  from `KNOWN_NON_COMPILING` when it is still listed — fix when next in that area.

**Notes for the resuming agent:**

- Per-task implementation + the per-folder quality pass both run on **opus**.
- This run used the Claude Code Agent-tool surface (no `TeamCreate`): one
  `code-implementer` teammate per task (sequential within a folder due to
  pine-converter hotspot contention), one `quality-analysis` teammate per
  folder. The next free fixture `NN` is **47** (`ls packages/pine-converter/fixtures`
  to confirm — do not trust task-file numbers).
- Build dist may be stale: run `pnpm -F @invinite-org/chartlang-core build`
  (and `adapter-kit`/`compiler`/`runtime`) before downstream typecheck if
  exports appear missing.
- A new `input.*` kind has **6** lockstep consumers (incl. the `editor`
  package), not 5. Editing `examples/*-adapter/src` requires
  `pnpm adapters:generate` (the CLI embeds a byte-copy).
- Conformance `plot-hash` is **adapter-independent** — pin it once; a
  per-adapter divergence is a mis-minted hash, not an adapter difference.
- Open low-priority item: `packages/compiler/src/compile.test.ts >
  request.security expression overload` can time out under heavy parallel
  load (passes in isolation) — pre-existing test-infra flakiness, not a
  correctness bug.

## TL;DR

```
WAVE A  ✅ DONE  (7 folders, no cross-folder deps)
  state-array · multi-symbol-security · bgcolor-barcolor-ergonomics
  calendar-session-helpers · math-utilities · str-utilities · drawing-handles(RFC)

        │ state-array tasks 1–3 land
        ▼
WAVE B  ✅ DONE  (2 folders, depend on state-array)
  array-analytics · map-collection

        │ multi-symbol-security + bgcolor D2 + str + calendar land
        ▼
WAVE C  ✅ DONE  (capstone — consumes the others)
  pine-converter-coverage  →  all 12 groups done (T1–T12, every folder X-prefixed)
```

Maximum parallel width is **7** (Wave A). The critical path is
`state-array → {array-analytics | map-collection}` for the collection family,
and `multi-symbol-security / bgcolor D2 → pine-converter-coverage` for the
converter capstone.

## Cross-folder dependency graph

```
state-array ──┬──────────────► array-analytics      (needs state-array 1–2)
              └──────────────► map-collection        (needs state-array 1–3)

multi-symbol-security ────────► pine-converter-coverage  (T5: tuple security)
bgcolor-barcolor (D2) ────────► pine-converter-coverage  (T8: plot visibility)
str-utilities ────────────────► pine-converter-coverage  (don't-duplicate str.tostring)
calendar-session-helpers ─────► pine-converter-coverage  (don't-duplicate timestamp; T5/T12)

math-utilities          (independent — no folder depends on it)
drawing-handles (RFC)   (independent — its output gates a FUTURE impl folder)
```

No cycles. Every edge is a "must land first," not a soft preference.

## Folder dependency table

Canonical, machine-readable folder order (consumed by `/execute-tasklist` in
aggregate mode). First column = child folder; **Depends on** lists sibling
folders that must fully land first. `—` = no cross-folder dependency.

| Folder | Depends on | Notes |
|--------|-----------|-------|
| state-array | — | foundation for the collection family |
| multi-symbol-security | — | unblocks pine-converter T5 |
| bgcolor-barcolor-ergonomics | — | D1 ships now; **D2 product-gated**, unblocks pine-converter T8 |
| calendar-session-helpers | — | fold in `time_close` |
| math-utilities | — | nothing depends on it |
| str-utilities | — | unblocks pine-converter `str.tostring` mapping |
| drawing-handles | — | RFC only; gates a *future* impl folder |
| array-analytics | state-array | reductions on `MutableArraySlot` |
| map-collection | state-array | reuses the state-array capacity guard (task 3) |
| pine-converter-coverage | multi-symbol-security, bgcolor-barcolor-ergonomics, str-utilities, calendar-session-helpers | capstone; itself an aggregate of T1–T12 |

This yields folder waves: **A** = the seven `—` folders, **B** =
array-analytics + map-collection, **C** = pine-converter-coverage.

## Wave A — start immediately (no cross-folder dependencies)

| Folder | Scope | Notes |
|--------|-------|-------|
| **state-array** | `state.array<number>(cap)` bounded FIFO ring | **Highest priority in Wave A** — unblocks all of Wave B. Land tasks 1–3 first so the dependents can start. |
| **multi-symbol-security** | `request.security({symbol?, interval})` composite key | Unblocks pine-converter T5. Self-contained (builds on already-landed `tasks/old/htf-security-expression`). |
| **bgcolor-barcolor-ergonomics** | Pine `bgcolor`/`barcolor` aliases (D1) + per-bar `colorValue` channel (D2) | **D1 (tasks 1–3) ships now.** **D2 (tasks 4–6) is product-gated** — do not start until the `colorValue`-vs-alternatives decision is ratified. D2 unblocks pine-converter T8. |
| **calendar-session-helpers** | `time.*` / `session.*` / `input.session` | Self-contained. **Fold in `time_close`** here (pine-converter-coverage defers it to this folder). |
| **math-utilities** | `math.*` chart-aware scalar helpers | Self-contained, lowest complexity (2 tasks). |
| **str-utilities** | `str.*` formatting namespace | Self-contained (2 tasks). Unblocks pine-converter `str.tostring` mapping. |
| **drawing-handles** | **Design RFC only** — no code | Independent, can run anytime. Output (accepted RFC) gates a *future* `drawing-handles-impl/` folder, **not** anything in this batch. |

### ⚠ File-contention within Wave A

These folders are *logically* independent but several edit the **same hotspot
files**. Running all 7 in isolated worktrees will produce merge conflicts in:

- `packages/compiler/src/program.ts` — ambient shim (str, math, calendar all
  add a frozen namespace; bgcolor + state-array add holes/registry mirrors).
- `packages/core/src/index.ts` — barrel export (every new namespace).
- `packages/core/src/statefulPrimitives.ts` — registry (state-array, bgcolor,
  calendar entries).
- `scripts/generate-skills-reference.ts` + generated
  `skills/chartlang-coding/references/primitives.md` (the `skills:gate`).
- `packages/pine-converter/src/...` mapping tables + transforms (str, math,
  calendar, multi-symbol all add converter mappings).

**Mitigation:** land the Wave-A folders sequentially *into `main`* (each is
small) with rebases between them, OR designate one integrator to own the shim /
barrel / skills-generator edits and have the namespace folders submit only their
package-local source. The dependency DAG permits full parallelism; the merge
surface does not — plan the integration, not just the implementation.

## Wave B — after `state-array` lands (tasks 1–3)

| Folder | Depends on | Notes |
|--------|-----------|-------|
| **array-analytics** | state-array tasks 1–2 | Reduction methods on `MutableArraySlot` + `array.*` aliases. Parallel with map-collection. |
| **map-collection** | state-array tasks 1–**3** | `state.map<K,V>` — reuses the state-array capacity guard (needs task 3), runtime store, and snapshot lifecycle. Parallel with array-analytics. |

array-analytics and map-collection touch disjoint runtime files
(`arraySlot` reductions vs a new `mapSlot`), so they parallelize cleanly — but
both add a `pine-converter` mapping + a `STATEFUL_PRIMITIVES`/shim edit, so the
same Wave-A contention note applies on those hotspots.

## Wave C — capstone

| Folder | Depends on | Notes |
|--------|-----------|-------|
| **pine-converter-coverage** | multi-symbol-security (T5), bgcolor **D2** (T8), str-utilities, calendar-session-helpers | The T1–T12 batch that makes the converter handle real-world Pine scripts. |

### pine-converter-coverage is partially front-loadable

The folder's own README gives the internal order. Most of T1–T12 are
**converter-internal** and depend only on each other — they do **not** need the
other future folders and can begin as soon as Wave A converter work has settled:

- **Start first (general prerequisites):** **T9** (leading-op continuation),
  **T10** (`break`/`continue`) — these unblock converting almost *any* real
  script.
- **Then:** **T1 → T2** (UDF declarations → nested `ta.*` lowering).
- **Independent converter fixes (any order, parallel):** **T3, T4, T6, T7, T11.**
- **Cross-folder-gated (Wave C proper):**
  - **T5** (tuple `request.security`) — needs **multi-symbol-security** + T4.
  - **T8** (plot visibility / `display=`) — needs **bgcolor D2**.
  - **T12** (`var color` / non-numeric persistent state) — core+runtime+converter.
- **Folded elsewhere:** `str.tostring`→str-utilities; `timestamp`/`time_close`
  →calendar-session-helpers; custom-symbol feeds→multi-symbol-security. Depend
  on those, don't re-implement.

So T9/T10/T1/T2/T3/T4/T6/T7/T11 can overlap Waves A–B; only T5/T8 force the
capstone wait.

## Product / decision gates (not engineering blockers)

- **bgcolor-barcolor D2** (`colorValue` wire channel) — gated on a product
  decision (cross-layer cost + wire-shape choice). D1 ships independently.
  **pine-converter T8 cannot complete until this gate clears.**
- **drawing-handles** — ships an RFC only. The implementation folder is authored
  *after* the RFC is accepted; nothing else in this batch waits on it.

## Recommended scheduling

1. **Kick off Wave A**, prioritizing **state-array** (to unblock Wave B) and
   **multi-symbol-security** + the **bgcolor D2 product decision** (to unblock
   the capstone). Run drawing-handles (RFC) and math/str/calendar in parallel.
2. **As state-array tasks 1–3 merge**, start **array-analytics** and
   **map-collection** (Wave B).
3. **In parallel with A/B**, begin the converter-internal
   pine-converter-coverage groups (**T9, T10, T1, T2, T3, T4, T6, T7, T11**).
4. **Once multi-symbol-security and bgcolor D2 land**, finish the gated
   pine-converter groups (**T5, T8**) and **T12** — closing the capstone.

Throughout, treat the shim/barrel/registry/skills-generator/converter files as
**shared integration points**: serialize edits to them even when the underlying
features are parallel.
