# chartlang-setup

The integration skill — for the **developer integrating chartlang into their
project**. Install it into the AI assistant you build with when you are wiring
chartlang into a product: compiling `.chart.ts` scripts, hosting the bundle in
a Web Worker or QuickJS sandbox, and rendering emissions through a chart
adapter. Use it when the assistant is touching
`@invinite-org/chartlang-compiler`, `-runtime`, `-host-worker`,
`-host-quickjs`, or `-adapter-kit`.

It is *not* for writing `.chart.ts` scripts. The skill that helps an end user's
editor assistant author scripts is [chartlang-coding](./chartlang-coding).

## Fastest start — clone the starter

The skill's recommended starting point is the **react-starter**: rather than
hand-wiring the boundaries, scaffold a runnable app that already does it.

```bash
npm create chartlang@latest my-app
```

It clones a TanStack Start app with the full embed path wired — the compiler
behind a `/api/compile` server route, a Worker host, and a chart adapter
behind one swappable `src/lib/chart/activeAdapter.ts` module — plus a
CodeMirror editor, an EODData symbol picker, and SQLite saved scripts. See
the [starter guide](../getting-started/react-starter). The hand-integration
paths below are for embedding chartlang into an *existing* product.

## What it teaches

The compiler → host → adapter data flow, capability gating, the host parity
guarantee, and the **three integration paths**:

- **Embed in your chart** — compile a script, host the bundle, render through an
  adapter (the full embed path).
- **Write a chart adapter** — author a new chart-vendor adapter against the
  [adapter contract](../adapters/contract) and conformance harness.
- **Run server-side alerts** — fire alerts headless on a server with the
  [QuickJS host](../hosts/quickjs).

## What's inside

- `SKILL.md` — the three boundaries, path routing, install guidance, capability
  gating, and the host parity guarantee.
- `references/embed.md` — the full compile → host → render embed path.
- `references/adapter.md` — authoring a new adapter against `adapter-kit`.
- `references/server-alerts.md` — headless alerts with the QuickJS host.

## Install

```bash
npx skills add outraday-org/chartlang/tree/main/skills/chartlang-setup
```

See [Skills](./) for manual-install targets and the maintenance contract. To
follow the same paths by hand, start with
[Embed in your chart](../getting-started/embed-in-our-chart) and
[Write your first adapter](../getting-started/write-your-first-adapter).
