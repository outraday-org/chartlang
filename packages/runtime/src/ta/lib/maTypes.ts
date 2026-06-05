// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MaTypeNoVolume } from "@invinite-org/chartlang-core";

/**
 * Re-export of the public {@link MaTypeNoVolume} from
 * `@invinite-org/chartlang-core`. The runtime-side `ta/lib/` helpers
 * consume it through this module so the local {@link MaType} (which
 * adds `"vwma"`) and the chained-MA subset stay declared next to each
 * other — there is no separate runtime declaration of the union, only
 * a re-export, so the two cannot drift.
 *
 * @formula  N/A — string-literal union type
 * @since 0.2
 * @stable
 * @example
 *     // const k: MaTypeNoVolume = "wma";
 */
export type { MaTypeNoVolume };

/**
 * Canonical moving-average kind union shared by every primitive that
 * exposes a configurable MA-type option (`bb` middle override,
 * `keltner` middle, `envelope` middle, `chop` denominator, `donchian`
 * midpoint, MACD / PPO / PVO signal). `"smma"` is the Wilder
 * smoothing kind (RMA in TradingView's vocabulary; same math path).
 *
 * Extends the public {@link MaTypeNoVolume} from
 * `@invinite-org/chartlang-core` with `"vwma"` — VWMA requires a
 * parallel volume array and is therefore unavailable to the chained-MA
 * dispatcher (`computeMaOfFloat64`). The volume-aware dispatcher
 * (`computeMa`) accepts the full {@link MaType}.
 *
 * @formula  N/A — string-literal union type
 * @since 0.2
 * @stable
 * @example
 *     // const k: MaType = "ema";
 */
export type MaType = MaTypeNoVolume | "vwma";
