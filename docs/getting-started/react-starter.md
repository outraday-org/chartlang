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
- **A symbol picker fed by [Yahoo Finance](https://finance.yahoo.com)** —
  free daily bars, US symbols, **no API key and no quota**. Each symbol
  ships ~5 years of daily history, so long-warmup indicators (a 30-bar SMA,
  say) have a full window out of the box.
- **SQLite saved scripts** (Drizzle + better-sqlite3, one file DB) — save,
  rename, and reload your scripts from a sidebar. The same DB caches the
  fetched daily bars so re-opening a symbol costs no network call.
- **The stock shadcn Base UI default (neutral) theme** — deliberately
  unbranded so you re-theme it freely. It does **not** import the chartlang
  brand tokens.
- **Choose-your-adapter** — the chart renders through one swappable module
  (`src/lib/chart/activeAdapter.ts`), default **canvas2d**.

## Quickstart

1. **Scaffold.** Pick a library when prompted (default **canvas2d**, or
   `echarts` · `lightweight-charts` · `uplot` · `konva`):

   ```bash
   npm create @invinite-org/chartlang@latest my-app
   # pnpm create @invinite-org/chartlang my-app · npx @invinite-org/create-chartlang my-app
   ```

2. **Run it.** From the project directory:

   ```bash
   pnpm install   # if you used --no-install
   pnpm dev
   # then open http://localhost:3100
   ```

   Market data works out of the box — it comes from Yahoo Finance's free
   public endpoint, with **no API key to set up and no quota to manage**.
   The installer writes a `.env` holding only the SQLite path
   (`DATABASE_URL=file:./data/starter.db`); the database auto-migrates and
   seeds one starter script on first open — no manual migration step.

### Installer flags

```bash
create-chartlang [dir] [--library <id>] [--pm <npm|pnpm|yarn|bun>] [--no-install] [--yes]
```

| Flag | Effect |
|---|---|
| `dir` | Target directory (default `./chartlang-starter`). |
| `--library <id>` | `canvas2d` (default) · `echarts` · `lightweight-charts` · `uplot` · `konva`. Skips the prompt. |
| `--pm <name>` | Package manager for the install + printed next steps. |
| `--no-install` | Skip the dependency install. |
| `--yes` | Accept defaults and overwrite a non-empty target dir. |

Only the GitHub clone and the optional install touch the network; the
adapter is vendored from an offline, version-pinned bundle.

## Market-data scope

Data comes from Yahoo Finance's free public chart endpoint — **no API key,
no quota, no rate-limit budget to manage**. A few things to know:

- **Daily bars only.** No intraday data. Multi-timeframe scripts resample
  the daily bars, so the daily interval is the resample floor —
  sub-daily requested intervals yield `NaN`.
- **US symbols only.** A non-US symbol fails fast (before any fetch).
- **~5 years of history per symbol**, so long-warmup indicators have a
  full window.

Every fetched symbol is cached in SQLite (`eod_cache`, refreshed once a
day), so re-opening a symbol or re-compiling a script costs **zero**
network calls.

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
