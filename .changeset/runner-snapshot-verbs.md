---
"@invinite-org/chartlang-runtime": minor
---

`ScriptRunner` gains on-demand `exportSnapshot` / `importSnapshot`

The runtime has shipped full state capture and restore since 0.5
(`captureStateSnapshot` / `restoreStateSnapshot`: OHLCV rings, every `ta.*`
accumulator, all `state.*` slot families, sibling and dependency sections),
but the only way to reach it was to configure a `PersistentStateStore` and
wait for the write cadence. `ScriptRunner` now exposes both directly:

- `exportSnapshot(): StateSnapshot | null` captures the current state,
  returning `null` when the capture is not JSON-clean (the same disposition
  the cadence path takes before downgrading to a diagnostic).
- `importSnapshot(snapshot): { barIndex }` validates and restores, throwing
  core's `SnapshotError` on a malformed or version-1 payload, and returns the
  last bar folded in so the caller resumes at `barIndex + 1`.

This is the store-free half of the existing machinery — a host whose
persistence lives elsewhere (a Durable Object, a server-side cache) no longer
needs to fake a store. The runtime enforces no ordering rule; hosts own
"after `load`, before the first push".
