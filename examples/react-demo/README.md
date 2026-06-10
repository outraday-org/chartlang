# chartlang-example-react-demo

**Experimental** — end-user demo of the chartlang stack.

A realistic consumer integration test: chartlang editor (CodeMirror,
React) on the left, live-rendered chart (canvas2d adapter + worker
host) on the right. Edit the script and the chart hot-reloads.

Not published; copy as a starting point for a host-app integration.

## Running

```sh
pnpm install
pnpm --filter chartlang-example-react-demo dev
```

Then open `http://localhost:5173`.

## How it works

- **Browser** — React shell. The editor is assembled from the
  exported CM6 extensions in `@invinite-org/chartlang-editor`
  (`hoverExtension`, `completionExtension`, `linterExtension`,
  `peekPanelExtension`) so the demo can swap in a hybrid language
  service. Hover / completion / signature / definition run locally
  through `createLanguageService()`; `compileToDiagnostics` is
  overridden to POST `/api/compile`.
- **Server** — `server/compilePlugin.ts` is a Vite dev plugin that
  mounts `POST /api/compile`. It calls the real
  `@invinite-org/chartlang-compiler` `compile()` and the language
  service's `compileToDiagnostics()`, then returns either
  `{ ok: true, moduleSource, manifest, diagnostics }` or
  `{ ok: false, diagnostics }`.
- **esbuild stub** — `@invinite-org/chartlang-language-service`
  transitively imports `esbuild`, which can't load in a browser.
  `vite.config.ts` aliases `esbuild` to `src/esbuildStub.ts` for the
  client bundle; the server-side compile runs in Node and uses real
  esbuild.
- **Chart** — `chartlang-example-canvas2d-adapter` +
  `mockCandleSource` over the first 300 bars of
  `packages/conformance/fixtures/goldenBars.json` (committed to
  `public/bars.json`). Each successful compile disposes the previous
  adapter, spins up a fresh one, `host.load(...)`s the new module,
  and runs the renderer loop.

## Public surface

None — this is an app, not a library.

## License

MIT.
