---
"@invinite-org/chartlang-host-worker": minor
---

`ScriptHost` gains `exportSnapshot` / `importSnapshot`, plus an opt-in IDB boot store

A host can now lift a runner's whole state out and put it back — the runtime
has been able to do this since 0.5, but nothing above `createScriptRunner`
could reach it, so an evicted consumer had no choice but to replay its full
lookback window.

- `exportSnapshot(): Promise<HostSnapshot | null>` returns the captured state
  bound to the `StateStoreKey` the host was constructed with, as one JSON-clean
  envelope — a consumer physically cannot persist the payload without its
  identity.
- `importSnapshot(exported): Promise<{ barIndex }>` restores it and acks with
  the last bar folded in, so the caller resumes at `barIndex + 1`.

Import is legal only AFTER `load` and BEFORE the first `push`, and only when
the envelope's key matches the host's own (two absent keys also match). Every
refusal — out of order, key mismatch, malformed payload — arrives as the new
`snapshotError` protocol frame and rejects with core's `SnapshotError`, kept
deliberately distinct from `fatal`: the runner is alive and the caller can fall
back to a full replay. `stateStoreKey` is caller-supplied because the host
cannot derive `scriptHash` / `symbol` / `mainInterval` on its own.

`CreateWorkerHostOpts.persistence: { kind: "idb" }` wires the packaged
`idbStateStore` into the shipped worker boot, which previously reached it from
nowhere: the boot builds the store around the `load` frame's `stateStoreKey`
(the store needs a key at construction, which only `load` knows) and warm-starts
once on the first candle event carrying a bar time. `createWorkerBoot(scope)`
remains callable with a single argument, so `dist/worker-boot.js` is unchanged
in signature. A consumer that pushes full history after a warm start re-seeds
the runner and harmlessly discards the restore — the store pays off for hosts
that push only the gap.

The boot also now processes frames through one promise chain rather than
letting an `async` listener interleave two frames' bodies.
