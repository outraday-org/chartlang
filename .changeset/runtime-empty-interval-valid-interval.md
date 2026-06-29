---
"@invinite-org/chartlang-runtime": patch
---

Treat Pine's empty-interval sentinel (`interval: ""`) as an always-valid
interval in the `request.security` capability gate, so a DIFFERENT-symbol feed
on the chart's own timeframe no longer trips a misleading `unsupported-interval`
diagnostic.

`""` is "the chart's own timeframe" — never a literal interval an adapter lists
in `capabilities.intervals` — so validating it there was wrong. Both
`makeSecurityBar` and `resolveSecondaryOrDiagnose` (`request/security.ts`) now
short-circuit the interval check on `interval === ""`. For the CHART symbol the
existing main-stream passthrough still runs first (unchanged); for a DIFFERENT
symbol at `interval: ""` ("that instrument on the chart clock") the request now
flows past the interval gate and is gated only by `multiSymbol` plus the
secondary-stream lookup keyed `feedKey(symbol, "")` — reading that stream's data
when registered, or falling back to the accurate `unknown-secondary-stream` when
not. A different-symbol NON-empty unsupported interval still trips
`unsupported-interval` (the relaxation is strictly `interval === ""`).
