# @invinite-org/chartlang-alert-runner

`experimental`

Headless alert evaluator for compiled chartlang scripts: feed history and
closed bars, persist and restore snapshots, and receive alert events with
explicit frequency semantics. Runs in the QuickJS sandbox
(`@invinite-org/chartlang-host-quickjs`) with a deterministic step budget,
and inside `node:worker_threads`.

## Install

```bash
pnpm add @invinite-org/chartlang-alert-runner @invinite-org/chartlang-compiler
```

## Public surface

- `createAlertRunner(opts) → Promise<AlertRunner>` — `requiredHistory()`,
  `needsWarmUp()`, `warmUp(bars, { secondary })`, `onBarClose(bar)`,
  `onSecondaryBarClose(interval, bar)`, `onPreClose(bar, offsetMs)`,
  `exportSnapshot()`, `dispose()`.
- Frequencies: `"once" | "once_per_bar" | "once_per_bar_close" | "every_time"`,
  plus optional `cooldownBars`; `createFrequencyGate` on its own.
- `createBarAggregator({ interval })` — ticks or 1m bars to the alert interval.
- `snapshotFidelityOf(compiled)` — `"exact"` or `"lossy"` (state a snapshot
  cannot carry: no snapshots, pre-close by replay).
- `validateAlertInputs(manifest, inputs)`, `alertRunnerCapabilities(...)`,
  `requiredHistoryFor(manifest, floor)`, `intervalMs(interval)`.
- `AlertRunnerError` (`code`: `aborted`, `runner-failed`, `invalid-inputs`, …).
- Defaults: `DEFAULT_ALERT_RUNNER_LIMITS` (32 MiB heap, 250 ms and
  5,000,000 steps per guest call), `DEFAULT_MIN_WARM_UP_BARS` (1,000).

## Minimum-viable API call

```ts
import { compile } from "@invinite-org/chartlang-compiler";
import { createAlertRunner } from "@invinite-org/chartlang-alert-runner";

const compiled = await compile(source, { apiVersion: 1, sourcePath: "alert.chart.ts" });
const runner = await createAlertRunner({
    compiled,
    symInfo: { ticker: "AAPL" },
    interval: "1h",
    frequency: "once_per_bar_close",
    snapshot: stored, // optional, a previous exportSnapshot()
});
if (runner.needsWarmUp()) await runner.warmUp(historyBars);
const events = await runner.onBarClose(bar); // AlertRunnerEvent[]
const next = await runner.exportSnapshot(); // JSON, the caller stores it
runner.dispose();
```

## Docs

See [`docs/hosts/alert-runner.md`](../../docs/hosts/alert-runner.md).

## License

MIT
