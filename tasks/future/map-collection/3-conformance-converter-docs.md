# Task 3 — Conformance + Pine `map.*` converter + docs/skills/example

> **Status: TODO**

## Goal

Add a conformance scenario exercising `state.map` across bars, map Pine's
`map.*` calls onto `state.map` in the converter, and publish docs / skill
reference / a runnable example.

## Prerequisites

- Tasks 1–2 complete (`state.map` core + runtime).

## Current Behavior

- No conformance scenario uses `state.map`.
- The Pine converter has no `map.*` mapping; Pine `map.new<int, float>()` has
  no chartlang target.

## Desired Behavior

| Pine | chartlang |
|------|-----------|
| `map.new<int, float>()` | `state.map<number, number>(CAP)` — converter must **synthesize a capacity** (Pine maps are unbounded). Emit `state.map<number, number>(/* TODO: bound */ 1000)` with a diagnostic explaining chartlang requires a literal capacity. |
| `map.put(id, k, v)` | `m.set(k, v)` |
| `map.get(id, k)` | `m.get(k)` *(note: chartlang returns `undefined`, not `na`; converter wraps reads as `(m.get(k) ?? na)` where the surrounding expression expects a number)* |
| `map.contains(id, k)` | `m.has(k)` |
| `map.remove(id, k)` | `m.delete(k)` |
| `map.size(id)` | `m.size` |
| `map.clear(id)` | `m.clear()` |
| `map.keys(id)` / `map.values(id)` | **unsupported** (no v1 iterators) → diagnostic + `// TODO` |

## Requirements

### 1. Pine converter (`packages/pine-converter/src/transform/`)

- Add a `map.*` family transform (new `mapFamily.ts` or extend the collection
  family file added by `../state-array/`). `map.new(...)` becomes a
  `state.map` declaration; member calls take the map id as first arg → the
  chartlang handle method.
- **Capacity synthesis:** Pine maps are unbounded; chartlang requires a literal
  capacity. Emit a default (`1000`) with an `unsupported-*`-family diagnostic
  (`packages/pine-converter/src/diagnostics/codes.ts`) telling the author to
  set a real bound. Do not fail the conversion.
- **`na` vs `undefined`:** wrap `map.get` reads so a downstream numeric
  expression sees `na`/`NaN` rather than `undefined` (reuse the converter's
  existing `na` lowering helper if one exists; otherwise `?? Number.NaN`).
- `map.keys`/`map.values` (no v1 iterators) + any unmapped `map.*` →
  diagnostic + `// TODO`.
- Co-locate converter unit tests for each mapped name + capacity synthesis +
  unsupported paths.

### 2. Conformance scenario (`packages/conformance/src/scenarios/`)

- `mapAccumulator.scenario.ts`: a script that accumulates per-rounded-price
  volume into `state.map<number, number>(N)` over a fixed bar series and
  `plot`s a derived scalar (e.g. the value at a fixed key each bar), asserting
  byte-stability across **all** adapters. `pnpm conformance` replays every
  registered scenario through every adapter (canvas2d, echarts, konva,
  lightweight-charts, uplot), so a registered scenario *is* the all-adapter
  proof. Mirror an existing state scenario shape.
- Register in the scenario index.

### 3. Docs (`docs/`)

- Add a `state.map` reference page (mirror the `state.array` page): surface
  table, the `undefined`-vs-`0` semantics, insertion-order FIFO eviction, the
  literal-capacity requirement, and the v1 `keyAt`/`size` iteration form (no
  iterators). Update nav.

### 4. Author skill (`skills/chartlang-coding/`)

- Add the `map.*` → `state.map` mapping to
  `references/translating-from-pine.md`, including the capacity-bound caveat
  and the `na`/`undefined` difference.

### 5. Example + live-demo wiring (`examples/scripts/` + `apps/site`)

Follow the example pipeline (`examples/CLAUDE.md`, `apps/CLAUDE.md`,
`tasks/examples-full-coverage/`):

1. **Source** — `examples/scripts/volume-by-level.chart.ts`: bucket volume into
   `state.map<number, number>(64)` keyed by rounded price, then mark the
   current bar's level — a real keyed-accumulation use.
2. **e2e compile** — append to `EXAMPLE_SCRIPTS` in
   `packages/cli/src/e2e.test.ts:13`.
3. **Live demo + docs Examples** — add a `DEMO_SCRIPTS` entry in
   `apps/site/src/components/demo/scripts.ts` (`source` inlined as a string);
   language/utilities category if the categorized dialog has landed.
4. **Generate + gate** — `pnpm examples:generate`; keep `pnpm examples:gate`
   green.

### 6. Adapters — no new capability, verified across all (`examples/*-adapter/`)

`state.map` is a pure-compute collection: the values an author derives from it
flow into the existing `plot`/`draw` holes. It emits **no new wire primitive**
and needs **no adapter code change** — given `tasks/adapter-feature-parity/` is
implemented, every adapter (canvas2d, echarts, konva, lightweight-charts,
uplot) already renders the resulting series. Coverage is by **verification, not
re-implementation**:

- The conformance scenario (§2) is the all-adapter proof — `pnpm conformance`
  replays it through every adapter and asserts byte-stable output. Do not add
  per-adapter code.
- State this explicitly in the changeset/PR so a reviewer does not expect
  adapter diffs.

### 7. react-starter — compile-path verification (`apps/react-starter/`)

The react-starter seam (`src/lib/chart/activeAdapter.ts`,
`src/lib/chart/seamVariants.ts`) is library-agnostic: new language features flow
through the compiler automatically, so **no seam change** is required. Verify
the namespace is accepted end-to-end through the starter:

- Add a minimal case to `apps/react-starter/tests/compile.spec.ts` that POSTs a
  source declaring `state.map<number, number>(N)` and using `set`/`get` to
  `/api/compile` and asserts a clean compile (also exercises the literal-capacity
  guard path).
- `apps/react-starter/tests/adapter-matrix.spec.ts` already proves all five
  seam variants build — no change needed; reference it as the
  all-adapter-bundles guarantee.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/mapFamily.ts` | Create | Map `map.*` Pine calls. |
| `packages/pine-converter/src/transform/mapFamily.test.ts` | Create | Converter unit tests. |
| `packages/conformance/src/scenarios/mapAccumulator.scenario.ts` | Create | Keyed-accumulation byte-stability. |
| `packages/conformance/src/scenarios/index.ts` (registry) | Modify | Register scenario. |
| `docs/language/state-map.md` | Create | Reference page. |
| `docs/.vitepress/config.*` | Modify | Nav entry. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Mapping table. |
| `examples/scripts/volume-by-level.chart.ts` | Create | Example. |
| `packages/cli/src/e2e.test.ts` | Modify | Add example to `EXAMPLE_SCRIPTS`. |
| `apps/site/src/components/demo/scripts.ts` | Modify | `DEMO_SCRIPTS` entry (live demo + docs Examples). |
| `apps/react-starter/tests/compile.spec.ts` | Modify | Compile-path case for `state.map` (proves the starter accepts the primitive). |
| `.changeset/state-map-converter.md` | Create | patch (pine-converter, conformance). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter + conformance)
- `pnpm conformance` (the scenario runs through every adapter)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm examples:gate` (after `pnpm examples:generate`)
- `pnpm skills:gate`
- `pnpm -F chartlang-react-starter e2e` (Playwright compile + adapter-matrix specs)

## Changeset

`.changeset/state-map-converter.md` — **patch** (pine-converter, conformance).

## Acceptance Criteria

- `map.new` → `state.map` with synthesized capacity + diagnostic; member calls
  map; unsupported iterators emit diagnostics, never hard failures.
- Conformance keyed-accumulation series byte-stable across **all** adapters
  (canvas2d, echarts, konva, lightweight-charts, uplot) via `pnpm conformance`.
- Docs page + skill mapping updated; example compiles in e2e
  (`EXAMPLE_SCRIPTS`) and appears in the live demo (`DEMO_SCRIPTS`);
  `examples:gate` green.
- No adapter code change required (documented in the changeset); react-starter
  compile-path case green and the adapter-matrix spec proves all five seam
  variants bundle.
- Coverage + conformance + docs + readme + skills + react-starter gates green;
  changeset committed.
