// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type IntervalDescriptor, intervalToSeconds } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { type CompileDiagnostic, createDiagnostic } from "../diagnostics";
import { resolveCalleeName } from "../transformers/resolveCallee";

function secondsOrNull(descriptor: IntervalDescriptor): number | null {
    try {
        return intervalToSeconds(descriptor);
    } catch {
        return null;
    }
}

type SmallestMain = Readonly<{ descriptor: IntervalDescriptor; seconds: number }>;

function smallestParseableMain(
    declaredIntervals: ReadonlyArray<IntervalDescriptor>,
): SmallestMain | null {
    let smallest: SmallestMain | null = null;
    for (const descriptor of declaredIntervals) {
        const seconds = secondsOrNull(descriptor);
        if (seconds !== null && (smallest === null || seconds < smallest.seconds)) {
            smallest = { descriptor, seconds };
        }
    }
    return smallest;
}

/**
 * Validate static `request.lowerTf({ interval })` calls against declared main
 * intervals and emit `lower-tf-not-lower` when the requested interval is not
 * strictly lower than the smallest declared main interval. Non-literal and
 * unparseable interval values are skipped — the literal-check pass and the
 * runtime's `unsupported-interval` gate own those.
 *
 * Ordering uses {@link intervalToSeconds}, which treats `1M` as 30 days and
 * `1Y` as 365 days. Comparisons that hinge on calendar-exact durations (e.g.
 * `30D` vs `1M`) should provide `intervalSeconds` on the {@link IntervalDescriptor}
 * to override the approximation.
 *
 * @since 0.6
 * @experimental
 * @example
 *     // const diagnostics = validateLowerTfIntervals(
 *     //     sourceFile, checker, "demo.chart.ts", capabilities.intervals,
 *     // );
 *     const fn: typeof validateLowerTfIntervals = validateLowerTfIntervals;
 *     void fn;
 */
export function validateLowerTfIntervals(
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    filePath: string,
    declaredIntervals: ReadonlyArray<IntervalDescriptor>,
): ReadonlyArray<CompileDiagnostic> {
    const main = smallestParseableMain(declaredIntervals);
    if (main === null) return [];

    const diagnostics: CompileDiagnostic[] = [];
    const checkCall = (call: ts.CallExpression): void => {
        const literal = readLiteralInterval(call);
        if (literal === null) return;
        const requestedSec = secondsOrNull({
            value: literal.text,
            label: literal.text,
            group: "request",
        });
        if (requestedSec === null || requestedSec < main.seconds) return;
        diagnostics.push(
            createDiagnostic({
                severity: "error",
                code: "lower-tf-not-lower",
                message: `request.lowerTf({ interval: "${literal.text}" }) must be strictly lower than the main interval "${main.descriptor.value}" (requested ${requestedSec}s >= main ${main.seconds}s)`,
                file: filePath,
                node: literal,
                sourceFile,
            }),
        );
    };

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && resolveCalleeName(node, checker) === "request.lowerTf") {
            checkCall(node);
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
    return Object.freeze(diagnostics.slice());
}

function readLiteralInterval(call: ts.CallExpression): ts.StringLiteral | null {
    const opts = call.arguments[0];
    if (opts === undefined || !ts.isObjectLiteralExpression(opts)) return null;
    const property = opts.properties
        .filter(ts.isPropertyAssignment)
        .find((p) => ts.isIdentifier(p.name) && p.name.text === "interval");
    if (property === undefined || !ts.isStringLiteral(property.initializer)) return null;
    return property.initializer;
}
