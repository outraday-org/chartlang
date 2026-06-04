// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { executeExampleBlock, qualifiesForExecution, stripFences } from "./docs-check.executor";

const SCRIPT = `
import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA(20)",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(ta.ema(bar.close, 20));
    },
});
`;

const HOSTILE_SCRIPT = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "bad",
    apiVersion: 1,
    compute: () => {
        plot(Math.random());
    },
});
`;

describe("qualifiesForExecution", () => {
    it("returns true when the block has a chartlang import and a defineIndicator call", () => {
        expect(qualifiesForExecution(SCRIPT)).toBe(true);
    });

    it("returns true for defineAlert", () => {
        expect(
            qualifiesForExecution(`from "@invinite-org/chartlang-core";\ndefineAlert({});`),
        ).toBe(true);
    });

    it("returns false without a chartlang import", () => {
        expect(qualifiesForExecution("export default defineIndicator({});")).toBe(false);
    });

    it("returns false when the chartlang import is present but no defineX call", () => {
        expect(
            qualifiesForExecution(`import { ta } from "@invinite-org/chartlang-core";\nta;`),
        ).toBe(false);
    });
});

describe("stripFences", () => {
    it("extracts content between fences", () => {
        expect(stripFences("```ts\nfoo\n```")).toBe("foo");
    });

    it("returns the text unchanged when no fences are present", () => {
        expect(stripFences("    indented block")).toBe("    indented block");
    });

    it("tolerates a fence with no language tag", () => {
        expect(stripFences("```\nbar\n```")).toBe("bar");
    });

    it("tolerates indentation before the opening fence", () => {
        expect(stripFences("  ```ts\nbaz\n  ```")).toBe("baz");
    });

    it("returns the rest of the text when the closing fence is missing", () => {
        expect(stripFences("```ts\nincomplete")).toBe("incomplete");
    });
});

describe("executeExampleBlock", () => {
    it("compiles a valid chartlang script silently", async () => {
        const record = vi.fn();
        await executeExampleBlock({
            source: SCRIPT,
            file: "demo.ts",
            line: 1,
            name: "demo",
            record,
        });
        expect(record).not.toHaveBeenCalled();
    });

    it("reports a CompileError when the block uses Math.random", async () => {
        const record = vi.fn();
        await executeExampleBlock({
            source: HOSTILE_SCRIPT,
            file: "demo.ts",
            line: 1,
            name: "demo",
            record,
        });
        expect(record).toHaveBeenCalledTimes(1);
        const args = record.mock.calls[0];
        expect(args?.[3]).toContain("hostile-global");
    });

    it("skips non-chartlang blocks without calling compile", async () => {
        const record = vi.fn();
        await executeExampleBlock({
            source: "const x = 1; void x;",
            file: "demo.ts",
            line: 1,
            name: "demo",
            record,
        });
        expect(record).not.toHaveBeenCalled();
    });

    it("skips chartlang blocks that have no defineIndicator/defineAlert call", async () => {
        const record = vi.fn();
        await executeExampleBlock({
            source: 'import { ta } from "@invinite-org/chartlang-core";\nvoid ta;',
            file: "demo.ts",
            line: 1,
            name: "demo",
            record,
        });
        expect(record).not.toHaveBeenCalled();
    });

    it("strips fences before compiling", async () => {
        const record = vi.fn();
        const fenced = `\`\`\`ts\n${SCRIPT.trim()}\n\`\`\``;
        await executeExampleBlock({
            source: fenced,
            file: "demo.ts",
            line: 1,
            name: "demo",
            record,
        });
        expect(record).not.toHaveBeenCalled();
    });
});
