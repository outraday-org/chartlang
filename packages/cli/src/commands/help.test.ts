// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { printHelp, runHelp } from "./help.js";

describe("printHelp", () => {
    it("writes the help text to the supplied stream", () => {
        const chunks: string[] = [];
        const stream = {
            write(chunk: string | Uint8Array): boolean {
                chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
                return true;
            },
        } as NodeJS.WritableStream;
        printHelp(stream);
        const out = chunks.join("");
        expect(out).toMatch(/chartlang — script compiler/);
        expect(out).toMatch(/chartlang compile <file\.\.\.>/);
        expect(out).toMatch(/chartlang scaffold-adapter <name>/);
        expect(out).toMatch(/chartlang add-adapter \[id\] \[dir\] \[--list\]/);
        expect(out).toMatch(/chartlang docs \[--source <dir>\] \[--out <dir>\]/);
        expect(out).toMatch(/chartlang --help/);
        expect(out).toMatch(/Examples:/);
        expect(out).toMatch(/chartlang docs --out docs\/primitives\/ta/);
    });
});

describe("runHelp", () => {
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let chunks: string[];

    beforeEach(() => {
        chunks = [];
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
            chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
            return true;
        });
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
    });

    it("writes the help text to process.stdout", () => {
        runHelp();
        expect(chunks.join("")).toMatch(/chartlang — script compiler/);
    });
});
