# QuickJS host

`@invinite-org/chartlang-host-quickjs` is the WASM-isolated `ScriptHost`
for server-side execution and untrusted-script runs. It mirrors
[`host-worker`](./worker.md)'s `ScriptHost` interface so consumers can
swap behind the same shape, but it adds **hard** runtime caps a Web
Worker cannot offer: real memory limits, real CPU preemption, and a
JSON-string membrane between the host realm and the guest realm.

## When to use it

Reach for QuickJS when:

- The script comes from an untrusted author and the host cannot rely on
  compiler enforcement alone.
- Alerts need to fire server-side without a browser session.
- CI conformance scenarios need a deterministic, isolated runtime.
- A Node deployment wants the same `ScriptHost` contract its browser
  client uses.

For trusted browser embedders, [the Worker host](./worker.md) is
lighter and reuses the host process.

## Minimum-viable usage

```ts
import type { Adapter } from "@invinite-org/chartlang-adapter-kit";
import {
    DEFAULT_QUICKJS_LIMITS,
    createQuickJsHost,
} from "@invinite-org/chartlang-host-quickjs";
import type { QuickJsCompiledScript } from "@invinite-org/chartlang-host-quickjs";

declare const adapter: Adapter;
declare const compiled: QuickJsCompiledScript;

const host = createQuickJsHost({
    capabilities: adapter.capabilities,
    limits: { maxHeapBytes: DEFAULT_QUICKJS_LIMITS.maxHeapBytes },
});
await host.load(compiled);
await host.push({ kind: "history", bars: [] });
const emissions = await host.drain();
adapter.onEmissions(emissions);
host.dispose();
```

`createQuickJsHost` returns a frozen `ScriptHost` whose four methods
behave identically to the Worker host:

| Method | Behaviour |
| --- | --- |
| `load(compiled)` | Initialises the QuickJS runtime, evaluates the dispatcher once, then evaluates the compiled module source as an in-realm script. |
| `push(event)` | Forwards a candle event into the realm by JSON membrane. |
| `drain()` | Returns the queued `RunnerEmissions` batch since the last drain. Plot and alert emissions are revalidated through `validateEmission` on the way out. |
| `dispose()` | Disposes the QuickJS context and runtime; clears pending drains. |

## Hard runtime caps

`DEFAULT_QUICKJS_LIMITS` is the frozen defaults bag:

| Field | Default | Meaning |
| --- | --- | --- |
| `maxHeapBytes` | 64 MiB | Mapped to `quickjs-emscripten`'s `runtime.setMemoryLimit(...)`. OOM is reported as a `quickjs-oom` host error. |
| `maxStepMs` | 1 ms | Drives the host-side interrupt handler. Step overshoots are reported via `onHostError`. |
| `maxLoadTimeoutMs` | 30 s | Informational. QuickJS evaluates the dispatcher inline on first `load()` — there is no async boot. The value is surfaced on `host.limits` to keep the cross-host shape uniform. |

Per-call overrides land in `CreateQuickJsHostOpts.limits` as a partial
`QuickJsHostLimits` and are merged over the defaults.

## Sandbox matrix

The QuickJS host enforces the following at the membrane (mirrored from
the package's invariants):

| Attack surface | Defence |
| --- | --- |
| `Function` constructor reach | `eval` and `Function` are deleted from the guest before any compute runs. |
| Direct `eval(...)` | Same hardened-globals path; the compiler also rejects it as `hostile-global`. |
| Dynamic `import(...)` | No host module resolver — surfaces as a host error. |
| `globalThis` writes | Confined to the QuickJS realm. Host globals are not reachable. |
| Host-object capture | The JSON-string membrane drops non-JSON members. |
| Infinite loops | Bounded by the interrupt handler at `maxStepMs`. |
| OOM attempts | Bounded by `maxHeapBytes`; reported as `quickjs-oom`. |
| Realm reflection | Stays in the QuickJS realm; host-only methods remain unavailable. |
| `Symbol.iterator` prototype hijacks | Emission serialisation does not iterate guest objects directly. |
| Revoked Proxies after emit | Already-serialised drain output is unaffected. |

The full sandbox-escape suite under `packages/host-quickjs/src/sandbox.test.ts`
asserts each row. Anything that breaks one of these invariants is
treated as a sandbox-escape regression, not as a behaviour change.

## Cross-host parity

The host is forbidden from intentionally diverging from
[`host-worker`](./worker.md)'s emission semantics. If QuickJS needs a
host-specific sandbox rule, the host surfaces it through the error
channel — not through a different emission shape. Cross-host emission
parity is verified by the conformance suite's 220 scenarios; both hosts
run every fixture and produce byte-identical drained emissions for
identical inputs.

## Cross-links

- The Worker host: [`host-worker`](./worker.md).
- The author-side contract: [Writing a host](./writing-a-host.md).
- The wire shapes the QuickJS host re-validates on drain:
  [Emission payloads](../spec/emissions.md).
- Determinism contract: [Execution semantics § Determinism](../spec/semantics.md#determinism).
