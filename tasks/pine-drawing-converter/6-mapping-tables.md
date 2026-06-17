# Task 6 — Mapping tables: drawings + enums + inputs + ta/math passthrough

> **Status: TODO**

## Goal

Centralize every Pine → chartlang name/enum mapping decision into
declarative, immutable lookup tables under `src/mapping/`. These
tables are the single source of truth that every transform task
(8–15) consumes. Each entry carries a comment pointing at the Pine
v6 reference page it derives from. This task ships data, not logic —
no transform code lives here.

## Prerequisites

Task 1 (scaffolded package).

## Current Behavior

`src/mapping/index.ts` is a placeholder. No mapping data exists in
the workspace.

## Desired Behavior

`src/mapping/` exports four tables, each as a `ReadonlyMap` or
`Readonly<Record>`:

- `DRAWING_KIND_MAP` — `line.new` → `draw.line`, `box.new` →
  `draw.rectangle`, etc.
- `ENUM_VALUE_MAP` — `line.style_dashed` → `"dashed"`, `extend.both`
  → `{ extendLeft: true, extendRight: true }`, `size.large` →
  `"large"`, etc.
- `INPUT_MAP` — `input.int` → chartlang `input.int`,
  `input.timeframe` → chartlang `input.interval`, etc.
- `TA_PASSTHROUGH_MAP` — `ta.ema` → chartlang `ta.ema`, `ta.sma` →
  `ta.sma`, etc. Includes a per-entry note about signature
  divergence (when relevant).
- `MATH_PASSTHROUGH_MAP` — `math.abs` → `Math.abs`, `math.max` →
  `Math.max`, `math.random` → REJECT, etc.

## Requirements

### 1. `src/mapping/drawingKinds.ts`

```ts
export type PineDrawingConstructor =
    | "line.new"
    | "label.new"
    | "box.new"
    | "table.new"
    | "polyline.new"
    | "linefill.new";

export type ChartlangDrawingKind =
    | "line" | "horizontal-line" | "horizontal-ray" | "vertical-line"
    | "cross-line" | "trend-angle"
    | "rectangle" | "rotated-rectangle" | "triangle" | "circle" | "ellipse"
    | "polyline" | "path"
    | "text" | "marker" | "arrow" | "arrow-marker" | "arrow-mark-up"
    | "arrow-mark-down"
    | "table"
    | /* …rest of the 62 kinds… */ string;

export type DrawingMapping = Readonly<{
    pine: PineDrawingConstructor;
    chartlang: ChartlangDrawingKind;
    /** Maps Pine setter name → chartlang `handle.update({key: ...})`. */
    setterMap: ReadonlyMap<string, ChartlangSetter>;
    notes?: string;
}>;

export type ChartlangSetter = Readonly<{
    /** Path inside the DrawingState patch — e.g. `["anchors", 0]` for `set_xy1`. */
    statePath: readonly (string | number)[];
    /** Number of args the Pine setter takes (after the handle). */
    arity: number;
    /** Optional pre-transform on the argument tuple. */
    transform?: (args: readonly ExpressionNode[]) => unknown;
}>;
```

Populate `DRAWING_KIND_MAP: ReadonlyMap<PineDrawingConstructor,
DrawingMapping>` with one entry per Pine drawing object type. Each
entry carries the full setter map. Examples:

`line.new` → `draw.line` with setter map:
- `set_xy1` → `{ statePath: ["anchors", 0], arity: 2 }` (x, y → WorldPoint)
- `set_xy2` → `{ statePath: ["anchors", 1], arity: 2 }`
- `set_x1` → `{ statePath: ["anchors", 0, "time"], arity: 1 }`
  (with coordinate resolver applied)
- `set_y1` → `{ statePath: ["anchors", 0, "price"], arity: 1 }`
- `set_color` → `{ statePath: ["style", "color"], arity: 1 }`
- `set_width` → `{ statePath: ["style", "lineWidth"], arity: 1 }`
- `set_style` → `{ statePath: ["style", "lineStyle"], arity: 1 }` (with
  enum mapping via ENUM_VALUE_MAP)
- `set_extend` → `{ statePath: ["style"], arity: 1, transform: …}`
  (decomposes extend.* into `{extendLeft, extendRight}`)

`box.new` → `draw.rectangle` similar with `~18 setters`.
`label.new` → `draw.text` similar; `yloc.abovebar`/`belowbar` recorded
as **non-mappable** and Task 10 emits a diagnostic at use site.
`polyline.new` → `draw.polyline` — no setters (Pine polyline is
immutable; mapping is constructor-only).
`linefill.new` → flagged as `chartlang: null` — no direct analogue;
Task 14 emits diagnostic.
`table.new` → `draw.table` — setter map collected separately in
Task 13's table builder; here the mapping carries a marker
`requiresBuilder: true` indicating the transform synthesizes the
`cells` array.

Every entry must include `// docs: https://www.tradingview.com/...`
comment pointing at the Pine v6 doc page.

### 2. `src/mapping/enums.ts`

```ts
export type EnumMapping = Readonly<{
    pine: string;          // e.g. "line.style_dashed"
    chartlang: string | Readonly<Record<string, unknown>>;
    notes?: string;
}>;

export const ENUM_VALUE_MAP: ReadonlyMap<string, EnumMapping>;
```

Cover the full enum surface from the Pine v6 research:

- `line.style_solid` → `"solid"`, `line.style_dotted` → `"dotted"`,
  `line.style_dashed` → `"dashed"`, `line.style_arrow_left` →
  `"dashed"` with `notes: "arrow heads not modeled in chartlang
  LineStyle; emit warning"`, similar for `arrow_right`/`arrow_both`.
- `extend.none` → `{ extendLeft: false, extendRight: false }`,
  `extend.left` → `{ extendLeft: true, extendRight: false }`, etc.
- `label.style_*` — 22 entries. Most map to chartlang via a
  composite: `style_label_up` → chartlang `draw.text` with
  `style.bgColor` set + a small triangle marker via `draw.arrowMarkUp`
  combined. For v1, only map the simple shapes (`style_circle` →
  `draw.marker` with shape "circle", `style_square` →
  `draw.rectangle`, `style_arrowup` → `draw.arrowMarkUp`,
  `style_arrowdown` → `draw.arrowMarkDown`, `style_xcross` →
  `draw.marker` with shape "x", `style_cross` → `draw.marker` with
  shape "cross", `style_flag` → `draw.marker` with shape "flag",
  `style_diamond` → `draw.marker` with shape "diamond",
  `style_triangleup` / `triangledown` → `draw.marker`). The "tinted
  callout" styles (`style_label_up`, `style_label_down`,
  `style_label_left`, `style_label_right`, etc.) map to chartlang
  `draw.frame` with `label` + `bgColor` set — note this in the entry.
  `style_none` → `draw.text` (no bg).
- `size.tiny` / `small` / `normal` / `large` / `huge` / `auto` →
  chartlang `"tiny"` / `"small"` / `"normal"` / `"large"` / `"huge"`
  / `"normal"` (auto → normal with a warning).
- `text.align_left` / `center` / `right` → `"left"` / `"center"` /
  `"right"`.
- `text.align_top` / `text.align_bottom` (overloaded with the same
  identifiers) → `"top"` / `"bottom"` (the converter disambiguates
  by parameter name: when the Pine arg is `text_valign`, treat the
  value as vertical alignment).
- `text.format_bold` → `notes: "chartlang TextOpts has no bold; emit
  warning"`; `text.format_italic` → same.
- `font.family_default` → omit (chartlang default), `font.family_monospace`
  → `notes: "chartlang TextOpts has no font family; emit warning"`.
- `position.top_left` / … / `position.bottom_right` →
  `"top-left"` / … / `"bottom-right"` (Pine's underscore to
  chartlang's kebab-case).
- `xloc.bar_index` / `xloc.bar_time` — mapping handled by Task 7's
  coordinate resolver; here just record as `notes: "consumed by
  coordinate resolver"`.
- `yloc.price` / `yloc.abovebar` / `yloc.belowbar` — mapping handled
  by Task 10 (`yloc.abovebar`/`belowbar` need bar.high/low math); here
  recorded with `notes: "label-only; non-trivial — Task 10"`.
- `color.*` named constants (`color.red`, `color.green`, etc.) →
  CSS hex strings. ~24 entries.

### 3. `src/mapping/inputs.ts`

```ts
export type InputMapping = Readonly<{
    pine: string;          // e.g. "input.int"
    chartlang: string;     // e.g. "input.int"
    argRemap?: ReadonlyMap<string, string>;
    notes?: string;
}>;

export const INPUT_MAP: ReadonlyMap<string, InputMapping>;
```

Entries:
- `input.int` → `input.int` (no remap).
- `input.float` → `input.float`.
- `input.bool` → `input.bool`.
- `input.string` → `input.string`.
- `input.color` → `input.color`.
- `input.source` → `input.source` (Pine's `defval=close` → chartlang's
  `"close"` string).
- `input.symbol` → `input.symbol`.
- `input.timeframe` → `input.interval` (Pine's `defval="60"` →
  chartlang's `"60m"` — handled by Task 9 with a string-format
  helper).
- `input.time` → `input.time`.
- `input.price` → `input.price`.
- `input.enum` → REJECT for v1 (`notes: "Pine UDT-backed; needs full
  type-system support"`).
- `input.text_area` → `input.string` with `multiline: true`.

### 4. `src/mapping/taPassthrough.ts`

```ts
export type TaMapping = Readonly<{
    pine: string;
    chartlang: string;
    signatureNote?: string;
}>;

export const TA_PASSTHROUGH_MAP: ReadonlyMap<string, TaMapping>;
```

Entries — the subset that map cleanly 1:1 in signature shape:
- `ta.sma`, `ta.ema`, `ta.rma` (→ `ta.smma`), `ta.wma`, `ta.hma`,
  `ta.swma` (→ chartlang has no `swma`; map with `signatureNote:
  "approximated by ta.wma"`), `ta.vwma`, `ta.alma`.
- `ta.rsi`, `ta.macd`, `ta.stoch`, `ta.cci`, `ta.cmo`, `ta.mfi`,
  `ta.tsi`, `ta.wpr` (→ `ta.williamsR`).
- `ta.bb`, `ta.bbw`, `ta.kc` (→ `ta.keltner`), `ta.atr`, `ta.stdev`.
- Pine `ta.kcw` (Keltner Channel Width) and `ta.dev` (median absolute
  deviation) have **no chartlang analogue** — record both with
  `chartlang: null` and emit `ta-not-mapped` warning at use site.
- `ta.supertrend`, `ta.sar` (→ `ta.psar`), `ta.dmi`, `ta.vwap`.
- `ta.crossover`, `ta.crossunder`, `ta.cross` (synthesize as
  `crossover || crossunder` — note in entry).
- `ta.highest`, `ta.lowest`, `ta.highestbars` (→ synthesized), 
  `ta.lowestbars` (→ synthesized), `ta.barssince`, `ta.valuewhen`,
  `ta.change`, `ta.cum` (→ note: rolling sum, no direct analog;
  reject), `ta.correlation` (→ reject), `ta.linreg` (→ `ta.lsma`).
- `ta.pivothigh`/`pivotlow` — chartlang exposes the centred swing-pivot
  pair via `ta.pivotsHighLow({...})` returning `{ high: Series,
  low: Series }`. Pine `ta.pivothigh(left, right)` → `ta.pivotsHighLow({
  leftLength: left, rightLength: right }).high`. Pine `ta.pivotlow` →
  `.low`. (The fields are `high`/`low`, NOT `pivotHigh`/`pivotLow` —
  verify against `PivotsHighLowResult` in `packages/core/src/ta/ta.ts`.)

Pine `ta.*` calls not in the table emit a `ta-not-mapped` warning at
transform time (Task 15) and pass through textually with a TODO.

### 5. `src/mapping/mathPassthrough.ts`

```ts
export const MATH_PASSTHROUGH_MAP: ReadonlyMap<string, MathMapping>;
```

Entries:
- `math.abs` → `Math.abs`, `math.round` → `Math.round`,
  `math.floor` → `Math.floor`, `math.ceil` → `Math.ceil`,
  `math.sqrt` → `Math.sqrt`, `math.pow` → `Math.pow`, `math.exp` →
  `Math.exp`, `math.log` → `Math.log`, `math.log10` → `Math.log10`,
  `math.sin` → `Math.sin`, `math.cos` → `Math.cos`, `math.tan` →
  `Math.tan`, `math.min` → `Math.min`, `math.max` → `Math.max`,
  `math.sign` → `Math.sign`.
- `math.avg`, `math.sum` → small inline helpers emitted by codegen
  (note in entry).
- `math.todegrees`, `math.toradians` → small inline arithmetic.
- `math.round_to_mintick` → REJECT (`notes: "requires syminfo.mintick;
  Task 15 fallback"`).
- `math.random` → REJECT (chartlang determinism rule).
- `math.pi`, `math.e`, `math.phi` → constants inlined.

### 6. Universal entry shape & helpers

`src/mapping/types.ts` defines the shared `MappingEntry` interface and
a `lookup<T extends MappingEntry>(map, key): T | null` helper. Each
table re-exports the helper so transform tasks call
`drawingKinds.lookup("line.new")` symmetrically.

`src/mapping/index.ts` re-exports all tables + types:

```ts
export * from "./drawingKinds.js";
export * from "./enums.js";
export * from "./inputs.js";
export * from "./taPassthrough.js";
export * from "./mathPassthrough.js";
export * from "./types.js";
```

### 7. Tests (§16.3)

| File | Purpose |
|------|---------|
| `drawingKinds.test.ts` | Every entry has correct chartlang kind + non-empty setter map + doc-link comment. |
| `enums.test.ts` | Every Pine enum value resolves; `extend.*` decomposes correctly; `line.style_arrow_*` carries the warning note. |
| `inputs.test.ts` | Every Pine input form maps; `input.enum` flagged. |
| `taPassthrough.test.ts` | Every entry's chartlang side is a real `ta.*` name (cross-check against `@invinite-org/chartlang-core` namespace via import). |
| `mathPassthrough.test.ts` | Every entry maps; `math.random` and `math.round_to_mintick` are REJECTs. |

Coverage 100% on `src/mapping/`.

### 8. JSDoc

Every exported map and helper carries `@since 0.1`, `@experimental`, an
`@example` showing one lookup.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/mapping/types.ts` | Create | Shared mapping types + `lookup` helper. |
| `packages/pine-converter/src/mapping/drawingKinds.ts` | Create | Drawing constructor + setter mapping. |
| `packages/pine-converter/src/mapping/enums.ts` | Create | Style/enum value mapping. |
| `packages/pine-converter/src/mapping/inputs.ts` | Create | Input-primitive mapping. |
| `packages/pine-converter/src/mapping/taPassthrough.ts` | Create | `ta.*` passthrough mapping. |
| `packages/pine-converter/src/mapping/mathPassthrough.ts` | Create | `math.*` passthrough mapping. |
| `packages/pine-converter/src/mapping/index.ts` | Replace placeholder | Barrel. |
| `packages/pine-converter/src/mapping/drawingKinds.test.ts` | Create | Unit tests. |
| `packages/pine-converter/src/mapping/enums.test.ts` | Create | Unit tests. |
| `packages/pine-converter/src/mapping/inputs.test.ts` | Create | Unit tests. |
| `packages/pine-converter/src/mapping/taPassthrough.test.ts` | Create | Cross-checks against `@invinite-org/chartlang-core`. |
| `packages/pine-converter/src/mapping/mathPassthrough.test.ts` | Create | Unit tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-mapping.md` — patch bump.

## Acceptance Criteria

- `drawingKinds.lookup("line.new").setterMap.get("set_xy1")` returns a
  setter with `statePath: ["anchors", 0]`.
- `enums.lookup("extend.both")` returns `{ extendLeft: true,
  extendRight: true }`.
- `taPassthrough.lookup("ta.rma").chartlang === "ta.smma"`.
- `taPassthrough.lookup("ta.pivothigh").chartlang === "ta.pivotsHighLow.high"`
  (NOT `.pivotHigh`).
- `taPassthrough.lookup("ta.kcw")` returns null (REJECT marker) +
  `taPassthrough.lookup("ta.dev")` returns null.
- `mathPassthrough.lookup("math.random")` returns null (REJECT
  marker).
- Cross-check test confirms every `taPassthrough` chartlang name
  exists in `@invinite-org/chartlang-core`'s `TaNamespace` interface
  (use a TS-API reflection helper or a runtime import of the stub).
- 100% coverage on `src/mapping/`.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
