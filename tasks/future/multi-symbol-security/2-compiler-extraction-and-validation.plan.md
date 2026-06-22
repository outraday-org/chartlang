# Task 2 — Compiler: extract `symbol` into `requestedFeeds` + literal validation — PLAN

## Context

Task 1 (DONE, verified): `RequestSecurityOpts.symbol?`, `RequestedFeed`
(`core/src/types.ts:445`), `ScriptManifest.requestedFeeds?`
(`core/src/types.ts:680`), `SecurityExpressionDescriptor.symbol?`
(`core/src/types.ts:427`), `feedKey(symbol, interval)`
(`core/src/request/feedKey.ts:22`, exported through `request/index.ts` + root
`index.ts`). The compiler `program.ts` ambient shim already declares
`requestedFeeds?: ReadonlyArray<RequestedFeed>` (line 1146) and `symbol?` on the
expression descriptor. `apiVersion` stays `1`.

This task: the compiler's `request.*` analysis pass reads the optional `symbol`
opt the SAME three ways it reads `interval` (string literal / `input.enum`
options) PLUS the new `input.symbol` default; builds `manifest.requestedFeeds`
(deduped via `feedKey`, sorted, omitted when empty); attaches the resolved
`symbol?` to each `SecurityExpressionDescriptor`; and rejects a genuinely-dynamic
symbol with the new `request-security-symbol-not-literal` diagnostic.
`requestedIntervals` stays byte-identical (the symbol-omitted main-symbol
projection).

## Pre-existing work (verified)

- `core` is built (`pnpm -F @invinite-org/chartlang-core build` run); `feedKey`
  + `RequestedFeed` resolve.
- `compile.test.ts:110-129` already has a `SYMBOL_FORM` test asserting the
  PRE-extraction baseline (comment line 124: "Task 2 fills requestedFeeds").
  Must be UPDATED to assert the new `requestedFeeds`.
- `extractRequestedIntervals.test.ts` `analyse` helper (line 223) returns the
  whole analysis object spread, so `feeds` flows automatically; existing
  `securityExpressions` `toEqual` assertions (e.g. line 250) have NO `symbol`
  key — they stay green because a symbol-omitted descriptor omits the key.

## Issues found / decisions

1. **`requestedFeeds` is from `request.security` calls ONLY** — NOT
   `request.lowerTf` (no symbol) and NOT `requiresIntervals`. `requestedIntervals`
   keeps mixing call-intervals + `requiresIntervals` in `api.ts` (unchanged).
   So `RequestAnalysis.feeds` is built only inside the `request.security` path.
2. **`request.lowerTf` interval path unchanged** — it still calls the
   interval-only reader and feeds `intervals` (its intervals DO join
   `requestedIntervals` today via `analysis.intervals` — preserved). It never
   produces a feed.
3. **Symbol-omitted feed both adds to `intervals` AND a `{ interval }` feed.**
   The interval-add must stay exactly as today (enum interval → each option
   added; literal → added) so `requestedIntervals` is byte-identical. The feed
   set is built ALONGSIDE, never replacing the interval-add.
4. **`feedKey` dedup → sort keys → map back to `RequestedFeed`.** Need a
   key→feed map (a `Map<string, RequestedFeed>`) since `feedKey` is lossy is NOT
   true here: `feedKey(undefined,"1D")==="1D"` and `feedKey("X","1D")` differ; but
   to reconstruct the `{symbol?, interval}` from a key I keep a `Map<string,
   RequestedFeed>` keyed by `feedKey`, then sort entries by key.
5. **Empty-literal symbol `symbol: ""`** → treated as chart symbol (omitted) per
   `feedKey` collapse → `{ interval }` feed, joins `requestedIntervals`. Handle by
   treating `value === ""` as the absent/omitted symbol in resolution.
6. **Diagnostic code is append-only** — append
   `"request-security-symbol-not-literal"` at the END of the union
   (`diagnostics.ts:56`), never reorder.
7. **Coverage**: every new branch needs a test (analyser + synthetic). The
   `readSecurityExpression` symbol-resolution mirrors `readLiteralInterval` —
   enum/dynamic symbol → descriptor symbol omitted.

## Symbol resolution helper (per task §2)

`readOptString(opts, "symbol", inputs)` returns a tagged union:
- `{ kind: "literal", value }` — string-literal initializer (incl. `""`).
- `{ kind: "enum", values }` — `inputs.<name>` → `enum` descriptor options.
- `{ kind: "input-default", value }` — `inputs.<name>` → `symbol` descriptor's
  `defaultValue` string.
- `{ kind: "absent" }` — property missing.
- `{ kind: "dynamic" }` — anything else.

`interval` keeps its own existing readers (literal or enum only; NEVER the
`input-default` path — `input.interval` is the main-chart interval, not a feed
interval). I will NOT route interval through the new helper to avoid changing its
byte-output; I add a small symbol-only resolver reusing `getInputsEnumOptions`
and a new `getInputSymbolDefault`.

## Feed-building algorithm (in the `request.security` branch of the interval reader)

For a `request.security` callsite:
1. Resolve **intervals**: `[]` if dynamic interval (diagnostic pushed, as today);
   `[literal]` or all enum options otherwise. (Existing `intervals.add` calls stay
   — they keep `requestedIntervals` byte-identical.)
2. Resolve **symbols** via the symbol helper:
   - `absent` / `literal ""` → `[undefined]` (chart symbol).
   - `literal value` → `[value]`.
   - `input-default value` → `[value]`.
   - `enum values` → `[...values]`.
   - `dynamic` → push `request-security-symbol-not-literal`, symbols = `[]`.
3. Cartesian product symbols × intervals → for each pair
   `feedKey(symbol, interval)` into a shared `Map<string, RequestedFeed>` on the
   analysis (omitted/empty symbol ⇒ `{ interval }` with no `symbol` key).
   `request.lowerTf` never enters this; only its interval-add path runs.

`request.security` interval-add MUST stay (symbol-omitted intervals already join
`requestedIntervals`; with a present symbol the interval does NOT join
`requestedIntervals` per task §3). So: only add to `intervals` when the resolved
symbol axis includes the omitted/chart symbol — wait: current behavior adds the
interval UNCONDITIONALLY for `request.security`. Per task §3:
- omitted symbol ⇒ interval joins `requestedIntervals`.
- present symbol(s) ⇒ do NOT join `requestedIntervals`.

Today every `request.security` is symbol-omitted, so unconditional-add ===
omitted-only-add for all existing scripts → byte-identical. New rule: add to
`intervals` ONLY for the omitted/empty-symbol axis. Implement by adding interval
to `intervals` per (symbol===undefined, interval) pair.

## Numbered steps

1. **`diagnostics.ts`** — append `| "request-security-symbol-not-literal"` to the
   `CompileDiagnosticCode` union end (after `state-array-capacity-exceeds-max`).
   Extend the JSDoc summary sentence to mention the new code.

2. **`extractRequestedIntervals.ts`**:
   a. Import `feedKey` and type `RequestedFeed` from core.
   b. Add `feeds: ReadonlyArray<RequestedFeed>` to `RequestAnalysis` (frozen,
      sorted by `feedKey`). Update its JSDoc.
   c. In `extractRequestAnalysis`, add `const feeds = new Map<string,
      RequestedFeed>();` accumulator; pass it into the `request.security` reader.
   d. Rename/extend `readRequestInterval` to also build feeds for
      `request.security` (keep `request.lowerTf` interval-only). Replace the
      single `intervals.add` literal/enum branches with: resolve intervals list +
      resolve symbols list, then for each (symbol, interval): record feed via
      `feedKey`; and add to `intervals` only when symbol is omitted.
      `request.lowerTf` keeps the exact existing interval-only branch (literal /
      enum / diagnostic).
   e. Add `resolveSymbol(opts, inputs, ...)` returning the tagged union; on
      `dynamic` push `request-security-symbol-not-literal`. Add
      `getInputSymbolDefault(expr, inputs)`.
   f. In `readSecurityExpression`, resolve the literal symbol (string literal or
      `input.symbol` default → concrete; enum/dynamic/absent → omitted) and
      include `symbol` in the pushed descriptor ONLY when defined.
   g. Sort + freeze feeds in the return: `Array.from(feeds.values())` sorted by
      `feedKey(symbol, interval)` (i.e. by the map key).

3. **`api.ts`** — both `buildManifest` callsites: pass `requestedFeeds` from the
   analysis (`fileRequestAnalysis.feeds` / `requestAnalysis.feeds`). For the
   drawn-manifest path mirror `securityExpressions` scoping (default manifest
   only). `buildManifest` omits when empty.

4. **`manifest.ts`** — add `requestedFeeds?: ReadonlyArray<RequestedFeed>` to the
   `buildManifest` args; write it (frozen, omitted when undefined/empty), placed
   adjacent to `securityExpressions` in the assembled object.

5. **Tests** — `extractRequestedIntervals.test.ts`: add a `feeds`-returning helper
   path (the `analyse` helper already returns `feeds`; add a `run`-style helper
   that also returns feeds, or assert `analyse(...).feeds`). Cover: literal
   symbol+interval; omitted symbol; `input.symbol` default; `input.enum` symbol
   (cartesian); dynamic symbol diagnostic + exclusion; both-dynamic → both codes;
   expression descriptor symbol (literal / input-default present; enum/dynamic
   omitted); determinism (two symbols → stable sorted feeds); empty-literal symbol
   collapses to chart symbol; dedup across callsites; synthetic for any
   parser-unreachable arm.

6. **`compile.test.ts`** — update the `SYMBOL_FORM` block (line 122-129) to assert
   `requestedFeeds` populated + sorted, `requestedIntervals` unchanged; add a
   no-`request.security` script asserts `requestedFeeds` undefined; back-compat
   symbol-omitted form asserts `requestedFeeds` = `[{ interval: "1W" }]` and
   `requestedIntervals` byte-identical.

7. **`compiler/CLAUDE.md`** — document: symbol read (literal / `input.symbol` /
   `input.enum`), `requestedFeeds` (deduped via `feedKey`, sorted, omitted when
   empty), `requestedIntervals` = symbol-omitted projection, new diagnostic.

## Files table

| File | Action |
|------|--------|
| `packages/compiler/src/diagnostics.ts` | Append `request-security-symbol-not-literal` to union. |
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` | Read symbol; build feeds; attach symbol; new helpers. |
| `packages/compiler/src/api.ts` | Pass `requestedFeeds` to both `buildManifest` callsites. |
| `packages/compiler/src/manifest.ts` | Accept + emit `requestedFeeds` (omit when empty). |
| `packages/compiler/src/analysis/extractRequestedIntervals.test.ts` | Feed/symbol/diagnostic/determinism coverage. |
| `packages/compiler/src/compile.test.ts` | E2E `requestedFeeds`; symbol diagnostic. |
| `packages/compiler/CLAUDE.md` | Document the symbol read + feeds invariant. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-compiler test` (100% coverage; determinism)
- `pnpm docs:check`

## Changeset

Covered by `.changeset/multi-symbol-security.md` (compiler already minor). Verify
it lists compiler; no new changeset needed.

## Acceptance criteria

Per task file lines 224-235.
