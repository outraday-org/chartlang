---
"@invinite-org/chartlang-adapter-kit": minor
---

Add a `"history-then-stream"` mode to `mockCandleSource` plus a `streamTail` option (default `1`, clamped to `[0, bars.length]`). The new mode emits a single warm-up history batch containing every bar except the trailing `streamTail` bars, then yields one `close` event per remaining bar. Lets a consumer paint a chart instantly from history and still receive a few per-bar ticks afterwards — the missing combination for the React demo pane, the conformance scenarios, and any "live editor" UI. The existing `"history"` and `"stream"` modes are unchanged.
