// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Shared contract for the two ring-buffer flavours the runtime ships
 * (`RingBuffer<T>` for object payloads, `Float64RingBuffer` for numeric
 * payloads). Mirrors PLAN.md §6.6 — `at(n)` returns `undefined` on
 * out-of-range reads in the generic shape; `Float64RingBuffer` narrows
 * the return to `number` with `NaN` as the OOR sentinel.
 *
 * @since 0.1
 * @example
 *     const buf: RingBufferLike<number> = new Float64RingBuffer(8);
 *     buf.append(42);
 *     buf.at(0); // 42
 */
export interface RingBufferLike<T> {
    readonly capacity: number;
    readonly length: number;
    append(v: T): void;
    replaceHead(v: T): void;
    at(n: number): T | undefined;
    reset(): void;
}

/**
 * Generic ring buffer over an `Array<T>`. Backs object-valued
 * `Series<T>` (e.g. Phase-3 drawing handles). For numeric series use
 * `Float64RingBuffer` — it avoids the array-pointer indirection on
 * every read.
 *
 * Out-of-range `at(n)` returns `undefined`. `replaceHead` on an empty
 * buffer behaves like `append` so the first call after construction
 * does not need a special-case branch in callers.
 *
 * @since 0.1
 * @example
 *     const buf = new RingBuffer<string>(3);
 *     buf.append("a");
 *     buf.append("b");
 *     buf.append("c");
 *     buf.append("d"); // overwrites "a"
 *     buf.at(0); // "d"
 *     buf.at(2); // "b"
 */
export class RingBuffer<T> implements RingBufferLike<T> {
    private buf: Array<T | undefined>;
    private head = -1;
    private filled = 0;

    constructor(public readonly capacity: number) {
        this.buf = new Array<T | undefined>(capacity);
    }

    append(v: T): void {
        this.head = (this.head + 1) % this.capacity;
        this.buf[this.head] = v;
        if (this.filled < this.capacity) this.filled += 1;
    }

    replaceHead(v: T): void {
        if (this.head === -1) {
            this.append(v);
            return;
        }
        this.buf[this.head] = v;
    }

    at(n: number): T | undefined {
        if (n < 0 || n >= this.filled) return undefined;
        return this.buf[(this.head - n + this.capacity) % this.capacity];
    }

    get length(): number {
        return this.filled;
    }

    reset(): void {
        this.buf = new Array<T | undefined>(this.capacity);
        this.head = -1;
        this.filled = 0;
    }
}

/**
 * Numeric ring buffer backed by a `Float64Array`. Reads are direct
 * memory hits — no boxing, no map lookup. Out-of-range reads return
 * `NaN` (the language-wide warmup sentinel per PLAN.md §6.3), which
 * is the correct value for unwarmed indicator slots.
 *
 * `at(n)` narrows the shared `RingBufferLike<T>`'s `T | undefined`
 * return to plain `number` in a covariant return position; callers
 * that hold this concrete class see `number`, callers that hold
 * the wider interface see `number | undefined`.
 *
 * @since 0.1
 * @example
 *     const buf = new Float64RingBuffer(4);
 *     buf.append(1.0);
 *     buf.append(2.0);
 *     buf.at(0); // 2
 *     buf.at(5); // NaN
 */
export class Float64RingBuffer implements RingBufferLike<number> {
    private buf: Float64Array;
    private head = -1;
    private filled = 0;

    constructor(public readonly capacity: number) {
        this.buf = new Float64Array(capacity);
    }

    append(v: number): void {
        this.head = (this.head + 1) % this.capacity;
        this.buf[this.head] = v;
        if (this.filled < this.capacity) this.filled += 1;
    }

    replaceHead(v: number): void {
        if (this.head === -1) {
            this.append(v);
            return;
        }
        this.buf[this.head] = v;
    }

    at(n: number): number {
        if (n < 0 || n >= this.filled) return Number.NaN;
        return this.buf[(this.head - n + this.capacity) % this.capacity];
    }

    get length(): number {
        return this.filled;
    }

    serialiseSnapshotBuffer(): Readonly<{
        headIndex: number;
        filled: number;
        values: ReadonlyArray<number | null>;
    }> {
        const values: Array<number | null> = [];
        for (const value of this.buf) {
            values.push(Number.isNaN(value) ? null : value);
        }
        return Object.freeze({
            headIndex: this.head,
            filled: this.filled,
            values: Object.freeze(values),
        });
    }

    restoreFromSnapshotBuffer(
        args: Readonly<{
            headIndex: number;
            filled: number;
            values: ReadonlyArray<number | null>;
        }>,
    ): void {
        if (
            args.values.length !== this.capacity ||
            !Number.isInteger(args.headIndex) ||
            args.headIndex < -1 ||
            args.headIndex >= this.capacity ||
            !Number.isInteger(args.filled) ||
            args.filled < 0 ||
            args.filled > this.capacity ||
            (args.filled === 0 && args.headIndex !== -1) ||
            (args.filled > 0 && args.headIndex < 0)
        ) {
            throw new Error("invalid ring buffer snapshot");
        }
        const next = new Float64Array(this.capacity);
        for (let i = 0; i < args.values.length; i += 1) {
            const value = args.values[i];
            next[i] = value === null ? Number.NaN : value;
        }
        this.buf = next;
        this.head = args.headIndex;
        this.filled = args.filled;
    }

    reset(): void {
        this.buf = new Float64Array(this.capacity);
        this.head = -1;
        this.filled = 0;
    }
}
