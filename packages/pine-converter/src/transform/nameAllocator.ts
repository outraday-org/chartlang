// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SemanticResult } from "../semantic/index.js";

// The chartlang `compute(ctx)` destructure params (every name the generated
// body might bind from the context) plus the always-present import binding.
// Reserved so a synthesized name never shadows `bar`/`draw`/etc.
const COMPUTE_CONTEXT_NAMES: readonly string[] = [
    "bar",
    "draw",
    "ta",
    "plot",
    "hline",
    "alert",
    "inputs",
    "state",
    "request",
    "barstate",
];

// JavaScript/TypeScript reserved words a synthesized identifier must never
// equal — emitting `const default = …` or `let class = …` is a syntax error.
// A Pine identifier that happens to match one of these is translated verbatim
// elsewhere (it is valid Pine), so reserving them only constrains SYNTHESIZED
// names, which is exactly the safety the allocator owes.
const JS_RESERVED_WORDS: readonly string[] = [
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "let",
    "static",
    "await",
];

// Coerce an arbitrary preferred base into a valid, readable identifier stem:
// strip leading `__` (the convention the allocator replaces), drop any
// non-identifier character, and prefix `n` if it would otherwise start with a
// digit. Falls back to `"value"` for an empty result so allocation always
// yields a usable name.
function sanitizeBase(preferred: string): string {
    const stripped = preferred.replace(/^_+/, "");
    const cleaned = stripped.replace(/[^A-Za-z0-9_$]/g, "");
    if (cleaned.length === 0) {
        return "value";
    }
    return /^[0-9]/.test(cleaned) ? `n${cleaned}` : cleaned;
}

/**
 * A deterministic, scope-aware identifier allocator for converter codegen.
 *
 * The converter synthesizes locals/types/functions in the generated
 * `compute` body (drawing handles, the bar-index bridge, ring/state vars, the
 * drawing-handle helper). Those names must never collide with identifiers
 * translated out of the Pine source (or the `compute` context params), which
 * is the reason the old codegen blanket-prefixed every synthesized name with
 * `__`. This allocator replaces that convention with readable names: it tracks
 * every taken identifier and hands back the preferred base when free, else a
 * minimal numeric-suffixed variant (`trail`, `trail2`, `trail3`, …). It NEVER
 * emits a `__`-prefixed name — a preferred base's leading underscores are
 * stripped on the way in.
 *
 * Allocation is order-deterministic: seed the allocator with the reserved set
 * first ({@link collectReservedNames}), allocate per-Pine-symbol names during
 * the transforms (each reusing its own Pine identifier), then allocate the
 * generic helper names last so they yield to user identifiers.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { NameAllocator } from "./nameAllocator.js";
 *     const names = new NameAllocator(["trail"]);
 *     names.allocate("trail"); // "trail2" — "trail" is reserved
 *     names.allocate("lvl"); // "lvl"
 */
export class NameAllocator {
    // Names that exist in the source scope but are NOT yet emitted as a
    // synthesized output — translated Pine symbols, context params, reserved
    // words. A generic `allocate` must avoid these; a per-symbol allocation MAY
    // reclaim its own seeded Pine name (its source references are rewritten to
    // the synthesized name, so reuse is collision-free).
    private readonly seeded: Set<string>;
    // Names actually emitted as synthesized output. Both `allocate` and
    // `allocateForSymbol` must avoid these.
    private readonly taken: Set<string>;
    // Memo of Pine-symbol → allocated name so `allocateForSymbol` is idempotent
    // — two transforms touching the SAME collection/handle (e.g. two
    // `array.push` sites into one ring) get the same local instead of minting a
    // colliding second name.
    private readonly symbolNames: Map<string, string>;
    // Memo of memo-key → allocated name for `allocateMemoized`, so codegen can
    // re-run helper-name allocation idempotently (`emit` must be deterministic
    // across repeated invocations of the same scaffold).
    private readonly memoizedNames: Map<string, string>;

    /**
     * Construct an allocator with an initial reserved (seeded) set. Each name
     * is recorded verbatim (no sanitization — reserved names are existing,
     * already-valid identifiers); subsequent {@link allocate} calls avoid them.
     *
     * @since 0.1
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator(["bar", "draw"]);
     *     names.has("bar"); // true
     */
    public constructor(reserved: Iterable<string> = []) {
        this.seeded = new Set(reserved);
        this.taken = new Set();
        this.symbolNames = new Map();
        this.memoizedNames = new Map();
    }

    /**
     * Whether `name` is already known (seeded or emitted).
     *
     * @since 0.1
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator(["x"]);
     *     names.has("x"); // true
     *     names.has("y"); // false
     */
    public has(name: string): boolean {
        return this.seeded.has(name) || this.taken.has(name);
    }

    /**
     * Seed `name` as a reserved source identifier without renaming it.
     * Idempotent.
     *
     * @since 0.1
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator();
     *     names.reserve("close");
     *     names.has("close"); // true
     */
    public reserve(name: string): void {
        this.seeded.add(name);
    }

    /**
     * Allocate a readable identifier for a GENERIC synthesized name (the
     * bar-index bridge, the drawing-handle helper type/function). Sanitizes
     * the base (strips leading `__`, drops invalid chars) and returns it when
     * free of BOTH the seeded and emitted sets, else appends the smallest
     * integer ≥ 2 that is free (`base2`, `base3`, …). Records the result as
     * emitted. Never returns a `__`-prefixed name.
     *
     * @since 0.1
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator(["barIndex"]);
     *     names.allocate("barIndex"); // "barIndex2" — collides with a Pine var
     */
    public allocate(preferred: string): string {
        return this.claim(sanitizeBase(preferred), (name) => this.has(name));
    }

    /**
     * Allocate a GENERIC synthesized name MEMOIZED by `key` — repeated calls
     * with the same `key` return the same name without consuming a new suffix.
     * Codegen uses this for the helper identifiers so `emit` is deterministic
     * across repeated invocations of one scaffold (re-running allocation must
     * not mint `barIndex2` the second time). The FIRST call for a key allocates
     * exactly like {@link allocate}; later calls replay the memo.
     *
     * @since 0.1
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator();
     *     names.allocateMemoized("barIndex", "barIndex"); // "barIndex"
     *     names.allocateMemoized("barIndex", "barIndex"); // "barIndex" (replayed)
     */
    public allocateMemoized(key: string, preferred: string): string {
        const memoized = this.memoizedNames.get(key);
        if (memoized !== undefined) {
            return memoized;
        }
        const allocated = this.allocate(preferred);
        this.memoizedNames.set(key, allocated);
        return allocated;
    }

    /**
     * Allocate the synthesized name for a Pine SYMBOL (a drawing handle, a
     * state slot, a ring), preferring the symbol's own identifier so a Pine
     * `var line trail` becomes `trail`. The symbol's seeded name is reclaimable
     * here (its source references are rewritten to this name), so the only
     * collisions considered are previously-EMITTED names — two distinct symbols
     * never share a root-scope identifier. Sanitizes + suffix-disambiguates
     * exactly like {@link allocate}; never returns a `__`-prefixed name.
     *
     * @since 0.1
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator(["trail"]);
     *     names.allocateForSymbol("trail"); // "trail" — reclaims its own seed
     */
    public allocateForSymbol(pineName: string): string {
        const memoized = this.symbolNames.get(pineName);
        if (memoized !== undefined) {
            return memoized;
        }
        const allocated = this.claim(sanitizeBase(pineName), (name) => this.taken.has(name));
        this.symbolNames.set(pineName, allocated);
        return allocated;
    }

    /**
     * The local already allocated for a Pine SYMBOL via
     * {@link allocateForSymbol}, or `undefined` when the symbol was never
     * allocated. A pure PEEK — it never claims a new name, so a caller can ask
     * "did this collection/handle get a local?" without the side effect of
     * minting one (the contract the drawing-ring emit context relies on to skip
     * un-registered collections).
     *
     * @since 0.4
     * @stable
     * @example
     *     import { NameAllocator } from "./nameAllocator.js";
     *     const names = new NameAllocator();
     *     names.allocatedSymbol("lvls"); // undefined
     *     names.allocateForSymbol("lvls"); // "lvls"
     *     names.allocatedSymbol("lvls"); // "lvls"
     */
    public allocatedSymbol(pineName: string): string | undefined {
        return this.symbolNames.get(pineName);
    }

    // Shared claim loop: pick `base` when `isTaken(base)` is false, else the
    // smallest `base<n>` (n ≥ 2) that passes, recording the winner as emitted.
    private claim(base: string, isTaken: (name: string) => boolean): string {
        if (!isTaken(base)) {
            this.taken.add(base);
            return base;
        }
        let suffix = 2;
        while (isTaken(`${base}${suffix}`) || this.taken.has(`${base}${suffix}`)) {
            suffix += 1;
        }
        const allocated = `${base}${suffix}`;
        this.taken.add(allocated);
        return allocated;
    }
}

/**
 * Collect every identifier already present in the generated scope so the
 * {@link NameAllocator} can avoid colliding with them: the `compute` context
 * params, the JS/TS reserved words, and every Pine symbol the source declares
 * (handles, scalars, collections, loop iterators) read from the semantic
 * `symbols` table. The Pine names are reserved because a synthesized name that
 * is NOT a per-symbol allocation (the bar-index bridge, the helper types) must
 * not clash with a translated Pine variable; a per-symbol allocation reuses
 * its own Pine name deliberately (claiming an already-reserved name yields a
 * suffixed variant only when two different sites want the same base).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { collectReservedNames } from "./nameAllocator.js";
 *     declare const analysis: import("../semantic/index.js").SemanticResult;
 *     collectReservedNames(analysis).has("bar"); // true
 */
export function collectReservedNames(analysis: SemanticResult): Set<string> {
    const reserved = new Set<string>(COMPUTE_CONTEXT_NAMES);
    for (const word of JS_RESERVED_WORDS) {
        reserved.add(word);
    }
    for (const symbol of analysis.symbols.values()) {
        reserved.add(symbol.name);
    }
    return reserved;
}
