---
"@invinite-org/chartlang-pine-converter": minor
---

Lower Pine `alert(message, freq?)` to chartlang `alert(message)`. The message
passes through the ordinary expression emitter (string concatenation preserved)
and the enclosing `if` is preserved, never hoisted — chartlang's `alert` is
imperative, the same shape as Pine's. The Pine `alert.freq_*` frequency
argument is consumed (dropped) with a new `alert-frequency-not-mapped` (info),
because chartlang's `AlertOpts` carries no firing-frequency contract; the three
frequency enums (`alert.freq_all`, `alert.freq_once_per_bar`,
`alert.freq_once_per_bar_close`) are recognised as REJECT rows in
`ENUM_VALUE_MAP` so the symbol is never leaked to the generic emitter. Adding a
`frequency` field to core `AlertOpts` is a deferred follow-up.
