// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Whether a `resolve` produced an `indent`, `dedent`, or no structural
 * change. `dedent` carries a count because a single source line can pop
 * several indent levels at once.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const delta: IndentDelta = { kind: "dedent", dedentCount: 2 };
 *     void delta;
 */
export type IndentDelta =
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "indent" }>
    | Readonly<{ kind: "dedent"; dedentCount: number }>;

/**
 * Result of resolving a line's indent against the level stack: the
 * structural {@link IndentDelta} plus an `inconsistentDedent` flag set
 * when a dedent does not land exactly on a prior level (the tracker then
 * snaps to the nearest lower level).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const r: IndentResolution = { delta: { kind: "none" }, inconsistentDedent: false };
 *     void r;
 */
export type IndentResolution = Readonly<{
    delta: IndentDelta;
    inconsistentDedent: boolean;
}>;

/**
 * Pure indentation state machine backing the lexer. Holds a stack of
 * column levels (always starting at `0`); `resolve(level)` compares the
 * next significant line's leading-whitespace width against the stack top
 * and reports the structural change, and `dedentToZero()` drains the
 * stack at EOF so `indent`/`dedent` tokens stay balanced.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const tracker = createIndentTracker();
 *     tracker.resolve(4).delta; // { kind: "indent" }
 *     tracker.dedentToZero(); // 1
 */
export type IndentTracker = Readonly<{
    resolve: (level: number) => IndentResolution;
    dedentToZero: () => number;
}>;

/**
 * Construct a fresh {@link IndentTracker} with a single base level (`0`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const tracker = createIndentTracker();
 *     tracker.resolve(2); // pushes level 2, emits one indent
 */
export function createIndentTracker(): IndentTracker {
    const stack: number[] = [0];

    function top(): number {
        return stack[stack.length - 1];
    }

    function resolve(level: number): IndentResolution {
        const current = top();
        if (level > current) {
            stack.push(level);
            return { delta: { kind: "indent" }, inconsistentDedent: false };
        }
        if (level === current) {
            return { delta: { kind: "none" }, inconsistentDedent: false };
        }
        let dedentCount = 0;
        while (stack.length > 1 && top() > level) {
            stack.pop();
            dedentCount += 1;
        }
        const inconsistentDedent = top() !== level;
        if (inconsistentDedent) {
            // Unbalanced dedent: snap the level stack to the nearest lower
            // landing point so subsequent lines resolve against a real level.
            stack[stack.length - 1] = level;
        }
        return { delta: { kind: "dedent", dedentCount }, inconsistentDedent };
    }

    function dedentToZero(): number {
        const popped = stack.length - 1;
        stack.length = 1;
        return popped;
    }

    return { resolve, dedentToZero };
}
