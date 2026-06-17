# Task 6 — Mapping tables — Validated Plan

## Context

Centralize every Pine v6 → chartlang name/enum mapping decision into
declarative, immutable lookup tables under
`packages/pine-converter/src/mapping/`. Data only — no transform logic.
Every transform task (7–15) consumes these tables; this is the single
source of truth for each Pine→chartlang decision.

## Pre-existing work

- Task 1 scaffolded the package. `src/mapping/index.ts` is the 5-line
  `export {};` stub. Subdir stubs exist for `ast/parser/semantic/codegen/
  transform/diagnostics`.
- Lexer (`src/lexer/`) is DONE by a concurrent teammate; `CLAUDE.md`
  already documents lexer invariants. I must NOT touch `src/lexer/`,
  `src/parser/`, `src/semantic/`, `src/ast/`. I append a mapping section
  to `CLAUDE.md`; I do NOT touch `src/index.ts` (mapping is package-
  internal, consumed by transforms — not part of the public `convert`
  surface, matching the lexer precedent which is also not re-exported).

## Chartlang TARGET symbols — VERIFIED against the workspace

All confirmed by reading `packages/core/src`:

- `DrawingKind` (`draw/drawingKind.ts`): 62 kebab-case kinds. Confirmed
  present: `line`, `rectangle`, `polyline`, `text`, `marker`,
  `arrow-mark-up`, `arrow-mark-down`, `frame`, `table`. NO `box` kind
  (Pine `box` → chartlang `rectangle`). NO `label` kind (Pine `label` →
  `text`/`marker`/`frame`). NO `linefill` kind (unmappable in v1).
- `DrawNamespace` (`draw/draw.ts`): `line/rectangle/polyline/marker/text/
  arrowMarkUp/arrowMarkDown/frame/table` all exist.
  **`marker(anchor, opts?: TextOpts & {text?, value?})` has NO `shape`
  field** — Pine label shape styles (circle/square/diamond/…) collapse to
  a plain `draw.marker`; the shape glyph is NOT modeled. Recorded with a
  warning note, not a fabricated `shape:"circle"`.
- `LineStyle` (`types.ts`): `"solid" | "dashed" | "dotted"` ONLY. No
  arrow-head line styles → Pine `line.style_arrow_*` maps to `"dashed"`
  with a warning note.
- `TextOpts` (`draw/drawingStyle.ts`): `size` ∈
  `tiny|small|normal|large|huge` (no `auto`, no `bold`/`italic`/font).
  `halign` ∈ `left|center|right`. `valign` ∈ `top|middle|bottom`.
- `SourceField` (`input/inputDescriptor.ts`):
  `open|high|low|close|hl2|hlc3|ohlc4|hlcc4`.
- `input` namespace (`input/input.ts`): `int|float|bool|string|enum|
  color|source|time|price|symbol|interval|externalSeries`.
  **No `input.timeframe`** → maps to `input.interval`. **No
  `input.text_area`** → `input.string` + `multiline:true`. **No
  `input.enum` mapping from Pine** (Pine `input.enum` is UDT-backed →
  REJECT in v1).
- `TaNamespace` (`ta/ta.ts`): verified each chartlang `ta.*` name in the
  passthrough table is a real method (sma/ema/rma→smma/wma/hma/vwma/alma,
  rsi/macd/stoch/cci/cmo/mfi/tsi/williamsR, bb/bbw/keltner/atr/stdev,
  supertrend/psar/dmi/vwap, crossover/crossunder, highest/lowest/
  barssince/valuewhen/change, lsma, pivotsHighLow). `swma`→`wma` approx.
  No chartlang `kcw`/`dev`/`cum`/`correlation`/`swma` exact → marked
  unmappable (null) where applicable.
- `PivotsHighLowResult` (`ta/ta.ts:1970`): fields are `high` / `low`
  (NOT `pivotHigh`/`pivotLow`). `ta.pivothigh` → `ta.pivotsHighLow.high`,
  `ta.pivotlow` → `ta.pivotsHighLow.low`.
- `BarStateView` (`views/barstate.ts`): `isfirst/islast/isnew/ishistory/
  isrealtime/isconfirmed` (not used directly in Task 6 tables but
  confirmed for completeness).

## Pine SOURCE facts

Enum names (`line.style_dashed`, `extend.both`, `label.style_circle`,
`size.large`, `text.align_*`, `position.*`, `color.*`), input signatures,
`ta.*`/`math.*` member lists derive from the TradingView Pine v6
reference (`https://www.tradingview.com/pine-script-reference/v6/`). Each
table entry carries a `// docs:` source-doc comment per the README
provenance note.

## Issues found / decisions

1. **`ExpressionNode` does not exist yet** (Task 3/4 own `src/ast/`, and
   I must not touch it). The task spec's `ChartlangSetter.transform`
   signature references it. DECISION: type `transform` as
   `(args: readonly unknown[]) => unknown`. The mapping module stays
   decoupled from the unbuilt AST; transform tasks narrow `unknown` at
   their call site. Documented as an invariant in `CLAUDE.md`.
2. **`draw.marker` has no `shape`** — cannot emit `shape:"circle"`.
   Pine label shape styles map to `draw.marker` with a warning note; the
   glyph is dropped. No fabricated field.
3. **Cross-check test**: import the runtime `ta` value from
   `@invinite-org/chartlang-core` and assert every non-null
   `TA_PASSTHROUGH_MAP` chartlang base name (before any `.high`/`.low`
   member suffix) is a key of `ta`. Requires adding
   `@invinite-org/chartlang-core: workspace:*` to the package's
   `devDependencies` (test-only; mapping source has zero runtime imports
   from core).
4. **`null` REJECT marker**: `lookup` returns `T | null`. Unmappable
   entries store `chartlang: null` and `lookup` still returns the entry
   (so the diagnostic layer can read the note); a separate predicate
   `isRejected(entry)` is NOT needed — callers check `entry.chartlang ===
   null`. BUT acceptance criteria say `lookup("ta.kcw")` returns null and
   `lookup("math.random")` returns null. DECISION: keep entries in the
   map but have `lookup` return `null` when the entry is a REJECT
   (`chartlang === null`). This satisfies the acceptance criteria
   literally. Tests assert both the map-level note AND `lookup` → null.

## Numbered steps (verified paths)

1. `src/mapping/types.ts` — shared `MappingEntry` base + generic
   `lookup<T>(map, key): T | null` that returns `null` for missing keys
   AND for entries whose `chartlang` field is `null` (REJECT). Plus
   `ChartlangSetter` / `DrawingMapping` / `EnumMapping` / `InputMapping` /
   `TaMapping` / `MathMapping` interfaces.
2. `src/mapping/drawingKinds.ts` — `DRAWING_KIND_MAP` + per-kind setter
   maps + `lookup`. `linefill.new` → `chartlang:null`.
3. `src/mapping/enums.ts` — `ENUM_VALUE_MAP` covering line styles,
   extend, label styles, sizes, text align, position, color constants.
4. `src/mapping/inputs.ts` — `INPUT_MAP`. `input.enum` REJECT.
5. `src/mapping/taPassthrough.ts` — `TA_PASSTHROUGH_MAP`. kcw/dev/cum/
   correlation REJECT (null).
6. `src/mapping/mathPassthrough.ts` — `MATH_PASSTHROUGH_MAP`.
   random/round_to_mintick REJECT (null).
7. `src/mapping/index.ts` — barrel re-export of all five tables + types.
8. Five `*.test.ts` files → 100% coverage incl. the taPassthrough
   cross-check against core's `ta`.
9. Append a mapping invariants section to
   `packages/pine-converter/CLAUDE.md`.
10. Add `@invinite-org/chartlang-core` to devDependencies.
11. `pnpm changeset` → `.changeset/pine-converter-mapping.md`, patch bump.

## Files to create / modify

| File | Action |
|------|--------|
| `src/mapping/types.ts` | Create |
| `src/mapping/drawingKinds.ts` | Create |
| `src/mapping/enums.ts` | Create |
| `src/mapping/inputs.ts` | Create |
| `src/mapping/taPassthrough.ts` | Create |
| `src/mapping/mathPassthrough.ts` | Create |
| `src/mapping/index.ts` | Replace stub (barrel) |
| `src/mapping/*.test.ts` (6) | Create |
| `packages/pine-converter/CLAUDE.md` | Append mapping section |
| `packages/pine-converter/package.json` | Add core devDep |
| `.changeset/pine-converter-mapping.md` | Create (patch) |

## Gates to keep green

- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% cov)
- typecheck / lint (no any/!/as; useImportType)
- docs:check (JSDoc @example/@since/@experimental on every export)

## Changeset

`.changeset/pine-converter-mapping.md` — patch bump for
`@invinite-org/chartlang-pine-converter`.

## Acceptance checklist

- [ ] `drawingKinds.lookup("line.new").setterMap.get("set_xy1")` →
      `statePath: ["anchors", 0]`
- [ ] `enums.lookup("extend.both")` → `{extendLeft:true,extendRight:true}`
- [ ] `taPassthrough.lookup("ta.rma").chartlang === "ta.smma"`
- [ ] `taPassthrough.lookup("ta.pivothigh").chartlang ===
      "ta.pivotsHighLow.high"`
- [ ] `taPassthrough.lookup("ta.kcw")` / `ta.dev` → null
- [ ] `mathPassthrough.lookup("math.random")` → null
- [ ] cross-check: every taPassthrough chartlang base name ∈ core `ta`
- [ ] 100% coverage on `src/mapping/`
- [ ] JSDoc + lint + typecheck green
- [ ] changeset committed
