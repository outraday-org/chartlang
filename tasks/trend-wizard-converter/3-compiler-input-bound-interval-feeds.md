# Task 3 — Core/compiler: accept input-bound + chart-timeframe security feeds

> **Status: TODO**

## Goal

Extend the compiler's **compile-time security-feed extraction** so that
an interval bound to an `input.interval` / `input.timeframe` value (and
the empty = **chart-timeframe** case) is accepted as a feed — mirroring
the existing support for an `input.symbol` **default**. This is the
chartlang-side prerequisite that lets the converter (Task 4) emit
Trend Wizard's input-bound `request.security` feeds without the
compiler rejecting them.

This is **not** a runtime lazy-feed architecture. Verified in
[`RESEARCH-BRIEF.md`](./RESEARCH-BRIEF.md) §Transform issue 4 + the feed
investigation: Trend Wizard's feeds resolve from input *defaults*, which
are compile-time constants. True runtime-arbitrary feeds remain out of
scope (README → Deferred).

## Prerequisites

Tasks 1, 2 (so the converter pipeline parses; not a code dependency,
but Task 4 depends on this task and on a parsing pipeline).

## Current Behavior

`packages/compiler/src/analysis/extractRequestedIntervals.ts`
(`resolveOptString`, ~L257-390) resolves a `request.security` symbol /
interval to a compile-time string and accepts:

- string literal (symbol + interval),
- `input.enum` value (cartesian product over options),
- `input.symbol` **default** (symbol only),
- absent symbol (chart symbol).

It **rejects** any other expression with
`request-security-symbol-not-literal` /
`request-security-interval-not-literal` and **excludes** the feed from
`manifest.requestedFeeds` / `manifest.securityExpressions`.

Runtime (`packages/runtime/src/createScriptRunner.ts`,
`request/requestNamespace.ts`) pre-creates one stream per
manifest-declared feed and keys lookups by `feedKey(symbol, interval)`;
unknown feeds return all-NaN with `unknown-secondary-stream`. So a feed
**must** be in the manifest at compile time — which is exactly what this
task ensures for the input-bound interval case.

Core contract: `packages/core/src/types.ts` —
`SecurityExpressionDescriptor` (~L469-479, has optional `symbol`) and
`RequestedFeed` (~L494-497). The `RequestSecurityOpts` type and the
literal-only rule prose live in `packages/core/src/request/request.ts`
(~L21-35: interval rule ~L7-9, symbol rule ~L24-26). The interval-side
extraction is `getInputSymbolDefault`'s sibling logic in
`extractRequestedIntervals.ts` (`getInputSymbolDefault` ~L398-413 is the
symbol-default helper to mirror for the interval branch).

## Desired Behavior

- An interval given as an `input.interval(...)` / `input.timeframe(...)`
  value **with a literal default** is accepted and contributes a feed
  using that default interval — symmetric with today's `input.symbol`
  default handling.
- An **empty** timeframe default (`""`, Pine "chart timeframe") resolves
  to the **chart interval** — i.e. the chart's own timeframe (omitted
  interval / same as the primary stream), not a rejected dynamic
  expression.
- Symbol side unchanged (already supports `input.symbol` default); just
  confirm an input-bound symbol identifier resolves through its default
  the same way the converter will emit it.
- A genuinely dynamic interval/symbol (no literal default, e.g. a
  computed expression) still rejects with the existing codes — no
  behavior change there.

## Requirements

1. **Confirm the chartlang surface first.** Verified facts to build on:
   `input.interval(defaultValue, opts?)` exists in
   `packages/core/src/input/input.ts` (~L210-212) and produces an
   `IntervalDescriptorInput`. The **chart timeframe** is the empty-string
   interval sentinel: the runtime main stream uses `StreamState.interval = ""`
   (runtime `CLAUDE.md` §6.8), and `feedKey(undefined, interval)` collapses
   a chart-symbol feed to a bare interval key (core `CLAUDE.md`). Use that
   empty/omitted-interval representation for "chart timeframe" — do not
   invent a new sentinel.

   **Invariant reversal (do not miss):** `packages/compiler/CLAUDE.md`
   (~L68) currently asserts the *opposite* of this task —
   "`input.symbol` **default** literal (NEW — `interval` never uses this;
   an `input.interval` is the main-chart interval, not a feed interval)".
   This task makes the interval branch accept an input default, so that
   line is now false. Rewrite it (and the matching core `CLAUDE.md` feed
   prose + `request.ts` literal-only prose) to describe the relaxed rule
   and the chart-timeframe representation in the same PR.

2. **Extend `resolveOptString` (interval branch)** in
   `extractRequestedIntervals.ts` to accept an `input.interval` /
   `input.timeframe`-style value by reading its literal default —
   reusing the same resolution path that already reads an
   `input.symbol` default. Empty default → chart interval (the same
   representation the omitted-interval feed already uses). Keep the
   cartesian-product behavior intact for `input.enum`.

3. **Manifest** (`packages/core/src/types.ts`): only change types if the
   chart-timeframe / input-bound feed needs a new field. Prefer reusing
   `RequestedFeed` with the resolved interval; avoid a
   `hasRuntimeVariableFeeds` flag (that's the deferred architecture).

4. **Runtime** (`packages/runtime`): likely **no change** — once the
   feed is in `manifest.requestedFeeds`, the existing
   `createSecondaryStreams` pre-registers it and `feedKey` lookup works.
   Verify with a runtime test that an input-default-interval feed
   resolves and a chart-timeframe feed maps to the primary stream
   (no spurious `unknown-secondary-stream`). If a real gap exists, fix
   it here and document.

5. **Diagnostics**: no new codes expected. If chart-timeframe handling
   needs a distinct info/warning, add it via `DIAGNOSTIC_CODE_ENTRIES`
   in the **compiler's** diagnostic registry (not the converter's) and
   run that package's docs/gen if it has one. Prefer no new code.

## Edge Cases

- `input.timeframe("")` empty default → chart interval, **not** a
  rejected dynamic expr and **not** a phantom secondary feed.
- `input.interval` with a literal default like `"1D"` → that feed.
- Same symbol, two different input-bound intervals → two feeds (no
  collision in `feedKey`).
- Input-bound interval **and** input-bound symbol on the same call
  (Trend Wizard's `request.security(src_symbol_custom, src_tframe, …)`).
- A computed (non-input, non-literal) interval still rejects with
  `request-security-interval-not-literal`.
- Warmup / capacity: a chart-timeframe feed must not double-count the
  primary stream.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` | Modify | Accept input-bound + chart-timeframe interval defaults. |
| `packages/core/src/types.ts` / `src/request/request.ts` | Modify (if needed) | Type/doc for chart-timeframe feed; update literal-only prose. |
| `packages/runtime/src/createScriptRunner.ts` / `request/requestNamespace.ts` | Modify (only if a gap) | Chart-timeframe → primary stream mapping. |
| `packages/compiler/.../extractRequestedIntervals.test.ts` | Modify/Add | Extraction unit + property tests. |
| `packages/runtime/src/request/security.test.ts` | Modify/Add | Resolution + chart-timeframe runtime test. |
| `packages/core/CLAUDE.md`, `packages/compiler/CLAUDE.md` | Modify | Document the relaxed literal-only rule + chart-tf representation. |

## Tests (co-located, 100% coverage on touched packages)

- Extraction: input-default interval → feed present in
  `requestedFeeds`; empty default → chart interval; computed expr →
  still rejected.
- Runtime: input-default-interval feed resolves to its stream;
  chart-timeframe resolves to the primary stream with no
  `unknown-secondary-stream`.
- Property test over interval/symbol literal/default/computed
  combinations.
- Keep `packages/compiler`, `packages/core`, `packages/runtime` each at
  100% line/branch/function.

## Gates

- `pnpm --filter @invinite-org/chartlang-compiler test`
- `pnpm --filter @invinite-org/chartlang-core test`
- `pnpm --filter @invinite-org/chartlang-runtime test`
- `pnpm typecheck`, `pnpm docs:check` (JSDoc on any new export)
- `pnpm conformance` (if feed surface changes)
- `pnpm check:content` (final)

## Changeset

`.changeset/<slug>.md` → bump **minor** for each touched published
package (`@invinite-org/chartlang-compiler`, `-core`, and `-runtime` if
changed): "Accept input-bound and chart-timeframe intervals as
compile-time security feeds."

## Acceptance Criteria

- Input-default-interval + chart-timeframe feeds are extracted into the
  manifest and resolve at runtime; computed exprs still reject.
- 100% coverage on every touched package; typecheck + docs:check green.
- `packages/core/CLAUDE.md` / `packages/compiler/CLAUDE.md` document the
  relaxed rule and the chart-timeframe representation.
- Changeset(s) committed. (Note: enables Task 4; not user-facing alone.)
