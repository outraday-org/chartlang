# Run server-side alerts

Fire chartlang alerts headless — on a server, with no browser open —
using the QuickJS host. Condensed from
[`docs/hosts/quickjs.md`](https://github.com/outraday-org/chartlang/blob/main/docs/hosts/quickjs.md)
and the invariants in
[`packages/host-quickjs/CLAUDE.md`](https://github.com/outraday-org/chartlang/blob/main/packages/host-quickjs/CLAUDE.md).

## Why QuickJS

`@invinite-org/chartlang-host-quickjs` is a QuickJS-WASM `ScriptHost` for
server-side and untrusted-script execution. It mirrors the Worker host's
`ScriptHost` shape but adds hard caps a Web Worker cannot offer:

- **Process isolation** — a JSON-string membrane between the host realm
  and the guest realm; no host I/O or live host object reaches the script.
- **Real CPU preemption** — a runaway script is interrupted at
  `maxStepMs` instead of pinning a thread.
- **Hard heap cap** — `maxHeapBytes` maps to QuickJS's memory limit; OOM
  aborts cleanly as a `quickjs-oom` host error without taking the host
  process down.
- **Headless alerts** — fire when no browser session exists.

For trusted browser embedders the Worker host is lighter; see
[`embed.md`](./embed.md).

## Compile, then run the bar feed

Compile the script server-side exactly as in [`embed.md`](./embed.md)
(the compiler is node-only), then feed bars through the QuickJS host and
drain alerts. `createQuickJsHost` (capital `J`, capital `S`) takes
`CreateQuickJsHostOpts` — the adapter's `capabilities` plus optional
`limits`. `load` accepts the compiler's `{ moduleSource, manifest }`;
`push` and `drain` are async:

```ts
import { compile } from "@invinite-org/chartlang-compiler";
import {
    DEFAULT_QUICKJS_LIMITS,
    createQuickJsHost,
} from "@invinite-org/chartlang-host-quickjs";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

declare const source: string;
declare const myCapabilities: Capabilities;
declare const liveBars: AsyncIterable<Bar>;
declare function notify(message: string): void;

const { moduleSource, manifest } = await compile(source, {
    apiVersion: 1,
    sourcePath: "alert.chart.ts",
});

const host = createQuickJsHost({
    capabilities: myCapabilities,
    limits: { maxHeapBytes: DEFAULT_QUICKJS_LIMITS.maxHeapBytes },
});
await host.load({ moduleSource, manifest });

for await (const bar of liveBars) {
    await host.push({ kind: "close", bar });
    const emissions = await host.drain();
    for (const alert of emissions.alerts) notify(alert.message);
}

host.dispose();
```

`createQuickJsHost` returns a frozen `ScriptHost`: `load` evaluates the
dispatcher and the module once, `push` forwards a candle event across the
JSON membrane, `drain` returns the queued `RunnerEmissions` (plots and
alerts are re-validated through `validateEmission` on the way out), and
`dispose` tears down the context and clears pending drains. Per-call
limit overrides go in `CreateQuickJsHostOpts.limits` as a partial
`QuickJsHostLimits` merged over `DEFAULT_QUICKJS_LIMITS`
(`maxHeapBytes` 64 MiB, `maxStepMs` 1 ms).

## The sandbox boundary

The bundle is process-isolated inside the QuickJS realm. Boundary values
are JSON strings — host functions and mutable host objects never cross,
so `globalThis` writes, host-object captures, and realm reflection stay
confined to the guest. `eval` and the `Function` constructor are deleted
from the guest before any compute runs; dynamic `import(...)` has no host
resolver and surfaces as a host error; infinite loops are bounded by the
interrupt handler and OOM by the heap cap. The full sandbox-escape suite
is `packages/host-quickjs/src/sandbox.test.ts`; the invariants behind
each defence are in
[`packages/host-quickjs/CLAUDE.md`](https://github.com/outraday-org/chartlang/blob/main/packages/host-quickjs/CLAUDE.md),
and the host docs are under
[`docs/hosts/`](https://github.com/outraday-org/chartlang/tree/main/docs/hosts).

## Parity

The QuickJS alert stream is **byte-identical** to the Worker host's for
the same input — the host is forbidden from intentionally diverging from
Worker emission semantics; a host-specific sandbox rule surfaces through
the error channel, never a different emission shape. Cross-host parity is
verified by the conformance suite's 220 scenarios (both hosts run every
fixture), and
[`parity-smoke.mts`](https://github.com/outraday-org/chartlang/blob/main/parity-smoke.mts)
runs the EMA-cross example through the in-process runner, the Worker
host, and the QuickJS host and asserts identical output. So you can
develop against the Worker host in the browser and switch to QuickJS in
production with a one-line constructor change.
