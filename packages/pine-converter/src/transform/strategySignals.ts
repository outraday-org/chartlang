// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CallArgument, CallExpression, ExpressionNode } from "../ast/index.js";
import { namedArg, positionalArgs } from "./callArgs.js";
import type { DiagnosticCollector } from "./diagnosticCollector.js";
import type { EmitContext } from "./emitContext.js";
import { emitScalar, emitWithContext } from "./emitContext.js";

// The registry's own `strategy-signal-only` message, restated here as the
// prefix of the per-call override that names what an individual call lost.
// Kept in lockstep with `diagnostics/codes.ts` by `strategy-signals.test.ts`,
// which asserts the two strings are equal.
const STRATEGY_SIGNAL_MESSAGE =
    "A `strategy.*` order call was lowered to an `order.*` market intent; the backtester's fill, " +
    "sizing, and stop/limit semantics beyond `qty` are not reproduced.";

// How each recognised `strategy.*` order member lowers: a `directional` member
// picks `order.buy` / `order.sell` from its direction argument, a `close`
// member always targets flat via `order.close`.
type SignalShape = "directional" | "close";

// One row per lowered member: how it lowers, plus Pine's POSITIONAL parameter
// names in order. That single list does two jobs, so the two cannot drift — it
// names a dropped positional argument the way its author would recognise it,
// AND it is where every role (`id` / `direction` / `qty` / `when`) finds its
// positional slot, via `indexOf`. A role absent from a row is named-only for
// that member (`when` on `entry`/`exit`, which Pine deprecated), and a
// positional past the end of a row falls back to `#<n>`.
type SignalSpec = Readonly<{ shape: SignalShape; params: readonly string[] }>;

// The `strategy.*` order members this transform lowers to `order.*`.
// `cancel`/`cancel_all` are deliberately absent — chartlang has no resting
// order to cancel, so they keep failing as `unknown-identifier` rather than
// converting into something that silently does nothing.
const STRATEGY_SIGNALS: ReadonlyMap<string, SignalSpec> = new Map([
    [
        "entry",
        {
            shape: "directional",
            params: ["id", "direction", "qty", "limit", "stop", "oca_name", "oca_type", "comment"],
        },
    ],
    [
        "order",
        {
            shape: "directional",
            params: ["id", "direction", "qty", "limit", "stop", "oca_name", "oca_type", "comment"],
        },
    ],
    [
        "close",
        {
            shape: "close",
            params: ["id", "when", "comment", "qty", "qty_percent", "alert_message", "immediately"],
        },
    ],
    [
        "exit",
        {
            shape: "close",
            params: [
                "id",
                "from_entry",
                "qty",
                "qty_percent",
                "profit",
                "limit",
                "loss",
                "stop",
                "trail_price",
                "trail_points",
                "trail_offset",
                "oca_name",
                "comment",
            ],
        },
    ],
    ["close_all", { shape: "close", params: ["comment", "alert_message", "immediately"] }],
]);

// The dotted member name of a bare-rooted `strategy.*` callee, or `null`.
function strategyMember(call: CallExpression): string | null {
    const callee = call.callee;
    if (
        callee.kind === "member-access-expression" &&
        callee.head === null &&
        callee.chain.length === 2 &&
        callee.chain[0] === "strategy"
    ) {
        return callee.chain[1];
    }
    return null;
}

// The raw (unquoted) value of a Pine string literal, or `null` otherwise.
function stringLiteralValue(node: ExpressionNode): string | null {
    return node.kind === "literal-expression" && node.literalKind === "string"
        ? node.value.slice(1, -1)
        : null;
}

// The argument a member reads for a role: its named form first (Pine allows
// `strategy.entry(id = "L", direction = strategy.long)`), else the positional
// slot the member's parameter list gives that role. A role the list does not
// name is named-only for this member.
function roleArg(call: CallExpression, spec: SignalSpec, role: string): CallArgument | null {
    const named = namedArg(call.args, role);
    if (named !== null) {
        return named;
    }
    const index = spec.params.indexOf(role);
    if (index === -1) {
        return null;
    }
    return positionalArgs(call.args)[index] ?? null;
}

/**
 * Whether an expression is a bare-rooted `strategy.long` / `strategy.short`
 * direction constant. Exported for the semantic pass, which resolves these AT
 * THE CALLSITE (see {@link isStrategySignalCall}) instead of registering
 * `strategy` as a namespace — a position-independent registration would
 * legalize `strategy.long` in any expression.
 *
 * @since 1.13
 * @stable
 * @example
 *     import { isStrategyDirectionExpr } from "./strategySignals.js";
 *     const node = {
 *         kind: "member-access-expression",
 *         head: null,
 *         chain: ["strategy", "long"],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 14 },
 *     } as const;
 *     isStrategyDirectionExpr(node); // true
 */
export function isStrategyDirectionExpr(node: ExpressionNode): boolean {
    return strategyDirection(node) !== null;
}

// The side a `strategy.long` / `strategy.short` constant names, or `null` for
// anything else (a variable, a ternary, an absent argument).
function strategyDirection(node: ExpressionNode): "long" | "short" | null {
    if (
        node.kind !== "member-access-expression" ||
        node.head !== null ||
        node.chain.length !== 2 ||
        node.chain[0] !== "strategy"
    ) {
        return null;
    }
    const member = node.chain[1];
    return member === "long" || member === "short" ? member : null;
}

/**
 * Whether a call invokes a `strategy.*` order member
 * (`entry`/`order`/`close`/`exit`/`close_all`). Lets the caller route a
 * downgraded `strategy(...)` script's signal calls to
 * {@link emitStrategySignal}, and lets the semantic pass resolve the
 * `strategy.<member>` callee plus a `strategy.long`/`strategy.short` argument
 * at this ONE position.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { isStrategySignalCall } from "./strategySignals.js";
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["strategy", "entry"],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 15 },
 *         },
 *         args: [],
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 17 },
 *     } as const;
 *     isStrategySignalCall(call); // true
 */
export function isStrategySignalCall(call: CallExpression): boolean {
    const member = strategyMember(call);
    return member !== null && STRATEGY_SIGNALS.has(member);
}

// Whether a `qty` argument is a shape the converter can emit inline as a
// number. Valid Pine always types `qty` numeric, so this only rejects the
// shapes that could never lower to a scalar expression — an explicit `na`, a
// string/bool literal, a direction constant, and the aggregate expression
// forms.
function isInlineScalar(node: ExpressionNode): boolean {
    if (node.kind === "na-expression") {
        return false;
    }
    if (node.kind === "literal-expression") {
        return node.literalKind === "int" || node.literalKind === "float";
    }
    // The semantic pass skips resolving a `strategy.long` / `strategy.short`
    // anywhere inside a signal call, not only in the direction slot — a
    // position-independent skip is what keeps `strategy` from being a
    // namespace. So a misplaced direction constant reaches here unresolved,
    // and emitting it verbatim would put the token `strategy.long` into a
    // `qty:` field. Drop it into the named "not an inline scalar" note
    // instead, which is the diagnostic every other unemittable qty gets.
    if (isStrategyDirectionExpr(node)) {
        return false;
    }
    return (
        node.kind !== "tuple-expression" &&
        node.kind !== "array-literal-expression" &&
        node.kind !== "lambda-expression" &&
        node.kind !== "switch-expression"
    );
}

// The Pine parameter names of every argument the lowering could not honor, in
// source order. Named arguments report their own name; positional arguments
// report the member's parameter name for that slot.
function droppedArgNames(
    call: CallExpression,
    spec: SignalSpec,
    consumed: ReadonlySet<CallArgument>,
): readonly string[] {
    const params = spec.params;
    const dropped: string[] = [];
    let positionalIndex = 0;
    for (const arg of call.args) {
        const name = arg.name ?? params[positionalIndex] ?? `#${positionalIndex + 1}`;
        if (arg.name === null) {
            positionalIndex += 1;
        }
        if (!consumed.has(arg)) {
            dropped.push(name);
        }
    }
    return dropped;
}

/**
 * Lower a `strategy.entry/order/close/exit/close_all(...)` call into a
 * chartlang `order.buy/sell/close({ … })` market intent. The order id seeds
 * `label` (string literals only), `qty` rides through when it is an inline
 * scalar, and a `when =` condition is preserved as the enclosing `if` rather
 * than dropped. Every lowered call pushes a `strategy-signal-only` info; an
 * unresolvable direction adds `strategy-direction-assumed` and any argument the
 * mapping cannot honor (stop / limit / trail / oca / …) adds
 * `strategy-order-args-dropped`, naming each one. Returns `null` for a
 * non-strategy-signal call.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitStrategySignal } from "./strategySignals.js";
 *     import { DiagnosticCollector } from "./diagnosticCollector.js";
 *     const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 23 } as const;
 *     const call = {
 *         kind: "call-expression",
 *         callee: {
 *             kind: "member-access-expression",
 *             head: null,
 *             chain: ["strategy", "entry"],
 *             span,
 *         },
 *         args: [
 *             {
 *                 name: null,
 *                 value: {
 *                     kind: "literal-expression",
 *                     literalKind: "string",
 *                     value: '"Long"',
 *                     span,
 *                 },
 *                 span,
 *             },
 *         ],
 *         span,
 *     } as const;
 *     const ctx = {
 *         annotations: new Map(),
 *         inputNames: new Set<string>(),
 *         localNames: new Set<string>(),
 *         stateSlots: new Map<string, string>(),
 *     };
 *     emitStrategySignal(call, ctx, new DiagnosticCollector());
 *     // 'order.buy({ label: "Long" });'
 */
export function emitStrategySignal(
    call: CallExpression,
    ctx: EmitContext,
    diagnostics: DiagnosticCollector,
): string | null {
    const member = strategyMember(call);
    const spec = member === null ? undefined : STRATEGY_SIGNALS.get(member);
    if (member === null || spec === undefined) {
        return null;
    }
    const consumed = new Set<CallArgument>();
    const notes: string[] = [];

    // `label` — string literals only. A computed id is a `series string` in
    // Pine; emitting it would type a chartlang `label` from an expression the
    // converter cannot prove is a string, so it is dropped and named instead.
    const idArg = roleArg(call, spec, "id");
    let label: string | null = null;
    if (idArg !== null) {
        consumed.add(idArg);
        label = stringLiteralValue(idArg.value);
        if (label === null) {
            notes.push("the order id is not a string literal, so no `label` was attached");
        }
    }

    // Direction — resolved HERE, at the callsite, never as a global constant.
    let action: "buy" | "sell" | "close" = "close";
    if (spec.shape === "directional") {
        const directionArg = roleArg(call, spec, "direction");
        if (directionArg !== null) {
            consumed.add(directionArg);
        }
        const direction = directionArg === null ? null : strategyDirection(directionArg.value);
        if (direction === null) {
            diagnostics.pushCode("strategy-direction-assumed", call.span);
            action = "buy";
        } else {
            action = direction === "short" ? "sell" : "buy";
        }
    }

    // `qty` is an unsigned magnitude on both sides. `order.close` ignores a
    // partial qty in the nominal position tracker but still carries it on the
    // wire, so it is emitted for every member that supplies one.
    const qtyArg = roleArg(call, spec, "qty");
    let qty: string | null = null;
    if (qtyArg !== null) {
        consumed.add(qtyArg);
        if (isInlineScalar(qtyArg.value)) {
            qty = emitScalar(qtyArg.value, ctx);
        } else {
            notes.push("the `qty` argument is not an inline scalar, so it was dropped");
        }
    }

    // `when =` is a CONDITION, not a detail: dropping it would fire the order on
    // every bar. It becomes the enclosing `if`, the same shape Pine's own `if`
    // wrapping already lowers to.
    const whenArg = roleArg(call, spec, "when");
    let guard: string | null = null;
    if (whenArg !== null) {
        consumed.add(whenArg);
        guard = emitWithContext(whenArg.value, ctx);
    }

    const dropped = droppedArgNames(call, spec, consumed);
    if (dropped.length > 0) {
        diagnostics.pushCode(
            "strategy-order-args-dropped",
            call.span,
            `\`strategy.${member}(...)\` lowered to \`order.${action}(...)\`, a market intent that ` +
                `${action === "close" ? "targets flat" : "opens or reverses the whole position"}; ` +
                `chartlang has no resting-order model, so ${dropped.map((name) => `\`${name}\``).join(", ")} ` +
                `${dropped.length === 1 ? "was" : "were"} dropped.`,
        );
    }

    const fields = [
        ...(label === null ? [] : [`label: ${JSON.stringify(label)}`]),
        ...(qty === null ? [] : [`qty: ${qty}`]),
    ];
    const opts = fields.length === 0 ? "" : `{ ${fields.join(", ")} }`;
    const emitted = `order.${action}(${opts});`;

    diagnostics.pushCode(
        "strategy-signal-only",
        call.span,
        notes.length === 0
            ? undefined
            : `${STRATEGY_SIGNAL_MESSAGE} In this call, ${notes.join(", and ")}.`,
    );
    return guard === null ? emitted : `if (${guard}) { ${emitted} }`;
}
