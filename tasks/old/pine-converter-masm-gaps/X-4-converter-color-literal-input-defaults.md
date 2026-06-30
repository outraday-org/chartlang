# Color-Literal Input Defaults

> **Status: TODO**

## Goal

Accept `color.rgb(...)`, `color.new(...)`, and named color constants
(`color.yellow`) as compile-time-literal defaults for `input.color(...)`.
Today they are rejected with `non-literal-input-default`, even though
they are compile-time constants in Pine. Fold them to a hex string
(`#RRGGBB` / `#RRGGBBAA`) at convert time, reusing the existing color
folding helpers.

## Prerequisites

None. (Color folding helpers already exist — Task 6 hooks the *same*
helpers into free expressions; this task hooks them into the input
default checker.)

## Current Behavior

MASM lines 434–437:

```pine
clr_green  = input.color(color.rgb(13, 218, 116), "Up", inline="1")
clr_yellow = input.color(color.yellow, "Yellow", inline="2")
```

The input-default literal check rejects both:

```ts
// src/transform/inputs.ts (~line 90)
function literalDefault(node): string | null {
    if (node.kind === "literal-expression") { /* hex/number/string/bool */ }
    if (node.kind === "unary-expression" && /* ± numeric */) { ... }
    return null; // call-expression (color.rgb) and member-access (color.yellow) fall here
}
```

→ `non-literal-input-default` (`codes.ts`, severity error).

The folding logic already exists for plot/hline/table contexts:

```ts
// src/transform/colorConvert.ts (~line 137)
convertColorWith(...) / convertColorNew(...) / convertColorRgb(...)
// helpers: baseHex(...), transpToAlphaHex(...), literalNonNegInt(...)
```

Core color targets: `packages/core/src/color/index.ts:23` exports
`withAlpha`, `rgb`, `hsl`, and the 17-name palette.

## Desired Behavior

`input.color(color.rgb(13, 218, 116), "Up")` →
`const clr_green = input.color("#0dda74");`

The converter drops Pine's **positional** title arg today (verified
against `fixtures/20-real-world-sr.expected.chart.ts`, which emits bare
`input.color("#FF9800")`), so the only deliverable here is folding the
**default** to a hex literal. A second `{ title }` options object is
emitted only when Pine uses a **named** `title=` arg — match the existing
`input.color` fixtures, do not add a title where the corpus omits it.

- `color.rgb(r, g, b)` → `#RRGGBB`
- `color.rgb(r, g, b, transp)` / `color.new(base, transp)` → `#RRGGBBAA`
  (transp 0–100 → alpha byte), reusing `transpToAlphaHex`
- `color.yellow` (named constant) → its `#RRGGBB` literal
- Non-literal args (e.g. `color.rgb(x, g, b)` where `x` is a variable)
  → still `non-literal-input-default`

## Requirements

### 1. Extend `literalDefault()` to fold color expressions

In `src/transform/inputs.ts`, before returning `null`, attempt color
folding when the node is a `color.rgb(...)` / `color.new(...)` call or a
`color.<name>` member access. Reuse the existing helpers from
`colorConvert.ts` (export them if currently module-private) — do **not**
reimplement hex math. The folder must:

- return the quoted hex string on success (so it slots into the
  `input.color("#...", …)` default position), and
- return `null` (→ `non-literal-input-default`) when any color arg is
  itself non-literal.

Keep the existing literal/unary branches unchanged.

### 2. Named-color resolution

Resolve `color.<name>` against the **converter's own** named-color table:
`ENUM_VALUE_MAP` in `src/mapping/enums.ts` (e.g.
`entry("color.yellow", "#FFEB3B")`, `color.gray → "#787B86"`), looked up
via `enumLookup`. This is already what `baseHex` (`colorConvert.ts:13`)
uses, so if you fold through `baseHex` / the `colorConvert.ts` helpers
(§1) named-color resolution comes for free — do **not** reimplement it.
⚠️ Do NOT resolve against core's `COLOR_PALETTE`
(`packages/core/src/color/index.ts`): its hex values deliberately differ
from the converter's TradingView palette (core `gray = #808080`,
converter `gray = #787B86`), so using core here would emit wrong colors
and diverge from the existing plot/hline/table color fixtures. Unknown
names → `null`.

### 3. Golden fixture

Add the next-numbered fixture trio reproducing all three forms:

```pine
//@version=6
indicator("color input defaults")
c_rgb   = input.color(color.rgb(13, 218, 116), "Up")
c_alpha = input.color(color.new(color.red, 40), "Down")
c_named = input.color(color.yellow, "Flat")
plot(close, color = c_rgb)
```

Regenerate with `UPDATE_FIXTURES=1`; confirm three folded hex defaults
and zero `non-literal-input-default` diagnostics. Must compile
(`fixtures-compile.test.ts`).

### 4. Negative unit test

Add an `inputs.test.ts` case asserting that a non-literal color arg
(`input.color(color.rgb(someVar, 0, 0))`) still yields
`non-literal-input-default`, preserving the guard for genuinely dynamic
defaults.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/transform/inputs.ts` | Modify | Fold color literals in `literalDefault` |
| `src/transform/colorConvert.ts` | Modify | Export folding helpers if needed |
| `src/transform/inputs.test.ts` | Modify | Positive + negative coverage |
| `fixtures/NN-color-input-defaults.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio (compiles) |
| `src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `packages/pine-converter/CLAUDE.md` | Modify | Note color-literal input defaults |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter 100% coverage)

## Changeset

`.changeset/converter-color-literal-input-defaults.md` — `@invinite-org/chartlang-pine-converter: minor`.

## Acceptance Criteria

- `color.rgb`/`color.new`/named-color defaults fold to hex; dynamic
  color args still rejected.
- Golden fixture added + compiles; count assertion bumped.
- Folding helpers reused (no duplicated hex math).
- 100% coverage; `CLAUDE.md` updated; changeset committed.
