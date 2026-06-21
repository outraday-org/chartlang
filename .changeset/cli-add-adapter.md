---
"@invinite-org/chartlang-cli": minor
---

Add `chartlang add-adapter [id] [dir]` — drop a complete, runnable library
adapter (canvas2d, echarts, konva, lightweight-charts, uplot) into your repo
from an offline, version-pinned bundle baked into the CLI. Supports `--list`
(comparison matrix), `--name <pkg>`, `--pm <npm|pnpm|yarn|bun>`, and `--force`.
Unlike `scaffold-adapter` (a blank starter), `add-adapter` writes a full,
conformance-green adapter with its chartlang dependencies pinned to the
matching published versions. Zero new runtime dependencies.
