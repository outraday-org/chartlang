// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument } from "../ast/index.js";

/**
 * The chartlang price-expression a `yloc.abovebar` / `yloc.belowbar`
 * vertical-location enum lowers to, plus whether the value was an
 * approximation. `yloc.price` (or an absent `yloc=`) resolves to `null`
 * so the caller keeps the drawing's resolved anchor price unchanged.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const r: YlocResolution = {
 *         priceExpr: "bar.high + ((bar.high - bar.low) * __YLOC_PAD_FRAC)",
 *         approximated: true,
 *     };
 *     void r;
 */
export type YlocResolution = Readonly<{
    priceExpr: string;
    approximated: boolean;
}>;

// The dotted built-in name of a bare-rooted member chain (`yloc.abovebar`),
// or `null` for any other expression.
function ylocMemberName(arg: CallArgument): string | null {
    const value = arg.value;
    if (value.kind === "member-access-expression" && value.head === null) {
        return value.chain.join(".");
    }
    return null;
}

/**
 * Resolve a Pine `label.new(..., yloc=…)` vertical-location enum into the
 * chartlang price expression the converted `draw.text(...)` anchor uses.
 *
 * - `yloc.abovebar` → `bar.high + ((bar.high - bar.low) * __YLOC_PAD_FRAC)`
 * - `yloc.belowbar` → `bar.low - ((bar.high - bar.low) * __YLOC_PAD_FRAC)`
 * - `yloc.price` / absent / unrecognised → `null` (keep the anchor price).
 *
 * The `__YLOC_PAD_FRAC` and `bar.*` references are emitted verbatim;
 * Task 16 codegen ships the `__YLOC_PAD_FRAC` preamble constant. The
 * `approximated` flag lets the caller raise `yloc-padding-approximated`
 * exactly once per script.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { resolveYloc } from "./ylocResolve.js";
 *     const arg = {
 *         name: "yloc",
 *         value: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["yloc", "abovebar"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     } as const;
 *     resolveYloc([arg])?.approximated; // true
 */
export function resolveYloc(args: readonly CallArgument[]): YlocResolution | null {
    const arg = args.find((candidate) => candidate.name === "yloc");
    if (arg === undefined) {
        return null;
    }
    const name = ylocMemberName(arg);
    const range = "(bar.high - bar.low)";
    if (name === "yloc.abovebar") {
        return { priceExpr: `bar.high + (${range} * __YLOC_PAD_FRAC)`, approximated: true };
    }
    if (name === "yloc.belowbar") {
        return { priceExpr: `bar.low - (${range} * __YLOC_PAD_FRAC)`, approximated: true };
    }
    return null;
}
