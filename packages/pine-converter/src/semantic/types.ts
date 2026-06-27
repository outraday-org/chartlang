// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CallArgument,
    CallExpression,
    ExpressionNode,
    Script,
    Statement,
} from "../ast/index.js";
import type { Argument, Declaration, VersionDirective } from "../ast/script.js";
import type { TypeAnnotation } from "../ast/types.js";
import type { Diagnostic, SourceSpan } from "../index.js";
import type { PineDrawingConstructor } from "../mapping/index.js";

/**
 * Any node in the Pine v6 AST — the key type for the identity-keyed scope
 * and annotation maps the analyzer produces. Every member carries a `span`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const n: AstNode = {
 *         kind: "identifier-expression",
 *         name: "close",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
 *     };
 *     void n;
 */
export type AstNode =
    | Script
    | VersionDirective
    | Declaration
    | Argument
    | Statement
    | ExpressionNode
    | CallArgument;

/**
 * Pine's type-qualifier lattice, ordered `const < input < simple < series`.
 * The analyzer joins operand qualifiers by taking the lattice maximum.
 *
 * @since 0.1
 * @stable
 * @example
 *     const q: TypeQualifier = "series";
 *     void q;
 */
export type TypeQualifier = "const" | "input" | "simple" | "series";

/**
 * The Pine drawing-object family a handle-typed symbol belongs to. `null`
 * (on {@link SymbolInfo}) marks a non-handle symbol.
 *
 * @since 0.1
 * @stable
 * @example
 *     const h: HandleType = "line";
 *     void h;
 */
export type HandleType = "line" | "label" | "box" | "table" | "polyline" | "linefill";

/**
 * What introduced a symbol into a scope.
 *
 * @since 0.1
 * @stable
 * @example
 *     const k: SymbolKind = "var-variable";
 *     void k;
 */
export type SymbolKind =
    | "variable"
    | "var-variable"
    | "varip-variable"
    | "for-iterator"
    | "function-parameter"
    | "function"
    | "builtin";

/**
 * A resolved symbol: its name, what declared it, where, its inferred
 * qualifier, and — for drawing handles — which object family it holds.
 * `declarationSpan` is `null` for built-ins. For a `kind: "function"`
 * user-defined function, `params` lists its parameter names and `stateful`
 * is the resolved transitive classification Tasks 3/4 read (pure `false` →
 * a reusable function; `true` → inline per call site); both fields are
 * absent on every non-function symbol.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: SymbolInfo = {
 *         name: "lvl",
 *         kind: "var-variable",
 *         declarationSpan: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 20 },
 *         typeAnnotation: null,
 *         qualifier: "series",
 *         handleType: "line",
 *     };
 *     void s;
 */
export type SymbolInfo = Readonly<{
    name: string;
    kind: SymbolKind;
    declarationSpan: SourceSpan | null;
    typeAnnotation: TypeAnnotation | null;
    qualifier: TypeQualifier;
    handleType: HandleType | null;
    params?: readonly string[];
    stateful?: boolean;
}>;

/**
 * One node in the scope tree: a back-pointer to the enclosing scope (`null`
 * at the root), the symbols declared directly in it, and the source span it
 * covers. Built-ins live only in the root scope's parent chain via
 * resolution, not in `symbols`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const root: Scope = {
 *         parent: null,
 *         symbols: new Map(),
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     };
 *     void root;
 */
export type Scope = Readonly<{
    parent: Scope | null;
    symbols: ReadonlyMap<string, SymbolInfo>;
    span: SourceSpan;
}>;

/**
 * Whether an `Identifier "=" Expression` statement declared a fresh symbol
 * or reassigned (accidentally shadowed) an enclosing one. `shadows` names
 * the shadowed symbol when `kind === "declaration"` shadows an outer
 * binding.
 *
 * @since 0.1
 * @stable
 * @example
 *     const a: AssignmentAnnotation = { kind: "reassignment", shadows: null };
 *     void a;
 */
export type AssignmentAnnotation = Readonly<{
    kind: "declaration" | "reassignment";
    shadows: SymbolInfo | null;
}>;

/**
 * One element of a tuple `request.security` source list: a bare OHLCV `field`
 * lowers to the data form (`request.security(opts).<field>`); any other `node`
 * lowers to the callback form (`request.security(opts, (bar) => <node>)`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const el: SecurityTupleElement = { kind: "ohlcv", field: "high" };
 *     void el;
 */
export type SecurityTupleElement =
    | Readonly<{ kind: "ohlcv"; field: string }>
    | Readonly<{ kind: "expr"; node: ExpressionNode }>;

/**
 * The classified IR for a tuple-LHS `request.security` declaration
 * (`[a, b] = request.security(sym, tf, [s1, s2])`): the resolved higher-
 * timeframe `feed` (the `symbol` omitted for the chart's own symbol) and the
 * source-order `elements` (one per `[…]` entry, binding to the LHS names by
 * position). Stored on the `TupleDeclaration` node in
 * {@link SemanticResult.annotations}; the transform reads it back to emit N
 * independent reads.
 *
 * @since 0.1
 * @stable
 * @example
 *     const a: SecurityTupleAnnotation = {
 *         kind: "securityTuple",
 *         feed: { interval: "1d" },
 *         elements: [{ kind: "ohlcv", field: "high" }],
 *     };
 *     void a;
 */
export type SecurityTupleAnnotation = Readonly<{
    kind: "securityTuple";
    feed: Readonly<{ symbol?: string; interval: string }>;
    elements: readonly SecurityTupleElement[];
}>;

/**
 * Per-node semantic facts attached during the walk: the inferred qualifier
 * for expression nodes, the resolved `na` flavour for `na`/`na(...)` nodes,
 * the declaration/reassignment verdict for assignment statements, and the
 * classified feed/elements for a tuple `request.security` declaration.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ann: SemanticAnnotation = { qualifier: "series" };
 *     void ann;
 */
export type SemanticAnnotation = Readonly<{
    qualifier?: TypeQualifier;
    naKind?: "numeric" | "handle" | "color";
    assignment?: AssignmentAnnotation;
    securityTuple?: SecurityTupleAnnotation;
}>;

/**
 * The lifecycle of one `var`/`varip` symbol: where it was reassigned,
 * mutated through a Pine setter, and deleted. Drives Camp A's single-
 * callsite fold (Task 10).
 *
 * @since 0.1
 * @stable
 * @example
 *     const li: LifetimeInfo = {
 *         declarationSpan: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 20 },
 *         reassignments: [],
 *         mutations: [],
 *         deletions: [],
 *     };
 *     void li;
 */
export type LifetimeInfo = Readonly<{
    declarationSpan: SourceSpan;
    reassignments: readonly SourceSpan[];
    mutations: readonly SourceSpan[];
    deletions: readonly SourceSpan[];
}>;

/**
 * Lifetime data per `var`/`varip` symbol, keyed by the shared
 * {@link SymbolInfo} identity the scope builder produced.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m: LifetimeMap = new Map();
 *     void m;
 */
export type LifetimeMap = ReadonlyMap<SymbolInfo, LifetimeInfo>;

/**
 * The drawing-handle mode of one `.new()` call-site:
 *
 * - `camp-a` — a single `var`/`varip` handle mutated each bar.
 * - `camp-b` — a bounded ring buffer with an extracted cap `K`.
 * - `camp-c-bounded` — a collection with an indicator cap but no detected
 *   eviction (attemptable heuristic).
 * - `camp-c-unbounded` — irreducibly dynamic (hard-reject).
 *
 * @since 0.1
 * @stable
 * @example
 *     const c: DrawingCamp = { kind: "camp-c-unbounded", reasoning: "linefill from collection" };
 *     void c;
 */
export type DrawingCamp =
    | Readonly<{ kind: "camp-a"; handleSymbol: SymbolInfo }>
    | Readonly<{
          kind: "camp-b";
          collectionSymbol: SymbolInfo;
          cap: number;
          capSource: "max-count-decl" | "bucket-default";
      }>
    | Readonly<{ kind: "camp-c-bounded"; reasoning: string }>
    | Readonly<{ kind: "camp-c-unbounded"; reasoning: string }>;

/**
 * A classified drawing constructor call-site: the `.new()` call, the Pine
 * constructor key, the handle family, the camp decision, and the call span.
 * The flat list the transform tasks (10–14) iterate over.
 *
 * @since 0.1
 * @stable
 * @example
 *     const site: DrawingCallSite = {
 *         call: {
 *             kind: "call-expression",
 *             callee: {
 *                 kind: "member-access-expression",
 *                 head: null,
 *                 chain: ["line", "new"],
 *                 span: { startLine: 5, startColumn: 8, endLine: 5, endColumn: 16 },
 *             },
 *             args: [],
 *             span: { startLine: 5, startColumn: 8, endLine: 5, endColumn: 18 },
 *         },
 *         constructor: "line.new",
 *         handleType: "line",
 *         camp: { kind: "camp-c-unbounded", reasoning: "x" },
 *         span: { startLine: 5, startColumn: 8, endLine: 5, endColumn: 18 },
 *     };
 *     void site;
 */
export type DrawingCallSite = Readonly<{
    call: CallExpression;
    constructor: PineDrawingConstructor;
    handleType: HandleType;
    camp: DrawingCamp;
    span: SourceSpan;
}>;

/**
 * The full output of {@link analyze}: the input script, the scope graph,
 * per-node annotations + scope membership, the symbol table (keyed by
 * declaration span), the `var`/`varip` lifetimes, the classified drawing
 * sites (both a flat list and a per-call map), the bar-index reference
 * flags, and the accumulated diagnostics. Every transform task (8–15)
 * consumes this.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: SemanticResult = {
 *         script: {
 *             kind: "script",
 *             version: null,
 *             declaration: null,
 *             body: [],
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *         rootScope: {
 *             parent: null,
 *             symbols: new Map(),
 *             span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *         },
 *         scopes: new Map(),
 *         annotations: new Map(),
 *         symbols: new Map(),
 *         lifetimes: new Map(),
 *         drawingSites: [],
 *         drawingClassifications: new Map(),
 *         referencesBarIndex: false,
 *         referencesFutureBarIndex: false,
 *         diagnostics: [],
 *     };
 *     void r;
 */
export type SemanticResult = Readonly<{
    script: Script;
    rootScope: Scope;
    scopes: ReadonlyMap<AstNode, Scope>;
    annotations: ReadonlyMap<AstNode, SemanticAnnotation>;
    symbols: ReadonlyMap<SourceSpan, SymbolInfo>;
    lifetimes: LifetimeMap;
    drawingSites: readonly DrawingCallSite[];
    drawingClassifications: ReadonlyMap<CallExpression, DrawingCamp>;
    referencesBarIndex: boolean;
    referencesFutureBarIndex: boolean;
    diagnostics: readonly Diagnostic[];
}>;
