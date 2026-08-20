---
"@invinite-org/chartlang-pine-converter": patch
---

Emit chartlang's real day and week interval tokens (`1D` / `1W`), not `1d` / `1w`

`PINE_TO_INTERVAL` lowered Pine `"D"`/`"1D"`/`"W"`/`"1W"` to `"1d"`/`"1w"`, but
chartlang's interval grammar is `^(\d+)([smHhDWMY]?)$` (`intervalToSeconds` in
`@invinite-org/chartlang-core`) — there is no lowercase day or week suffix, so
`intervalToSeconds({ value: "1d" })` throws and no adapter can serve such a
feed. Every converted daily or weekly `request.security` therefore resolved to
nothing on every host, on the chart's own symbol as well as cross-symbol — the
commonest Pine multi-timeframe idiom.

Nothing was red: the converter's suites compared emitted text against goldens
carrying the same wrong token, and the compiler does not validate interval
literals. The new `emitted-intervals-are-parseable.test.ts` checks the table and
a real conversion against core's own parser instead of against a second table,
so a re-lowercasing fails rather than shipping.

`intervalToPineTimeframe` now keys on `"1D"`/`"1W"` and returns `null` for the
retired spellings. Emitted output changes for any script using a daily or weekly
timeframe; the other nine table entries (`1s`, `15s`, `1m`, `5m`, `1h`, `4h`,
`1M`) are unchanged and were already correct.
