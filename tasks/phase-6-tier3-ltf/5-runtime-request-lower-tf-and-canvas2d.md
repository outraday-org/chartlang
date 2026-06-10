# Runtime: `request.lowerTf` wiring + canvas2d intervals + conformance

> **Status: TODO**

## Goal

Wire the runtime side of `request.lowerTf`: register LTF secondary
streams via the existing Phase-5 stream machinery, materialise the
returned `Series<ReadonlyArray<Bar>>` via the Task-3 bucketing kernel
+ cache, emit the runtime diagnostics
(`multi-timeframe-not-supported` / `unsupported-interval` /
`unknown-secondary-stream`) per callsite with the existing dedup
helper, widen the canvas2d adapter's declared `intervals` set to
include sub-minute intervals so conformance scenarios can run, and
land three LTF conformance scenarios that prove the round-trip.

## Prerequisites

- Task 3 completed (`bucketLtfBarsByMainContainment` +
  `bucketLtfBarsCache` available).
- Task 4 completed (`request.lowerTf` surface + compiler pass +
  `"lower-tf-not-lower"` diagnostic available).

## Current Behavior

`packages/runtime/src/request/security.ts` is the Phase-5 HTF
implementation. The runtime's `ComputeContext.request` namespace
exposes `security` only; `lowerTf` is the Task-4 stub that throws
outside a `ComputeContext`.

`packages/runtime/src/createScriptRunner.ts` maintains
`secondaryStreams: Map<string, StreamState>` keyed by interval, plus
three caches on `RuntimeContext`
(`requestSecurityBars: Map<string, SecurityBar>`,
`requestSecurityAlignments: Map<string, ReadonlyArray<number>>`,
`requestSecurityAscendingBars: Map<StreamState, ReadonlyArray<Bar>>`)
for the HTF aligned-series cache. Secondary stream events are routed
via `CandleEvent.streamKey`. Per-callsite diagnostic dedup uses a
private `pushOnce()` function inside
`packages/runtime/src/request/security.ts` keyed on
`diagnosticKey(code, slotId, interval)` — there is no public
`SeriesViewCache` helper today.

`examples/canvas2d-adapter/src/capabilities.ts` declares:

```ts
intervals: capabilities.intervals(["1m", "5m", "15m", "1H", "4H", "1D"])
```

No sub-minute intervals; conformance can't currently exercise the LTF
path against this adapter.

## Desired Behavior

`ComputeContext.request.lowerTf({ interval })` returns a stable
`Series<ReadonlyArray<Bar>>` for every callsite. Behaviour:

1. **Capability gated.** When `Capabilities.multiTimeframe === false`,
   emit `multi-timeframe-not-supported` (once per callsite) and
   return a `Series` whose values are empty arrays for every bar.
2. **Unsupported interval gated.** When the requested interval is
   not in `Capabilities.intervals`, emit `unsupported-interval`
   (once per callsite) and return the empty-arrays `Series`.
3. **Secondary stream unknown.** When the adapter doesn't deliver
   a stream for this interval, emit `unknown-secondary-stream`
   (once per callsite) and return the empty-arrays `Series`. Mirrors
   the Phase-5 path.
4. **Happy path.** Register the LTF stream key
   (the literal interval value) via the same machinery that
   `request.security` uses. On every main-bar `compute`, read the
   current `mainStream.bars` and the matching secondary stream's
   `streamState.bars`, run them through
   `bucketLtfBarsCache.getOrBucket(mainBars, ltfBars)`, and return
   the bucket array for the current main-bar index. The returned
   `Series` is identity-stable per callsite (reuses the secondary
   stream's `seriesViews` cache pattern — one Proxy per callsite).

The canvas2d adapter's `intervals` set widens to include `"30s"` and
`"15s"` so conformance can run sub-minute streams. The adapter does
not need to render sub-minute candles — the runtime path is what's
being exercised.

Three new conformance scenarios land:

- **`lowerTfHappyPath`** — 1m main, 30s LTF, simple script
  `plot(request.lowerTf({ interval: "30s" }).length)` over 100 bars.
  Pinned `plot-hash`.
- **`lowerTfCapabilityFalse`** — same script, capability flipped
  off. Asserts `diagnostic-code-present: "multi-timeframe-not-supported"`
  + plot values all zero.
- **`lowerTfUnsupportedInterval`** — script requests `"1s"` LTF
  (not in adapter's `intervals` set). Asserts
  `diagnostic-code-present: "unsupported-interval"`.

(The compile-time `lower-tf-not-lower` case is exercised in the
Task-4 compiler test, not a runtime conformance scenario — it never
reaches the runtime.)

## Requirements

### 1. Extract `pushOnce` to a sibling helper

`pushOnce` is currently a private function inside
`packages/runtime/src/request/security.ts`. Both the HTF
(`security.ts`) and LTF (`lowerTf.ts`) paths need it, so extract it
to `packages/runtime/src/request/pushOnce.ts`:

```ts
// packages/runtime/src/request/pushOnce.ts
import type { RuntimeContext } from "../runtimeContext.js";
import type { DiagnosticCode } from "@invinite-org/chartlang-adapter-kit";

/**
 * Emit a request-namespace diagnostic at most once per
 * (code, slotId, interval, kind) tuple. Mirrors the Phase-5 dedup
 * contract that lived inside `security.ts`.
 *
 * @since 0.6
 * @stable
 */
export function pushOnce(
  ctx: RuntimeContext,
  code: DiagnosticCode,
  slotId: string,
  interval: string,
  kind: "security" | "lowerTf",
  message: string,
): void {
  const key = `${code}|${slotId}|${interval}|${kind}`;
  if (ctx.diagnosedRequestKeys.has(key)) return;
  ctx.diagnosedRequestKeys.add(key);
  ctx.emissions.diagnostics.push({ code, message, severity: "error" });
}
```

Update `security.ts` to import `pushOnce` from this new sibling and
pass `"security"` for `kind`. The `kind` suffix in the dedup key
prevents LTF and HTF callsites with the same `(code, slotId,
interval)` from colliding.

### 2. New runtime module `packages/runtime/src/request/lowerTf.ts`

```ts
import type { Bar, Series } from "@invinite-org/chartlang-core";
import type { RuntimeContext } from "../runtimeContext.js";
import { getOrBucket } from "./bucketLtfBarsCache.js";
import { pushOnce } from "./pushOnce.js";

const EMPTY_BUCKET: ReadonlyArray<Bar> = Object.freeze([]);

export function createLowerTfImpl(ctx: RuntimeContext) {
  return (
    opts: { readonly interval: string },
    callsiteSlotId: string,
  ): Series<ReadonlyArray<Bar>> => {
    const cached = ctx.requestLowerTfViews.get(callsiteSlotId);
    if (cached !== undefined) return cached;
    // Build a Series<ReadonlyArray<Bar>> Proxy whose .at(i) reads:
    // - EMPTY_BUCKET if capability disabled / interval unsupported /
    //   stream unknown (with the matching dedup diagnostic emitted
    //   once via pushOnce(..., "lowerTf", ...)).
    // - else: getOrBucket(mainBars, ltfBars)[i]
    const view = /* build proxy */ ...;
    ctx.requestLowerTfViews.set(callsiteSlotId, view);
    return view;
  };
}
```

The Proxy returns `EMPTY_BUCKET` for any disabled path. The Series
wrapper uses the same `Series<T>` infra as the rest of core.

The implementation lives alongside `security.ts` — sibling pure
functions, no shared mutable state apart from
`ctx.requestLowerTfViews`. There is no `SeriesViewCache` helper to
reuse; the LTF identity cache is a plain `Map<string,
Series<ReadonlyArray<Bar>>>` keyed by callsite slot id, mirroring the
Phase-5 `requestSecurityBars: Map<string, SecurityBar>` pattern.

### 3. Extend `RuntimeContext`

`packages/runtime/src/runtimeContext.ts`:

```ts
export type RuntimeContext = {
  ...existing fields...
  readonly requestLowerTfViews: Map<string, Series<ReadonlyArray<Bar>>>;
};
```

Mirrors the Phase-5 pattern of one `Map` per request-namespace cache
(`requestSecurityBars`, `requestSecurityAlignments`,
`requestSecurityAscendingBars`). Key is the callsite slot id; value
is the identity-stable `Series` Proxy. Initialise to an empty `Map`
in `createScriptRunner.ts` alongside the existing
`requestSecurityBars` initialisation.

### 4. Wire `request.lowerTf` into `ComputeContext.request`

`packages/runtime/src/buildComputeContext.ts`:

```ts
const requestNamespace = Object.freeze({
  security: securityImpl,
  lowerTf: lowerTfImpl,
});
```

The slot id for the callsite comes from the compiler's
slot-injection pass (Phase 4) — the same mechanism that gives
`request.security` a stable id.

### 5. Secondary stream registration

`createScriptRunner.ts`:

- When building `secondaryStreams` from `manifest.requestedIntervals`,
  register one `StreamState` per interval (the existing path already
  iterates `requestedIntervals`).
- The LTF intervals collected by Task 4's extended
  `extractRequestedIntervals` flow through this loop unchanged — no
  new branch.
- Routing `CandleEvent.streamKey === <interval>` to the right
  `streamState.bars` ring buffer is the existing Phase-5 path.

If any extra registration step is needed (e.g. distinguishing LTF
from HTF for scope tracking), add it here. Likely none — the runtime
treats every secondary stream uniformly.

### 6. Diagnostic dedup

Reuse `packages/runtime/src/request/pushOnce.ts` (extracted in §1
above). Dedup key for LTF callsites:
`${code}|${callsiteSlotId}|${interval}|lowerTf` — the `lowerTf`
suffix ensures LTF and HTF callsites with the same interval don't
collide. The Phase-5 `security.ts` callsites pass `"security"` for
the `kind` argument; the new LTF impl passes `"lowerTf"`.

### 7. Widen canvas2d intervals

`examples/canvas2d-adapter/src/capabilities.ts` — extend the existing
`CANVAS2D_INTERVALS` tuple (which currently lists `1m`, `5m`, `15m`,
`1h`, `1D`, `1W` per `examples/canvas2d-adapter/src/capabilities.ts:13–20`)
with two sub-minute entries:

```ts
const CANVAS2D_INTERVALS = [
  { value: "15s", label: "15 seconds", group: "second" },
  { value: "30s", label: "30 seconds", group: "second" },
  { value: "1m", label: "1 minute", group: "minute" },
  { value: "5m", label: "5 minutes", group: "minute" },
  { value: "15m", label: "15 minutes", group: "minute" },
  { value: "1h", label: "1 hour", group: "hour" },
  { value: "1D", label: "1 day", group: "daily" },
  { value: "1W", label: "1 week", group: "weekly" },
] as const;
```

Preserve the lowercase `"1h"` to avoid breaking Phase-5 manifests
(Task 1 widens `intervalToSeconds` to accept both `"H"` and `"h"`).
The hour entry is unchanged; only the two sub-minute entries are
added. The spread syntax
`...capabilities.intervals(CANVAS2D_INTERVALS)` in the
`CANVAS2D_CAPABILITIES` literal needs no further change.

The adapter's bundled demo doesn't deliver `"15s"` / `"30s"` for
production — conformance scenarios provide their own synthetic
streams via `Scenario.secondaryCandles` (typed
`Readonly<Record<string, ReadonlyArray<Bar>>>`, keyed by interval).

If the adapter's demo UI exposes an interval picker, document that
`"15s"` and `"30s"` are conformance-only (or add them to a "hidden"
allowlist).

### 8. Conformance scenarios

`packages/conformance/src/scenarios/lowerTfHappyPath.scenario.ts`:

```ts
import { defineScenario } from "../defineScenario.js";

export default defineScenario({
  id: "lower-tf-happy-path",
  title: "request.lowerTf returns bucketed LTF bars",
  inlineSource: /* ts */ `
    import { defineIndicator, plot, request } from "@invinite-org/chartlang-core";
    export default defineIndicator({
      id: "ltf-happy",
      version: "1.0.0",
      compute(ctx) {
        const bucket = request.lowerTf({ interval: "30s" });
        plot(bucket.at(0).length, { id: "count" });
      },
    });
  `,
  intervalCount: 100, // 100 main bars at 1m
  // Scenario.secondaryCandles is Readonly<Record<string,
  // ReadonlyArray<Bar>>>, keyed by interval value. The "30s" key
  // matches the literal interval string in the script.
  secondaryCandles: { "30s": /* synthetic ReadonlyArray<Bar> covering same window */ },
  assertions: [
    { kind: "plot-hash", id: "count", sha256: "<pinned>" },
    { kind: "diagnostic-code-absent", code: "multi-timeframe-not-supported" },
    { kind: "diagnostic-code-absent", code: "unsupported-interval" },
    { kind: "diagnostic-code-absent", code: "unknown-secondary-stream" },
  ],
});
```

`packages/conformance/src/scenarios/lowerTfCapabilityFalse.scenario.ts`:

```ts
export default defineScenario({
  id: "lower-tf-capability-false",
  title: "request.lowerTf emits diagnostic + zero plot when multiTimeframe: false",
  inlineSource: /* same script as happy path */,
  intervalCount: 50,
  capabilitiesOverride: { multiTimeframe: false },
  assertions: [
    { kind: "diagnostic-code-present", code: "multi-timeframe-not-supported" },
    { kind: "plot-hash", id: "count", sha256: "<pinned all-zeros>" },
  ],
});
```

`packages/conformance/src/scenarios/lowerTfUnsupportedInterval.scenario.ts`:

```ts
export default defineScenario({
  id: "lower-tf-unsupported-interval",
  title: "request.lowerTf for unsupported interval emits diagnostic",
  inlineSource: /* script with interval: "1s" — not in canvas2d's set */,
  intervalCount: 50,
  assertions: [
    { kind: "diagnostic-code-present", code: "unsupported-interval" },
  ],
});
```

All three scenarios register in `packages/conformance/src/scenarios/index.ts`.

### 9. Runtime tests

- `packages/runtime/src/request/lowerTf.test.ts`:
  - Happy path returns identity-stable `Series` per callsite.
  - Capability disabled → all buckets `EMPTY_BUCKET` + diagnostic
    emitted once.
  - Unsupported interval → all buckets `EMPTY_BUCKET` + diagnostic.
  - Unknown secondary stream → all buckets `EMPTY_BUCKET` +
    diagnostic.
  - Two callsites with same interval → distinct Series identity,
    each with own dedup.
- `packages/runtime/src/request/pushOnce.test.ts`:
  - Same `(code, slotId, interval, kind)` → diagnostic emitted once.
  - Different `kind` (e.g. `"security"` vs `"lowerTf"`) → diagnostic
    emitted twice (no collision across request shapes).

### 10. Snapshot determinism

Phase 5 shipped a warm-start determinism conformance scenario. Add
`lowerTfHappyPath` to the warm-start matrix (snapshot at bar 50 of
100, cold-load + replay from bar 51, assert byte-identical
emissions). Mirrors the Phase-5 pattern; the bucketing kernel is pure
and the Task-3 cache's length-check defence guards against silent
buffer-reuse drift during snapshot restore — reproducibility is
guaranteed.

### 11. JSDoc + docs gate

`request.lowerTf`'s public-facing JSDoc carries `@since 0.6`,
`@stable`, and a compiling `@example`. `pnpm docs:check` regenerates
`docs/primitives/request/lowerTf.md`.

### 12. READMEs + CLAUDE.md

- `packages/runtime/README.md` — bullet for `request.lowerTf`. ≤ 100
  lines.
- `examples/canvas2d-adapter/README.md` — note the widened intervals
  list. ≤ 100 lines.
- `packages/conformance/README.md` — add the three new scenarios to
  the surface table. ≤ 100 lines.
- `packages/runtime/src/request/CLAUDE.md` — Task 3 created the file;
  this task appends a paragraph on the LTF runtime path alongside the
  Phase-5 HTF runtime path.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/request/pushOnce.ts` | Create | Extract Phase-5 private `pushOnce` from `security.ts`; add `kind` arg. |
| `packages/runtime/src/request/pushOnce.test.ts` | Create | Dedup-key + cross-kind tests. |
| `packages/runtime/src/request/security.ts` | Modify | Import `pushOnce` from sibling; pass `"security"` for `kind`. |
| `packages/runtime/src/request/lowerTf.ts` | Create | Runtime impl for `request.lowerTf`. |
| `packages/runtime/src/request/lowerTf.test.ts` | Create | Unit cases (happy + 3 disabled paths + identity stability). |
| `packages/runtime/src/runtimeContext.ts` | Modify | Add `requestLowerTfViews: Map<string, Series<ReadonlyArray<Bar>>>` field. |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Wire `request.lowerTf` into the namespace. |
| `packages/runtime/src/createScriptRunner.ts` | Modify | Initialise `requestLowerTfViews` Map; verify LTF intervals flow through existing secondary-stream loop. |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | Prepend `"15s"` + `"30s"` to `CANVAS2D_INTERVALS` tuple; preserve existing lowercase `"1h"`. |
| `examples/canvas2d-adapter/README.md` | Modify | Note widened intervals. |
| `packages/conformance/src/scenarios/lowerTfHappyPath.scenario.ts` | Create | Conformance scenario (happy path). |
| `packages/conformance/src/scenarios/lowerTfCapabilityFalse.scenario.ts` | Create | Conformance scenario (cap off). |
| `packages/conformance/src/scenarios/lowerTfUnsupportedInterval.scenario.ts` | Create | Conformance scenario (interval). |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register the three scenarios. |
| `packages/runtime/src/request/CLAUDE.md` | Modify | Append LTF runtime-path paragraph (Task 3 created the file). |
| `packages/runtime/README.md` | Modify | Surface bullet. |
| `packages/conformance/README.md` | Modify | Scenario list update. |
| `.changeset/phase6-runtime-lower-tf.md` | Create | Minor bumps on `chartlang-runtime`, `chartlang-canvas2d-adapter`, `chartlang-conformance`. |

## Gates

- `pnpm typecheck`.
- `pnpm lint`.
- `pnpm test` — 100% coverage on touched runtime files.
- `pnpm conformance` — the three new scenarios pass.
- `pnpm docs:check`.
- `pnpm readme:check`.

## Changeset

`.changeset/phase6-runtime-lower-tf.md`:

```md
---
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Wire `request.lowerTf` runtime path: register LTF secondary
streams via the existing Phase-5 secondary-stream machinery,
materialise `Series<ReadonlyArray<Bar>>` via the
`bucketLtfBarsByMainContainment` kernel, emit
`multi-timeframe-not-supported` / `unsupported-interval` /
`unknown-secondary-stream` per callsite. Canvas2d adapter widens
`intervals` to include sub-minute streams so conformance can run.
Three new conformance scenarios cover the happy path, capability
disabled, and unsupported interval cases.
```

## Acceptance Criteria

- [ ] `pushOnce` extracted to `packages/runtime/src/request/pushOnce.ts`
      with `kind: "security" | "lowerTf"` arg; `security.ts` imports
      it and passes `"security"`.
- [ ] `request.lowerTf` runtime impl ships in
      `packages/runtime/src/request/lowerTf.ts` with full JSDoc.
- [ ] `RuntimeContext.requestLowerTfViews: Map<string, Series<ReadonlyArray<Bar>>>`
      added and initialised in `createScriptRunner.ts`.
- [ ] `ComputeContext.request.lowerTf` returns identity-stable
      `Series<ReadonlyArray<Bar>>` per callsite.
- [ ] Capability-disabled / unsupported-interval / unknown-stream
      paths each emit the right diagnostic exactly once per callsite
      and return the empty-bucket Series.
- [ ] Happy path uses the Task-3 bucketing cache via
      `getOrBucket(mainBars, ltfBars)`.
- [ ] Canvas2d adapter `CANVAS2D_INTERVALS` tuple includes `"15s"` +
      `"30s"` (prepended) and preserves the existing lowercase
      `"1h"`.
- [ ] Three conformance scenarios (happy, cap-off, unsupported-interval)
      ship and pass against the canvas2d reference adapter.
- [ ] Warm-start determinism scenario covers `lowerTfHappyPath`.
- [ ] 100% coverage on touched runtime files.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm conformance`,
      `pnpm docs:check`, `pnpm readme:check` all green.
- [ ] Changeset committed.
