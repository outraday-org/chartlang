// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Argument,
    Declaration,
    IndicatorDeclaration,
    LibraryDeclaration,
    StrategyDeclaration,
    VersionDirective,
} from "../ast/index.js";
import { makeDiagnostic } from "../diagnostics/codes.js";
import type { SourceSpan } from "../index.js";
import type { Token, TokenKind } from "../lexer/index.js";
import type { ParserContext } from "./context.js";
import { parseExpression } from "./expression-stub.js";
import { spanBetween } from "./spans.js";

type CallDeclarationKind =
    | IndicatorDeclaration["kind"]
    | StrategyDeclaration["kind"]
    | LibraryDeclaration["kind"];

const DECLARATION_KEYWORDS: ReadonlyMap<string, CallDeclarationKind> = new Map<
    string,
    CallDeclarationKind
>([
    ["indicator", "indicator-declaration"],
    ["strategy", "strategy-declaration"],
    ["library", "library-declaration"],
]);

function buildCallDeclaration(
    kind: CallDeclarationKind,
    args: readonly Argument[],
    span: SourceSpan,
): IndicatorDeclaration | StrategyDeclaration | LibraryDeclaration {
    switch (kind) {
        case "indicator-declaration":
            return { kind, args, span };
        case "strategy-declaration":
            return { kind, args, span };
        case "library-declaration":
            return { kind, args, span };
    }
}

const STATEMENT_SYNC: ReadonlySet<TokenKind> = new Set<TokenKind>(["newline", "eof"]);

/**
 * Parse the leading `//@version=N` directive when present. Reads the single
 * `version-directive` token emitted by the lexer (NOT `//@version=` + an
 * int), records `unsupported-pine-version` when `N !== 6`, and returns the
 * node — or `null` (with a `missing-version-directive` diagnostic) when the
 * stream does not start with a directive.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const ctx = createContext(lex("//@version=6\n").tokens);
 *     parseVersionDirective(ctx)?.version; // 6
 */
export function parseVersionDirective(ctx: ParserContext): VersionDirective | null {
    const token = ctx.cursor.match("version-directive");
    if (token === null) {
        ctx.addDiagnostic(makeDiagnostic("missing-version-directive", ctx.cursor.peek().span));
        return null;
    }
    // The lexer only emits a `version-directive` token when its regex
    // matched `\d+`, so `versionNumber` is always present here.
    const version = token.versionNumber === undefined ? 0 : token.versionNumber;
    if (version !== 6) {
        ctx.addDiagnostic(makeDiagnostic("unsupported-pine-version", token.span));
    }
    ctx.cursor.match("newline");
    return { kind: "version-directive", version, span: token.span };
}

function parseArgumentList(ctx: ParserContext): readonly Argument[] {
    const args: Argument[] = [];
    if (ctx.cursor.peek().text === ")") {
        return args;
    }
    do {
        const name = parseArgumentName(ctx);
        const value = parseExpression(ctx);
        const valueSpan = value.span;
        const span = name === null ? valueSpan : spanBetween(name.span, valueSpan);
        args.push({ name: name === null ? null : name.text, value, span });
    } while (ctx.cursor.match("punctuation", ",") !== null);
    return args;
}

function parseArgumentName(ctx: ParserContext): Token | null {
    const token = ctx.cursor.peek();
    const after = ctx.peekAhead(1);
    if (token.kind === "identifier" && after.kind === "operator" && after.text === "=") {
        ctx.cursor.next();
        ctx.cursor.next();
        return token;
    }
    return null;
}

/**
 * Parse a top-level `indicator(...)` / `strategy(...)` / `library(...)`
 * declaration. `strategy` and `library` parse fully but each emit one
 * rejection diagnostic (`unsupported-strategy` / `unsupported-library`) so
 * the body is still walked. Returns `null` when the head token is not a
 * declaration keyword (the caller treats the head as the first body
 * statement instead).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const ctx = createContext(lex('indicator("hi")\n').tokens);
 *     parseDeclaration(ctx)?.kind; // "indicator-declaration"
 */
export function parseDeclaration(ctx: ParserContext): Declaration | null {
    const head = ctx.cursor.peek();
    const kind = DECLARATION_KEYWORDS.get(head.text);
    if (kind === undefined || head.kind !== "identifier") {
        return null;
    }
    ctx.cursor.next();
    const open = ctx.cursor.expect("punctuation", "(");
    if (open === null) {
        ctx.addDiagnostic(
            makeDiagnostic(
                "expected-token",
                ctx.cursor.peek().span,
                "Expected `(` after declaration.",
            ),
        );
        ctx.cursor.recover(STATEMENT_SYNC);
        ctx.cursor.match("newline");
        return buildCallDeclaration(kind, [], head.span);
    }
    const args = parseArgumentList(ctx);
    const close = ctx.cursor.expect("punctuation", ")");
    const endSpan = close === null ? ctx.cursor.peek().span : close.span;
    if (close === null) {
        ctx.addDiagnostic(
            makeDiagnostic("expected-token", endSpan, "Expected `)` to close the declaration."),
        );
        ctx.cursor.recover(STATEMENT_SYNC);
    }
    if (kind === "strategy-declaration") {
        ctx.addDiagnostic(makeDiagnostic("unsupported-strategy", head.span));
    } else if (kind === "library-declaration") {
        ctx.addDiagnostic(makeDiagnostic("unsupported-library", head.span));
    }
    ctx.cursor.match("newline");
    return buildCallDeclaration(kind, args, spanBetween(head.span, endSpan));
}
