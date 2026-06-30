---
"@invinite-org/chartlang-pine-converter": minor
---

Lower a source input (`input.source` / bare `input(defval=close)`) as the
chosen bar series. A reference now emits `bar[inputs.<name> as SourceField]` —
an indexable, number-coercible `PriceSeries` — instead of a `(inputs.<name> as
number)` cast, so `src[1]` history reads and `ta.*(src, …)` source args work.
