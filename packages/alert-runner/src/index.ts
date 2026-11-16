// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export {
    DEFAULT_ALERT_RUNNER_LIMITS,
    DEFAULT_MIN_WARM_UP_BARS,
    createAlertRunner,
    requiredHistoryFor,
} from "./runner.js";
export { createBarAggregator } from "./aggregate.js";
export type {
    AggregatedBarSource,
    BarAggregator,
    BarAggregatorOpts,
    BarAggregatorResult,
} from "./aggregate.js";
export { snapshotFidelityOf } from "./fidelity.js";
export type { SnapshotFidelity } from "./fidelity.js";
export { createFrequencyGate } from "./frequency.js";
export type { FrequencyGate, GateCandidate, GateVerdict } from "./frequency.js";
export { AlertRunnerError } from "./errors.js";
export type { AlertRunnerErrorCode } from "./errors.js";
export { alertRunnerCapabilities, DEFAULT_ALERT_RUNNER_MAX_LOOKBACK } from "./capabilities.js";
export { validateAlertInputs } from "./inputs.js";
export { intervalMs } from "./interval.js";
export type {
    AlertBar,
    AlertFrequency,
    AlertRunner,
    AlertRunnerCompiledScript,
    AlertRunnerDiagnostic,
    AlertRunnerEvent,
    AlertRunnerLimits,
    AlertRunnerPhase,
    AlertRunnerSnapshot,
    AlertSuppression,
    AlertSuppressionReason,
    CreateAlertRunnerOpts,
    FrequencyGateState,
    PreCloseResult,
    SnapshotStatus,
    WarmUpOpts,
} from "./types.js";
