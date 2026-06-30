# `var string = na` Empty-String Default

> **Status: TODO**

## Goal

Fix the compile error caused by `var string x = na`. The converter
currently emits `let x: string | null = null`, which later `:=`
assignments do not narrow, so passing `x` to a `string`-typed callee
(e.g. `alert(x)`) fails type-checking with `'string | null' is not
assignable to 'string'`. Emit an empty-string (`""`) default for
string-typed `na` initializers instead, matching Pine's effective
runtime semantics for string `na` usage.

## Prerequisites

None.

## Current Behavior

MASM line 591: `string alert_msg = na`, later `alert_msg := '{...}'`
and finally `alert(alert_msg, alert.freq_all)`.

`na` lowering lives in `src/transform/exprEmit.ts` (`emitNa`, ~line 60):

```ts
function emitNa(node, annotations): string {
    const naKind = annotations.get(node)?.naKind;
    if (naKind === "handle") return "null";
    if (naKind === "color") return JSON.stringify(PINE_NA_COLOR);
    return "Number.NaN"; // string/bool/number fall here
}
```

The declaration-site type annotation is chosen in
`src/transform/other.ts` (~line 1776), which **short-circuits before
`emitNa`** for a `var`/`na` declaration:

```ts
// other.ts ~1776
if (stmt.initializer.kind === "na-expression") {
    const element = scalarElementType(stmt);
    if (element === "string" || element === "bool") {
        const tsType = element === "string" ? "string" : "boolean";
        return [`let ${stmt.name}: ${tsType} | null = null;`];
    }
}
```

So `var string x = na` becomes `let x: string | null = null` here (the
`emitNa` numeric fallback is **not** on this path). The mismatch: the
declaration emits `null` for the string case, and the `string | null`
union never narrows across `:=` reassignments. This is the authoritative
site to change.

## Desired Behavior

`var string x = na` (and bare `string x = na`) emit:

```ts
let x = ""; // string, no null union
```

so subsequent `x := "..."` keeps `x` typed `string` and `alert(x)`
compiles. Numeric `na` (`Number.NaN`), handle `na` (`null`), and color
`na` are unchanged.

## Requirements

### 1. Emit `""` for string-typed `na`

The type information lives at the declaration site (`other.ts` ~1776),
which already branches on `scalarElementType(stmt)` (`string` vs `bool`)
and short-circuits before `emitNa`. Change **only the `string` arm** of
that branch so a string-typed binding initialised to `na` emits:

```ts
return [`let ${stmt.name} = "";`];   // string only
```

i.e. a plain `string` (no `| null`) seeded with `""`. The `emitNa`
numeric fallback (`exprEmit.ts:60`) is **not** on the var-declaration
path and needs no change; leave it for inline `na` expressions
(`Number.NaN`). Make the **single** change at `other.ts:1776`; do not
also touch `emitNa`.

### 2. Bool `na` (sanity check, no scope creep)

`var bool x = na` currently emits `let x: boolean | null = null` from the
**same `other.ts:1805` branch** (the `bool` arm), not `Number.NaN`. It
has the identical narrowing problem, but this task's scope is **string
only**. Leave the `bool` arm unchanged (optionally drop a `// TODO`
referencing a follow-up) — do **not** alter bool semantics here. Your
edit must touch only the `string` arm of the `if (element === "string"
|| element === "bool")` block.

### 3. Golden fixture

Add the next-numbered fixture trio. Minimal `.pine` reproducing the
exact MASM idiom:

```pine
//@version=6
indicator("na string default")
var string msg = na
if close > open
    msg := "up"
alert(msg)
plot(close)
```

Regenerate with `UPDATE_FIXTURES=1`. The `.expected.chart.ts` must show
`let msg = "";` and a clean `alert(msg)` call. This fixture must also
pass `fixtures-compile.test.ts` (the round-trip compile) — verify it is
NOT added to `KNOWN_NON_COMPILING`.

### 4. Unit test

Add an `exprEmit` / `other` unit test asserting a string `var = na`
binding emits `""` and that a numeric `var = na` still emits
`Number.NaN`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/transform/other.ts` | Modify | String `na` decl arm → `let x = ""` (`~line 1776`, string arm only) |
| `src/transform/other.test.ts` | Modify | Coverage (string `""`; numeric/bool unchanged) |
| `fixtures/NN-na-string-default.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio (must compile) |
| `src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `packages/pine-converter/CLAUDE.md` | Modify | Note string-`na` default |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter 100% coverage, incl. `fixtures-compile`)

## Changeset

`.changeset/converter-na-string-default.md` — `@invinite-org/chartlang-pine-converter: patch` (behavior fix, no public API change).

## Acceptance Criteria

- `var string x = na` emits `let x = "";` and downstream `string`-typed
  uses compile.
- Numeric / handle / color `na` lowering unchanged.
- Golden fixture added, compiles in `fixtures-compile.test.ts`, count
  assertion bumped.
- 100% coverage maintained.
- `CLAUDE.md` updated; changeset committed.
