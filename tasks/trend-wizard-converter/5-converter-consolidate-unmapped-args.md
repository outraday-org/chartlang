# Task 5 — Converter: consolidate unmapped-arg-name warnings (inputs + tables)

> **Status: TODO**

## Goal

Stop the converter from emitting one warning **per call site per
unmapped argument**. Trend Wizard's ~150 inputs each pass
`group`/`inline`/`tooltip` (and some `confirm`), producing **228+**
`input-arg-not-mapped` warnings; its `table.cell` calls produce **6**
`table-formatting-not-mapped` warnings for
`text_formatting`/`text_font_family`/`text_wrap`. Consolidate each to
**one diagnostic per distinct unmapped argument name** across the whole
script.

See [`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) §Transform issues 6 & 7.
These are genuinely unmappable: core's `InputOptionsObject` carries only
`title/min/max/step/multiline`; core's `TableCell` carries only
`text/bgColor/textColor/textHalign/textValign/textSize`.

## Prerequisites

Task 4 (so the script gets through input/security mapping; the arg
walk runs over the full input set).

## Current Behavior

```bash
node packages/cli/dist/bin.js pine-convert /tmp/tw.pine --diagnostics-json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const c={};for(const d of j){c[d.code]=(c[d.code]||0)+1}console.log(c)})'
# input-arg-not-mapped: 228, table-formatting-not-mapped: 6
```

- `packages/pine-converter/src/transform/inputs.ts` `buildOptions`
  (~L130-173, push at ~L166) and `resolveOptionsEnum` (~L383-388) push
  one `input-arg-not-mapped` per unmapped arg per call.
- `packages/pine-converter/src/transform/tables.ts` `UNMAPPED_CELL_ARGS`
  (~L88-92), `applyCellNamedArgs` (~L236-239) push one
  `table-formatting-not-mapped` per arg per cell.

## Desired Behavior

- For each distinct unmapped **input** arg name encountered anywhere in
  the script (`group`, `inline`, `tooltip`, `confirm`, …), emit **one**
  `input-arg-not-mapped` diagnostic, with a message naming the arg and
  stating it has no chartlang analogue. 228 → ~4.
- For each distinct unmapped **table cell** arg name
  (`text_formatting`, `text_font_family`, `text_wrap`), emit **one**
  `table-formatting-not-mapped`. 6 → ~3.
- Span: point at a representative (first) occurrence; keep it
  actionable. Severity unchanged (warning) per the codes registry.
- The mapped args (`title`, `min/max/step`, `options`→enum on inputs;
  `bgcolor`, `text_color`, `text_halign/valign`, `text_size` on cells)
  continue to map exactly as before — **no behavior change** for mapped
  args, including the dynamic `bgcolor`/`text_color` path
  (`get_dynamic_color(...)`).

## Requirements

1. **Shared consolidation helper.** `DiagnosticCollector`
   (`src/transform/diagnosticCollector.ts`) is the shared instance already
   threaded through every transform and **already has a `has(code)` dedup
   primitive** (~L84-86) used elsewhere for per-script dedup — but that
   dedups by *code*, and here we need dedup by *(code, arg-name)*.
   Preferred approach: extend `DiagnosticCollector` with a per-key
   "warn-once" method (e.g. `pushCodeOnce(key, argName, span)` backed by a
   `Set<string>` of `${key}:${argName}`), so both `inputs.ts` and
   `tables.ts` route through the single shared collector.
   **Note:** there is **no `_lib/` directory** in this package — helpers
   are plain sibling modules under `src/transform/` (e.g. `callArgs.ts`,
   `colorConvert.ts`). If you prefer a standalone helper over extending
   the collector, add it as a sibling `src/transform/<dedupe>.ts`, not
   under `_lib/`.

2. **Inputs** (`src/transform/inputs.ts`): in `buildOptions` /
   `resolveOptionsEnum`, route unmapped-arg warnings through the helper
   so each arg name warns once per script, not per call.

3. **Tables** (`src/transform/tables.ts`): same for
   `applyCellNamedArgs` / `UNMAPPED_CELL_ARGS`.

4. **Messages**: keep the existing diagnostic **codes** (`input-arg-not-mapped`,
   `table-formatting-not-mapped`) — do not add new codes. Update the
   `defaultMessage` / override text in `DIAGNOSTIC_CODE_ENTRIES` if it
   currently implies a single arg; the message should read naturally for
   a per-arg-name (not per-occurrence) emission. If you change a
   message, run `pnpm converter:docs:generate`.

5. **Strict mode**: confirm `golden.strict.test.ts` (warnings→errors)
   still behaves sensibly — fewer-but-present warnings.

## Edge Cases

- The same arg name on different input primitives
  (`input.int` vs `input.bool`) → still one warning for that name.
- An arg that is mapped on one primitive but not another → only warn for
  the genuinely-unmapped uses; don't suppress a real mapping.
- Determinism: the consolidated set must emit in a **stable order**
  (e.g. first-seen or sorted) so goldens/diagnostics snapshots are
  deterministic across runs (the harness fixes seeds; ordering must not
  depend on Map iteration of nondeterministic input).
- An input/cell with **no** unmapped args → no diagnostic.
- Interaction with Task 4's `gaps=` info — if you built a consolidation
  helper here, retrofit Task 4's gaps info to reuse it (or note it’s
  already consolidated).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/diagnosticCollector.ts` (preferred) or a sibling `src/transform/<dedupe>.ts` | Modify/Create | Per-(code, arg-name) warn-once helper. **No `_lib/` dir exists.** |
| `packages/pine-converter/src/transform/inputs.ts` | Modify | Route unmapped input args through the helper. |
| `packages/pine-converter/src/transform/tables.ts` | Modify | Route unmapped cell args through the helper. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify (if message reworded) | Per-arg-name phrasing. |
| `packages/pine-converter/src/transform/*.test.ts` | Modify/Add | Consolidation + ordering + no-regression tests. |

## Tests (co-located, 100% coverage)

- A script with N inputs all passing `group`/`inline`/`tooltip` → exactly
  3 warnings, stable order.
- A `table.cell` with `text_formatting` + `text_font_family` +
  `text_wrap` across multiple cells → exactly 3 warnings.
- Mapped args (`title`, `bgcolor`, etc.) still map; assert emitted output
  unchanged for a known fixture (no golden drift beyond the warning
  count).
- Determinism test: two runs → identical diagnostics array.
- 100% line/branch/function maintained.

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100%)
- `pnpm converter:docs:generate && pnpm converter:docs:check` (if a
  message changed)
- `pnpm check:content` (final)

## Changeset

`.changeset/<slug>.md` → `@invinite-org/chartlang-pine-converter`
**patch**: "Consolidate `input-arg-not-mapped` and
`table-formatting-not-mapped` to one diagnostic per distinct unmapped
argument name."

## Acceptance Criteria

- Full-script `--report`: `input-arg-not-mapped` ≈4 (one per distinct
  name), `table-formatting-not-mapped` ≈3 — not 228 / 6.
- Mapped-arg behavior unchanged (no golden drift beyond warning counts).
- Deterministic diagnostics; 100% coverage; converter docs gate green.
- Changeset committed.
