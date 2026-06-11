---
"@invinite-org/chartlang-editor": minor
"@invinite-org/chartlang-runtime": patch
---

React-demo polish round:

- **`editor`**: New `chartlangDark` theme export and an `extensions` passthrough on `createChartlangEditor` / `<ChartlangEditor>` (via `@lezer/highlight`). The editor previously shipped with no theme at all, so CodeMirror's default light styling landed on dark host pages.
- **`runtime`**: `onHistory` no longer discards all but the last bar's emissions. A bulk history push is one event followed by one `drain()`, but the per-bar close path reset the emission queues each iteration — consumers only ever saw the final bar's plots. History walks now accumulate emissions across the batch, matching the "everything since last drain" contract (PLAN §6.1).
