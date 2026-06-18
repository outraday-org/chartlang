// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import type { Script } from "../ast/script.js";
import type { Statement } from "../ast/statements.js";
import type { SourceSpan } from "../index.js";
import type { SemanticResult } from "../semantic/index.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { transformInputs } from "./inputs.js";
import type { ScriptScaffold } from "./ir.js";
import { NameAllocator } from "./nameAllocator.js";

// The `tuple-expression` and `switch`-as-value arms of the input walk are not
// emitted by the real parser (Pine has no array-tuple literal and no
// switch-expression value position), so — following the package's
// defensive-arm precedent — they are exercised here through a hand-built AST.

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function inputCall(kind: string, defaultValue: string): CallExpression {
    return {
        kind: "call-expression",
        callee: {
            kind: "member-access-expression",
            head: null,
            chain: ["input", kind],
            span: SPAN,
        },
        args: [
            {
                name: null,
                value: {
                    kind: "literal-expression",
                    literalKind: "int",
                    value: defaultValue,
                    span: SPAN,
                },
                span: SPAN,
            },
        ],
        span: SPAN,
    };
}

function scriptWith(body: readonly Statement[]): Script {
    return { kind: "script", version: null, declaration: null, body, span: SPAN };
}

function emptyScaffold(): ScriptScaffold {
    return {
        constructor: "defineIndicator",
        apiVersion: 1,
        name: "X",
        shortName: null,
        overlay: null,
        format: null,
        precision: null,
        scale: null,
        maxDrawings: {},
        maxBarsBack: null,
        inputs: [],
        stateSlots: [],
        handleSlots: [],
        handleRings: [],
        computeBody: { statements: [] },
        diagnostics: [],
        names: new NameAllocator(),
    };
}

function runBody(body: readonly Statement[]): ScriptScaffold {
    const analysis = { script: scriptWith(body) } as unknown as SemanticResult;
    const scaffold = emptyScaffold();
    transformInputs(analysis, scaffold, new DiagnosticCollector());
    return scaffold;
}

describe("transformInputs — synthetic defensive arms", () => {
    it("promotes inline inputs nested in a tuple-expression value", () => {
        const tuple: ExpressionNode = {
            kind: "tuple-expression",
            elements: [inputCall("int", "1"), inputCall("int", "2")],
            span: SPAN,
        };
        const scaffold = runBody([{ kind: "expression-statement", expression: tuple, span: SPAN }]);
        expect(scaffold.inputs.map((i) => i.code)).toEqual(["input.int(1)", "input.int(2)"]);
    });

    it("promotes inline inputs in a switch subject and case bodies", () => {
        const scaffold = runBody([
            {
                kind: "switch-statement",
                subject: inputCall("int", "1"),
                cases: [
                    {
                        test: inputCall("int", "2"),
                        body: [
                            {
                                kind: "expression-statement",
                                expression: inputCall("int", "3"),
                                span: SPAN,
                            },
                        ],
                        span: SPAN,
                    },
                    { test: null, body: [], span: SPAN },
                ],
                span: SPAN,
            },
        ]);
        expect(scaffold.inputs.map((i) => i.code)).toEqual([
            "input.int(1)",
            "input.int(2)",
            "input.int(3)",
        ]);
    });

    it("walks a return-statement value and a bare break/continue", () => {
        const scaffold = runBody([
            { kind: "return-statement", value: inputCall("int", "4"), span: SPAN },
            { kind: "return-statement", value: null, span: SPAN },
            { kind: "break-statement", span: SPAN },
            { kind: "continue-statement", span: SPAN },
        ]);
        expect(scaffold.inputs.map((i) => i.code)).toEqual(["input.int(4)"]);
    });

    it("recurses into a standalone block-statement", () => {
        const scaffold = runBody([
            {
                kind: "block-statement",
                body: [
                    { kind: "expression-statement", expression: inputCall("int", "5"), span: SPAN },
                ],
                span: SPAN,
            },
        ]);
        expect(scaffold.inputs.map((i) => i.code)).toEqual(["input.int(5)"]);
    });
});
