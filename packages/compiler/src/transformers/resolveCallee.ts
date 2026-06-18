// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

import { CORE_MODULE_PATH } from "../program.js";

/**
 * Resolve a `CallExpression`'s callee to its fully-qualified name. Returns
 * one of `"ta.<method>"`, `"plot"`, `"hline"`, `"alert"`,
 * `"defineIndicator"`, `"defineAlert"` for calls whose target comes from
 * `@invinite-org/chartlang-core`; returns `null` for everything else
 * (user-shadowed identifiers, computed access, optional chains, calls on
 * call results).
 *
 * Identifier callees are gated on the symbol's declaration source file
 * matching the core ambient module path so a user's `const plot = (x) => x;
 * plot(42);` is not mistaken for the core `plot` primitive.
 *
 * @since 0.1
 * @example
 *     // const fqn = resolveCalleeName(callNode, checker);
 *     // fqn === "ta.ema" | "plot" | "alert" | ... | null
 *     const fn: typeof resolveCalleeName = resolveCalleeName;
 *     void fn;
 */
export function resolveCalleeName(node: ts.CallExpression, checker: ts.TypeChecker): string | null {
    const expression = node.expression;
    if (ts.isPropertyAccessExpression(expression)) {
        return resolvePropertyAccessName(expression, checker);
    }
    if (ts.isIdentifier(expression)) {
        const canonical = resolveCoreSymbolName(checker, expression);
        if (canonical === null) return null;
        return canonical;
    }
    return null;
}

function resolvePropertyAccessName(
    expression: ts.PropertyAccessExpression,
    checker: ts.TypeChecker,
): string | null {
    const segments: string[] = [expression.name.text];
    let current: ts.Expression = expression.expression;
    while (ts.isPropertyAccessExpression(current)) {
        segments.unshift(current.name.text);
        current = current.expression;
    }
    if (!ts.isIdentifier(current)) return null;
    const canonical = resolveCoreSymbolName(checker, current);
    if (canonical === null) return null;
    return [canonical, ...segments].join(".");
}

/**
 * Resolve the canonical core-export name for the *object* of an
 * `ElementAccessExpression` (`obj[...]`). Used by the callsite-id
 * transformer to detect element-access calls on core namespaces
 * (`ta["ema"](...)`, `state["foo"]?.()`) that would otherwise silently
 * skip slot-id injection. Returns the canonical name (e.g. `"ta"`) when
 * the object identifier resolves to a core symbol, or `null` when it
 * does not (user-shadowed identifier, non-core object, computed receiver).
 *
 * @since 0.1
 * @example
 *     // const name = resolveCoreSymbolForElementAccess(node, checker);
 *     // name === "ta" | null
 *     const fn: typeof resolveCoreSymbolForElementAccess = resolveCoreSymbolForElementAccess;
 *     void fn;
 */
export function resolveCoreSymbolForElementAccess(
    node: ts.ElementAccessExpression,
    checker: ts.TypeChecker,
): string | null {
    const obj = node.expression;
    if (!ts.isIdentifier(obj)) return null;
    return resolveCoreSymbolName(checker, obj);
}

/**
 * Return the canonical core-export name for `identifier`, or `null` if
 * the identifier does not resolve to a `@invinite-org/chartlang-core`
 * symbol. Renamed imports (`import { ta as TA } from "core"; TA.ema(...)`)
 * map back to their export name (`"ta"`) so the resulting slot-id
 * matches what `STATEFUL_PRIMITIVES` expects.
 *
 * Reused by the `request.security` expression capture check
 * (`validateSecurityExpr`) to decide whether a free identifier inside the
 * HTF callback resolves to the ambient `ta` / `inputs` namespaces (allowed)
 * versus an outer-scope binding (rejected).
 *
 * @since 0.7
 * @stable
 * @example
 *     // const name = resolveCoreSymbolName(checker, identifier);
 *     // name === "ta" | "inputs" | null
 *     const fn: typeof resolveCoreSymbolName = resolveCoreSymbolName;
 *     void fn;
 */
export function resolveCoreSymbolName(
    checker: ts.TypeChecker,
    identifier: ts.Identifier,
): string | null {
    const localSymbol = checker.getSymbolAtLocation(identifier);
    if (!localSymbol) return null;
    const target =
        localSymbol.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(localSymbol)
            : localSymbol;
    const declarations = target.declarations ?? [];
    if (declarations.some((d) => d.getSourceFile().fileName === CORE_MODULE_PATH)) {
        return target.getName();
    }
    // Destructured `compute({ ta, plot, ... })` binding: the symbol's
    // declaration is the binding element, not the core module. The
    // identifier's *type*, however, comes from `ComputeContext` (core)
    // — so a binding element whose type declaration originates in core
    // counts as a core symbol for the callsite-id transformer. The
    // canonical name is the binding's property name (or, when the
    // binding is renamed `{ ta: TA }`, the original property name).
    for (const declaration of declarations) {
        if (!ts.isBindingElement(declaration)) continue;
        // `{ ta }` → propertyName is undefined, fall back to identifier.
        // `{ ta: TA }` → propertyName is `ta`, identifier is `TA`.
        const propertyName = declaration.propertyName;
        const canonicalName =
            propertyName !== undefined && ts.isIdentifier(propertyName)
                ? propertyName.text
                : identifier.text;
        if (bindingElementComesFromCoreContext(checker, declaration, canonicalName)) {
            return canonicalName;
        }
        const type = checker.getTypeAtLocation(identifier);
        const typeSymbol = type.getSymbol();
        /* v8 ignore next */
        if (typeSymbol === undefined) continue;
        /* v8 ignore next */
        const typeDecls = typeSymbol.declarations ?? [];
        if (!typeDecls.some((d) => d.getSourceFile().fileName === CORE_MODULE_PATH)) continue;
        if (propertyName !== undefined && ts.isIdentifier(propertyName)) {
            return propertyName.text;
        }
        return identifier.text;
    }
    return null;
}

function bindingElementComesFromCoreContext(
    checker: ts.TypeChecker,
    declaration: ts.BindingElement,
    canonicalName: string,
): boolean {
    const bindingPattern = declaration.parent;
    const bindingOwner = bindingPattern.parent;
    if (!ts.isObjectBindingPattern(bindingPattern) || !ts.isParameter(bindingOwner)) return false;
    const parameterType = checker.getTypeAtLocation(bindingOwner);
    const property = parameterType.getProperty(canonicalName);
    const propertyDecls = property?.declarations ?? [];
    return propertyDecls.some((d) => d.getSourceFile().fileName === CORE_MODULE_PATH);
}
