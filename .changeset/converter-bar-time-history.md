---
"@invinite-org/chartlang-pine-converter": minor
---

Support `time[n]` history. The scalar series builtin `time` (which remaps to a
non-indexable `bar.time`) is backed by a synthesized `state.series` slot fed
`bar.time` each bar, so `time[1]` indexes the slot. A bare `time` read still
lowers to `bar.time`.
