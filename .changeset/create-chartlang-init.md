---
"create-chartlang": minor
---

New package `create-chartlang` — the `npm create chartlang@latest my-app`
installer. It clones the `apps/react-starter` TanStack Start starter from
GitHub, prompts for a chart library (default echarts, or
lightweight-charts / uplot / konva / canvas2d), vendors the chosen adapter
from the CLI's offline `BUNDLED_ADAPTERS`, rewrites the single
`activeAdapter.ts` seam + the `package.json` workspace deps to published
versions, writes a `.env`, and prints next steps. Flags: `[dir]`,
`--library <id>`, `--pm <npm|pnpm|yarn|bun>`, `--no-install`, `--yes`. Only
the GitHub clone + optional install touch the network; adapter vendoring +
seam rewrite are offline. The emitted seam for every library is
byte-identical to the matrix-proven `SEAM_VARIANTS` (guarded by a parity
test).
