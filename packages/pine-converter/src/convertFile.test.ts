// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { convertFile } from "./index.js";

const HELLO_PINE = "//@version=6\nindicator('hello')\n";

describe("convertFile", () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-convert-file-"));
    });

    afterEach(async () => {
        await rm(workspace, { recursive: true, force: true });
    });

    it("reads a Pine file, converts it, and returns the ConvertResult", async () => {
        const input = join(workspace, "hello.pine");
        await writeFile(input, HELLO_PINE, "utf-8");

        const result = await convertFile(input);

        expect(result.output).not.toBeNull();
        expect(result.output?.startsWith("// Auto-generated")).toBe(true);
        expect(result.manifest?.name).toBe("hello");
        expect(Array.isArray(result.diagnostics)).toBe(true);
    });

    it("writes the converted output to outPath when set and output is non-null", async () => {
        const input = join(workspace, "hello.pine");
        const output = join(workspace, "hello.chart.ts");
        await writeFile(input, HELLO_PINE, "utf-8");

        const result = await convertFile(input, { outPath: output });

        const written = await readFile(output, "utf-8");
        expect(written).toBe(result.output);
    });

    it("does not write any file when outPath is omitted", async () => {
        const input = join(workspace, "hello.pine");
        await writeFile(input, HELLO_PINE, "utf-8");

        await convertFile(input, { strictMode: false });

        await expect(stat(join(workspace, "hello.chart.ts"))).rejects.toThrow();
    });

    it("does not write when output is null (no declaration parses)", async () => {
        const input = join(workspace, "empty.pine");
        const output = join(workspace, "empty.chart.ts");
        await writeFile(input, "", "utf-8");

        const result = await convertFile(input, { outPath: output });

        expect(result.output).toBeNull();
        await expect(stat(output)).rejects.toThrow();
    });

    it("forwards ConvertOpts through to convert (strictMode honored)", async () => {
        const input = join(workspace, "hello.pine");
        await writeFile(input, HELLO_PINE, "utf-8");

        const result = await convertFile(input, { strictMode: true });

        expect(result.output).not.toBeNull();
    });

    it("rejects when the input file does not exist (host I/O error)", async () => {
        await expect(convertFile(join(workspace, "missing.pine"))).rejects.toThrow();
    });
});
