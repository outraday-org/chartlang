---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": patch
---

Add `state.series(init)` — a writable, indexable user series. Store an
arbitrary value each bar (`s.value = expr`) and read its history N bars
back (`s[1]`). Number-coercible (`+s`, `s.current`) and usable as a `ta.*`
source. The Pine converter lowers a history-indexed `var` to it.
