# Multi-symbol `request.security`

## Overview

Widen `request.security` from a **timeframe-only** secondary read to a
**symbol + timeframe** read — the way Pine's
`request.security("NASDAQ:AAPL", "1D", close)` works. Today the opts object
is `{ interval: string }` only; the requested symbol is implicitly always
the chart's own symbol, and the runtime keys every secondary stream by
interval alone. After this work an author can write:

```ts
// SPY priced in QQQ — a ratio against a DIFFERENT symbol
const spy = request.security({ symbol: "AMEX:SPY", interval: "1D" });
const qqq = request.security({ symbol: "NASDAQ:QQQ", interval: "1D" });
plot(spy.close / qqq.close, { title: "SPY/QQQ" });

// weekly EMA(20) of a different symbol — expression form on the HTF clock
const trend = request.security(
    { symbol: "NASDAQ:AAPL", interval: "1W" },
    (bar) => ta.ema(bar.close, 20),
);
plot(trend, { title: "AAPL weekly EMA(20)" });
```

`symbol` is **optional** — omitting it (`{ interval: "1D" }`) keeps the
existing meaning (the chart's own symbol at a higher timeframe), so every
script written before this change compiles and runs byte-identically.

The load-bearing idea is that the **secondary-stream identity widens from
`interval` to a composite `(symbol, interval)` key** and that composite must
flow in lockstep through five layers that today all assume "interval is the
key":

```
core manifest  →  compiler extraction  →  runtime stream-map + cache keys  →  host CandleEvent.streamKey wire
```

This is the direct sibling of the just-landed HTF **expression** form
(`tasks/old/htf-security-expression/`): that work added a second *arity*
(the callback) on the HTF clock; this work adds a second *dimension* (the
symbol) to the secondary-stream identity. Both forms — data and expression —
inherit multi-symbol for free once the key is composite, because the
expression runner already clocks off the secondary stream that the data form
registers.

### Why an additive `requestedFeeds`, not a reshaped `requestedIntervals`

`manifest.requestedIntervals: ReadonlyArray<string>`
(`packages/core/src/types.ts:454`) is the wire the runtime uses to create
secondary streams (`createSecondaryStreams`,
`packages/runtime/src/createScriptRunner.ts:206`). Changing its **shape** to
`{symbol, interval}[]` would force an `apiVersion: 2` bump
(`packages/core/CLAUDE.md`: the manifest is additive within `apiVersion: 1`;
reshaping an existing field is not additive). Instead we **add** a new
`requestedFeeds: {symbol?, interval}[]` field and keep `requestedIntervals`
meaning exactly what it means today — the set of higher-timeframe intervals
requested for the **main symbol** — for back-compat. `requestedFeeds` is the
superset; `requestedIntervals` stays the main-symbol projection. Absent on
scripts with no `request.security` so existing manifest snapshots stay
byte-identical (mirrors how `securityExpressions?` and `plots?` are omitted).

### Why a new `multiSymbol` capability

`Capabilities.multiTimeframe` (`packages/adapter-kit/src/types.ts:304`)
already gates the timeframe-only feature: a non-supporting adapter degrades
`request.security` to all-NaN. A different symbol is a strictly larger ask (a
chart adapter that can resample its own symbol to a higher timeframe cannot
necessarily fetch *another instrument*), so it needs its own gate. We add a
new `multiSymbol: boolean` capability; a script that requests a non-chart
symbol against an adapter advertising `multiSymbol: false` degrades to NaN
with a new `multi-symbol-not-supported` diagnostic, exactly as
`multi-timeframe-not-supported` does today
(`packages/runtime/src/request/security.ts:208`). A request that omits
`symbol` (chart symbol) is gated only by `multiTimeframe`, unchanged.

### Provenance

Pine-parity. The original timeframe-only feature was specced in
`tasks/old/htf-security-expression/` (the expression overload) and the
preceding data-form MTF work; this completes the `request.security`
signature toward Pine's `request.security(symbol, timeframe, expression)`
three-argument shape. The chartlang opts-object spelling
(`{ symbol, interval }`) is chartlang-native; the *capability* is the
Pine-parity one. No `../invinite/` port.

References: root `CLAUDE.md` (skills-mirror + per-folder-CLAUDE rules),
`packages/core/CLAUDE.md` (`request.security` overload, `STATEFUL_PRIMITIVES`
additive rule, three-place `SecurityExpr` export lockstep),
`packages/compiler/CLAUDE.md` (callsite-id format is load-bearing,
`request.security` two-arity analysis, overloaded shim = `interface`),
`packages/runtime/CLAUDE.md` (NaN fallback, secondary-stream + expr-runner
invariants, `streamKey` routing), `packages/runtime/src/request/CLAUDE.md`
(alignment kernels), `packages/adapter-kit/src/types.ts` (`CandleEvent`,
`Capabilities`), `packages/pine-converter/src/transform/requestSecurity.ts`
(`request-security-different-symbol` becomes a real mapping).

## Current State

- **Core** (`packages/core/src/request/request.ts`):
  `RequestSecurityOpts` (line 17) is `Readonly<{ interval: string }>` —
  **no `symbol` field**. The two overloads (line 129–133) take that opts
  type. `SecurityBar` (line 53) **already carries a
  `symbol: Series<string>` field** (line 64) reflecting whatever symbol the
  host fed — so the *return* shape is already symbol-aware; only the
  *request* is not. `SecurityExpr` (line 88). `request.security` is one
  `{ name: "request.security", slot: true }` registry entry
  (`statefulPrimitives.ts`); the slot id is injected first regardless of
  arity. `SecurityExpr` / `RequestSecurityOpts` / `SecurityBar` are exported
  from three places in lockstep (`request/request.ts`, `request/index.ts`,
  `src/index.ts`).
- **Manifest** (`packages/core/src/types.ts`):
  `requestedIntervals: ReadonlyArray<string>` (line 454) on
  `ScriptManifest`; `SecurityExpressionDescriptor { slotId, interval,
  paramName }` (line 396) with **no symbol**; `securityExpressions?`
  (line 612). `apiVersion: 1` literal (line 449).
- **Compiler** (`packages/compiler/src/analysis/extractRequestedIntervals.ts`):
  `readRequestInterval` (line 186) reads **only** `interval` (string-literal
  → `intervals.add`, or `inputs.<enum>` expansion at line 208, else
  `request-security-interval-not-literal`). `readLiteralInterval` (line 175)
  reads only the literal `interval` for the expression descriptor.
  `readSecurityExpression` (line 135) builds the descriptor with `{ slotId,
  interval, paramName }` — no symbol. `validateSecurityExpr.ts:30` restricts
  the callback's free identifiers. Slot ids minted by `callsiteIdFor`
  (`callsiteIdInjection.ts`). Diagnostic codes live in
  `packages/compiler/src/diagnostics.ts`
  (`request-security-interval-not-literal` line 30).
- **Runtime**:
  - `createScriptRunner.ts`: `createSecondaryStreams` (line 206) iterates
    `manifest.requestedIntervals` and keys `Map<string, StreamState>` by
    **interval**, constructing each stream with `symbol: ""` hardcoded
    (line 213). `pushSecondaryEvent` (line 244) routes
    `CandleEvent.streamKey` → `ctx.secondaryStreams.get(streamKey)`.
  - `request/security.ts`: `makeSecurityBar` (line 199) keys the cache
    `${slotId}|${interval}` (line 204), gates on
    `ctx.capabilities.multiTimeframe` (line 208), then looks up
    `ctx.secondaryStreams.get(interval)` (line 231). `SecurityBar.symbol` is
    a const series of `secondary.bar.symbol` (line 170).
  - `runtimeContext.ts`: `secondaryStreams: Map<string, StreamState>` keyed
    by `IntervalDescriptor.value` (line 168); `requestSecurityBars` keyed
    `slotId|interval` (line 178); `requestSecurityAlignments` keyed
    `slotId|interval|sourceKey` (line 185).
  - `request/securityExprRunner.ts`: each runner is keyed by `slotId` +
    indexed per **interval** (`securityExprRunnersByInterval`); fold stream
    clocked on the interval. `streamState.ts` `StreamState.symbol`
    (line 103/227).
- **Adapter wire** (`packages/adapter-kit/src/types.ts`):
  `CandleEvent` (line 33) carries `streamKey?: string` on each variant
  (lines 43/54/65), documented "set to a requested interval value such as
  `"1D"`". `Capabilities.multiTimeframe` (line 304) — **no `multiSymbol`**.
  `Adapter.candles({ interval })` (line 833). Demo producer
  (`apps/site/src/components/demo/secondaryStreams.ts:160`) tags
  `streamKey: interval`.
- **Pine converter**
  (`packages/pine-converter/src/transform/requestSecurity.ts`): a non-chart
  symbol (anything but `syminfo.tickerid`, line 152) currently pushes
  `request-security-different-symbol`
  (`diagnostics/codes.ts:540`) — i.e. multi-symbol Pine is **un-mappable**
  today. `pineTimeframeToInterval` already maps the timeframe.
- **Input source** (`packages/core/src/input/input.ts`): `input.symbol`
  (line 192) returns a `SymbolDescriptor` — the candidate dynamic-symbol
  source. `input.externalSeries` (`input/inputDescriptor.ts:42`) is a
  **type-only stub** ("Phase 4 ships the type only"), **not** reusable as an
  OHLCV symbol feed.

## Target State

- `request.security({ symbol?, interval }, expr?)` accepts an optional
  `symbol`. Both forms (data + expression) carry it. Omitting `symbol`
  defaults to the chart symbol (back-compat). `symbol` must be a
  compile-time literal — a string literal, an `input.symbol` default, or an
  `input.enum` value — mirroring exactly how `interval` is constrained.
- The compiler emits an additive `manifest.requestedFeeds:
  ReadonlyArray<{ symbol?: string; interval: string }>` (one per distinct
  requested feed; symbol omitted ⇒ chart symbol). `requestedIntervals` is
  retained as the **main-symbol** HTF projection (its existing meaning), so
  `apiVersion` stays `1`. `SecurityExpressionDescriptor` gains an optional
  `symbol?`. A non-literal symbol emits the new
  `request-security-symbol-not-literal` diagnostic and is excluded.
- The runtime keys `secondaryStreams`, `requestSecurityBars`,
  `requestSecurityAlignments`, and the expr-runner indices by a **composite
  `(symbol, interval)` key** built by a single shared `feedKey(symbol,
  interval)` helper (the byte-for-byte format both runtime and host must
  agree on, exactly like slot ids). A request that omits `symbol` resolves
  to the chart symbol before keying, so the back-compat path is
  byte-identical.
- The host wire `CandleEvent.streamKey` carries that same composite feed
  key. A reference adapter and the demo producer build it through the shared
  helper so producer and consumer never drift.
- A new `Capabilities.multiSymbol: boolean` gates non-chart-symbol requests;
  `multiSymbol: false` degrades a different-symbol request to all-NaN with a
  new `multi-symbol-not-supported` diagnostic. Chart-symbol requests stay
  gated only by `multiTimeframe`.
- A conformance scenario (a two-symbol ratio indicator) + golden proves the
  composite key end-to-end; capability-false scenarios prove both NaN
  fallbacks.
- Docs (`multi-timeframe.md` + the `request.security` primitive page), the
  pine-converter mapping (different-symbol Pine now lowers), the
  chartlang-coding skill (`translating-from-pine.md` + regenerated
  `primitives.md`), and an example script all show the feature.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Additive `manifest.requestedFeeds: {symbol?, interval}[]`; keep `requestedIntervals` as the main-symbol HTF projection.** | Reshaping `requestedIntervals` to `{symbol, interval}[]` is **not** additive and forces `apiVersion: 2` (`core/CLAUDE.md`). Adding a sibling field is additive; `requestedIntervals` keeps its meaning so every existing manifest snapshot, host, and runner path is byte-identical. Omitted on no-`request.security` scripts. |
| **Composite key via a single shared `feedKey(symbol, interval)` helper.** | The secondary-stream identity is now two-dimensional and the **same string must be produced on both sides of the host wire** (`CandleEvent.streamKey`) and used for every runtime map/cache — this is the exact "load-bearing format, must match byte-for-byte" concern that slot ids have (`compiler/CLAUDE.md`). Centralising the format in one helper (consumed by runtime keying AND the reference adapter/demo producer) is the only safe way to keep them aligned. Never re-derive the key inline. |
| **`symbol` optional, defaults to chart symbol; chart-symbol requests stay on the `multiTimeframe` gate.** | Back-compat: an omitted `symbol` must produce a byte-identical wire + key + manifest to the pre-feature baseline, so existing scripts and goldens don't move. Only a *different* symbol is the new, larger ask. |
| **New `multiSymbol` capability, separate from `multiTimeframe`.** | Fetching another instrument is strictly harder than resampling the chart's own symbol to a higher timeframe — an adapter can support one without the other. A separate gate lets adapters advertise precisely; a different-symbol request against `multiSymbol: false` degrades to NaN (mirrors `multiTimeframe`). |
| **HARDEST: literal-symbol-only vs `input.symbol`/`input.enum` (dynamic at mount). Decision: support BOTH a string literal AND `input.symbol`/`input.enum`-resolved symbols — mirror interval handling exactly.** | A symbol fixed only at *mount* (`input.symbol`) cannot be pre-enumerated into `requestedFeeds` at compile time — the *exact same* problem `interval` already has with `input.enum`, which the compiler solves by expanding all enum options (`extractRequestedIntervals.ts:208`). We resolve `input.symbol`'s **default** literal and `input.enum`'s **options** into `requestedFeeds`, just as `interval` does. A symbol expression that is genuinely dynamic (anything else) emits `request-security-symbol-not-literal` and is excluded — identical to `request-security-interval-not-literal`. This keeps symbol and interval on one consistent rule rather than inventing a second, stricter one for symbols. The mount-time re-resolution of `input.symbol` to a concrete ticker is the host's job (it already resolves inputs), and the runtime keys on the resolved symbol fed via `streamKey`. |
| **`SecurityBar.symbol` is already a series — reuse it, don't add a field.** | The return shape was always symbol-aware (`request/request.ts:64`, fed from `secondary.bar.symbol` at `security.ts:170`). Only the *request* opts and the *stream identity* change. |
| **Do NOT reuse `input.externalSeries` as a symbol feed.** | It is an explicit type-only stub ("Phase 4 ships the type only", `inputDescriptor.ts:42`) with no runtime; the OHLCV symbol feed is the secondary `StreamState` mechanism, not an external-series input. |

## Dependency Graph

```
Task 1 (spec/manifest contract + core opts type + feedKey helper)
  |
  v
Task 2 (compiler: extract symbol into requestedFeeds + literal validation + new diagnostic)
  |
  v
Task 3 (runtime: composite-key streams, caches, expr-runner indices)
  |
  +--> Task 4 (adapter-kit: streamKey composite + multiSymbol capability)
  |        |
  |        v
  |     Task 5 (host / reference-adapter wiring + multi-symbol NaN fallback)
  |        |
  v        v
Task 6 (conformance: two-symbol ratio scenario + golden + capability-false)
  |
  v
Task 7 (docs + pine-converter mapping + skills + example)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Spec + manifest `requestedFeeds` + core opts `symbol` + `feedKey`](./1-spec-manifest-and-core-opts.md) | core | None | Medium |
| 2 | [Compiler: extract symbol into feeds + literal validation](./2-compiler-extraction-and-validation.md) | compiler | 1 | High |
| 3 | [Runtime: composite `(symbol, interval)` keys](./3-runtime-composite-key.md) | runtime | 1, 2 | High |
| 4 | [Adapter-kit: `streamKey` composite + `multiSymbol` capability](./4-adapter-kit-wire-and-capability.md) | adapter-kit | 1 | Medium |
| 5 | [Host / reference-adapter wiring + multi-symbol NaN fallback](./5-host-and-nan-fallback.md) | runtime, host-worker, host-quickjs, adapter-kit | 3, 4 | Medium |
| 6 | [Conformance: two-symbol ratio scenario + golden](./6-conformance-multi-symbol.md) | conformance | 3, 4, 5 | Medium |
| 7 | [Docs + pine-converter mapping + skills + example](./7-docs-converter-skills-example.md) | docs, pine-converter, skills, examples, apps/site | 1–6 | High |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `RequestSecurityOpts` | `packages/core/src/request/request.ts:17` | Add optional `symbol`. |
| `SecurityBar.symbol` series | `packages/core/src/request/request.ts:64` | Already symbol-aware return field — reuse, do not add. |
| `SecurityExpressionDescriptor` | `packages/core/src/types.ts:396` | Add optional `symbol?`. |
| `requestedIntervals` projection | `packages/core/src/types.ts:454` | Keep as main-symbol HTF list; `requestedFeeds` is the superset. |
| `readRequestInterval` / `readLiteralInterval` / `getInputsEnumOptions` | `packages/compiler/src/analysis/extractRequestedIntervals.ts:186/175/229` | Extend to also read `symbol` (literal / `input.symbol` / `input.enum`). |
| `validateSecurityExpr` | `packages/compiler/src/analysis/validateSecurityExpr.ts:30` | Unchanged (capture check); symbol literal is in opts, not the callback body. |
| `callsiteIdFor` | `packages/compiler/src/transformers/callsiteIdInjection.ts` | Slot id minting — unchanged; the key adds symbol, not callsite identity. |
| `createSecondaryStreams` | `packages/runtime/src/createScriptRunner.ts:206` | Iterate `requestedFeeds`; key by `feedKey`. |
| `makeSecurityBar` + `fallbackNaN` + `pushOnce` | `packages/runtime/src/request/security.ts:199/175` | Key by `feedKey`; add `multiSymbol` gate. |
| `securityExprRunner` + `driveSecurityExpressions` | `packages/runtime/src/request/securityExprRunner.ts` | Index by `feedKey` instead of interval. |
| `CandleEvent.streamKey` | `packages/adapter-kit/src/types.ts:43/54/65` | Re-document as composite feed key. |
| `Capabilities.multiTimeframe` | `packages/adapter-kit/src/types.ts:304` | Sibling `multiSymbol`. |
| Demo secondary producer | `apps/site/src/components/demo/secondaryStreams.ts:160` | Tag `streamKey` via `feedKey`. |
| MTF conformance fixtures + scenarios | `packages/conformance/src/scenarios/mtfFixtures.ts`, `mtfRequestSecurityClose.scenario.ts`, `mtfCapabilityFalse.scenario.ts` | Scenario shape + golden harness to mirror for the two-symbol case. |
| `requestSecurity.ts` converter | `packages/pine-converter/src/transform/requestSecurity.ts:152` | `request-security-different-symbol` becomes a real mapping. |
| `pineTimeframeToInterval` | `packages/pine-converter/src/transform/timeframeConvert.ts` | Existing tf mapper — add the symbol slot to the emitted opts. |
| `gen-examples-docs.ts` / `generate-skills-reference.ts` / `DEMO_SCRIPTS` | `scripts/`, `apps/site/src/components/demo/scripts.ts` | Generated docs + skills + demo. |

## Provenance

Pine-parity feature (Pine `request.security(symbol, timeframe, expression)`),
completing the `request.security` signature begun in
`tasks/old/htf-security-expression/` (the HTF **expression** overload) and the
preceding data-form MTF work. The opts-object spelling (`{ symbol, interval }`)
is chartlang-native; the multi-symbol *capability* is the Pine-parity element.
No `../invinite/` port. Reference `tasks/old/htf-security-expression/README.md`
for the original HTF precedent — this work reuses its secondary-stream and
expr-runner machinery wholesale, only widening the key.

## Deferred / Follow-Up Work

- **Truly dynamic mount-time symbols beyond `input.symbol`/`input.enum`**
  (e.g. a symbol computed in `compute`) — same open question as dynamic
  intervals; out of scope, emits `request-security-symbol-not-literal`.
- **Per-feed `request.lowerTf` symbol** — `request.lowerTf` stays
  chart-symbol-only in this batch; widening it is a follow-up.
- **Cross-symbol session / calendar alignment edge cases** (a symbol that
  trades a different session than the chart) — v1 aligns on timestamp
  no-lookahead exactly like the same-symbol HTF path; session-aware
  alignment is deferred.
- **`syminfo.*` enrichment for the requested symbol** (currency, mintick of
  the *secondary* instrument) — the `SecurityBar.symbol` series carries the
  ticker string; richer per-feed `syminfo` is a follow-up.
