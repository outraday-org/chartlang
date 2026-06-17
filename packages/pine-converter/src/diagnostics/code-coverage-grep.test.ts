// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { DIAGNOSTIC_CODE_ENTRIES } from "./codes.js";

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

// The registry-key call sites: `makeDiagnostic("<key>", …)` (parse/semantic/
// coordinate stages) and the transform collector's `pushCode("<key>", …)`.
// Both take a short registry KEY as the first argument — never an inline code
// string. A TS Compiler-API walk (NOT a regex) finds them precisely so a
// kebab-case identifier that merely LOOKS like a code (`camp-a`, `kebab-case`)
// never trips the assertion.
const KEY_CALLEES = new Set(["makeDiagnostic", "pushCode"]);

function tsFilesUnder(dir: string): readonly string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...tsFilesUnder(full));
        } else if (
            entry.name.endsWith(".ts") &&
            !entry.name.endsWith(".test.ts") &&
            !entry.name.endsWith(".bench.test.ts")
        ) {
            out.push(full);
        }
    }
    return out;
}

/** The simple name a call expression's callee resolves to (`a.b.pushCode` → `pushCode`). */
function calleeName(expr: ts.LeftHandSideExpression): string | null {
    if (ts.isIdentifier(expr)) {
        return expr.text;
    }
    if (ts.isPropertyAccessExpression(expr)) {
        return expr.name.text;
    }
    return null;
}

function collectKeyLiterals(source: ts.SourceFile): readonly string[] {
    const keys: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const name = calleeName(node.expression);
            const firstArg = node.arguments[0];
            if (
                name !== null &&
                KEY_CALLEES.has(name) &&
                firstArg !== undefined &&
                ts.isStringLiteral(firstArg)
            ) {
                keys.push(firstArg.text);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return keys;
}

describe("diagnostic code coverage (TS Compiler API)", () => {
    const files = tsFilesUnder(SRC_DIR);

    it("finds at least one registry-key call site across the source tree", () => {
        const total = files.flatMap((file) =>
            collectKeyLiterals(
                ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ESNext, true),
            ),
        ).length;
        expect(total).toBeGreaterThan(0);
    });

    it("registers every diagnostic key pushed via makeDiagnostic/pushCode", () => {
        const registered = new Set(Object.keys(DIAGNOSTIC_CODE_ENTRIES));
        const unregistered: { readonly key: string; readonly file: string }[] = [];
        for (const file of files) {
            const source = ts.createSourceFile(
                file,
                readFileSync(file, "utf8"),
                ts.ScriptTarget.ESNext,
                true,
            );
            for (const key of collectKeyLiterals(source)) {
                if (!registered.has(key)) {
                    unregistered.push({ key, file });
                }
            }
        }
        expect(unregistered).toEqual([]);
    });
});
