# Task 5 — Host / reference-adapter wiring + multi-symbol NaN fallback — PLAN

## Context

Widen `request.security` to a `(symbol, interval)` composite. Tasks 1–4 landed
(working tree, uncommitted): `feedKey` in core, `manifest.requestedFeeds`,
runtime composite keying (`secondaryStreams` / `requestSecurityBars` /
`requestSecurityAlignments` / `securityExprRunnersByFeed` all keyed by
`feedKey`), `Capabilities.multiSymbol` (required boolean), and
`CandleEvent.streamKey` re-documented as the composite key.

This task adds the **`multi-symbol-not-supported` NaN fallback** in the runtime
request kernel (data + expression forms), wires the demo producer + CLI adapter
template to build `streamKey`/advertise `multiSymbol`, and adds two-symbol host
tests proving the composite `streamKey` flows through both hosts unchanged.

Per-request gate order (verified against `security.ts`):
**symbol differs ⇒ `multiSymbol`** → **interval differs ⇒ `multiTimeframe`** →
`unsupported-interval` → `unknown-secondary-stream`. A chart-symbol request
(omitted symbol, or the chart's own ticker) never trips the symbol gate — it
stays on the `multiTimeframe` path, byte-identical to baseline.

### Key design fact (verified)

`requestNamespace.security` (`requestNamespace.ts:34-35,47`) already calls
`resolveSymbol(ctx, opts.symbol)`, which **collapses an omitted symbol OR the
chart's own ticker to `undefined`**. Therefore inside `security.ts` the signal
"is this a different symbol?" is simply **`symbol !== undefined`** — no extra
chart-symbol comparison is needed. `makeSecurityBar` already receives
`symbol: string | undefined`; `makeSecurityExprSeries` receives only `feed`, so
it gains an `isDifferentSymbol: boolean` parameter computed by the caller.

## Pre-existing work (validated against the workspace)

- `Capabilities.multiSymbol: boolean` is REQUIRED (`adapter-kit/src/types.ts:336`),
  built helper `capabilities.multiSymbol(enabled)` exists
  (`capabilities/capabilities.ts:173`), re-exported, and dist is rebuilt.
- `feedKey(symbol, interval)` exists (`core/src/request/feedKey.ts:22`),
  re-exported from core (`index.ts:221`) and adapter-kit barrel.
- `manifest.requestedFeeds?: ReadonlyArray<RequestedFeed>` exists
  (`core/src/types.ts:680`).
- `requestNamespace.test.ts` (staged, migrated) PASSES all 17 — incl. a
  per-feed dedup test that currently expects `multi-timeframe-not-supported`
  for a SPY request under `multiTimeframe:false`. **That expectation changes**
  to `multi-symbol-not-supported` once the symbol gate lands (symbol gate
  precedes timeframe gate).
- Host invariant (`host-worker/CLAUDE.md`, `host-quickjs/CLAUDE.md`):
  `buildBundleFromModule` / `dispatcherCore` spread the WHOLE `__manifest`
  sidecar (so `requestedFeeds` rides through with no host change) and pass
  `CandleEvent.streamKey` through untouched. Confirmed by host explorer.

## Issues found (must address)

1. **`securityExprRunner.test.ts` is STALE and FAILS 10 tests on the current
   tree** — it is the ONLY file still referencing the dead Task-3 API
   (`built.byInterval`, `ctx.securityExprRunnersByInterval`, and
   `createSecurityExprRunner({...})` WITHOUT the now-required `symbol` arg).
   The source is fully migrated to `byFeed` / `securityExprRunnersByFeed` /
   `foldBar.symbol`. This blocks the runtime test gate Task 5 must keep green,
   and these same tests call `makeSecurityExprSeries` whose signature I change.
   **Fix the stale test as part of Task 5** (migrate to `byFeed`,
   `securityExprRunnersByFeed`, pass `symbol`, pass the new
   `isDifferentSymbol` arg).

2. **`makeCapabilities` test helpers omit `multiSymbol`** in
   `requestNamespace.test.ts` (passes today only because it's not in the
   symbol-gate path) and `securityExprRunner.test.ts`. Vitest compiles test
   files (excluded from `pnpm typecheck` but not from vitest's transform), so
   add `multiSymbol` to every runtime/host test `makeCapabilities` I touch.
   Host `integration.test.ts`'s `makeCapabilities` also omits it — add there.

3. **The runtime build NOTE applies**: core/adapter-kit/runtime dist were
   stale; already rebuilt this session (`pnpm -F …-core/-adapter-kit/-runtime
   build`). Re-run before final typecheck.

## Steps

### A. Diagnostic registration (append, never reorder)

1. `packages/adapter-kit/src/types.ts` — append
   `| "multi-symbol-not-supported"` to the `DiagnosticCode` union (after
   `"multi-timeframe-not-supported"`, line ~761). Update the JSDoc list near
   line ~740 if it enumerates codes (it lists dep-* only — add a one-line
   bullet for the new code near the MTF mention is optional; keep minimal).
2. `packages/adapter-kit/src/validation/validateEmission.ts` — append
   `"multi-symbol-not-supported"` to `VALID_DIAGNOSTIC_CODES` (after the MTF
   entry, line ~126).
3. `packages/adapter-kit/src/types.types.test.ts` — add
   `"multi-symbol-not-supported"` to the `ExpectedCodes` union (line ~89) so
   the `expectTypeOf<DiagnosticCode>().toEqualTypeOf<ExpectedCodes>()` stays
   exact.
4. `packages/adapter-kit/src/validation/validateEmission.test.ts` — if there
   is a test enumerating valid codes, add the new code (grep first; only the
   union test at ~5143 references the string `"DiagnosticCode"`, likely no
   list to extend — verify).
5. Rebuild adapter-kit so runtime sees the widened union.

### B. Runtime gate (`packages/runtime/src/request/security.ts`)

6. Widen the `fallbackNaN` `code` param union (line 180) to add
   `| "multi-symbol-not-supported"`.
7. Widen `resolveSecondaryOrDiagnose`'s push (it calls `pushOnce` with literal
   codes — `pushOnce` already takes `DiagnosticCode`, so no signature change,
   just add the new branch).
8. Add a shared message constant:
   `Adapter declares multiSymbol: false; request.security for a different symbol returns NaN`
   (exact text from the task).
9. In `makeSecurityBar` (after the cache-hit early return, BEFORE the
   `multiTimeframe` gate at line 215): if `symbol !== undefined &&
   !ctx.capabilities.multiSymbol` → `return fallbackNaN(ctx, cacheKey, slotId,
   feed, "multi-symbol-not-supported", MULTI_SYMBOL_MSG)`. Uses `feed` (the
   composite key already built at line 210) as the dedup discriminator.
10. Add a param `isDifferentSymbol: boolean` to `makeSecurityExprSeries`
    (after `feed`). In its body, BEFORE `resolveSecondaryOrDiagnose`: if
    `isDifferentSymbol && !ctx.capabilities.multiSymbol`, cache + return an
    all-NaN series and `pushOnce(ctx, "multi-symbol-not-supported",
    runner.slotId, feed, "security", MULTI_SYMBOL_MSG)`. Mirror the cache set
    (`cache?.set(cacheKey, series)`) so the second call is a cache hit (one
    diagnostic). Update its JSDoc + `@example`.
11. `packages/runtime/src/request/requestNamespace.ts` — pass
    `symbol !== undefined` as the new `isDifferentSymbol` arg to
    `makeSecurityExprSeries(ctx, runner, feed, symbol !== undefined)`.
    `makeSecurityBar` already gets `symbol`.

### C. Runtime tests

12. `packages/runtime/src/request/requestNamespace.test.ts`:
    - Add `multiSymbol` to `makeCapabilities` (param `multiSymbol = false`,
      defaulting false so existing chart-symbol tests are unaffected; the
      one different-symbol live test sets it true).
    - The existing "keys the diagnostic dedupe per feed" test (line ~452)
      currently expects BOTH keys as `multi-timeframe-not-supported`. Under
      `multiSymbol:false` the SPY one now trips the SYMBOL gate first → update
      its expected code to `multi-symbol-not-supported|slot#0|AMEX:SPY@1D|security`
      (the chart-symbol `1D` one stays `multi-timeframe-not-supported`).
      Rename the test to reflect both gates.
    - Add new tests: (a) different-symbol + `multiSymbol:false` → all-NaN bar +
      one `multi-symbol-not-supported`; (b) different-symbol + `multiSymbol:true`
      + registered stream → live values (already partly covered by the
      "routes a different-symbol request" test — extend/confirm); (c)
      chart-symbol + `multiSymbol:false` → still `multiTimeframe`-gated
      (unaffected); (d) BOTH different symbol AND different interval +
      `multiSymbol:false` → ONE `multi-symbol-not-supported` (symbol precedes
      timeframe); (e) `multiSymbol:true` + `multiTimeframe:false` + different
      symbol at the CHART interval → allowed (no gate); at a DIFFERENT interval
      → `multi-timeframe-not-supported`.
    - Expression-form gate: same different-symbol gate via the namespace.
13. `packages/runtime/src/request/securityExprRunner.test.ts` (STALE — fix):
    - Migrate `built.byInterval` → `built.byFeed`,
      `ctx.securityExprRunnersByInterval` → `ctx.securityExprRunnersByFeed`.
    - Pass `symbol: ""` (or the resolved symbol) to every
      `createSecurityExprRunner({...})` call and to `buildSecurityExprRunners`
      fixtures as needed.
    - Add `multiSymbol` to its `makeCapabilities`.
    - Update every `makeSecurityExprSeries(ctx, runner, FEED)` call to the new
      4-arg form `(ctx, runner, FEED, isDifferentSymbol)`; pass `false` for the
      existing chart-symbol tests (byte-identical behaviour).
    - Add an expr-form different-symbol gate test:
      `makeSecurityExprSeries(ctx, runner, "AMEX:SPY@1D", true)` with
      `multiSymbol:false` → all-NaN + one `multi-symbol-not-supported`.

### D. Demo producer (`apps/site/src/components/demo/secondaryStreams.ts`)

14. Import `feedKey` from `@invinite-org/chartlang-core`. Build each secondary
    `close` event's `streamKey` via `feedKey(undefined, interval)` (===
    `interval`, byte-identical for the single-symbol case). Keep behaviour
    identical for the existing interval-only path.
15. Add a second-symbol synthetic producer: a function (e.g.
    `createMultiSymbolCandlePump` or extend the existing pump to accept
    `RequestedFeed[]`) that, given the manifest's `requestedFeeds`, emits a
    deterministic resample of a SECOND seeded series tagged with
    `feedKey(symbol, interval)`. Scope: a small, self-contained helper +
    its unit test; ChartPane rewiring to `requestedFeeds` is left to Task 7
    (which owns DEMO_SCRIPTS) — note this in the plan + the apps demo comment.
    Do NOT touch the example-adapter capability bags (those live in
    `examples/*` / their packages; advertising `multiSymbol` there is Task 7's
    DEMO_SCRIPT concern). Add a `feedKey`-built-streamKey test.

    NOTE: `apps/*` is Biome-exempt + has no coverage/README/changeset gate, so
    the demo change is verified by its existing app tests only.

### E. CLI adapter template (`packages/cli/src/adapterTemplate/templates.ts`)

16. In `INDEX_TS`'s `starterCapabilities`, add
    `...capabilities.multiSymbol(true)` next to `capabilities.multiTimeframe(true)`
    and a one-line comment noting the composite `streamKey` format
    (`feedKey(symbol, interval)` → `"AMEX:SPY@1D"`). This is a string template,
    so verify the generated TS still compiles via the cli e2e (the template is
    scaffold-snapshot-tested — check `commands/scaffoldAdapter` tests / any
    golden of `INDEX_TS` and update).

### F. Host tests (parity, both hosts)

17. `packages/host-worker/src/integration.test.ts`: add a two-symbol test
    mirroring the existing expr-form boot test. Add `multiSymbol` to
    `makeCapabilities` (true in the two-symbol path). Compile-shape a data-form
    two-symbol script (SPY/QQQ ratio) with `requestedFeeds: [{symbol:"AMEX:SPY",
    interval:"1D"},{symbol:"NASDAQ:QQQ",interval:"1D"}]` in its manifest, feed
    two `history` batches with `streamKey: feedKey("AMEX:SPY","1D")` and
    `feedKey("NASDAQ:QQQ","1D")`, assert both series are finite + DISTINCT.
    Use `feedKey` from core to build the keys (never inline `@`).
18. `packages/host-quickjs/src/integration.test.ts` (or `dispatcherCore.test.ts`
    if that is where the MTF test lives — host explorer to confirm): the
    byte-identical two-symbol test for cross-host parity. Add `multiSymbol` to
    its capability fixture.
19. Do NOT modify `createWorkerBoot.ts` / `dispatcherCore.ts` source — the
    sidecar spread already carries `requestedFeeds` and `streamKey` passes
    through. Only add tests. (Confirm via host explorer that no field is
    stripped; if a field IS stripped, the minimal fix is to keep spreading the
    whole manifest — never enumerate fields.)

### G. CLAUDE.md updates

20. `packages/runtime/CLAUDE.md` — extend the NaN-fallback / composite-key
    invariant: add `multi-symbol-not-supported` and the gate order (symbol →
    timeframe → unsupported-interval → unknown-stream); note the
    `symbol !== undefined` ⇒ different-symbol signal and per-feed dedup.
21. `packages/runtime/src/request/CLAUDE.md` — note the symbol gate precedes
    the timeframe gate in both `makeSecurityBar` and `makeSecurityExprSeries`,
    and that `makeSecurityExprSeries` takes `isDifferentSymbol`.
22. Host CLAUDE.md files: only if an invariant changes. The sidecar invariant
    already covers `requestedFeeds` (the whole manifest is spread); add a
    one-clause note that the same spread carries `requestedFeeds` and the
    composite `streamKey` routes unchanged (append to the existing
    `__manifest` sidecar bullet).

### H. Changeset

23. Extend `.changeset/multi-symbol-security.md` (already staged, lists
    runtime/host-worker/host-quickjs/adapter-kit minor). Add `cli` patch IF
    `templates.ts` changes a published `src/` (it does — `multiSymbol` in the
    scaffold). Verify the front-matter package list; append a sentence about
    the `multi-symbol-not-supported` fallback if the body doesn't already.

## Files table

| File | Action |
|------|--------|
| `packages/adapter-kit/src/types.ts` | Modify — append `multi-symbol-not-supported` to `DiagnosticCode`. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify — append to `VALID_DIAGNOSTIC_CODES`. |
| `packages/adapter-kit/src/types.types.test.ts` | Modify — add to `ExpectedCodes`. |
| `packages/runtime/src/request/security.ts` | Modify — code unions + `multiSymbol` gate (data + expr); `isDifferentSymbol` param. |
| `packages/runtime/src/request/requestNamespace.ts` | Modify — pass `symbol !== undefined` to expr form. |
| `packages/runtime/src/request/requestNamespace.test.ts` | Modify — `multiSymbol` cap; gate-order tests; update per-feed dedup expectation. |
| `packages/runtime/src/request/securityExprRunner.test.ts` | Modify — fix stale `byInterval`→`byFeed`, add `symbol`, new arg, `multiSymbol` cap, gate test. |
| `apps/site/src/components/demo/secondaryStreams.ts` | Modify — `feedKey`-built `streamKey`; second-symbol synthetic producer. |
| `apps/site/src/components/demo/secondaryStreams.test.ts` (verify path) | Create/Modify — `feedKey` streamKey + second-symbol stream. |
| `packages/cli/src/adapterTemplate/templates.ts` | Modify — `capabilities.multiSymbol(true)` + composite `streamKey` comment. |
| `packages/cli/src/commands/scaffoldAdapter.test.ts` / `e2e.test.ts` | Modify (if a golden of `INDEX_TS` pins capabilities). |
| `packages/host-worker/src/integration.test.ts` | Modify — `multiSymbol` cap + two-symbol test. |
| `packages/host-quickjs/src/integration.test.ts` (or dispatcherCore.test.ts) | Modify — same two-symbol test. |
| `packages/runtime/CLAUDE.md`, `packages/runtime/src/request/CLAUDE.md` | Modify — gate order + new code. |
| `packages/host-worker/CLAUDE.md`, `packages/host-quickjs/CLAUDE.md` | Modify — sidecar carries `requestedFeeds` note (one clause). |
| `.changeset/multi-symbol-security.md` | Modify — cli patch; fallback note. |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm -F @invinite-org/chartlang-runtime test` (incl. coverage — every new
  branch in `security.ts` must be hit: different-symbol×{cap true,false},
  expr-form gate, the combined symbol+interval case)
- `pnpm -F @invinite-org/chartlang-host-worker test`,
  `pnpm -F @invinite-org/chartlang-host-quickjs test` (do NOT break
  `sandbox.test.ts` in either)
- `pnpm -F @invinite-org/chartlang-cli test`
- `pnpm docs:check`
- Build core/adapter-kit/runtime first if a missing-export error appears.

## Changeset

`.changeset/multi-symbol-security.md` — ensure runtime / host-worker /
host-quickjs / adapter-kit minor; add cli patch (templates.ts published src).

## Acceptance criteria

- Different-symbol request vs `multiSymbol:false` → all-NaN + one deduped
  `multi-symbol-not-supported` (DATA and EXPRESSION forms).
- Chart-symbol request (omitted / chart ticker) vs `multiSymbol:false` →
  unaffected, still `multiTimeframe`-gated, byte-identical.
- Gate order: symbol → timeframe → unsupported-interval → unknown-stream;
  symbol+interval-both-different trips ONE `multi-symbol-not-supported`.
- Per-feed dedup keys on the composite `feedKey` (SPY-unsupported and
  QQQ-unsupported each warn once).
- Demo producer tags `streamKey` via `feedKey`; second-symbol synthetic stream
  available; single-symbol wire byte-identical.
- CLI scaffold advertises `multiSymbol`.
- Both hosts load a two-symbol script; series finite + distinct; sidecar with
  `requestedFeeds` but no `securityExpressions` still mounts.
- `securityExprRunner.test.ts` migrated + green; runtime/adapter-kit/host/cli
  tests + `docs:check` green; CLAUDE.md updated.

## What Task 6 (conformance) must know

- New diagnostic code `multi-symbol-not-supported`; message is exactly
  `Adapter declares multiSymbol: false; request.security for a different symbol returns NaN`.
- Gate order (symbol precedes timeframe); a both-different request emits ONE
  symbol diagnostic.
- The composite `streamKey` an adapter must produce for a different symbol is
  `feedKey(symbol, interval)` === `"<symbol>@<interval>"`; omitted/chart-symbol
  collapses to the bare interval.
- `mockCandleSource({ symbol })` (adapter-kit) already tags via `feedKey`.
