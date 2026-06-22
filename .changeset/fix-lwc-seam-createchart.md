---
"@invinite-org/create-chartlang": patch
---

Fix the lightweight-charts starter rendering blank ("Assertion failed" in
lightweight-charts 5.x `addSeriesImpl`). The lightweight-charts seam overrode
the adapter's `createChart` with the raw `IChartApi` (force-cast through
`unknown`), bypassing the adapter's internal wrapper that maps its string-keyed
`addSeries("Candlestick" | "Line", …)` calls onto v5's series-definition API.
The seam now omits the override so the adapter uses its own (correct) default
`createChart`, matching how the site demo driver mounts it. The chosen library
is still installed (the adapter imports `lightweight-charts` internally).
