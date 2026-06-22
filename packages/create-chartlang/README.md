# @invinite-org/create-chartlang

> **Stability: experimental.**

The `npm create @invinite-org/chartlang` installer — scaffold a runnable chartlang starter
app (TanStack Start editor + live chart + EODData + SQLite) with your chosen
chart library wired in.

## Usage

```bash
npm create @invinite-org/chartlang@latest my-app
# or: pnpm create @invinite-org/chartlang my-app · npx @invinite-org/create-chartlang my-app
```

It clones `apps/react-starter` from GitHub, prompts for a chart library
(default **echarts**), vendors the chosen adapter from the CLI's offline
bundle, rewrites the single `activeAdapter.ts` seam + the `package.json`
workspace deps, writes a `.env`, and (optionally) installs.

```bash
create-chartlang [dir] [--library <id>] [--pm <npm|pnpm|yarn|bun>] [--no-install] [--yes]
```

- `dir` — target directory (default `./chartlang-starter`).
- `--library <id>` — `echarts` (default) · `lightweight-charts` · `uplot` ·
  `konva` · `canvas2d`. Skips the prompt.
- `--pm` — package manager for the install + printed next steps.
- `--no-install` — skip the dependency install.
- `--yes` — accept defaults and overwrite a non-empty target dir.

## Public surface

The installer is also importable for programmatic scaffolding / testing:

```bash
pnpm add @invinite-org/create-chartlang
```

```ts
import { runCreateChartlang, defaultDeps } from "@invinite-org/create-chartlang";

await runCreateChartlang(["my-app", "--library", "echarts"], defaultDeps({
  cloneStarter: async () => {/* clone the starter tree */},
  runInstall: async () => {/* run the package install */},
}));
```

`runCreateChartlang(argv, deps)` runs the flow against an injectable IO seam
(`CreateChartlangDeps`); the network clone + install are injected so the rest
is offline + testable. Also exported: `seamTemplateFor`,
`rewriteStarterPackageJson`, `bundleChartlangVersions`, `resolveAdapter`,
`CHARTLANG_VERSIONS`, `STARTER_CLONE_REF`.

## Switching libraries later

```bash
npx @invinite-org/chartlang-cli add-adapter <id>
# then edit src/lib/chart/activeAdapter.ts
```

## Docs

See <https://chartlang.invinite.com> for the full starter guide.

## License

MIT
