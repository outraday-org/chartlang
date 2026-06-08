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

const MINIMAL_DRAW = `/**
 * Demo draw kind.
 * @anchors a, b
 * @anchorCount 2
 * @bucket lines
 * @since 0.3
 * @experimental
 * @example
 *     // draw.line(a, b)
 */
export function line(slotId: string): { id: string } { return { id: slotId }; }
`;

const MINIMAL_PHASE4_INPUT = `export const input = Object.freeze({
    /**
     * Build an integer input descriptor.
     * @since 0.4
     * @stable
     * @example
     *     const v = input.int(1);
     */
    int(): unknown { return {}; },
    /** Build a float input descriptor. @since 0.4 @stable @example const v = input.float(1); */
    float(): unknown { return {}; },
    /** Build a bool input descriptor. @since 0.4 @stable @example const v = input.bool(true); */
    bool(): unknown { return {}; },
    /** Build a string input descriptor. @since 0.4 @stable @example const v = input.string("x"); */
    string(): unknown { return {}; },
    /** Build an enum input descriptor. @since 0.4 @stable @example const v = input.enum("x", ["x"]); */
    enum(): unknown { return {}; },
    /** Build a color input descriptor. @since 0.4 @stable @example const v = input.color("#fff"); */
    color(): unknown { return {}; },
    /** Build a source input descriptor. @since 0.4 @stable @example const v = input.source("close"); */
    source(): unknown { return {}; },
    /** Build a time input descriptor. @since 0.4 @stable @example const v = input.time(0); */
    time(): unknown { return {}; },
    /** Build a price input descriptor. @since 0.4 @stable @example const v = input.price(1); */
    price(): unknown { return {}; },
    /** Build a symbol input descriptor. @since 0.4 @stable @example const v = input.symbol("AAPL"); */
    symbol(): unknown { return {}; },
    /** Build an interval input descriptor. @since 0.4 @stable @example const v = input.interval("1D"); */
    interval(): unknown { return {}; },
    /** Build an external series input descriptor. @since 0.4 @stable @example const v = input.externalSeries({}); */
    externalSeries(): unknown { return {}; },
});`;

const MINIMAL_PHASE4_STATE = `export const state = Object.freeze({
    /** Persistent float. @since 0.4 @stable @example const v = state.float(1); */
    float(): unknown { return {}; },
    /** Persistent int. @since 0.4 @stable @example const v = state.int(1); */
    int(): unknown { return {}; },
    /** Persistent bool. @since 0.4 @stable @example const v = state.bool(true); */
    bool(): unknown { return {}; },
    /** Persistent string. @since 0.4 @stable @example const v = state.string("x"); */
    string(): unknown { return {}; },
    /** Tick-persistent state. @since 0.4 @stable @example const v = state.tick.float(1); */
    tick: Object.freeze({
        float(): unknown { return {}; },
        int(): unknown { return {}; },
        bool(): unknown { return {}; },
        string(): unknown { return {}; },
    }),
});`;

const MINIMAL_PHASE4_BARSTATE = `/** Bar-state view. @since 0.4 @stable @example void barstate; */
export const barstate = Object.freeze({});`;
const MINIMAL_PHASE4_SYMINFO = `/** Symbol view. @since 0.4 @stable @example void syminfo; */
export const syminfo = Object.freeze({});`;
const MINIMAL_PHASE4_TIMEFRAME = `/** Timeframe view. @since 0.4 @stable @example void timeframe; */
export const timeframe = Object.freeze({});`;
const MINIMAL_PHASE4_REQUEST = `export const request = Object.freeze({
    /** Read a secondary stream. @since 0.4 @stable @example const v = request.security({ interval: "1D" }); */
    security(): unknown { return {}; },
});`;
const MINIMAL_PHASE4_OVERRIDES = `/** Overrides. @since 0.4 @experimental @example const o: ScriptOverrides = {}; */
export type ScriptOverrides = Readonly<{
    /** Max bars. @since 0.4 @example const v: ScriptOverrides["maxBarsBack"] = 1; */
    maxBarsBack?: number;
    /** Format. @since 0.4 @example const v: ScriptOverrides["format"] = "price"; */
    format?: string;
    /** Precision. @since 0.4 @example const v: ScriptOverrides["precision"] = 2; */
    precision?: number;
    /** Scale. @since 0.4 @example const v: ScriptOverrides["scale"] = "right"; */
    scale?: string;
    /** Intervals. @since 0.4 @example const v: ScriptOverrides["requiresIntervals"] = ["1D"]; */
    requiresIntervals?: ReadonlyArray<string>;
    /** Short name. @since 0.4 @example const v: ScriptOverrides["shortName"] = "EMA"; */
    shortName?: string;
}>;`;

describe("runDocsCommand", () => {
    let repoRoot: string;
    let sourceDir: string;
    let outDir: string;
    let drawSourceDir: string;
    let drawOutDir: string;
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
        drawSourceDir = join(repoRoot, "packages", "runtime", "src", "emit", "draw");
        drawOutDir = join(repoRoot, "docs", "primitives", "draw");
        await mkdir(sourceDir, { recursive: true });
        await mkdir(outDir, { recursive: true });
        await mkdir(drawSourceDir, { recursive: true });
        await mkdir(drawOutDir, { recursive: true });
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
        await mkdir(join(repoRoot, "packages/core/src/input"), { recursive: true });
        await mkdir(join(repoRoot, "packages/core/src/state"), { recursive: true });
        await mkdir(join(repoRoot, "packages/core/src/views"), { recursive: true });
        await mkdir(join(repoRoot, "packages/core/src/request"), { recursive: true });
        await mkdir(join(repoRoot, "packages/core/src/define"), { recursive: true });
        await writeFile(
            join(repoRoot, "packages/core/src/input/input.ts"),
            MINIMAL_PHASE4_INPUT,
            "utf8",
        );
        await writeFile(
            join(repoRoot, "packages/core/src/state/state.ts"),
            MINIMAL_PHASE4_STATE,
            "utf8",
        );
        await writeFile(
            join(repoRoot, "packages/core/src/views/barstate.ts"),
            MINIMAL_PHASE4_BARSTATE,
            "utf8",
        );
        await writeFile(
            join(repoRoot, "packages/core/src/views/syminfo.ts"),
            MINIMAL_PHASE4_SYMINFO,
            "utf8",
        );
        await writeFile(
            join(repoRoot, "packages/core/src/views/timeframe.ts"),
            MINIMAL_PHASE4_TIMEFRAME,
            "utf8",
        );
        await writeFile(
            join(repoRoot, "packages/core/src/request/request.ts"),
            MINIMAL_PHASE4_REQUEST,
            "utf8",
        );
        await writeFile(
            join(repoRoot, "packages/core/src/define/overrides.ts"),
            MINIMAL_PHASE4_OVERRIDES,
            "utf8",
        );

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
        expect(stdout).toMatch(/generated 0 drawing page\(s\)/);
    });

    it("regenerates both ta and draw trees in a single invocation", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
        const linesDir = join(drawSourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_DRAW, "utf8");

        await runDocsCommand([]);

        await expect(stat(join(outDir, "demo.md"))).resolves.toBeTruthy();
        await expect(stat(join(drawOutDir, "line.md"))).resolves.toBeTruthy();
        const stdout = stdoutChunks.join("");
        expect(stdout).toMatch(/wrote docs\/primitives\/draw\/line\.md/);
        expect(stdout).toMatch(/generated 1 drawing page\(s\)/);
    });

    it("honours absolute --draw-source / --draw-out flags", async () => {
        const linesDir = join(drawSourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_DRAW, "utf8");
        const altDraw = join(repoRoot, "alt-draw-out");
        await mkdir(altDraw, { recursive: true });

        await runDocsCommand(["--draw-source", drawSourceDir, "--draw-out", altDraw]);

        await expect(stat(join(altDraw, "line.md"))).resolves.toBeTruthy();
    });

    it("honours --ta-source / --ta-out as explicit aliases", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
        const altOut = join(repoRoot, "alt-ta-out");
        await mkdir(altOut, { recursive: true });

        await runDocsCommand(["--ta-source", sourceDir, "--ta-out", altOut]);

        await expect(stat(join(altOut, "demo.md"))).resolves.toBeTruthy();
    });

    it("sets process.exitCode = 1 on a draw-side GenDocsError", async () => {
        const linesDir = join(drawSourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(
            join(linesDir, "line.ts"),
            // Drop the @bucket tag to trigger a missing-bucket error.
            MINIMAL_DRAW.replace(/\* @bucket[^\n]+\n/, ""),
            "utf8",
        );

        await runDocsCommand([]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/\[missing-bucket\]/);
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
