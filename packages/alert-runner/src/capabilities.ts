// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    Capabilities,
    DrawingKind,
    InputKind,
    SymInfoField,
} from "@invinite-org/chartlang-adapter-kit";
import { capabilities as cap } from "@invinite-org/chartlang-adapter-kit";
import type { IntervalDescriptor, ScriptManifest } from "@invinite-org/chartlang-core";

const INPUT_KINDS: ReadonlyArray<InputKind> = [
    "int",
    "float",
    "bool",
    "string",
    "enum",
    "color",
    "source",
    "time",
    "price",
    "symbol",
    "interval",
    "session",
];

const SYM_INFO_FIELDS: ReadonlyArray<SymInfoField> = [
    "ticker",
    "type",
    "mintick",
    "currency",
    "basecurrency",
    "exchange",
    "timezone",
    "session",
    "meta",
];

/**
 * Ring-buffer floor the default capability bag advertises; raised to the
 * warm-up size when a script needs more.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { DEFAULT_ALERT_RUNNER_MAX_LOOKBACK } from "@invinite-org/chartlang-alert-runner";
 *     void DEFAULT_ALERT_RUNNER_MAX_LOOKBACK; // 5000
 */
export const DEFAULT_ALERT_RUNNER_MAX_LOOKBACK = 5_000;

/**
 * The headless capability bag the runner mounts a script under unless the
 * caller passes its own. Every alert channel and alert conditions are on (the
 * caller routes delivery); every plot kind is accepted so plotting scripts
 * stay quiet; drawings, logs and orders are off (nothing reads them);
 * intervals are exactly the alert interval plus the manifest's
 * `requestedIntervals`, with multi-timeframe on and multi-symbol off.
 *
 * The bag is part of the snapshot key (`capabilitiesHash`), so changing it
 * invalidates stored snapshots.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { alertRunnerCapabilities } from "@invinite-org/chartlang-alert-runner";
 *     declare const manifest: Parameters<typeof alertRunnerCapabilities>[0]["manifest"];
 *     const caps = alertRunnerCapabilities({ manifest, interval: "1h", maxLookback: 5_000 });
 *     void caps.alertConditions; // true
 */
export function alertRunnerCapabilities(
    opts: Readonly<{ manifest: ScriptManifest; interval: string; maxLookback: number }>,
): Capabilities {
    const values = [
        opts.interval,
        ...opts.manifest.requestedIntervals.filter((i) => i !== opts.interval),
    ];
    const intervals: ReadonlyArray<IntervalDescriptor> = values.map((value) => ({
        value,
        label: value,
        group: "alert",
    }));
    return Object.freeze({
        plots: cap.allPhase5Plots(),
        drawings: new Set<DrawingKind>(),
        alerts: cap.alerts("log", "toast", "webhook", "email", "sms", "push"),
        alertConditions: true,
        logs: false,
        orders: false,
        inputs: new Set<InputKind>(INPUT_KINDS),
        intervals,
        multiTimeframe: true,
        multiSymbol: false,
        subPanes: Number.MAX_SAFE_INTEGER,
        symInfoFields: new Set<SymInfoField>(SYM_INFO_FIELDS),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: Math.max(DEFAULT_ALERT_RUNNER_MAX_LOOKBACK, opts.maxLookback),
        maxTickHz: 30,
    });
}
