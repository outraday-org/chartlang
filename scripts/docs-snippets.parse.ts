// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Pure parser for fenced TypeScript blocks inside user-facing markdown.
 * Split from `docs-snippets-check.ts` so the parse + classification logic
 * can be unit-tested under `pnpm test:scripts` without touching disk or
 * the compiler.
 *
 * Fence conventions accepted by the gate:
 *
 * - ```ts``` and ```typescript``` open a TypeScript block.
 * - ```ts no-gate``` and ```typescript no-gate``` open a TypeScript block
 *   that is explicitly opted out of compilation. Use this for
 *   consumer-side node / browser code that imports things that don't
 *   exist at gate time (e.g. an adapter that hasn't been scaffolded
 *   yet, a Vite plugin import).
 *
 * A block is classified as a chart-script (and therefore compiled) iff
 * its body contains BOTH `from "@invinite-org/chartlang-` AND one of
 * `defineIndicator(`, `defineAlert(`, `defineDrawing(`, or
 * `defineAlertCondition(`. This mirrors the heuristic used by
 * `docs-check.executor.ts` for in-source `@example` blocks.
 */

/**
 * Classification of a fenced TypeScript block. `chart-script` blocks are
 * piped through the chartlang compiler; `consumer` blocks document
 * consumer-side code and are skipped. `opt-out` is the explicit opt-out
 * via the `no-gate` fence annotation.
 *
 * @since 0.8
 * @stable
 * @example
 *     const k: SnippetKind = "chart-script";
 *     void k;
 */
export type SnippetKind = "chart-script" | "consumer" | "opt-out";

/**
 * A single fenced TypeScript block extracted from a markdown file, with
 * enough context for the gate to point at the original source location
 * on failure.
 *
 * @since 0.8
 * @stable
 * @example
 *     const s: Snippet = {
 *         file: "README.md",
 *         line: 1,
 *         kind: "consumer",
 *         body: "",
 *     };
 *     void s;
 */
export type Snippet = Readonly<{
    file: string;
    line: number;
    kind: SnippetKind;
    body: string;
}>;

const FENCE_TS_RE = /^(?<indent>[ \t]*)```(?<lang>ts|typescript)(?<meta>[^\n]*)$/;
const CHART_IMPORT_TOKEN = 'from "@invinite-org/chartlang-';
const DEFINE_CALL_TOKENS = [
    "defineIndicator(",
    "defineAlert(",
    "defineDrawing(",
    "defineAlertCondition(",
] as const;

function classify(meta: string, body: string): SnippetKind {
    if (/\bno-gate\b/.test(meta)) return "opt-out";
    const hasImport = body.includes(CHART_IMPORT_TOKEN);
    const hasDefine = DEFINE_CALL_TOKENS.some((token) => body.includes(token));
    if (hasImport && hasDefine) return "chart-script";
    return "consumer";
}

/**
 * Walk a markdown document and return every fenced TypeScript block
 * with its source line, fence-metadata classification, and body. The
 * parser is line-oriented and tolerates indented fences (≤ 4 leading
 * spaces or one tab) so it composes with nested-list code blocks.
 *
 * @since 0.8
 * @stable
 * @example
 *     const snippets = extractSnippets("README.md", "```ts\nconst x = 1;\n```\n");
 *     // snippets[0].kind === "consumer"
 *     void snippets;
 */
export function extractSnippets(file: string, markdown: string): Snippet[] {
    const lines = markdown.split("\n");
    const out: Snippet[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i] ?? "";
        const match = FENCE_TS_RE.exec(line);
        if (match === null) {
            i++;
            continue;
        }
        const indent = match.groups?.indent ?? "";
        const meta = match.groups?.meta ?? "";
        const openLine = i + 1;
        const closeFence = `${indent}\`\`\``;
        const bodyLines: string[] = [];
        i++;
        while (i < lines.length && lines[i] !== closeFence) {
            const raw = lines[i] ?? "";
            // Strip the same leading indent the fence carried so the
            // compiler sees source-level indentation, not the markdown's
            // outer indentation.
            bodyLines.push(indent === "" ? raw : raw.replace(new RegExp(`^${indent}`), ""));
            i++;
        }
        const body = bodyLines.join("\n");
        out.push(
            Object.freeze({
                file,
                line: openLine,
                kind: classify(meta, body),
                body,
            }),
        );
        // Skip the closing fence if we landed on it.
        if (i < lines.length) i++;
    }
    return out;
}
