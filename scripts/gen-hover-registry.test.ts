// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { collectHoverRegistryEntries, generateHoverRegistry } from "./gen-hover-registry";

describe("gen-hover-registry", () => {
    it("extracts exported JSDoc entries and supports check mode", async () => {
        const root = await mkdtemp(join(tmpdir(), "chartlang-hover-"));
        const core = join(root, "core");
        const output = join(root, "hoverRegistry.generated.ts");
        await mkdir(core);
        await writeFile(
            join(core, "fixture.ts"),
            `/**
 * Example namespace.
 *
 * @since 0.4
 * @stable
 * @example
 *     const ns = fixture;
 */
export const fixture = Object.freeze({
    /**
     * Do work.
     *
     * @param value value docs
     * @since 0.4
     * @stable
     * @example
     *     fixture.work(1);
     */
    work(value: number): number {
        return value;
    },
});

/**
 * The typed surface of the sample namespace.
 *
 * @since 0.4
 * @experimental
 * @example
 *     const x: SampleNamespace | null = null;
 */
export type SampleNamespace = {
    run(value: string): string;
};
`,
            "utf8",
        );

        const entries = await collectHoverRegistryEntries(core);
        expect(entries.map((entry) => entry.fqn)).toEqual([
            "fixture",
            "fixture.work",
            "sample.run",
            "SampleNamespace",
        ]);

        await generateHoverRegistry({ coreSrcDir: core, outputFile: output });
        await expect(
            generateHoverRegistry({ coreSrcDir: core, outputFile: output, check: true }),
        ).resolves.toBeUndefined();

        await writeFile(output, "stale", "utf8");
        await expect(
            generateHoverRegistry({ coreSrcDir: core, outputFile: output, check: true }),
        ).rejects.toThrow("out of date");

        const generated = await readFile(output, "utf8");
        expect(generated).toBe("stale");
    });
});
