---
"@invinite-org/chartlang-pine-converter": minor
---

pine-converter: lower the full Pine v6 `str.*` surface. `str.startswith` /
`str.endswith` → `s.startsWith(t)` / `s.endsWith(t)`, `str.pos` →
`s.indexOf(t)`, `str.substring` → `s.substring(begin[, end])`, `str.trim` →
`s.trim()`, `str.repeat` → `s.repeat(n)` (2-arg or empty-string-literal
separator), occurrence-aware `str.replace` → `s.replace(t, r)` (no occurrence
or a literal-`0` occurrence), and `str.tonumber` → `Number(s)`. This rounds out
the existing `str.tostring` / `str.format` / `str.length` / `str.contains` /
`str.upper` / `str.lower` / `str.split` / `str.replace_all` lowerings — the same
native-where-native-exists shape `math.*` uses for bare `Math.*` (no `str`
import/destructure is added to the generated output).

`str.match` (regex) and `str.format_time` (host-time) have no native
one-liner and continue to emit the existing `str-not-mapped` diagnostic and
pass the call through; so do a `str.repeat` with a non-empty separator and a
`str.replace` with a non-zero / non-literal occurrence. No new diagnostic codes
— the stable `code:` contract is unchanged.
