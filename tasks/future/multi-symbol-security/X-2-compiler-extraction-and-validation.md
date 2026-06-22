# Task 2 — Compiler: extract symbol into `requestedFeeds` + literal validation

> **Status: DONE**

## Goal

Teach the compiler's `request.*` analysis pass to read the new optional
`symbol` opt: populate `manifest.requestedFeeds` with one entry per **distinct**
`(symbol, interval)` feed, attach `symbol` to each
`SecurityExpressionDescriptor`, keep `requestedIntervals` as the main-symbol
(symbol-omitted) projection, and reject a non-literal symbol with the new
`request-security-symbol-not-literal` diagnostic — mirroring exactly how
`interval` is read and validated today.

## Prerequisites

Task 1 (`RequestSecurityOpts.symbol`, `RequestedFeed`,
`manifest.requestedFeeds`, `SecurityExpressionDescriptor.symbol?`, shim
mirror).

## Current Behavior

- `extractRequestAnalysis`
  (`packages/compiler/src/analysis/extractRequestedIntervals.ts:53`) walks
  the AST; for each `request.security` / `request.lowerTf` call it runs
  `readRequestInterval` (line 186) and, for `request.security`,
  `readSecurityExpression` (line 135).
- `readRequestInterval` (line 186) reads **only** the `interval` property of
  the opts object literal: a string literal → `intervals.add(text)`; an
  `inputs.<enum>` access → expand all enum options via `getInputsEnumOptions`
  (line 208/229); otherwise push
  `request-security-interval-not-literal` /
  `request-lower-tf-interval-not-literal` (line 214) and exclude.
- `readLiteralInterval` (line 175) reads the literal `interval` (string
  literal only — `input.enum` returns `null`) to anchor an expression
  descriptor; a `null` interval skips the descriptor.
- `readSecurityExpression` (line 135) builds
  `{ slotId: callsiteIdFor(...), interval, paramName }` (line 159) — **no
  symbol**.
- `RequestAnalysis` (line 25) is `{ intervals, securityExpressions }` — no
  feeds.
- `getInputsEnumOptions` (line 229) resolves an `inputs.<name>` access to a
  descriptor's `enum` options; it does **not** handle `input.symbol`
  defaults.
- Diagnostic codes live in `packages/compiler/src/diagnostics.ts`
  (`request-security-interval-not-literal` line 30, the
  `request-lower-tf-interval-not-literal` line 42).
- The default manifest is assembled in `packages/compiler/src/manifest.ts`
  from the analysis result; `requestedIntervals` and `securityExpressions`
  are written there.

## Desired Behavior

- For each `request.security({ symbol?, interval })` callsite the analyser
  reads the **symbol** opt the same way it reads interval:
  - a **string literal** → that literal symbol,
  - an `inputs.<enum>` access whose descriptor is an `enum` → expand to all
    enum options (one feed per option, mirroring interval),
  - an `inputs.<name>` access whose descriptor is a **`symbol`** input →
    that input's `defaultValue` literal (the mount-time-resolvable case),
  - **omitted** → chart symbol (`symbol` undefined on the feed),
  - anything else → push `request-security-symbol-not-literal` and exclude
    the feed (mirrors `request-security-interval-not-literal`).
- `RequestAnalysis` gains `feeds: ReadonlyArray<RequestedFeed>` (deduped,
  sorted deterministically). `requestedIntervals` stays the projection of
  symbol-omitted feeds' intervals (its existing meaning) so existing
  manifests and the runtime's main-symbol path are unchanged.
- Each `SecurityExpressionDescriptor` carries the resolved `symbol?`.
- A non-literal **interval** with a literal symbol still emits the interval
  diagnostic (unchanged); a literal interval with a non-literal symbol emits
  the new symbol diagnostic. Both diagnostics can fire on one callsite if
  both opts are dynamic.

## Requirements

### 1. New diagnostic code (`packages/compiler/src/diagnostics.ts`)

Add to the diagnostic-code union, next to
`request-security-interval-not-literal`:

```ts
| "request-security-symbol-not-literal"
```

Message (raised in the analyser): `request.security({ symbol }) must be a
string literal, an input.symbol default, or an input.enum value`.

### 2. Read the symbol opt (`extractRequestedIntervals.ts`)

Add a `readOptStringLiteralOrInput(opts, propName, inputs)` helper (or extend
the existing property-reading shape) that, given the opts object literal and a
property name, returns:
- `{ kind: "literal", value }` for a string-literal initializer,
- `{ kind: "enum", values }` for an `inputs.<enum>` access,
- `{ kind: "input-default", value }` for an `inputs.<name>` access resolving
  to a **`symbol`** input descriptor's `defaultValue` (NEW — interval has no
  analogue because `input.interval` is the main-chart interval, not a feed
  interval; symbols are different),
- `{ kind: "absent" }` when the property is missing,
- `{ kind: "dynamic" }` otherwise.

Extend `getInputsEnumOptions` (line 229) or add a sibling
`getInputSymbolDefault(expr, inputs)` that reads a `symbol`-kind descriptor's
`defaultValue` string. Keep `interval` reading exactly as-is (it never uses
the `input-default` path).

### 3. Build the feed list (`readRequestInterval` → a widened feed reader)

Replace the interval-only `readRequestInterval` for `request.security` with a
feed reader that produces the cartesian product of resolved symbols × resolved
intervals, deduped into a `Set` of `RequestedFeed`:

- interval resolution is unchanged (string literal or `input.enum`),
- symbol resolution per §2,
- **omitted symbol** ⇒ `{ interval }` (no `symbol` key) — and this interval
  ALSO joins `requestedIntervals` (the main-symbol projection),
- **present symbol(s)** ⇒ `{ symbol, interval }` per (symbol, interval) pair
  — these do **not** join `requestedIntervals`,
- a dynamic interval emits `request-security-interval-not-literal` (as today);
  a dynamic symbol emits `request-security-symbol-not-literal`; in either
  dynamic case no feed is added for that axis.

`request.lowerTf` is unchanged — it has no symbol, only interval; keep its
existing interval-only path (and it still feeds `requestedIntervals`? — No:
confirm by reading current code whether lowerTf intervals join
`requestedIntervals`; preserve whatever it does today exactly).

Deterministic ordering: dedup feeds into a `Set<string>` of `feedKey(symbol,
interval)` (import `feedKey` from core — the single key source) → sort the
keys → map back to `RequestedFeed`. This guarantees byte-stable manifest
output (determinism gate, `packages/compiler/CLAUDE.md`).

### 4. Attach `symbol` to the expression descriptor (`readSecurityExpression`)

In `readSecurityExpression` (line 135), after resolving the literal interval
(`readLiteralInterval`, line 175), resolve the **literal** symbol the same
way (string literal or `input.symbol` default → a concrete symbol; an
`input.enum`/dynamic symbol → no single descriptor symbol, leave `symbol`
omitted — an enum symbol can't anchor a single expression clock, exactly as an
`input.enum` interval can't, line 175 comment). Push the descriptor with the
resolved `symbol?`:

```ts
out.push(Object.freeze({
    slotId: callsiteIdFor(sourceFile, call, sourcePath),
    symbol,        // undefined ⇒ chart symbol
    interval,
    paramName,
}));
```

`validateSecurityExpr` (`validateSecurityExpr.ts:30`) is **unchanged** — the
symbol literal lives in the opts object, not in the callback body, so it does
not interact with the capture check.

### 5. `RequestAnalysis` + manifest assembly

- Add `feeds: ReadonlyArray<RequestedFeed>` to `RequestAnalysis` (line 25),
  frozen + sorted.
- `extractRequestedIntervals` (the thin delegate, line 116) keeps returning
  `.intervals` (callers that only need intervals are unchanged).
- In `manifest.ts`, write `requestedFeeds` from `analysis.feeds` **only when
  non-empty** (omit otherwise for snapshot byte-compat), and keep writing
  `requestedIntervals` from `analysis.intervals`. The `securityExpressions`
  list now carries `symbol?` per entry.

### 6. Tests (`extractRequestedIntervals.test.ts` + `compile.test.ts`)

- literal symbol + literal interval → one `{ symbol, interval }` feed; NOT in
  `requestedIntervals`.
- omitted symbol → `{ interval }` feed AND the interval in
  `requestedIntervals` (back-compat: a symbol-omitted script's
  `requestedIntervals` is byte-identical to today).
- `input.symbol` default → feed uses the default literal.
- `input.enum` symbol → one feed per enum option (cartesian with intervals).
- dynamic symbol (`bar.symbol`, a concatenation, a function call) →
  `request-security-symbol-not-literal`, feed excluded.
- both opts dynamic → both diagnostics.
- expression form: descriptor carries the resolved `symbol`; enum/dynamic
  symbol ⇒ descriptor `symbol` omitted.
- determinism: two distinct symbols at the same interval produce a stable
  sorted `requestedFeeds`; printing the manifest twice is byte-identical.
- a no-`request.security` script omits `requestedFeeds` entirely.

## Edge cases

- `symbol: ""` (empty literal) is treated as the chart symbol (omitted)
  consistent with `feedKey`'s empty-collapse — produces `{ interval }`, joins
  `requestedIntervals`.
- Same symbol+interval requested by two callsites ⇒ one feed (dedup by
  `feedKey`).
- An `input.symbol` whose `defaultValue` equals the chart symbol is still
  recorded as that explicit symbol feed (the compiler can't know it equals the
  chart symbol — that's a runtime/host fact); the runtime's chart-symbol
  resolution + `feedKey` collapse handles equality at mount.
- Cartesian explosion: `input.enum` symbol (N options) × `input.enum` interval
  (M options) ⇒ N×M feeds — acceptable and bounded by the enums' option counts
  (same blow-up `input.enum` intervals already accept).
- Non-`request.security` `request.lowerTf` calls never produce feeds with a
  symbol.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/diagnostics.ts` | Modify | Add `request-security-symbol-not-literal`. |
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` | Modify | Read symbol; build `feeds`; attach `symbol` to descriptors; dedup via `feedKey`. |
| `packages/compiler/src/manifest.ts` | Modify | Write `requestedFeeds` (non-empty only); keep `requestedIntervals` projection. |
| `packages/compiler/src/analysis/extractRequestedIntervals.test.ts` | Modify | Feed/symbol/diagnostic/determinism coverage. |
| `packages/compiler/src/compile.test.ts` | Modify | End-to-end manifest has `requestedFeeds`; symbol diagnostic fires. |
| `packages/compiler/CLAUDE.md` | Modify | Document the symbol read (literal / `input.symbol` / `input.enum`), `requestedFeeds` (deduped via `feedKey`, sorted, omitted-when-empty), and that `requestedIntervals` is the symbol-omitted projection. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-compiler test` (coverage thresholds;
  determinism test green)
- `pnpm docs:check`

## Changeset

Covered by Task 1's feature changeset (compiler is minor).

## Acceptance Criteria

- `request.security` symbol opt read as literal / `input.symbol` default /
  `input.enum` options; dynamic symbol → `request-security-symbol-not-literal`.
- `manifest.requestedFeeds` populated (deduped via `feedKey`, sorted, omitted
  when empty); `requestedIntervals` unchanged for symbol-omitted scripts
  (byte-compat).
- `SecurityExpressionDescriptor.symbol` attached for literal/input-default
  symbols; omitted for enum/dynamic/chart-symbol.
- Determinism: manifest prints byte-identically twice.
- `packages/compiler/CLAUDE.md` updated; compiler tests/docs:check green.
