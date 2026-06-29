---
"@invinite-org/create-chartlang": patch
---

Default the React starter's chart library to `webgl` (the zero-dep raw WebGL2
example adapter) instead of `canvas2d`. `npm create @invinite-org/chartlang`
with no `--library` (or an empty interactive answer / `--yes`) now vendors the
webgl adapter and writes the webgl `activeAdapter.ts` seam; the prompt list
shows webgl first, marked `(default)`. `canvas2d` remains a fully supported
non-default choice via `--library canvas2d`.
