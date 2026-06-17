// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorMessage, runPineConvert } from "./pineConvert.js";

describe("errorMessage", () => {
    it("returns the message of an Error instance", () => {
        expect(errorMessage(new Error("boom"))).toBe("boom");
    });

    it("stringifies a non-Error thrown value", () => {
        expect(errorMessage("plain string")).toBe("plain string");
    });
});

// A script whose conversion emits at least one warning-severity diagnostic, so
// `--strict` has something to upgrade. `format=format.inherit` has no chartlang
// analogue and raises `indicator-arg-not-mapped` (warning) while still emitting
// valid output.
const WARN_PINE = `//@version=6
indicator("warn", format=format.inherit)
plot(close)
`;

const HELLO_PINE = '//@version=6\nindicator("hello")\n';

describe("runPineConvert", () => {
    let workspace: string;
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let priorExitCode: number | undefined;
    let priorIsTTY: boolean | undefined;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-pine-convert-"));
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
        priorIsTTY = process.stderr.isTTY;
        // Force non-TTY so the default routing is deterministic; the TTY branch
        // is exercised by its own test below.
        Object.defineProperty(process.stderr, "isTTY", { value: false, configurable: true });
    });

    afterEach(async () => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        process.exitCode = priorExitCode;
        Object.defineProperty(process.stderr, "isTTY", {
            value: priorIsTTY,
            configurable: true,
        });
        await rm(workspace, { recursive: true, force: true });
    });

    async function writeInput(name: string, source: string): Promise<string> {
        const path = join(workspace, name);
        await writeFile(path, source, "utf-8");
        return path;
    }

    it("streams converted output to stdout when --out is absent", async () => {
        const input = await writeInput("hello.pine", HELLO_PINE);

        await runPineConvert([input]);

        expect(stdoutChunks.join("")).toMatch(/\/\/ Auto-generated/);
        expect(process.exitCode).toBeUndefined();
    });

    it("writes converted output to --out and leaves stdout empty of source", async () => {
        const input = await writeInput("hello.pine", HELLO_PINE);
        const out = join(workspace, "hello.chart.ts");

        await runPineConvert([input, "--out", out]);

        const written = await readFile(out, "utf-8");
        expect(written).toMatch(/\/\/ Auto-generated/);
        expect(stdoutChunks.join("")).not.toMatch(/\/\/ Auto-generated/);
        expect(process.exitCode).toBeUndefined();
    });

    it("prints the human report to stderr under --report", async () => {
        const input = await writeInput("hello.pine", HELLO_PINE);

        await runPineConvert([input, "--report"]);

        expect(stderrChunks.join("")).toMatch(/==== converter diagnostics ====/);
    });

    it("prints the human report to stderr when stderr is a TTY", async () => {
        Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
        const input = await writeInput("hello.pine", HELLO_PINE);

        await runPineConvert([input]);

        expect(stderrChunks.join("")).toMatch(/==== converter diagnostics ====/);
    });

    it("emits parseable JSON diagnostics on stdout under --diagnostics-json", async () => {
        const input = await writeInput("warn.pine", WARN_PINE);

        await runPineConvert([input, "--diagnostics-json"]);

        const parsed: unknown = JSON.parse(stdoutChunks.join(""));
        expect(Array.isArray(parsed)).toBe(true);
        // JSON mode suppresses the converted source from stdout.
        expect(stdoutChunks.join("")).not.toMatch(/\/\/ Auto-generated/);
    });

    it("--strict exits 1 when warnings are present", async () => {
        const input = await writeInput("warn.pine", WARN_PINE);

        await runPineConvert([input, "--strict", "--diagnostics-json"]);

        const parsed = JSON.parse(stdoutChunks.join("")) as ReadonlyArray<{ severity: string }>;
        expect(parsed.some((d) => d.severity === "error")).toBe(true);
        expect(process.exitCode).toBe(1);
    });

    it("threads --bar-interval and --bar-index-origin through to convert", async () => {
        const input = await writeInput("hello.pine", HELLO_PINE);

        await runPineConvert([input, "--bar-interval", "60000", "--bar-index-origin", "0"]);

        expect(stdoutChunks.join("")).toMatch(/\/\/ Auto-generated/);
    });

    it("exits 2 when the input file does not exist", async () => {
        await runPineConvert([join(workspace, "missing.pine")]);

        expect(stderrChunks.join("")).toMatch(/failed to read/);
        expect(process.exitCode).toBe(2);
    });

    it("exits 3 when no input file is given", async () => {
        await runPineConvert([]);

        expect(stderrChunks.join("")).toMatch(/requires an input file path/);
        expect(process.exitCode).toBe(3);
    });

    it("exits 3 when more than one positional is given", async () => {
        await runPineConvert(["a.pine", "b.pine"]);

        expect(stderrChunks.join("")).toMatch(/accepts a single input file/);
        expect(process.exitCode).toBe(3);
    });

    it("exits 3 on an unknown flag", async () => {
        await runPineConvert(["hello.pine", "--bogus"]);

        expect(stderrChunks.join("")).toMatch(/error:/);
        expect(process.exitCode).toBe(3);
    });

    it("exits 3 on a non-numeric --bar-interval", async () => {
        const input = await writeInput("hello.pine", HELLO_PINE);

        await runPineConvert([input, "--bar-interval", "abc"]);

        expect(stderrChunks.join("")).toMatch(/invalid --bar-interval value/);
        expect(process.exitCode).toBe(3);
    });

    it("exits 3 on a non-numeric --bar-index-origin", async () => {
        const input = await writeInput("hello.pine", HELLO_PINE);

        await runPineConvert([input, "--bar-index-origin", "xyz"]);

        expect(stderrChunks.join("")).toMatch(/invalid --bar-index-origin value/);
        expect(process.exitCode).toBe(3);
    });

    it("prints help under --help without converting", async () => {
        await runPineConvert(["--help"]);

        expect(stdoutChunks.join("")).toMatch(/chartlang pine-convert/);
        expect(process.exitCode).toBeUndefined();
    });
});
