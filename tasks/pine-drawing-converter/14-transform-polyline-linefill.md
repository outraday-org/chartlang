# Task 14 — Transform: `polyline` + `linefill`

> **Status: TODO**

## Goal

Convert Pine's `polyline.new` (immutable, no setters) into chartlang
`draw.polyline` / `draw.path`, handling the canonical
delete-and-recreate idiom Pine scripts use to "update" polylines. For
`linefill.new`, map the **simple case** (two fixed lines defined at
top level, single linefill between them) to chartlang's
`ShapeStyle.fill` on a synthesized `draw.path` connecting the two; for
every other linefill case (cross-collection, dynamic line selection,
filled regions between MA series), emit the appropriate hard-reject
diagnostic with a concrete suggestion.

## Prerequisites

Task 13 (tables — table transform's "rebuild each bar" pattern is
reused for polyline rebuilds).

## Current Behavior

`polyline.new` calls and `linefill.new` calls pass through untouched.
Task 12 already emits `linefill-over-ring` for cross-ring linefills.

## Desired Behavior

A package-internal `transformPolylineLinefill(analysis: SemanticResult,
scaffold: ScriptScaffold, diagnostics: DiagnosticCollector): void` API
in `src/transform/polylineLinefill.ts` handles:

### Polyline cases

1. **Literal anchor array** — `polyline.new([chart.point.from_index(0,
   close), chart.point.from_index(1, close)], curved=true)` with a
   compile-time-known anchor list. Direct map to
   `draw.polyline([...], { ... })` with the curved arg mapped to
   either `draw.curve` (curved=true, 3 anchors) or `draw.polyline`
   (straight). Closed=true → `draw.path` with `closed: true`.

2. **`var array<chart.point>` bounded by literal** — the script builds
   a fixed-length anchor list each bar, then rebuilds the polyline.
   The transform reads the anchor-building loop bound, unrolls into a
   literal-bounded anchor expression, and emits `draw.polyline(...)`.

3. **`var array<chart.point>` with dynamic count** — emits
   `polyline-dynamic-points` error (the Task 12 reject; finalized
   here).

### Linefill cases

1. **Top-level two-line linefill** — `var line lineA = …`, `var line
   lineB = …`, `var linefill fill = linefill.new(lineA, lineB,
   color=...)`. Synthesize a `draw.path([anchorA1, anchorB1, anchorB2,
   anchorA2], { closed: true, style: { fill: color } })` driven by the
   anchors of `lineA` and `lineB` mirrored in their own handle slots.

2. **Series-fill** — `linefill` used in the v6 idiom of filling
   between two series (typical for Bollinger Bands). The converter
   detects when both lines' anchors are series-driven and emits
   `linefill-series-fill` info with suggestion "Use a chartlang
   `plot(...)` with two outputs and a future `fill(...)` primitive
   instead." (chartlang doesn't ship a plot-fill primitive in v1; this
   is genuine out-of-scope work.)

3. **Cross-collection / dynamic-line** — already rejected by Task 12.

## Requirements

### 1. Polyline literal-array path

For `polyline.new([chart.point.A, chart.point.B, chart.point.C],
curved=true, line_color=color.blue)`, emit:

```ts
const __points = [
    { time: <A.time>, price: <A.price> },
    { time: <B.time>, price: <B.price> },
    { time: <C.time>, price: <C.price> },
];
const __h = draw.polyline(__points, { color: "#0000ff" });
__poly_handle.set(__h);
```

With `curved=true` and exactly three anchors, emit `draw.curve(__points,
{...})` instead (chartlang's curve takes AnchorTriple, matching Pine's
3-point smooth curve). With more anchors and `curved=true`, emit
`draw.polyline(...)` and warn that `curved=true` isn't preserved
beyond 3 anchors.

`closed=true` → use `draw.path` with `closed: true` instead of
`draw.polyline`.

### 2. Polyline rebuild idiom

For:

```pinescript
var array<chart.point> pts = array.new<chart.point>()
// ... mutate pts inside literal-bounded loop ...
if barstate.islast
    polyline.delete(myPoly)
    myPoly := polyline.new(pts, curved=true)
```

The transform:

1. Verifies the anchor-list mutation is literal-bounded.
2. Detects the delete-then-recreate sequence.
3. Emits a "table-style" full rebuild:

```ts
if (barstate.islast) {
    __myPoly_handle.current()?.remove();
    const __points = [
        /* unrolled anchors */
    ];
    __myPoly_handle.set(draw.polyline(__points, { color: "#…" }));
}
```

When the anchor-list mutation is NOT literal-bounded (data-driven
`array.push`), emit `polyline-dynamic-points` error.

### 3. `polyline.delete` standalone

Same pattern as `line.delete`: emit `remove()` + slot clear.

### 4. `linefill.new` top-level two-line case

For:

```pinescript
var line lineA = line.new(bar_index, high, bar_index, high)
var line lineB = line.new(bar_index, low, bar_index, low)
var linefill fill = linefill.new(lineA, lineB, color=color.new(color.gray, 80))
// later: line.set_xy1/xy2 on both lines per bar
```

The transform:

1. Recognizes the linefill's two `line` args as Camp A handles.
2. Records anchor mirrors for each line in their handle slots
   (extending the Camp A handle slot with `currentAnchors:
   AnchorPair`).
3. Synthesizes a `draw.path(...)` quad whose corners are the four
   endpoint anchors, with `style: { fill: <color>, fillAlpha: <opacity-converted-from-transp> }`.
4. Updates the path each bar alongside the line updates.

```ts
// Camp A handles for lineA and lineB created as usual
// Additional fill path:
const __fill_handle = useDrawingHandleSlot<"path">();

// In compute:
const __aA = { time: bar.time, price: bar.high };
const __aB = { time: bar.time + (5 * __BAR_INTERVAL_MS), price: bar.high };
const __bA = { time: bar.time, price: bar.low };
const __bB = { time: bar.time + (5 * __BAR_INTERVAL_MS), price: bar.low };

__lineA_handle.current()?.update({ anchors: [__aA, __aB] });
__lineB_handle.current()?.update({ anchors: [__bA, __bB] });

if (__fill_handle.current() === null) {
    __fill_handle.set(draw.path([__aA, __aB, __bB, __bA], {
        closed: true,
        style: { fill: "#80808033", stroke: undefined },
    }));
} else {
    __fill_handle.current()?.update({
        anchors: [__aA, __aB, __bB, __bA],
    });
}
```

(The hex `33` corresponds to Pine's `transp=80` → ~20% opacity.)

### 5. `color.new(color, transp)` mapping

`color.new(c, transp)` → CSS hex with alpha. The transparency
conversion: Pine's `transp` is 0..100 where 0 = fully opaque and 100 =
fully transparent. CSS alpha hex (`00`..`FF`) maps as `alpha = 255 *
(100 - transp) / 100`, rendered as two hex digits appended to the
6-hex color.

The conversion lives in `src/transform/colorConvert.ts` (shared with
Tasks 10, 11, 13).

### 6. `linefill.set_color`

If the linefill's color is mutated via `linefill.set_color(...)`,
fold into a `handle.update({ style: { fill: <new color> } })` on the
synthesized path handle.

### 7. Series-fill detection

When both `line`s used in `linefill.new` are mutated with `bar.time`
arithmetic on EVERY bar (i.e. their anchors track a series), the
result is what Pine users call a "series fill" — typically a BB band
shaded region. Detect by walking the line handles' mutation patterns
and noting whether the anchors are bar-by-bar updated.

For v1, the converter **still emits** the `draw.path` quad
construction in `compute({...})` updated every bar — this preserves
the visual intent at the cost of one drawing per script (instead of
chartlang's eventual `plot(...)` series-fill). Emit
`linefill-series-fill` info noting the approximation.

### 8. `linefill.delete`

Emit `remove()` + slot clear on the synthesized fill handle.

### 9. Diagnostic codes (added this task)

- `polyline-curved-anchors-warning` (warning) — curved=true with >3
  anchors.
- `polyline-closed-info` (info) — closed=true mapped to `draw.path`.
  (Renamed from `polyline-closed-warning` since severity is info, not
  warning; the suffix must reflect actual severity for consistent
  diagnostic catalog parsing.)
- `linefill-series-fill` (info) — approximation explained.
- `linefill-color-transp-approximated` (info) — alpha hex conversion.

(Previously-allocated codes: `polyline-dynamic-points`,
`cross-collection-linefill`, `linefill-over-ring`.)

### 10. Tests (§16.3)

| File | Purpose |
|------|---------|
| `polyline.test.ts` | Literal-array case (3-point curved → `draw.curve`, n-point straight → `draw.polyline`, closed → `draw.path`). |
| `polyline-rebuild.test.ts` | `var array<chart.point>` with literal-bounded loop unroll → full rebuild per bar. |
| `polyline-rebuild-dynamic.test.ts` | Dynamic-bound rebuild emits `polyline-dynamic-points` error. |
| `linefill-two-line.test.ts` | Canonical top-level two-line linefill → quad path + alpha-converted color. |
| `linefill-series-fill.test.ts` | Bollinger-band-style two-series-driven linefill → quad path + `linefill-series-fill` info. |
| `colorConvert.test.ts` | `color.new(color.gray, 80)` → `#80808033`. Property: alpha hex always 2 chars, valid hex. |

Coverage 100% on `src/transform/polylineLinefill.ts`,
`src/transform/colorConvert.ts`.

### 11. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/polylineLinefill.ts` | Create | Polyline + linefill transform. |
| `packages/pine-converter/src/transform/colorConvert.ts` | Create | Color/transp helper (shared). |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-14 codes. |
| `packages/pine-converter/src/transform/polyline.test.ts` | Create | Literal-array tests. |
| `packages/pine-converter/src/transform/polyline-rebuild.test.ts` | Create | Rebuild idiom tests. |
| `packages/pine-converter/src/transform/polyline-rebuild-dynamic.test.ts` | Create | Reject tests. |
| `packages/pine-converter/src/transform/linefill-two-line.test.ts` | Create | Two-line linefill tests. |
| `packages/pine-converter/src/transform/linefill-series-fill.test.ts` | Create | Series-fill tests. |
| `packages/pine-converter/src/transform/colorConvert.test.ts` | Create | Color helper tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-polyline-linefill.md` — patch bump.

## Acceptance Criteria

- 3-anchor `polyline.new(..., curved=true)` produces `draw.curve(...)`;
  5-anchor produces `draw.polyline(...)` + `polyline-curved-anchors-
  warning`.
- `polyline.new([...], closed=true)` produces `draw.path(..., {
  closed: true })`.
- Two-line linefill produces a `draw.path` quad with the
  alpha-converted fill color.
- BB-style two-series linefill produces the path + info diagnostic.
- `color.new(color.gray, 80)` produces `#80808033`.
- Dynamic-anchor polyline rebuild produces the Task-12 reject.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
