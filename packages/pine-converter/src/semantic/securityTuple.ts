// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { TupleDeclaration } from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { Diagnostic } from "../index.js";
import { dottedCallee, positionalArgs } from "../transform/callArgs.js";
import {
    type SecurityFeedInputs,
    resolveSecurityFeed,
    securityField,
} from "../transform/securityShape.js";
import type { SecurityTupleAnnotation, SecurityTupleElement } from "./types.js";

/**
 * Recognise and classify a tuple-LHS `request.security` declaration
 * (`[a, b] = request.security(sym, tf, [s1, s2])`). Returns the
 * {@link SecurityTupleAnnotation} when the RHS is a `request.security` call with
 * a resolvable feed and an array-literal source list, otherwise `null` (a
 * non-`request.security` tuple RHS is left to the multi-output `ta.*` path).
 *
 * The feed is resolved by the shared {@link resolveSecurityFeed} against the
 * script's {@link SecurityFeedInputs}, so an `input.symbol`/`input.timeframe`-
 * bound symbol/timeframe lowers to its `inputs.<name>` reference exactly like
 * the single-source path.
 *
 * Diagnostics are pushed into `diagnostics` (the semantic walk's collector): a
 * computed / wrong-axis / out-of-table symbol or interval reuses the existing
 * `request-security-not-mapped`; a non-array third argument raises
 * `security-tuple-source-not-list`; a name/source-length mismatch raises
 * `security-tuple-arity-mismatch` and still classifies what it can. The shared
 * `resolveSecurityFeed` / `securityField` helpers mirror the single-source
 * `request.security` dispatch exactly — one OHLCV-field test, one feed resolver.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { analyzeSecurityTuple } from "./securityTuple.js";
 *     // analyzeSecurityTuple(tupleDecl, diagnostics) → the classified feed +
 *     // elements, or null for a non-request.security tuple RHS.
 *     void analyzeSecurityTuple;
 */
export function analyzeSecurityTuple(
    decl: TupleDeclaration,
    diagnostics: Diagnostic[],
    inputs: SecurityFeedInputs,
): SecurityTupleAnnotation | null {
    const init = decl.initializer;
    if (init.kind !== "call-expression" || dottedCallee(init) !== "request.security") {
        return null;
    }
    const positional = positionalArgs(init.args);
    if (positional.length < 3) {
        diagnostics.push(makeDiagnostic("request-security-not-mapped", init.span));
        return null;
    }
    const feed = resolveSecurityFeed(positional[0].value, positional[1].value, inputs);
    if (feed === null) {
        diagnostics.push(makeDiagnostic("request-security-not-mapped", init.span));
        return null;
    }
    const source = positional[2].value;
    if (source.kind !== "array-literal-expression") {
        diagnostics.push(makeDiagnostic("security-tuple-source-not-list", source.span));
        return null;
    }
    const elements: SecurityTupleElement[] = source.elements.map((element) => {
        const field = securityField(element);
        return field === null ? { kind: "expr", node: element } : { kind: "ohlcv", field };
    });
    if (decl.names.length !== elements.length) {
        diagnostics.push(makeDiagnostic("security-tuple-arity-mismatch", decl.span));
    }
    return {
        kind: "securityTuple",
        feed:
            feed.symbol === null
                ? { interval: feed.interval }
                : { symbol: feed.symbol, interval: feed.interval },
        elements,
    };
}
