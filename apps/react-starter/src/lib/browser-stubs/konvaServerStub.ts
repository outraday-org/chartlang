// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// SSR stand-in for the `konva` package (konva seam variant only).
//
// The konva `activeAdapter.ts` seam does `import Konva from "konva"` at module
// scope, so the specifier is evaluated on the SERVER during SSR even though the
// chart only mounts client-side (`createActiveAdapter` runs inside ChartPane's
// `useEffect`). Konva's real entry resolves — under SSR's `node` conditions —
// to `lib/index-node.js`, whose first line is `require("canvas")` (a native
// addon the starter neither ships nor needs), throwing
// `Cannot find module 'canvas'`; its browser build is CommonJS and trips
// `exports is not defined` when bundled into the ESM server graph. Konva is
// never CALLED on the server, so the import only needs to succeed — this stub
// default-exports a harmless empty namespace. The Vite plugin
// `konvaServerStub` redirects `konva` here for every non-`client` environment;
// the browser keeps the real konva via its `browser` field.

export default {};
