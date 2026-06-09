// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runCompile } from "./compile";

const EMA_CROSS_SRC = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "EMA cross",
    apiVersion: 1,
    compute: ({ bar }) => {
        const fast = ta.ema(bar.close, 12);
        plot(fast);
    },
});
`;

const BROKEN_SRC = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "broken",
    apiVersion: 1,
    compute: () => {
        while (true) {}
    },
});
`;

const COMPILE_TIMEOUT_MS = 15_000;

describe("runCompile", () => {
    let workspace: string;
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let priorExitCode: number | undefined;
    let priorCwd: string;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-cli-compile-"));
        stdoutChunks = [];
        stderrChunks = [];
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
            stdoutChunks.push(typeof chunk === "string" ? chunk : chunk.toString());
            return true;
        });
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
            stderrChunks.push(typeof chunk === "string" ? chunk : chunk.toString());
            return true;
        });
        priorExitCode = process.exitCode;
        process.exitCode = undefined;
        priorCwd = process.cwd();
    });

    afterEach(async () => {
        process.chdir(priorCwd);
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        process.exitCode = priorExitCode;
        await rm(workspace, { recursive: true, force: true });
    });

    it("writes the triple as siblings of the source file", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile([source]);

        await expect(stat(join(workspace, "ema.chart.js"))).resolves.toBeTruthy();
        await expect(stat(join(workspace, "ema.chart.manifest.json"))).resolves.toBeTruthy();
        await expect(stat(join(workspace, "ema.chart.d.ts"))).resolves.toBeTruthy();
        expect(stdoutChunks.join("")).toMatch(/compiled .+ema\.chart\.ts → .+ema\.chart\.js/);
    });

    it("writes an external .map sibling when --sourcemap=external", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile([source, "--sourcemap=external"]);

        await expect(stat(join(workspace, "ema.chart.js.map"))).resolves.toBeTruthy();
    });

    it("treats bare --sourcemap as true (writes the .map sibling)", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile([source, "--sourcemap"]);

        await expect(stat(join(workspace, "ema.chart.js.map"))).resolves.toBeTruthy();
    });

    it("does not write a .map sibling when --sourcemap=inline", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile([source, "--sourcemap=inline"]);

        await expect(stat(join(workspace, "ema.chart.js.map"))).rejects.toThrow();
    });

    it("treats --sourcemap=none as no sourcemap", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile([source, "--sourcemap=none"]);

        await expect(stat(join(workspace, "ema.chart.js.map"))).rejects.toThrow();
    });

    it("rejects an invalid --sourcemap mode by throwing", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await expect(runCompile([source, "--sourcemap=bogus"])).rejects.toThrow(
            /invalid --sourcemap value/,
        );
    });

    it("propagates --minify to the bundler", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile([source, "--minify"]);

        const js = await readFile(join(workspace, "ema.chart.js"), "utf8");
        expect(js.length).toBeGreaterThan(0);
    });

    it("writes the triple to --out <dir> when supplied", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");
        const outDir = join(workspace, "out");

        await runCompile([source, "--out", outDir]);

        await expect(stat(join(outDir, "ema.chart.js"))).resolves.toBeTruthy();
        await expect(stat(join(outDir, "ema.chart.manifest.json"))).resolves.toBeTruthy();
        await expect(stat(join(outDir, "ema.chart.d.ts"))).resolves.toBeTruthy();
        // The sibling next to the source should NOT exist.
        await expect(stat(join(workspace, "ema.chart.js"))).rejects.toThrow();
    });

    it("writes a .map sibling under --out when --sourcemap=external", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");
        const outDir = join(workspace, "out");

        await runCompile([source, "--out", outDir, "--sourcemap=external"]);

        await expect(stat(join(outDir, "ema.chart.js.map"))).resolves.toBeTruthy();
    });

    it("propagates --minify through the --out branch", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");
        const outDir = join(workspace, "out");

        await runCompile([source, "--out", outDir, "--minify"]);

        const js = await readFile(join(outDir, "ema.chart.js"), "utf8");
        expect(js.length).toBeGreaterThan(0);
    });

    it("resolves a relative --out against process.cwd()", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");
        process.chdir(workspace);

        await runCompile([source, "--out", "rel-out"]);

        await expect(stat(join(workspace, "rel-out", "ema.chart.js"))).resolves.toBeTruthy();
    });

    it("resolves a relative source path against process.cwd()", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");
        process.chdir(workspace);

        await runCompile(["ema.chart.ts"]);

        await expect(stat(join(workspace, "ema.chart.js"))).resolves.toBeTruthy();
    });

    it("prints help with --help and does not compile", async () => {
        const source = join(workspace, "ema.chart.ts");
        await writeFile(source, EMA_CROSS_SRC, "utf8");

        await runCompile(["--help"]);

        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
        await expect(stat(join(workspace, "ema.chart.js"))).rejects.toThrow();
    });

    it("errors when no positional files are provided", async () => {
        await runCompile([]);
        expect(stderrChunks.join("")).toMatch(/requires at least one file path/);
        expect(process.exitCode).toBe(1);
    });

    it("reports diagnostics and sets exitCode 1 on a CompileError", async () => {
        const source = join(workspace, "broken.chart.ts");
        await writeFile(source, BROKEN_SRC, "utf8");

        await runCompile([source]);

        expect(process.exitCode).toBe(1);
        const stderr = stderrChunks.join("");
        expect(stderr).toMatch(/failed to compile/);
        expect(stderr).toMatch(/unbounded-loop/);
    });

    it("rethrows non-CompileError errors (e.g. ENOENT)", async () => {
        const missing = join(workspace, "missing.chart.ts");
        await expect(runCompile([missing])).rejects.toThrow();
    });

    it("compiles multiple positional files in sequence", async () => {
        const a = join(workspace, "a.chart.ts");
        const b = join(workspace, "b.chart.ts");
        await writeFile(a, EMA_CROSS_SRC, "utf8");
        await writeFile(b, EMA_CROSS_SRC, "utf8");

        await runCompile([a, b]);

        await expect(stat(join(workspace, "a.chart.js"))).resolves.toBeTruthy();
        await expect(stat(join(workspace, "b.chart.js"))).resolves.toBeTruthy();
    }, COMPILE_TIMEOUT_MS);

    it("continues with the next file after a CompileError", async () => {
        const ok = join(workspace, "ok.chart.ts");
        const bad = join(workspace, "bad.chart.ts");
        await writeFile(ok, EMA_CROSS_SRC, "utf8");
        await writeFile(bad, BROKEN_SRC, "utf8");

        await runCompile([bad, ok]);

        expect(process.exitCode).toBe(1);
        await expect(stat(join(workspace, "ok.chart.js"))).resolves.toBeTruthy();
    });
});
