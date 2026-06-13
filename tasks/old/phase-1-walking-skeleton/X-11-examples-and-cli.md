# Task 11 — Example Scripts + `chartlang` CLI (`compile` + `scaffold-adapter`)

> **Status: TODO**

## Goal

Write the three Phase-1 `.chart.ts` example scripts that the
canvas2d adapter renders + the conformance suite verifies, and
ship the `chartlang` CLI's two Phase-1 subcommands: `compile <file>`
(invokes the compiler, writes the triple) and `scaffold-adapter
<name>` (writes a starter adapter package into a target directory).

## Prerequisites

- Task 3 (compiler API: `compile`, `compileFile`, `compileProject`).
- Task 7 (runtime `ta.*` primitives — scripts call `ta.ema`, `ta.bb`,
  `ta.rsi`, `ta.crossover`, `ta.crossunder`).
- Task 8 (runtime emission primitives — scripts call `plot`,
  `hline`, `alert`).

## Desired Behavior

After this task:

- `examples/scripts/ema-cross.chart.ts`,
  `bollinger-bands.chart.ts`, and `rsi-divergence-alert.chart.ts`
  all compile cleanly via `pnpm chartlang compile <file>` and
  produce the `.chart.js` + `.chart.manifest.json` + `.chart.d.ts`
  triple.
- `chartlang compile examples/scripts/ema-cross.chart.ts` exits 0,
  writes the triple to the same directory, and prints a one-line
  summary.
- `chartlang scaffold-adapter my-tradingview-adapter --target
  ./out` writes a starter adapter package outside the OSS repo,
  per §3.2's `scaffold-adapter` brief.
- `pnpm chartlang --help` prints the available commands.
- 100% coverage on every CLI branch.

## Requirements

### 1. Example script — `ema-cross.chart.ts`

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
import { defineIndicator, ta, plot, alert } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, alert }) {
        const fast = ta.ema(bar.close, 12);
        const slow = ta.ema(bar.close, 26);

        plot(fast, { color: "#26a69a", title: "EMA(12)" });
        plot(slow, { color: "#ef5350", title: "EMA(26)" });

        if (ta.crossover(fast, slow).current) {
            alert("EMA(12) crossed above EMA(26)", { severity: "info" });
        }
        if (ta.crossunder(fast, slow).current) {
            alert("EMA(12) crossed below EMA(26)", { severity: "warning" });
        }
    },
});
```

Calls per stateful primitive (with compiler-injected slot ids):
- `ta.ema` × 2
- `plot` × 2
- `ta.crossover` × 1
- `ta.crossunder` × 1
- `alert` × 2

= 8 stateful callsites. The compiler injects 8 unique `slotId`
literals.

### 2. Example script — `bollinger-bands.chart.ts`

```ts
import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bollinger Bands",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const bands = ta.bb(bar.close, 20, { multiplier: 2 });
        plot(bands.upper,  { color: "#cccccc", title: "BB Upper",  lineWidth: 1 });
        plot(bands.middle, { color: "#90caf9", title: "BB Middle", lineWidth: 2 });
        plot(bands.lower,  { color: "#cccccc", title: "BB Lower",  lineWidth: 1 });
    },
});
```

Exercises the multi-output `ta.bb` primitive from Task 7 — proves
the `BbResult` return is `Series<number>` × 3 and that `plot`
accepts each.

### 3. Example script — `rsi-divergence-alert.chart.ts`

```ts
import { defineIndicator, ta, plot, hline, alert } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "RSI Divergence Alert",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot, hline, alert }) {
        const rsi = ta.rsi(bar.close, 14);
        plot(rsi, { color: "#9c27b0", title: "RSI(14)" });

        hline(70, { color: "#ef5350", lineStyle: "dashed", title: "Overbought" });
        hline(30, { color: "#26a69a", lineStyle: "dashed", title: "Oversold" });

        if (rsi.current > 70 && ta.crossunder(rsi, 70).current) {
            alert("RSI dropped below 70 (overbought exit)", { severity: "warning" });
        }
        if (rsi.current < 30 && ta.crossover(rsi, 30).current) {
            alert("RSI rose above 30 (oversold exit)", { severity: "info" });
        }
    },
});
```

The "divergence" name keeps the §22.2 step-2 filename intact. The
Phase-1 implementation uses overbought/oversold crosses rather
than true price-vs-RSI divergence detection — divergence math
needs pivots which are a Phase-2 primitive.

Note: this script is `overlay: false`, meaning RSI would live in a
sub-pane. Phase 1's canvas2d adapter declares `subPanes: 0`, so the
plot folds to the overlay pane with an `unsupported-pane`
diagnostic emitted at runtime. The script still compiles and runs
end-to-end — the diagnostic is the silent-no-op surface from §7.4
working correctly. (Phase 4 wires real sub-panes; this script then
renders properly without code change.)

### 4. CLI entrypoint (`packages/cli/src/bin.ts`)

```ts
#!/usr/bin/env node
import { runCli } from "./index";

runCli(process.argv.slice(2)).catch((err) => {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
});
```

`package.json` `bin` field:

```jsonc
{
    "bin": { "chartlang": "./dist/bin.js" }
}
```

The package becomes executable post-`pnpm build` via `pnpm exec
chartlang ...` inside the `packages/cli/` directory. To support
**root-relative** invocation (`pnpm chartlang …` from the repo
root, used in this task's acceptance criteria), add a root
`package.json` script alias in the same commit:

```jsonc
// root package.json
"scripts": {
    "chartlang": "pnpm -F @invinite-org/chartlang-cli exec chartlang"
}
```

This avoids relying on pnpm-workspaces' bin-hoisting behaviour
(which depends on `link-workspace-packages` and node-linker
settings) and works under any pnpm configuration.

### 5. CLI arg parsing (`src/index.ts`)

Use Node's built-in `node:util.parseArgs` — no external dep:

```ts
import { parseArgs } from "node:util";

export async function runCli(argv: ReadonlyArray<string>): Promise<void> {
    const [command, ...rest] = argv;
    switch (command) {
        case "compile":         return runCompile(rest);
        case "scaffold-adapter": return runScaffoldAdapter(rest);
        case "--help":
        case "-h":
        case undefined:         return runHelp();
        default:
            console.error(`Unknown command: ${command}`);
            process.exitCode = 1;
            return runHelp();
    }
}
```

### 6. `chartlang compile` (`src/commands/compile.ts`)

```ts
type CompileArgs = {
    files: string[];           // positional
    sourcemap?: boolean | "inline" | "external";
    minify?: boolean;
    outDir?: string;           // override sibling-write
};
```

Behaviour:
- Resolve each file relative to `process.cwd()`.
- For each file, call `compileFile(path, { apiVersion: 1, write:
  true, sourcemap, minify, outDir })`.
- Print one line per file: `compiled <path> → <out-path>.chart.js
  (+ manifest + types)`.
- If any file errors, print the `CompileError`'s diagnostic
  array (file:line:col + code + message) and set `process.exitCode
  = 1`.
- Flags: `--sourcemap`, `--sourcemap=inline|external|none`,
  `--minify`, `--out <dir>`, `--help`.

Tests: per-flag positive + negative cases. Mock the filesystem
via a **hand-rolled in-memory shim** (no `memfs` dep — keeps Phase
1 lean). The shim is a small `Map<string, string>`-backed object
exposing `readFile`, `writeFile`, `rename`, `unlink` matching the
node `fs/promises` shape the compile path uses. Inject via a
dependency-injection pattern: `runCompile(args, { fs })`.

### 7. `chartlang scaffold-adapter` (`src/commands/scaffoldAdapter.ts`)

```ts
type ScaffoldArgs = {
    name: string;          // positional — kebab-case package name
    target: string;        // --target <dir>; default ./<name>
};
```

Behaviour:
- Validates `name` matches `^[a-z][a-z0-9-]*$`. Reject leading
  digits, capital letters, underscores.
- Creates the target directory.
- Copies the files from
  `packages/cli/src/adapterTemplate/` into the target, substituting
  template placeholders:
  - `<NAME>` → the passed name.
  - `<DATE>` → today's ISO date (UTC).
  - Adapter id = `kebab(name)`.
- Files written:
  - `package.json` — name `chartlang-adapter-<NAME>`, deps on
    `@invinite-org/chartlang-adapter-kit` + `@invinite-org/chartlang-host-worker`.
  - `tsconfig.json` — extends a relative base or stands alone.
  - `src/index.ts` — barebones adapter calling `defineAdapter`
    with a TODO capability bag.
  - `src/index.test.ts` — placeholder that imports and asserts the
    adapter is defined.
  - `README.md` — ≤100 lines, §17.1 structure.
  - `.gitignore` — `node_modules/`, `dist/`, `coverage/`.
- Idempotent: refuses to overwrite an existing file. If the
  target dir is non-empty, prints `target directory not empty`
  and exits 1.

The template files live in `packages/cli/src/adapterTemplate/`.
Each file's content lives as a string export in a TS module so
TypeScript can verify the template strings compile; we don't
want broken templates shipped.

```ts
// packages/cli/src/adapterTemplate/templates.ts
export const PACKAGE_JSON = (name: string, date: string): string => `...`;
export const TSCONFIG = `...`;
export const INDEX_TS = (name: string): string => `...`;
export const INDEX_TEST_TS = (name: string): string => `...`;
export const README_MD = (name: string, date: string): string => `...`;
export const GITIGNORE = `node_modules/\ndist/\ncoverage/\n`;
```

Tests: scaffold into a tmp directory; assert all expected files
exist, their content type-checks via a quick TypeScript program
build over `src/index.ts`.

### 8. `chartlang --help` (`src/commands/help.ts`)

Plain text:

```
chartlang — script compiler + adapter scaffolding

Usage:
  chartlang compile <file...> [--sourcemap[=mode]] [--minify] [--out <dir>]
  chartlang scaffold-adapter <name> [--target <dir>]
  chartlang --help

Examples:
  chartlang compile examples/scripts/ema-cross.chart.ts
  chartlang scaffold-adapter my-trading-chart --target ./out
```

### 9. Tests

§16.3 row: unit + type.

- `compile.test.ts`: positional + every flag path covered.
- `scaffoldAdapter.test.ts`: happy path, invalid name, non-empty
  target, file write atomicity.
- `index.test.ts`: arg parsing dispatch — each command + help +
  unknown command.
- `bin.test.ts`: import the bin file in a test harness; assert
  `runCli` is called with sliced argv. (Avoid spawning a child
  process — keep it in-process for coverage.)
- Type tests: `expect-type` over `runCli`'s signature.

Add `tinyglob` or use `node:fs/promises` glob — no globs needed
for Phase 1 (CLI takes explicit paths), keep deps minimal.

### 10. End-to-end script-compile assertion (lives in this task)

Add `packages/cli/src/e2e.test.ts`:

```ts
it("compiles each Phase-1 example script", async () => {
    const examples = [
        "examples/scripts/ema-cross.chart.ts",
        "examples/scripts/bollinger-bands.chart.ts",
        "examples/scripts/rsi-divergence-alert.chart.ts",
    ];
    for (const path of examples) {
        const compiled = await compileFile(path, { apiVersion: 1, write: false });
        expect(compiled.moduleSource).toMatch(/__manifest/);
        expect(compiled.manifest.apiVersion).toBe(1);
        expect(compiled.manifest.kind).toBe("indicator");
        expect(compiled.manifest.capabilities).toContain("indicators");
    }
});
```

This proves the three example scripts compile end-to-end —
exercising compiler + core + runtime types together.

### 11. Update `examples/scripts/` directory

The `.gitkeep` placeholder from Phase 0 is removed; the three
`.chart.ts` files take its place. No `README.md` per
`examples/scripts/` — the parent `examples/` directory's README is
the index.

### 12. JSDoc + per-package docs

- `runCli` carries `@since 0.1` + `@example` (non-script — just
  illustrative CLI usage).
- Each command function has a JSDoc block.
- The CLI README lists all subcommands and flags. ≤100 lines.

### 13. Remove `PACKAGE_VERSION`

Delete the placeholder export from `packages/cli/src/index.ts`.
The new export is `runCli` plus the command functions used by
tests.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/ema-cross.chart.ts` | Create | Example script. |
| `examples/scripts/bollinger-bands.chart.ts` | Create | Example script. |
| `examples/scripts/rsi-divergence-alert.chart.ts` | Create | Example script. |
| `examples/scripts/.gitkeep` | Delete | No longer needed. |
| `packages/cli/src/bin.ts` | Create | `#!/usr/bin/env node` entry. |
| `packages/cli/src/index.ts` | Modify | `runCli` dispatcher + remove placeholder. |
| `packages/cli/src/commands/compile.ts` | Create | Compile subcommand. |
| `packages/cli/src/commands/scaffoldAdapter.ts` | Create | Scaffold subcommand. |
| `packages/cli/src/commands/help.ts` | Create | Help text. |
| `packages/cli/src/commands/index.ts` | Create | Barrel. |
| `packages/cli/src/adapterTemplate/templates.ts` | Create | Template strings. |
| `packages/cli/src/*.test.ts` | Create | Per-module tests. |
| `packages/cli/src/e2e.test.ts` | Create | End-to-end example-compile coverage. |
| `packages/cli/package.json` | Modify | Add `bin` field, workspace deps on compiler + adapter-kit + host-worker. |
| `package.json` (root) | Modify | Add the `"chartlang": "pnpm -F @invinite-org/chartlang-cli exec chartlang"` script alias so `pnpm chartlang …` works from the repo root. |
| `packages/cli/README.md` | Modify | List the two subcommands. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-cli typecheck && pnpm -F
  @invinite-org/chartlang-cli test` pass with 100% coverage.
- `pnpm chartlang compile examples/scripts/ema-cross.chart.ts`
  writes the three sibling files and exits 0.
- `pnpm chartlang compile examples/scripts/*.chart.ts` compiles
  all three Phase-1 examples successfully.
- `pnpm chartlang scaffold-adapter test-adapter --target /tmp/test-adapter`
  produces a valid starter package whose `src/index.ts` compiles
  via `tsc --noEmit` (manual verification step).
- `pnpm chartlang --help` prints the help text.
- The e2e test compiles all three example scripts and asserts
  their manifests are well-formed.
- `pnpm docs:check`, `readme:check`, `lint`, `format:check`,
  `conformance` (still 0 scenarios) pass.
- Earlier-phase gates remain green.
