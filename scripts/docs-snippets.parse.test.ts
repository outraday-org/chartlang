// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { extractSnippets } from "./docs-snippets.parse";

const CHART_BLOCK = `\`\`\`ts
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
\`\`\``;

const CONSUMER_BLOCK = `\`\`\`ts
import { foo } from "bar";
const x: number = 1; void x; void foo;
\`\`\``;

const OPT_OUT_BLOCK = `\`\`\`ts no-gate
import { weird } from "not-yet-published";
void weird;
\`\`\``;

const TYPESCRIPT_FENCE_BLOCK = `\`\`\`typescript
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
\`\`\``;

describe("extractSnippets", () => {
    it("returns an empty array when the markdown has no ts fences", () => {
        expect(extractSnippets("a.md", "# title\n\nplain prose")).toEqual([]);
    });

    it("ignores non-ts fenced blocks", () => {
        const md = "```bash\npnpm test\n```\n\n```mermaid\nflowchart LR\nA --> B\n```\n";
        expect(extractSnippets("a.md", md)).toEqual([]);
    });

    it("classifies a chartlang import + defineIndicator block as chart-script", () => {
        const result = extractSnippets("README.md", CHART_BLOCK);
        expect(result).toHaveLength(1);
        expect(result[0]?.kind).toBe("chart-script");
        expect(result[0]?.file).toBe("README.md");
        expect(result[0]?.line).toBe(1);
        expect(result[0]?.body).toContain("defineIndicator(");
    });

    it("classifies a typescript-language fence the same as a ts fence", () => {
        const result = extractSnippets("a.md", TYPESCRIPT_FENCE_BLOCK);
        expect(result[0]?.kind).toBe("chart-script");
    });

    it("classifies plain consumer code as consumer", () => {
        const result = extractSnippets("a.md", CONSUMER_BLOCK);
        expect(result[0]?.kind).toBe("consumer");
    });

    it("classifies a no-gate fence annotation as opt-out", () => {
        const result = extractSnippets("a.md", OPT_OUT_BLOCK);
        expect(result[0]?.kind).toBe("opt-out");
    });

    it("classifies a chartlang import without defineX as consumer", () => {
        const block = '```ts\nimport { ta } from "@invinite-org/chartlang-core";\nvoid ta;\n```';
        expect(extractSnippets("a.md", block)[0]?.kind).toBe("consumer");
    });

    it("classifies a defineX without a chartlang import as consumer", () => {
        const block = "```ts\nexport default defineIndicator({});\n```";
        expect(extractSnippets("a.md", block)[0]?.kind).toBe("consumer");
    });

    it("recognises defineAlert as a chart-script trigger", () => {
        const block =
            "```ts\n" +
            'import { defineAlert } from "@invinite-org/chartlang-core";\n' +
            "defineAlert({});\n" +
            "```";
        expect(extractSnippets("a.md", block)[0]?.kind).toBe("chart-script");
    });

    it("recognises defineDrawing as a chart-script trigger", () => {
        const block =
            "```ts\n" +
            'import { defineDrawing } from "@invinite-org/chartlang-core";\n' +
            "defineDrawing({});\n" +
            "```";
        expect(extractSnippets("a.md", block)[0]?.kind).toBe("chart-script");
    });

    it("recognises defineAlertCondition as a chart-script trigger", () => {
        const block =
            "```ts\n" +
            'import { defineAlertCondition } from "@invinite-org/chartlang-core";\n' +
            "defineAlertCondition({});\n" +
            "```";
        expect(extractSnippets("a.md", block)[0]?.kind).toBe("chart-script");
    });

    it("returns multiple snippets in source order with accurate line numbers", () => {
        const md = `${CHART_BLOCK}\n\n${CONSUMER_BLOCK}`;
        const result = extractSnippets("a.md", md);
        expect(result).toHaveLength(2);
        expect(result[0]?.kind).toBe("chart-script");
        expect(result[1]?.kind).toBe("consumer");
        expect(result[1]?.line).toBeGreaterThan(result[0]?.line ?? 0);
    });

    it("tolerates indented fences inside list items", () => {
        const md = "- item\n\n    ```ts\n    const x = 1; void x;\n    ```\n";
        const result = extractSnippets("a.md", md);
        expect(result).toHaveLength(1);
        expect(result[0]?.body).toBe("const x = 1; void x;");
    });

    it("handles an unterminated fence by absorbing the remainder", () => {
        const md = "```ts\nconst x = 1;\n";
        const result = extractSnippets("a.md", md);
        expect(result).toHaveLength(1);
        expect(result[0]?.body).toContain("const x = 1;");
    });

    it("ignores empty fences", () => {
        const md = "```ts\n```\n";
        const result = extractSnippets("a.md", md);
        expect(result).toHaveLength(1);
        expect(result[0]?.body).toBe("");
    });
});
