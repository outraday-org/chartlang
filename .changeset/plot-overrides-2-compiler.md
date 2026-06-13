---
"@invinite-org/chartlang-compiler": minor
---

Emit `ScriptManifest.plots` — one `PlotSlotDescriptor` per `plot()` /
`hline()` callsite, in source order, carrying the compiler-issued
`slotId`, the statically-known plot `kind` (derived from the opts
`style.kind` literal; bare `plot` ⇒ `line`, `hline` ⇒ `horizontal-line`;
dynamic styles fall back to `line` best-effort), and a literal `title`
when present. Additive: the field is omitted for scripts with no
plot/hline callsites, so existing manifests are byte-identical.
