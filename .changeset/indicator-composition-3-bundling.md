---
"@invinite-org/chartlang-compiler": minor
---

Bundle multi-export `.chart.ts` files into one ESM module, inline cross-file
`.chart.ts` deps recursively via the new `createProducerResolver` walker, emit
a union-shape manifest sidecar (single object or array depending on
drawn-export count), and emit per-export `.d.ts` declarations carrying the
typed `output<K>` / `withInputs` accessors. Single-script files remain
byte-identical.
