# Dropdown + Concat `request.security` Symbols

> **Status: TODO**

## Goal

Extend `request.security` symbol resolution to accept (a) symbols bound
to an `input.string` dropdown (`options=[...]`), and (b) compile-time
foldable string concatenation (e.g. `prefix + ";EARNINGS"`). Both
currently produce `request-security-not-mapped`. The runtime already
accepts any symbol string, so this is a converter-only relaxation. The
daily `"D"` timeframe is already supported and is **not** the blocker.

## Prerequisites

None. Builds on the already-landed input-symbol/interval-bound security
work (archived task folder
`tasks/old/trend-wizard-converter/X-4-converter-input-bound-security.md`).
That work has shipped in `securityShape.ts` regardless of the task's
archived status.

## Current Behavior

MASM's three rejected calls:

```pine
# line 191 — string-concat symbol template
earnings = request.security(esdSymbolTemplate + ';EARNINGS', 'D', open, lookahead=barmerge.lookahead_on)
# lines 244/246 — input.string dropdown symbol
comp_sec_close_slct = request.security(compmode_select, "D", close, ignore_invalid_symbol=true)
```

Symbol resolution rejects both:

```ts
// src/transform/securityShape.ts (~line 192)
function resolveSymbolSource(symbol, inputs): string | null | undefined {
    if (isTickerId(symbol)) return null;            // syminfo.tickerid → omit
    const literal = stringLiteralValue(symbol);
    if (literal !== null) return JSON.stringify(literal);
    return inputFeedSource(symbol, inputs, "symbol") ?? undefined; // input.symbol only
}
```

The feed-input map (`inputs`) is built by `collectSecurityFeedInputs`
(`securityShape.ts:151`), which assigns an axis via `feedAxisOfValue`
(`securityShape.ts:113`). The axis type is **`SecurityFeedAxis =
"symbol" | "interval"`** (`securityShape.ts:92`) — there is **no
`"string"` axis**. `feedAxisOfValue` registers **only**
`input.symbol → "symbol"` and `input.timeframe → "interval"`;
`input.string` is registered **nowhere**:

```ts
// securityShape.ts:113 — feedAxisOfValue (member = chain[1] after "input")
if (member === "symbol") return "symbol";
if (member === "timeframe") return "interval";
return null;     // input.string et al. → never registered
```

So for `comp_sec_close_slct = input.string(...)`, the identifier has no
entry in the map at all: `inputFeedSource(symbol, inputs, "symbol")`
returns `null` (because `inputs.get(node.name) !== "symbol"`) →
`undefined` → `resolveSecurityFeed` returns `null` →
`request-security-not-mapped` (`requestSecurity.ts:154`).

A concatenation expression isn't a string literal and isn't an
identifier, so it also falls through to `undefined`.

## Desired Behavior

- **Dropdown symbol:** an identifier bound to `input.string` (with or
  without `options`) resolves to `inputs.<name> as string`, same emit
  shape as an `input.symbol`-bound feed.
- **Literal-foldable concat:** `"A" + "B"`, `lit + ";EARNINGS"`, and
  nested chains where **every** operand folds to a string literal →
  fold to a single quoted literal symbol. (A literal-foldable operand
  includes string literals and identifiers bound to a constant string
  default, if that is already resolvable; otherwise only literal +
  literal.)
- **Non-foldable computed symbol** (a runtime variable concatenated, a
  function call) → unchanged `request-security-not-mapped`.

## Requirements

### 1. Accept `input.string` symbols

The fix is in **`feedAxisOfValue`** (`securityShape.ts:113`) — the single
place axes are assigned — **not** in `inputFeedSource`. Register
`input.string` to the existing `"symbol"` axis alongside `input.symbol`:

```ts
// securityShape.ts:113 — feedAxisOfValue
if (member === "symbol" || member === "string") return "symbol";
if (member === "timeframe") return "interval";
```

With `input.string` mapped to `"symbol"`, the existing
`inputFeedSource(symbol, inputs, "symbol")` call in `resolveSymbolSource`
resolves it unchanged and emits the same `inputs.<name> as string`
reference the symbol path already produces — **no change to
`inputFeedSource` is required**. Do **not** add a new `"string"` axis
value to `SecurityFeedAxis` (it stays `"symbol" | "interval"`), and do
**not** widen the timeframe position (`input.timeframe` only).

This is safe even though `input.string` has many non-symbol uses: the
axis map is only consulted when an identifier appears in
`request.security`'s symbol position, so a stray `input.string` used
elsewhere is unaffected.

Decision: do **not** introduce a new diagnostic for "string input used
as symbol" — it is a valid, supported shape now.

### 2. Fold literal string concatenation

Add a helper (near `stringLiteralValue`) that recursively folds a
binary `+` expression to a single string when all leaves are string
literals (reuse `stringLiteralValue` for leaves). Call it from
`resolveSymbolSource` after the direct-literal check. Return the folded,
JSON-stringified symbol. If any leaf is non-literal, return `undefined`
(→ existing rejection).

### 3. `ignore_invalid_symbol` stays a silent drop

No change — it is already silently dropped (no runtime contract).
Confirm no diagnostic regression. `lookahead` continues to emit the
existing `request-security-lookahead-not-supported` warning.

### 4. Runtime is already capable — verify, don't change

`packages/runtime/src/request/requestNamespace.ts` keys feeds by
`feedKey(symbol, interval)` for any string symbol. No runtime change.
Add a converter→runtime round-trip assertion only if an existing
`requestNamespace.test.ts` pattern makes it cheap; otherwise rely on
`fixtures-compile.test.ts`.

### 5. Golden fixtures

Add **two** next-numbered fixture trios (or one combined) covering:

```pine
//@version=6
indicator("security dropdown + concat")
sym = input.string("AMEX:SPY", "Compare", options=["AMEX:SPY","NASDAQ:QQQ"])
comp = request.security(sym, "D", close)
earn = request.security("ESD:" + "AAPL", "D", open)
plot(comp)
plot(earn)
```

Regenerate with `UPDATE_FIXTURES=1`. Confirm: the dropdown symbol emits
`inputs.sym as string`; the concat folds to `"ESD:AAPL"`; `"D"` →
`"1d"`; zero `request-security-not-mapped`. Must compile.

### 6. Negative test

A `request.security(someRuntimeVar + suffix, "D", close)` where leaves
are non-literal still yields `request-security-not-mapped`. Cover in
`securityShape.test.ts` (or the request-security test file).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/transform/securityShape.ts` | Modify | `feedAxisOfValue` (`:113`): map `input.string → "symbol"`; `resolveSymbolSource` (`:192`): fold literal concat |
| `src/transform/securityShape.test.ts` | Modify | Positive + negative coverage |
| `fixtures/NN-security-dropdown-concat.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio (compiles) |
| `src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `packages/pine-converter/CLAUDE.md` | Modify | Note widened symbol resolution |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter 100% coverage)
- `pnpm conformance` (if any runtime request path is exercised — likely no-op)

## Changeset

`.changeset/converter-security-dropdown-concat-symbols.md` — `@invinite-org/chartlang-pine-converter: minor`.

## Acceptance Criteria

- `input.string` dropdown symbols and literal-foldable concat symbols
  resolve; non-foldable computed symbols still rejected.
- `ignore_invalid_symbol` silent-drop and `lookahead` warning unchanged.
- Golden fixture(s) added + compile; count assertion bumped.
- 100% coverage; `CLAUDE.md` updated; changeset committed.
