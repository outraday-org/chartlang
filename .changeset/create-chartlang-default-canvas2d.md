---
"@invinite-org/create-chartlang": patch
---

Change the default chart library from `echarts` to `canvas2d`. When you run
`npm create @invinite-org/chartlang@latest` without `--library` (or accept the
prompt default / pass `--yes`), the installer now scaffolds the dependency-free
`canvas2d` adapter instead of `echarts`. The other four libraries
(`echarts`, `lightweight-charts`, `uplot`, `konva`) are still available via the
prompt or `--library <id>`.
