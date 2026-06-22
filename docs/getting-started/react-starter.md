# Start from a working app

The fastest way to get a real chartlang app running is to clone the
**react-starter** — a private TanStack Start application that pairs a
script editor with a live chart. Write a chartlang
indicator/drawing/alert script on the left, see it render on the right.
One command scaffolds your own copy, wired to the chart library you pick.

```bash
npm create @invinite-org/chartlang@latest my-app
```

The installer is [`@invinite-org/create-chartlang`](https://www.npmjs.com/package/@invinite-org/create-chartlang);
the tree it clones lives at
[`apps/react-starter/`](https://github.com/outraday-org/chartlang/tree/main/apps/react-starter).

## What's in the starter

The starter is a standalone product you own and extend — **not** the
chartlang landing site. It mirrors the
[embedded-demo architecture](./embed-in-our-chart) (the real compiler
behind a `/api/compile` server route, the chosen library adapter + its
worker host on the client) but ships a full app around it:

- **A CodeMirror editor + live chart**, two resizable panes. Editing
  debounce-compiles through `/api/compile` and re-renders the chart.
- **A symbol picker fed by [EODData](https://eoddata.com)** — free tier,
  daily end-of-day bars, US symbols.
- **SQLite saved scripts** (Drizzle + better-sqlite3, one file DB) — save,
  rename, and reload your scripts from a sidebar. The same DB caches EOD
  data and counts your daily API usage.
- **The stock shadcn Base UI default (neutral) theme** — deliberately
  unbranded so you re-theme it freely. It does **not** import the chartlang
  brand tokens.
- **Choose-your-adapter** — the chart renders through one swappable module
  (`src/lib/chart/activeAdapter.ts`), default **echarts**.

## Quickstart

1. **Scaffold.** Pick a library when prompted (default **echarts**, or
   `lightweight-charts` · `uplot` · `konva` · `canvas2d`):

   ```bash
   npm create @invinite-org/chartlang@latest my-app
   # pnpm create @invinite-org/chartlang my-app · npx @invinite-org/create-chartlang my-app
   ```

2. **Get a free EODData key.** Sign up at
   [eoddata.com](https://eoddata.com) and copy your API key.

3. **Set the key.** The installer writes a `.env`; fill in the key:

   ```bash
   # my-app/.env
   EODDATA_API_KEY=your-key
   DATABASE_URL=file:./data/starter.db
   ```

4. **Run it.** From the project directory:

   ```bash
   pnpm install   # if you used --no-install
   pnpm dev
   # then open http://localhost:3100
   ```

   The SQLite database auto-migrates and seeds one starter script on first
   open — no manual migration step.

### Installer flags

```bash
create-chartlang [dir] [--library <id>] [--pm <npm|pnpm|yarn|bun>] [--no-install] [--yes]
```

| Flag | Effect |
|---|---|
| `dir` | Target directory (default `./chartlang-starter`). |
| `--library <id>` | `echarts` (default) · `lightweight-charts` · `uplot` · `konva` · `canvas2d`. Skips the prompt. |
| `--pm <name>` | Package manager for the install + printed next steps. |
| `--no-install` | Skip the dependency install. |
| `--yes` | Accept defaults and overwrite a non-empty target dir. |

Only the GitHub clone and the optional install touch the network; the
adapter is vendored from an offline, version-pinned bundle.

## EODData free-tier limits

The starter is built around the EODData **free tier**, and its data layer
is designed so a casual user never blows the quota:

- **100 calls/day.** A per-UTC-day counter (`api_usage`) increments only on
  a real network call — cache hits cost zero. At the limit the app serves
  stale cache or returns a `429`; an in-app **quota badge** shows how many
  calls remain.
- **Daily EOD only.** No intraday data. Multi-timeframe scripts resample
  the daily bars, so the daily interval is the resample floor —
  sub-daily requested intervals yield `NaN`.
- **US symbols only.** A non-US symbol fails fast (before any fetch).

Every fetched `(symbol, range)` is cached in SQLite (`eod_cache`), so
re-opening a symbol or re-compiling a script costs **zero** API calls. The
counter is conservative — it may refuse slightly early but never
over-spends — so a refresh won't exhaust your daily quota.

## Switch chart libraries later

The chart renders through one swappable module —
`src/lib/chart/activeAdapter.ts` — so nothing else in the app names a
concrete adapter. To move to a different library after install, vendor the
new adapter with the CLI and point the seam at it:

```bash
npx @invinite-org/chartlang-cli add-adapter <library>
# then edit src/lib/chart/activeAdapter.ts to re-export the new adapter
```

Compare the five libraries — license, render tech, bundle size, install
command — in the [adapter gallery](../adapters/gallery).

## Integrating chartlang by hand instead

The starter is the fastest path to a working app. If you are wiring
chartlang into an *existing* product instead of cloning the starter, start
with [Embed in your chart](./embed-in-our-chart) and install the
[chartlang-setup](../skills/chartlang-setup) skill into your AI assistant —
it teaches the compiler → host → adapter flow the starter wires up for you.
