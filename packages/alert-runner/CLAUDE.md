# packages/alert-runner/

`@invinite-org/chartlang-alert-runner` — headless alert evaluator over the
QuickJS host: warm-up / snapshot restore, bar close, pre-close, frequency
gate, bar aggregation. The generic half of what invinite's alert Durable
Objects ran (`worker/do/chartlang/*`); the invinite-only parts (Convex HTTP,
DO storage, the tentative-protocol tests, the pre-close persistence guard,
dependency plans / external-series feeds) stay out.

## Invariants

- **Compute is unconditional, delivery is the frequency's.** Every bar is
  pushed whatever the frequency; `createFrequencyGate` only decides which
  emissions deliver. A gate placed before the push would make indicator state
  depend on when the alert notifies.
- **One bar fires once** under `once_per_bar` / `once_per_bar_close`: the
  gate keys on `kind:id` and the bar TIME, so a pre-close delivery and the
  same bar's close are one signal. A held emission records nothing.
- **`dedupeKey` is built on the bar time, never the runtime's bar index.**
  The index moves with the warm-up length; a key built on it would change
  after a cold rebuild and re-deliver downstream.
- **Pre-close pushes a CLOSE on a scratch COPY; the live host is never
  touched.** A tick revises the last committed bar (window one bar short); a
  close commits. `scratchCopy()` builds a fresh host and imports the live
  state (exact scripts) or replays the journal (lossy ones). A failure there
  (abort, failed copy) throws but never fails the runner.
- **Snapshot fidelity is decided per script, conservatively.** The runtime
  snapshot carries only `ta.sma` / `ta.ema` / `ta.rsi` among the `ta.*` slots
  (`runtime/src/ta/persistence.ts`); everything else is re-initialised on
  import. `fidelity.ts` scans the compiler-injected callsite ids
  (`ns.name("path:line:col#n", …)`) against `STATEFUL_PRIMITIVES` and a
  `PERSISTED` set; any other slot-bearing callee, or a
  `manifest.securityExpressions` entry, makes the script `"lossy"`: no snapshot
  export or import, and a `journal` of every folded `CandleEvent` for pre-close
  replay. `fidelity.test.ts` pins the persisted `ta.*` kinds against a real
  snapshot — when the runtime persists more, grow `PERSISTED`.
- **Any budget abort fails the runner.** `push()` swallows the abort into
  `onHostError` and the next `drain()` throws `QuickJsStepAbortedError` with
  its `reason`; `step()` turns that into `AlertRunnerError("aborted")` and
  every later call into `"runner-failed"`. Truncated `ta` state is never
  served. An out-of-memory error inside `compute` is caught by the runtime
  (a diagnostic, the runner goes on); only a host-level `quickjs-oom` fails
  the runner.
- **The snapshot key carries every spec identity field** (`buildStateStoreKey`)
  plus `inputsHash`; `capabilitiesHash` hashes `canonicalJson`, which branches
  `Set` / `Map` BEFORE plain objects (an `Object.entries` walk would make every
  capability set invisible). No `compilerVersion` ⇒ unkeyed: no export, every
  import refused (`"unkeyed"`).
- **Warm-up is allowed only before the first bar and never after a restore**;
  secondary intervals are pushed before the main stream, `warmUpChunkBars`
  (default 1) bars per guest call so warm-up runs on the per-bar budget.
- **No `node:` imports in `src/`** (hashing is Web Crypto), so the package
  runs in a Worker, workerd or a browser. `workerThreads.test.ts` loads the
  BUILT `dist/` inside a real `Worker` — run `pnpm build` before the tests.
- Calls are serialized through one promise chain; `dispose()` is synchronous
  and always works.
