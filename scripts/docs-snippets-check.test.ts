// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { runDocsSnippets } from "./docs-snippets-check";

describe("docs:snippets gate", () => {
    it("compiles every chart-script block in README.md, docs/index.md, and docs/getting-started/*.md cleanly", async () => {
        const { failures, compiledSnippets } = await runDocsSnippets();
        if (failures.length > 0) {
            const lines = failures.map((f) => `${f.file}:${f.line}: ${f.reason}`);
            throw new Error(`docs:snippets failures:\n${lines.join("\n")}`);
        }
        // We expect at least the README hero example to compile.
        expect(compiledSnippets).toBeGreaterThanOrEqual(1);
    }, 30_000);
});
