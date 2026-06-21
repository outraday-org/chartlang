// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runCli } from "./index.js";

describe("runCli dispatcher", () => {
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let priorExitCode: number | undefined;

    beforeEach(() => {
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

    afterEach(() => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        process.exitCode = priorExitCode;
    });

    it("prints help when called with no arguments", async () => {
        await runCli([]);
        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
        expect(process.exitCode).toBeUndefined();
    });

    it("prints help when called with --help", async () => {
        await runCli(["--help"]);
        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
    });

    it("prints help when called with -h", async () => {
        await runCli(["-h"]);
        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
    });

    it("dispatches `compile` to runCompile", async () => {
        // No positional files → exits with code 1, but proves dispatch path.
        await runCli(["compile"]);
        expect(stderrChunks.join("")).toMatch(/requires at least one file path/);
        expect(process.exitCode).toBe(1);
    });

    it("dispatches `scaffold-adapter` to runScaffoldAdapter", async () => {
        // No positional name → exits 1, but proves dispatch.
        await runCli(["scaffold-adapter"]);
        expect(stderrChunks.join("")).toMatch(/requires a name positional/);
        expect(process.exitCode).toBe(1);
    });

    it("dispatches `add-adapter` to runAddAdapter", async () => {
        // --list short-circuits before any filesystem write — proves dispatch
        // through the default IO deps.
        await runCli(["add-adapter", "--list"]);
        expect(stdoutChunks.join("")).toMatch(/Available chartlang adapters/);
        expect(process.exitCode).toBeUndefined();
    });

    it("dispatches `docs` to runDocsCommand", async () => {
        // --help short-circuits the generator — proves dispatch without
        // requiring the runtime source tree to be reachable from the
        // ephemeral cwd.
        await runCli(["docs", "--help"]);
        expect(stdoutChunks.join("")).toMatch(/chartlang docs \[--source <dir>\] \[--out <dir>\]/);
    });

    it("dispatches `pine-convert` to runPineConvert", async () => {
        // --help short-circuits before any file read — proves dispatch.
        await runCli(["pine-convert", "--help"]);
        expect(stdoutChunks.join("")).toMatch(/chartlang pine-convert <input\.pine>/);
    });

    it("reports unknown commands and prints help with exit code 1", async () => {
        await runCli(["bogus-command"]);
        expect(stderrChunks.join("")).toMatch(/Unknown command: bogus-command/);
        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
        expect(process.exitCode).toBe(1);
    });
});
