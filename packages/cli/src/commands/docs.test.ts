// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runDocsCommand } from "./docs";

const MINIMAL_PRIMITIVE = `/**
 * Demo primitive.
 * @formula  out = source
 * @warmup   0
 * @since 0.1
 * @experimental
 * @example
 *     // ta.demo("slot", bar.close)
 */
export function demo(slotId: string, source: number): number { return source; }
`;

const BAD_PRIMITIVE = `/**
 * Missing formula.
 * @warmup 0
 * @since 0.1
 * @experimental
 * @example
 *     // x
 */
export function bad(slotId: string): number { return 1; }
`;

describe("runDocsCommand", () => {
    let repoRoot: string;
    let sourceDir: string;
    let outDir: string;
    let priorCwd: string;
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let priorExitCode: number | undefined;

    beforeEach(async () => {
        repoRoot = await mkdtemp(join(tmpdir(), "chartlang-cli-docs-"));
        sourceDir = join(repoRoot, "packages", "runtime", "src", "ta");
        outDir = join(repoRoot, "docs", "primitives", "ta");
        await mkdir(sourceDir, { recursive: true });
        await mkdir(outDir, { recursive: true });
        await mkdir(join(repoRoot, "packages", "cli"), { recursive: true });
        await writeFile(
            join(repoRoot, "packages", "cli", "package.json"),
            JSON.stringify({
                name: "@invinite-org/chartlang-cli",
                repository: {
                    type: "git",
                    url: "https://github.com/outraday-org/chartlang.git",
                },
            }),
            "utf8",
        );
        await writeFile(join(repoRoot, "pnpm-workspace.yaml"), "packages:\n", "utf8");

        priorCwd = process.cwd();
        process.chdir(repoRoot);

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
    });

    afterEach(async () => {
        process.chdir(priorCwd);
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        process.exitCode = priorExitCode;
        await rm(repoRoot, { recursive: true, force: true });
    });

    it("writes one page per primitive with the default source/out dirs", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");

        await runDocsCommand([]);

        await expect(stat(join(outDir, "demo.md"))).resolves.toBeTruthy();
        const stdout = stdoutChunks.join("");
        expect(stdout).toMatch(/wrote docs\/primitives\/ta\/demo\.md/);
        expect(stdout).toMatch(/generated 1 primitive page\(s\)/);
    });

    it("honours absolute --source and --out paths", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
        const altOut = join(repoRoot, "alt-out");
        await mkdir(altOut, { recursive: true });

        await runDocsCommand(["--source", sourceDir, "--out", altOut]);

        await expect(stat(join(altOut, "demo.md"))).resolves.toBeTruthy();
    });

    it("prints help with --help and does not write pages", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");

        await runDocsCommand(["--help"]);

        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
        await expect(stat(join(outDir, "demo.md"))).rejects.toThrow();
    });

    it("sets process.exitCode = 1 and writes a structured error on GenDocsError", async () => {
        await writeFile(join(sourceDir, "bad.ts"), BAD_PRIMITIVE, "utf8");

        await runDocsCommand([]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/\[missing-formula\]/);
    });

    it("rethrows non-GenDocsError errors (e.g. missing source directory)", async () => {
        // Point --source at a nonexistent directory; the runner walks it
        // and the readdir call throws ENOENT. The runner does not catch
        // it — it propagates to the bin handler.
        const missing = join(repoRoot, "no-such-dir");
        await expect(runDocsCommand(["--source", missing])).rejects.toThrow();
    });

    it("rejects unknown flags via parseArgs strict mode", async () => {
        await expect(runDocsCommand(["--bogus"])).rejects.toThrow();
    });

    it("resolves --source and --out relative to the repo root", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");

        await runDocsCommand([
            "--source",
            "packages/runtime/src/ta",
            "--out",
            "docs/primitives/ta",
        ]);

        const content = await readFile(join(outDir, "demo.md"), "utf8");
        expect(content).toMatch(/AUTO-GENERATED/);
    });
});
