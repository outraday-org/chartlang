# Task 3 — Pine converter: full Pine v6 `str.*` surface

> **Status: TODO**

## Goal

Extend the pine-converter's `str.*` lowering
(`packages/pine-converter/src/transform/strFormat.ts`) from the
8-function "v1 subset" to the full Pine v6 `str.*` surface (18
functions): newly map `startswith`, `endswith`, `pos`, `substring`,
`trim`, `repeat`, `replace` (occurrence-aware), and `tonumber`; keep
`match` and `format_time` as `str-not-mapped` rejects. Emit **native
JS** (the established convention), add tests to keep 100% coverage,
mirror the change into the skills `translating-from-pine.md`, and
update `pine-converter/CLAUDE.md`.

## Prerequisites

None. `math.*` passthrough is already complete and untouched here.

## Current Behavior

`emitStr(call, ctx)` (`strFormat.ts`) dispatches a `switch (member)`
over the dotted-callee suffix and maps 8 Pine functions to native JS:

| Pine | Emitted |
|---|---|
| `str.tostring(x)` / `(x, "#.##")` | `String(x)` / `(x).toFixed(n)` |
| `str.format("{0}", a)` | template literal |
| `str.length(s)` | `s.length` |
| `str.upper(s)` / `lower(s)` | `s.toUpperCase()` / `.toLowerCase()` |
| `str.contains(s, sub)` | `s.includes(sub)` |
| `str.split(s, sep)` | `s.split(sep)` |
| `str.replace_all(s, t, r)` | `s.replaceAll(t, r)` |

Every other member falls to `default: { kind: "warn", code:
"str-not-mapped" }`. Helpers `unary` / `binary` / `ternary` build the
source from `emitWithContext`-rendered args; `stringLiteralValue`
extracts a raw literal.

## Desired Behavior

Ten more Pine functions handled: eight mapped to native JS, two
explicitly rejected. The `default` arm still catches genuinely-unknown
members.

## Requirements

### 1. New `switch` cases in `emitStr` (native JS)

Pine v6 `str.*` semantics confirmed against the TradingView v6
reference. Add these cases (positions 0-based; Pine `substring` /
`replace` occurrence are 0-based, matching JS):

| Pine member | Emitted JS | Helper | Notes |
|---|---|---|---|
| `startswith` | `s.startsWith(sub)` | `binary` | direct |
| `endswith` | `s.endsWith(sub)` | `binary` | direct |
| `pos` | `s.indexOf(sub)` | `binary` | Pine returns `na` if absent → JS returns `-1`; document the divergence in the diagnostic-free note, acceptable v1 |
| `substring` | `s.substring(begin)` or `s.substring(begin, end)` | custom (2-or-3 arg) | both 0-based, `end` exclusive — matches JS exactly |
| `trim` | `s.trim()` | `unary` | direct |
| `repeat` | `s.repeat(n)` (2-arg, or empty-string-literal separator) | custom | see §2 |
| `replace` | `s.replace(t, r)` (occurrence absent / literal `0`) | custom | see §3 |
| `tonumber` | `Number(s)` | `unary` | `NaN` ≈ Pine `na` (edge: `Number("")===0`) |
| `match` | reject | — | `{ kind: "warn", code: "str-not-mapped" }` |
| `format_time` | reject | — | `{ kind: "warn", code: "str-not-mapped" }` |

`match` and `format_time` can simply fall through to the existing
`default` arm (which already returns `str-not-mapped`) — list them in a
comment so it is intentional, not accidental. No new diagnostic codes;
reuse `str-not-mapped`.

### 2. `str.substring` and `str.repeat` (optional/guarded args)

`str.substring(source, begin_pos[, end_pos])` — Pine has a 2-arg and a
3-arg overload. Emit:
- 2 args → `${s}.substring(${begin})`
- 3 args → `${s}.substring(${begin}, ${end})`
- fewer than 2 args → `str-not-mapped` (malformed).

`str.repeat(source, repeat[, separator])`:
- 2 args → `${s}.repeat(${n})`
- 3 args where the separator is an **empty-string literal** (`""`) →
  `${s}.repeat(${n})` (no separator changes nothing)
- 3 args with any **non-empty / non-literal** separator →
  `{ kind: "warn", code: "str-not-mapped" }` (JS has no one-expression
  "repeat with separator"; passthrough + warn rather than emit wrong
  code).
- fewer than 2 args → `str-not-mapped`.

Use `stringLiteralValue(node) === ""` to detect the empty-string
separator.

### 3. `str.replace` (occurrence-aware)

`str.replace(source, target, replacement[, occurrence])` — Pine's
`occurrence` (0-based, default `0`) selects the N-th match. JS
`s.replace(target, replacement)` with a **string** target replaces the
**first** occurrence only — equivalent to occurrence `0`.

- 3 args (no occurrence) → `${s}.replace(${t}, ${r})`
- 4 args where occurrence is a **literal `0`** (int, or unary `+0`) →
  `${s}.replace(${t}, ${r})`
- 4 args where occurrence is a **non-zero literal or non-literal** →
  `{ kind: "warn", code: "str-not-mapped" }` (no native nth-occurrence
  one-liner; do not emit incorrect code).
- fewer than 3 args → `str-not-mapped`.

A small `literalZero(node)` predicate detects the occurrence-`0` case.
`plotFamily.ts` has a private `isLiteralZero` (`node.kind ===
"literal-expression" && (literalKind "int" | "float") && Number(value)
=== 0`) — but it is **not exported**, and it does **not** unwrap a unary
`+0`, which §3 requires. Per `pine-converter/CLAUDE.md` the literal-number
predicates are intentionally kept per-file ("The `literalInt` family is
NOT shared… each keeps its own intentionally-different variant"), so the
convention-consistent move is to inline a small `literalZero` in
`strFormat.ts` that mirrors the `isLiteralZero` shape AND also accepts a
`unary-expression` `+`/`-` over a numeric-`0` literal. Reuse the AST node
kinds already used in the package (`literal-expression`, `literalKind`,
`unary-expression`); do not re-implement a numeric parser and do not
import the private `plotFamily` helper.

### 4. Add the new arg-count helpers as needed

The existing `unary`/`binary`/`ternary` cover `trim`/`startswith`/
`endswith`/`pos`/`tonumber`. `substring`/`repeat`/`replace` need
optional-trailing-arg handling — add small focused helpers (or inline
the arg-presence branches) consistent with the existing helper style
(undefined-arg → `str-not-mapped`).

### 5. Update `emitStr` JSDoc

The function's JSDoc currently says "Supports the v1 subset
(`str.tostring`, `str.format`, …)". Update it to list the full mapped
set and note `match` / `format_time` reject, and `tonumber` →
`Number(...)`. Keep the `@example` valid.

### 6. Tests (`str-mapping.test.ts` / `strFormat`-adjacent tests)

Extend the existing converter `str.*` tests with a case per new
function and per reject/guard branch — the package holds **100%
line/branch/function** and the `code-coverage-grep.test.ts` asserts
every `pushCode`/`makeDiagnostic` literal is registered (no new codes
here, so that stays green). Required new cases:
- `startswith`, `endswith`, `pos`, `trim`, `tonumber` → emitted native
  JS.
- `substring` 2-arg and 3-arg forms.
- `repeat` 2-arg, 3-arg empty-sep, 3-arg non-empty-sep (warn).
- `replace` 3-arg, 4-arg occurrence-0, 4-arg occurrence-non-zero
  (warn).
- `match` and `format_time` → `str-not-mapped`.
- Malformed (too-few-args) branches for each new custom helper → warn.

Place them alongside the existing `str-mapping.test.ts` cases; mirror
the existing test's structure (the file builds a synthetic `CallExpression`
via the local `call(expr)` helper — `lex` + `parseStatements` — and calls
`emitStr(call("str.X(...)"), CTX)` directly; reuse that helper).

**Update the existing `tonumber` test — it will flip.** The current case
titled *"warns str-not-mapped for an unknown str.\* member"*
(`str-mapping.test.ts`, ~line 154) asserts
`emitStr(call("str.tonumber(sym)"), CTX)` → `{ kind: "warn", code:
"str-not-mapped" }`. After this task `tonumber` maps to `Number(sym)`, so
that assertion MUST change to `{ kind: "code", source: "Number(sym)" }`,
and the "unknown member" example must move to a genuinely-unknown member
(e.g. `str.fizz`) or to `match`/`format_time` (the new intentional
rejects). Leaving the old assertion in place fails the suite.

### 7. Mirror into the skill + update `CLAUDE.md`

Root `CLAUDE.md` invariant: changing what a skill describes requires
updating that skill in the same PR.
- `skills/chartlang-coding/references/translating-from-pine.md` —
  update the `## str.*` section to reflect the now-fuller mapping
  (it currently describes the subset). List the newly-supported Pine
  functions and the `match`/`format_time` rejects + `tonumber`→`Number`.
- `packages/pine-converter/CLAUDE.md` — the "Transform: control flow +
  passthrough" section describes `str.*` handling as a subset
  (`strFormat.ts`). Update that prose to the full surface, the native-JS
  convention, the occurrence-0 / empty-separator guards, and the
  `match`/`format_time`/`non-zero-occurrence`/`non-empty-separator`
  reject cases (all reusing `str-not-mapped`).

This does NOT change any `code:` string — `str-not-mapped` /
`str-format-not-mapped` are reused, preserving the stable public
diagnostic contract.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/strFormat.ts` | Modify | 8 new mappings + 2 rejects + guards; JSDoc |
| `packages/pine-converter/src/transform/str-mapping.test.ts` | Modify | Cases for every new member + guard/reject branch (100% coverage) |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | `## str.*` mirror of the fuller mapping |
| `packages/pine-converter/CLAUDE.md` | Modify | `str.*` prose → full surface + guards/rejects |
| `.changeset/pine-converter-str-surface.md` | Create | minor bump |

## Gates

- `pnpm --filter @invinite-org/chartlang-pine-converter test` —
  100% line/branch/function maintained; new cases pass;
  `code-coverage-grep.test.ts` green (no unregistered codes).
- `pnpm typecheck`, `pnpm lint` — green.
- `pnpm docs:check` — `emitStr`'s updated JSDoc `@example` still
  compiles/parses if it qualifies.
- `pnpm skills:gate` — `translating-from-pine.md` is hand-authored (not
  generated), so this gate is unaffected, but confirm it stays green.

## Changeset

`.changeset/pine-converter-str-surface.md` — **minor** bump of
`@invinite-org/chartlang-pine-converter` (new Pine functions supported
= additive feature). Example body: "pine-converter: lower the full Pine
v6 `str.*` surface (startswith/endswith/pos/substring/trim/repeat/
occurrence-aware replace/tonumber); `str.match` and `str.format_time`
reject with `str-not-mapped`."

## Acceptance Criteria

- `emitStr` maps `startswith`, `endswith`, `pos`, `substring` (2/3-arg),
  `trim`, `repeat` (with the empty-sep guard), `replace` (with the
  occurrence-0 guard), and `tonumber` to native JS; `match` /
  `format_time` / non-zero-occurrence `replace` / non-empty-sep
  `repeat` reject with `str-not-mapped`.
- No new diagnostic codes; the stable `code:` contract is unchanged.
- Native-JS convention preserved (no `str` import/destructure added to
  generated output).
- 100% coverage on `strFormat.ts`; `code-coverage-grep.test.ts` green.
- `translating-from-pine.md` and `pine-converter/CLAUDE.md` reflect the
  full surface.
- A minor changeset for the pine-converter is committed.
- `pnpm typecheck` / `lint` / pine-converter test suite green.
