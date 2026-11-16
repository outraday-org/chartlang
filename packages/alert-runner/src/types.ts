// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    Capabilities,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import type {
    AlertSeverity,
    JsonValue,
    ScriptManifest,
    SessionCalendarDay,
    StateSnapshot,
    StateStoreKey,
} from "@invinite-org/chartlang-core";
import type { QuickJsLike } from "@invinite-org/chartlang-host-quickjs";

import type { SnapshotFidelity } from "./fidelity.js";

/**
 * When an alert delivers, per alert id (an `alert()` callsite or a
 * `defineAlertCondition` condition id).
 *
 * - `"every_time"` — every evaluation that emits delivers: each bar close
 *   and each pre-close evaluation. Equal to the runtime's drain output.
 * - `"once_per_bar"` — at most once per bar; a pre-close fire and the same
 *   bar's close are one signal.
 * - `"once_per_bar_close"` — only on bar close; pre-close evaluations never
 *   deliver.
 * - `"once"` — the first evaluation that delivers anything delivers all its
 *   events, then the runner is exhausted and delivers nothing more.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertFrequency } from "@invinite-org/chartlang-alert-runner";
 *     const frequency: AlertFrequency = "once_per_bar_close";
 *     void frequency;
 */
export type AlertFrequency = "once" | "once_per_bar" | "once_per_bar_close" | "every_time";

/**
 * One OHLCV bar as the runner accepts it. A full core `Bar` is assignable;
 * the runner derives `hl2` / `hlc3` / `ohlc4` / `hlcc4`, `symbol` and
 * `interval` itself. `time` is the bar's open time in UTC ms; `closeTime`,
 * when the caller knows the venue's real close, is forwarded to the script.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertBar } from "@invinite-org/chartlang-alert-runner";
 *     const bar: AlertBar = {
 *         time: 1_700_000_000_000,
 *         open: 1,
 *         high: 2,
 *         low: 0.5,
 *         close: 1.5,
 *         volume: 100,
 *     };
 *     void bar;
 */
export type AlertBar = Readonly<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime?: number;
}>;

/**
 * Hard caps for the QuickJS sandbox the runner evaluates in. Every limit
 * applies per guest call: the load, each warm-up chunk, each bar close, each
 * pre-close evaluation. `maxSteps` is the deterministic budget (see
 * `QuickJsHostLimits.maxSteps` in `@invinite-org/chartlang-host-quickjs`);
 * `maxStepMs` the wall-clock backstop.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerLimits } from "@invinite-org/chartlang-alert-runner";
 *     const limits: AlertRunnerLimits = {
 *         maxHeapBytes: 32 * 1024 * 1024,
 *         maxStepMs: 250,
 *         maxSteps: 5_000_000,
 *         maxLoadTimeoutMs: 30_000,
 *     };
 *     void limits;
 */
export type AlertRunnerLimits = Readonly<{
    maxHeapBytes: number;
    maxStepMs: number;
    maxSteps: number;
    maxLoadTimeoutMs: number;
}>;

/**
 * The slice of `@invinite-org/chartlang-compiler`'s `CompiledScript` the
 * runner needs. Pass the compiler's output as is.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerCompiledScript } from "@invinite-org/chartlang-alert-runner";
 *     declare const compiled: AlertRunnerCompiledScript;
 *     void compiled.manifest.maxLookback;
 */
export type AlertRunnerCompiledScript = Readonly<{
    moduleSource: string;
    manifest: ScriptManifest;
}>;

/**
 * Which evaluation produced an event: a confirmed bar close, or a pre-close
 * evaluation of the still-forming bar.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerPhase } from "@invinite-org/chartlang-alert-runner";
 *     const phase: AlertRunnerPhase = "close";
 *     void phase;
 */
export type AlertRunnerPhase = "close" | "preClose";

/**
 * One delivered alert. `kind: "alert"` comes from an `alert()` call (`id` is
 * the callsite `slotId`); `kind: "condition"` from `signal(id, true)` of a
 * `defineAlertCondition` script (`id` is the condition id, `title` its
 * title, `message` its default message). `dedupeKey` is stable across
 * restarts, snapshot restores and warm-up lengths: `kind:id:time`, plus a
 * `:pre:<offsetMs>` suffix for an `every_time` pre-close delivery and a
 * `#n` suffix for the n-th repeat of one id within one evaluation.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerEvent } from "@invinite-org/chartlang-alert-runner";
 *     const event: AlertRunnerEvent = {
 *         kind: "alert",
 *         id: "x.chart.ts:5:9#0",
 *         message: "crossed",
 *         severity: "info",
 *         meta: {},
 *         bar: 120,
 *         time: 1_700_000_000_000,
 *         dedupeKey: "alert:x.chart.ts:5:9#0:1700000000000",
 *         phase: "close",
 *     };
 *     void event;
 */
export type AlertRunnerEvent = Readonly<{
    kind: "alert" | "condition";
    id: string;
    title?: string;
    message: string;
    severity?: AlertSeverity;
    meta: Readonly<Record<string, JsonValue>>;
    bar: number;
    time: number;
    dedupeKey: string;
    phase: AlertRunnerPhase;
}>;

/**
 * Why the frequency gate held an emission back.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertSuppressionReason } from "@invinite-org/chartlang-alert-runner";
 *     const reason: AlertSuppressionReason = "already-fired-this-bar";
 *     void reason;
 */
export type AlertSuppressionReason =
    | "frequency"
    | "already-fired-this-bar"
    | "cooldown"
    | "exhausted";

/**
 * An emission the gate did not deliver, with the reason.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertSuppression } from "@invinite-org/chartlang-alert-runner";
 *     const held: AlertSuppression = {
 *         kind: "condition",
 *         id: "up",
 *         time: 1_700_000_000_000,
 *         reason: "frequency",
 *     };
 *     void held;
 */
export type AlertSuppression = Readonly<{
    kind: "alert" | "condition";
    id: string;
    time: number;
    reason: AlertSuppressionReason;
}>;

/**
 * Result of one pre-close evaluation: what was delivered, what the gate held
 * back, and the facts it ran on (the bar it evaluated and how far before the
 * close it ran).
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { PreCloseResult } from "@invinite-org/chartlang-alert-runner";
 *     declare const result: PreCloseResult;
 *     const wouldFire = result.emissionCount > 0;
 *     void wouldFire;
 */
export type PreCloseResult = Readonly<{
    events: ReadonlyArray<AlertRunnerEvent>;
    suppressed: ReadonlyArray<AlertSuppression>;
    bar: AlertBar;
    offsetMs: number;
    /** Alerts plus `fired: true` conditions the script emitted, delivered or not. */
    emissionCount: number;
}>;

/**
 * A non-fatal problem the runner observed: a runtime diagnostic from the
 * script's drain, or a host message (a script error, a slow step).
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerDiagnostic } from "@invinite-org/chartlang-alert-runner";
 *     const d: AlertRunnerDiagnostic = { source: "host", message: "step overshoot 3.10ms" };
 *     void d;
 */
export type AlertRunnerDiagnostic =
    | Readonly<{ source: "host"; message: string }>
    | Readonly<{ source: "runtime"; message: string; diagnostic: RuntimeDiagnostic }>;

/**
 * Persisted per-id gate state: the last bar time each id delivered on, and
 * whether a `"once"` runner is spent.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { FrequencyGateState } from "@invinite-org/chartlang-alert-runner";
 *     const state: FrequencyGateState = { lastFiredBarTime: { "alert:x": 0 }, exhausted: false };
 *     void state;
 */
export type FrequencyGateState = Readonly<{
    lastFiredBarTime: Readonly<Record<string, number>>;
    exhausted: boolean;
}>;

/**
 * The JSON document `exportSnapshot()` returns and `createAlertRunner`'s
 * `snapshot` option accepts back. The caller stores it verbatim (it is
 * JSON-clean) and treats it as opaque.
 *
 * `key` carries every persistent-store identity field of the spec
 * (`scriptHash`, `compilerVersion`, `apiVersion`, `capabilitiesHash`,
 * `symbol`, `mainInterval`, `requestedIntervals`); `inputsHash` adds the
 * user inputs. Any difference refuses the snapshot and the runner needs a
 * warm-up.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerSnapshot } from "@invinite-org/chartlang-alert-runner";
 *     declare const snapshot: AlertRunnerSnapshot;
 *     const stored = JSON.stringify(snapshot);
 *     void stored;
 */
export type AlertRunnerSnapshot = Readonly<{
    format: "chartlang-alert-runner";
    version: 1;
    key: StateStoreKey;
    inputsHash: string;
    lastBarTime: number | null;
    secondaryLastBarTimes: Readonly<Record<string, number>>;
    gate: FrequencyGateState;
    state: StateSnapshot;
}>;

/**
 * What happened to the snapshot passed to `createAlertRunner`:
 * `"none"` (none passed), `"restored"`, `"key-mismatch"` (another script,
 * compiler, symbol, interval, capability set or inputs), `"invalid"` (not a
 * runner snapshot, or the runtime refused its payload), `"unkeyed"` (the
 * manifest carries no `compilerVersion`, so snapshots are disabled),
 * `"lossy"` (the script holds state a snapshot cannot carry — see
 * `snapshotFidelityOf` — so snapshots are disabled).
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { SnapshotStatus } from "@invinite-org/chartlang-alert-runner";
 *     const status: SnapshotStatus = "restored";
 *     void status;
 */
export type SnapshotStatus = "none" | "restored" | "key-mismatch" | "invalid" | "unkeyed" | "lossy";

/**
 * Options for `createAlertRunner`.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { CreateAlertRunnerOpts } from "@invinite-org/chartlang-alert-runner";
 *     declare const compiled: CreateAlertRunnerOpts["compiled"];
 *     const opts: CreateAlertRunnerOpts = {
 *         compiled,
 *         symInfo: { ticker: "AAPL" },
 *         interval: "1h",
 *         frequency: "once_per_bar_close",
 *     };
 *     void opts;
 */
export type CreateAlertRunnerOpts = Readonly<{
    /** The compiler's output for the script. */
    compiled: AlertRunnerCompiledScript;
    /** The alert's interval, e.g. `"1h"`, `"1D"` (see core `intervalToSeconds`). */
    interval: string;
    frequency: AlertFrequency;
    /** Instrument facts; `ticker` is the main-stream symbol and part of the snapshot key. */
    symInfo?: AdapterSymInfo;
    /** User inputs, validated against `manifest.inputs` (see `validateAlertInputs`). */
    inputs?: Readonly<Record<string, unknown>>;
    /** Bars an id stays quiet after it delivered (`0`, the default, = no cooldown). */
    cooldownBars?: number;
    limits?: Partial<AlertRunnerLimits>;
    /** A previous `exportSnapshot()` result, as stored (parsed JSON). */
    snapshot?: unknown;
    /** Floor for `requiredHistory()`; defaults to `DEFAULT_MIN_WARM_UP_BARS`. */
    minWarmUpBars?: number;
    /** Bars per warm-up guest call; defaults to 1 so warm-up runs on the per-bar budget. */
    warmUpChunkBars?: number;
    /** Exchange calendar rows for `session.*` reads. */
    sessionCalendar?: ReadonlyArray<SessionCalendarDay>;
    /** QuickJS module factory, e.g. a precompiled-WASM variant for an edge runtime. */
    quickJsLike?: QuickJsLike;
    /** Replace the default capability bag (`alertRunnerCapabilities`). */
    capabilities?: Capabilities;
    /** Receives every non-fatal diagnostic. */
    onDiagnostic?: (diagnostic: AlertRunnerDiagnostic) => void;
}>;

/**
 * Secondary-interval bars for `warmUp`, keyed by interval (`"1D"`). Only the
 * script's `manifest.requestedIntervals` are accepted.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { WarmUpOpts } from "@invinite-org/chartlang-alert-runner";
 *     const opts: WarmUpOpts = { secondary: { "1D": [] } };
 *     void opts;
 */
export type WarmUpOpts = Readonly<{
    secondary?: Readonly<Record<string, ReadonlyArray<AlertBar>>>;
}>;

/**
 * A headless alert evaluator over one compiled script, one symbol and one
 * interval. Calls are serialized internally; a fatal error (step budget,
 * wall-clock budget, out of memory) fails the runner — every later call
 * throws an `AlertRunnerError` with code `"runner-failed"`, and only
 * `dispose()` works.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunner } from "@invinite-org/chartlang-alert-runner";
 *     declare const runner: AlertRunner;
 *     declare const bar: Parameters<AlertRunner["onBarClose"]>[0];
 *     const events = await runner.onBarClose(bar);
 *     void events;
 */
export type AlertRunner = Readonly<{
    /** What happened to the snapshot passed at creation. */
    readonly snapshotStatus: SnapshotStatus;
    /** The snapshot key this runner exports under, or `null` when unkeyed. */
    readonly key: StateStoreKey | null;
    /** `"lossy"`: snapshots are disabled and pre-close replays every folded bar. */
    readonly snapshotFidelity: SnapshotFidelity;
    /** Time of the last main-stream bar folded in (the replay watermark). */
    readonly lastBarTime: number | null;
    /** Time of the last bar folded into a secondary interval, or `null`. */
    lastSecondaryBarTime(interval: string): number | null;
    /** `true` once a `"once"` runner delivered. */
    readonly exhausted: boolean;
    /** Bars of history `warmUp` should receive (main and each secondary interval). */
    requiredHistory(): number;
    /** `true` when nothing was restored and no bar has been folded in yet. */
    needsWarmUp(): boolean;
    /** Fold closed history bars in without delivering. Only before the first bar. */
    warmUp(bars: ReadonlyArray<AlertBar>, opts?: WarmUpOpts): Promise<void>;
    /** Fold one closed bar in; returns the events the frequency lets through. */
    onBarClose(bar: AlertBar): Promise<ReadonlyArray<AlertRunnerEvent>>;
    /** Fold one closed bar of a secondary interval in (before the main bar it precedes). */
    onSecondaryBarClose(interval: string, bar: AlertBar): Promise<void>;
    /** Evaluate the still-forming bar `offsetMs` before its close, on a copy of the state. */
    onPreClose(bar: AlertBar, offsetMs: number): Promise<PreCloseResult>;
    /** The state to store, or `null` when the runner is unkeyed or lossy. */
    exportSnapshot(): Promise<AlertRunnerSnapshot | null>;
    dispose(): void;
}>;
