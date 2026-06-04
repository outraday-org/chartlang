// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { CompileError, compile } from "@invinite-org/chartlang-compiler";

/**
 * Detection heuristic for `@example` blocks that are actually chartlang
 * scripts. A block qualifies for compilation iff its text contains BOTH a
 * chartlang import (substring `from "@invinite-org/chartlang-`) AND a
 * `defineIndicator(` or `defineAlert(` call. The `defineX(` check keeps the
 * heuristic robust against future placeholder JSDoc shims that import from
 * chartlang but don't declare a script.
 *
 * @since 0.1
 * @example
 *     // qualifiesForExecution('… defineIndicator({ … }) …') === true
 *     const fn: typeof qualifiesForExecution = qualifiesForExecution;
 *     void fn;
 */
export function qualifiesForExecution(text: string): boolean {
    if (!text.includes('from "@invinite-org/chartlang-')) return false;
    if (!text.includes("defineIndicator(") && !text.includes("defineAlert(")) return false;
    return true;
}

/**
 * Strip surrounding ``` ``` ``` code fences from an `@example` block. If no
 * fences are present, the text passes through unchanged. The compiler is
 * lenient about leading whitespace, so indented (non-fenced) blocks need no
 * normalisation beyond what TypeScript already strips when reading the JSDoc.
 *
 * @since 0.1
 * @example
 *     // stripFences('```ts\nexport default x;\n```') === 'export default x;'
 *     const fn: typeof stripFences = stripFences;
 *     void fn;
 */
export function stripFences(text: string): string {
    const openMatch = text.match(/^[ \t]*```[a-zA-Z]*\n/m);
    if (openMatch === null) return text;
    const openEnd = (openMatch.index ?? 0) + openMatch[0].length;
    const afterOpen = text.slice(openEnd);
    const closeMatch = afterOpen.match(/\n[ \t]*```/);
    if (closeMatch === null) return afterOpen;
    return afterOpen.slice(0, closeMatch.index ?? afterOpen.length);
}

/**
 * Callback the executor invokes when a qualifying `@example` block fails to
 * compile. Mirrors the violation-recorder used by `docs-check.ts`.
 *
 * @since 0.1
 * @example
 *     const cb: RecordViolation = () => {};
 *     void cb;
 */
export type RecordViolation = (file: string, line: number, name: string, reason: string) => void;

/**
 * Compile a single `@example` block via the chartlang compiler when the
 * block's text qualifies (see `qualifiesForExecution`). On
 * `CompileError`, records a violation with the first diagnostic's message.
 * On any other thrown error, records the error's message. Skipped blocks
 * resolve silently — there is nothing to compile.
 *
 * @since 0.1
 * @example
 *     // await executeExampleBlock({
 *     //     source: '… defineIndicator(…) …',
 *     //     file: "core/ta.ts", line: 12, name: "ta",
 *     //     record: (f, l, n, r) => violations.push({ f, l, n, r }),
 *     // });
 *     const fn: typeof executeExampleBlock = executeExampleBlock;
 *     void fn;
 */
export async function executeExampleBlock(args: {
    readonly source: string;
    readonly file: string;
    readonly line: number;
    readonly name: string;
    readonly record: RecordViolation;
}): Promise<void> {
    const stripped = stripFences(args.source);
    if (!qualifiesForExecution(stripped)) return;
    try {
        await compile(stripped, {
            apiVersion: 1,
            sourcePath: `__doc_example__/${args.name}.chart.ts`,
        });
    } catch (err) {
        if (err instanceof CompileError) {
            args.record(
                args.file,
                args.line,
                args.name,
                `@example block failed to compile: ${err.message}`,
            );
            return;
        }
        const message = err instanceof Error ? err.message : String(err);
        args.record(args.file, args.line, args.name, `@example block threw: ${message}`);
    }
}
