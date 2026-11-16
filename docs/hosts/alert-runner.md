# Alert runner

`@invinite-org/chartlang-alert-runner` turns a compiled chartlang script into
a headless alert evaluator: restore a stored snapshot (or warm up from
history), feed closed bars, and receive alert events filtered by an explicit
frequency. It runs the script in the [QuickJS host](./quickjs.md), so the
script is sandboxed, memory-capped and step-bounded, and it runs unchanged
inside `node:worker_threads`.

Use it when alerts fire on a server, for many users' scripts, with no chart
open. For a chart in a browser, use [the Worker host](./worker.md).

## Minimum-viable usage

```ts no-gate
import { compile } from "@invinite-org/chartlang-compiler";
import { createAlertRunner } from "@invinite-org/chartlang-alert-runner";

const compiled = await compile(source, { apiVersion: 1, sourcePath: "alert.chart.ts" });

const runner = await createAlertRunner({
    compiled,
    symInfo: { ticker: "AAPL" },
    interval: "1h",
    inputs: { length: 14 },
    frequency: "once_per_bar_close",
    limits: { maxHeapBytes: 32 * 1024 * 1024, maxStepMs: 250, maxSteps: 5_000_000 },
    snapshot: stored, // optional: a previous exportSnapshot(), parsed
});
if (runner.needsWarmUp()) {
    await runner.warmUp(await loadBars(runner.requiredHistory()));
}
for (const bar of closedBars) {
    for (const event of await runner.onBarClose(bar)) await deliver(event);
}
await store(await runner.exportSnapshot());
runner.dispose();
```

## API

| Member | Behaviour |
| --- | --- |
| `createAlertRunner(opts)` | Validates the options and the inputs, mints the snapshot key, loads the script into a fresh QuickJS host and restores `opts.snapshot` when it matches. |
| `requiredHistory()` | Bars of history to warm up with (see [Warm-up](#warm-up)). |
| `needsWarmUp()` | `true` when nothing was restored and no bar has been folded in. |
| `warmUp(bars, { secondary })` | Folds closed history in without delivering. Only before the first bar and never after a restore. |
| `onBarClose(bar)` | Folds one closed bar in and returns the delivered `AlertRunnerEvent[]`. A bar at or before `lastBarTime` is ignored. |
| `onSecondaryBarClose(interval, bar)` | Folds one closed bar of a `request.security` interval in. Push it before the main bar that follows it. |
| `onPreClose(bar, offsetMs)` | Evaluates the still-forming bar `offsetMs` before its close and rolls the state back (see [Pre-close](#pre-close)). |
| `exportSnapshot()` | The JSON document to store, or `null` for an unkeyed or lossy runner. |
| `dispose()` | Frees the QuickJS runtime. Always works, also on a failed runner. |
| `lastBarTime`, `lastSecondaryBarTime(i)`, `exhausted`, `snapshotStatus`, `snapshotFidelity`, `key` | Read-only state. |

Calls are serialized internally, so concurrent calls run one after another.
Bars are plain `{ time, open, high, low, close, volume, closeTime? }`; the
runner derives `hl2` / `hlc3` / `ohlc4` / `hlcc4`, `symbol` and `interval`.

## Events

```ts no-gate
type AlertRunnerEvent = {
    kind: "alert" | "condition";
    id: string;          // alert(): the callsite slotId; condition: the condition id
    title?: string;      // condition title
    message: string;     // alert message, or the condition's default message
    severity?: "info" | "warning" | "critical"; // alert() only
    meta: Record<string, JsonValue>;            // alert meta, or { description }
    bar: number;         // runtime bar index
    time: number;        // bar open time (UTC ms)
    dedupeKey: string;
    phase: "close" | "preClose";
};
```

A condition becomes an event only on `signal(id, true)`; `fired: false` is a
disarm. `dedupeKey` is `kind:id:time` — built on the bar TIME, not the bar
index, so it is stable across restarts, restores and warm-up lengths — with
`:pre:<offsetMs>` appended to an `every_time` pre-close delivery and `#n` to
the n-th repeat of one id within one evaluation. Deliver at-least-once and
dedupe on it.

## Frequencies

Compute is never gated: every bar is pushed, so indicator state is the same
under every frequency. Only delivery is.

| Frequency | Delivers |
| --- | --- |
| `every_time` | Every alert and fired condition of every evaluation, close and pre-close. On closes alone it equals the runtime's drain output (pinned by the conformance runner pass). |
| `once_per_bar` | At most once per id per bar. A pre-close delivery and the same bar's close are one signal. |
| `once_per_bar_close` | Only on bar close, at most once per id per bar. Pre-close evaluations report what they held back (`reason: "frequency"`). |
| `once` | The first evaluation that delivers anything delivers all its events; then `exhausted` is `true` and nothing is delivered again. |

`cooldownBars: n` additionally holds an id for `n × interval` after it
delivered, in every frequency. The gate's memory (last delivered bar per id,
`exhausted`) is part of the snapshot. `createFrequencyGate` exposes the gate
on its own.

## Warm-up

`requiredHistory()` is the largest of `manifest.maxLookback + 1`,
`manifest.maxBarsBack`, `manifest.seriesCapacities.dynamicFallback` (5,000
when the script indexes a series by a value the compiler cannot bound) and
`minWarmUpBars` (default `DEFAULT_MIN_WARM_UP_BARS`, 1,000). The floor exists
because `maxLookback` counts provable series indexing (`close[20]`) only, not
the bars a `ta.*` call needs to converge: an `ema(close, 200)` script reports
`maxLookback: 0`.

`warmUp` pushes secondary intervals first (an expression-form
`request.security` captures its stream on the first compute), then the main
bars, `warmUpChunkBars` per guest call (default 1, so warm-up runs on the same
per-bar budget as live bars). Emissions during warm-up are dropped.

## Pre-close

`onPreClose(bar, offsetMs)` pushes the forming bar as a **close** — a tick
would revise the last committed bar and read a window one bar short — and a
close commits, so it runs on a **copy**: a fresh host that imports the live
state (an `"exact"` script) or replays every bar the runner folded in (a
`"lossy"` one, see [Snapshot fidelity](#snapshot-fidelity)). The live state is
never touched and `lastBarTime` does not move, so the real close of the same
bar arrives later as usual; a budget abort on the forming bar throws
`"aborted"` but does not fail the runner. The result carries the delivered
events, the held-back emissions with their reasons, the evaluated bar,
`offsetMs` and the emission count. A bar at or before `lastBarTime` throws
`stale-bar`. Each pre-close costs one script load (plus the replay for a lossy
script).

## Snapshot storage contract

`exportSnapshot()` returns a JSON-clean document:

| Field | Meaning |
| --- | --- |
| `format`, `version` | `"chartlang-alert-runner"`, `1`. |
| `key` | Every persistent-store identity field of [the spec](../spec/semantics.md#state-persistence): `scriptHash` (SHA-256 of `moduleSource`), `compilerVersion`, `apiVersion`, `capabilitiesHash` (SHA-256 of the canonical capability bag), `symbol` (`symInfo.ticker`), `mainInterval`, sorted `requestedIntervals`. |
| `inputsHash` | SHA-256 of the canonical user inputs. |
| `lastBarTime`, `secondaryLastBarTimes` | The replay watermarks. |
| `gate` | The frequency gate's memory. |
| `state` | The runtime snapshot (rings, `ta` accumulators, `state.*` slots). |

Store it as is and pass it back, parsed, as `snapshot`. The runner reports
what happened in `snapshotStatus`: `restored`, `key-mismatch` (another script,
compiler, symbol, interval, capability set or inputs), `invalid` (not a runner
snapshot, or the runtime refused the payload), `unkeyed`, `lossy`, or `none`. Anything
but `restored` means "warm up". After a restore, fetch bars after
`lastBarTime` and feed them through `onBarClose`; replayed bars at or before
the watermark are ignored. Restore plus replay produces byte-identical events
to a cold run over the same bars.

A manifest without `compilerVersion` (pre-1.11 output) has no complete key:
the runner is unkeyed, `exportSnapshot()` returns `null`, and every start is
a warm-up.

### Snapshot fidelity

The runtime snapshot carries `state.*` slots, the OHLCV rings and the state of
`ta.sma`, `ta.ema` and `ta.rsi` — not that of the other `ta.*` primitives
(`ta.crossover`, `ta.atr`, …), `draw.*`, `request.lowerTf` or an
expression-form `request.security`, which an import silently re-initialises.
A restored EMA-cross script would miss crosses. `snapshotFidelityOf(compiled)`
classifies a script from its compiled callsites (conservatively) and
`runner.snapshotFidelity` reports it:

- `"exact"` — snapshots export and restore; restore + replay is byte-identical
  to a cold run.
- `"lossy"` — `exportSnapshot()` returns `null`, a passed snapshot is refused
  (`snapshotStatus: "lossy"`), every start is a warm-up, and pre-close replays
  the runner's journal of folded bars (memory and replay time grow with the
  bars the runner has seen).

## Limits

| Field | Default | Meaning |
| --- | --- | --- |
| `maxSteps` | 5,000,000 | Deterministic budget per guest call (load, warm-up chunk, close, pre-close): QuickJS interrupt checkpoints, counted 10,000 per poll. The same script on the same bars aborts at the same place on any machine. |
| `maxStepMs` | 250 | Wall-clock backstop per guest call. |
| `maxHeapBytes` | 32 MiB | QuickJS heap cap. |
| `maxLoadTimeoutMs` | 30,000 | Wall-clock cap of a script load. |

A call that hits `maxSteps` or `maxStepMs` throws `AlertRunnerError` with
code `"aborted"` and `reason: "steps" | "time"`. The runner is then failed:
the script's state is truncated, so every later call throws
`"runner-failed"`. Dispose it and disable or rebuild the alert. An
out-of-memory error inside `compute` is a script error like any other — the
runtime drops that bar's emissions with a diagnostic and the runner goes on;
one that escapes the runtime fails the runner with `"out-of-memory"`.
`onDiagnostic` receives every runtime diagnostic and host message.

## Inputs and capabilities

`inputs` are checked against `manifest.inputs` strictly (`validateAlertInputs`):
unknown keys, wrong kinds, numbers outside `min` / `max` and enum values
outside `options` throw `"invalid-inputs"` with the list in `details`.
`external-series` inputs are refused — the runner has no feed for them.

The default capability bag (`alertRunnerCapabilities`) declares every alert
channel, alert conditions, every plot kind and input kind, all `symInfo`
fields, the alert interval plus `requestedIntervals` (multi-timeframe on,
multi-symbol off); drawings, logs and orders are off. Pass `capabilities` to
replace it; it is part of the snapshot key.

## Bar aggregation

`createBarAggregator({ interval, bucketStart? })` rolls ticks
(`ingestTick(price, timeMs, size?)`) or finer bars (`ingestBar(bar)`, e.g. 1m)
into bars of the alert interval. `closed` is set on the sample that crosses
into a later bucket; `closeIfDue(nowMs)` closes a bar on the clock when no
sample arrives. `seedFromHistory(bars)` keeps a sample in the last history
bucket from re-opening it; `seedFormingBar(bar)` merges a provider's forming
candle forward only. The default bucket grid is wall-clock UTC; pass
`bucketStart` for session-aligned daily bars or calendar months.

## Worker threads and bundling

The runner has no `node:` imports and works in a `node:worker_threads`
`Worker` as is (tested on Node 22). By default every host calls
`getQuickJS()` from `quickjs-emscripten`, which compiles the WASM once per
thread. To avoid any runtime WASM compile — required on Cloudflare Workers
(workerd), and cheaper for a pool of Node workers — compile the module once
and hand it over:

```ts no-gate
// main thread
const wasm = await WebAssembly.compile(
    await readFile(require.resolve("@jitl/quickjs-wasmfile-release-sync/wasm")),
);
new Worker(new URL("./alert-worker.js", import.meta.url), { workerData: { wasm } });

// alert-worker.js
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, newVariant } from "quickjs-emscripten-core";

const quickJs = newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmModule: workerData.wasm }));
const runner = await createAlertRunner({ ...opts, quickJsLike: () => quickJs });
```

Create the QuickJS module once per thread and share it — `quickJsLike` is
called for every host the runner builds, including the rebuild after each
pre-close. Pin `@jitl/quickjs-wasmfile-release-sync` and
`quickjs-emscripten-core` to the `quickjs-emscripten` version
`@invinite-org/chartlang-host-quickjs` uses (0.31.x). On workerd, import the
`.wasm` file statically so the bundler emits a precompiled `WebAssembly.Module`
binding; workerd refuses to compile WASM bytes at runtime.

## Cross-links

- The sandbox it runs in: [QuickJS host](./quickjs.md).
- Alert surfaces in the language: [Alerts](../language/alerts.md).
- Snapshot identity: [Execution semantics § State persistence](../spec/semantics.md#state-persistence).
