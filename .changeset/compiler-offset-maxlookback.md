---
"@invinite-org/chartlang-compiler": patch
---

Count `opts.offset` toward `maxLookback` so offset-shifted series render.

`extractMaxLookback` only inspected literal `series[N]` element-access
reads, so a `ta.*` call with a positive `opts.offset` (e.g.
`ta.sma(bar.close, 20, { offset: 5 })`) left `maxLookback` at `0`. The
runtime sizes every output ring buffer to `maxLookback + 1`, so the
shifted series view's `buf.at(offset)` read was always out-of-range NaN
and the offset line never drew. The analysis now contributes a positive
`offset` literal to `maxLookback` (and stacks it with any literal index
on the same series, so `shifted[N]` sizes for `N + offset`); negative and
non-literal offsets are unchanged.
