# `ta.*` primitives

The `ta.*` namespace is chartlang's technical-analysis surface — a
Pine-canonical set of stateful indicators that script authors call
once per bar. Every primitive's page on this index is **auto-generated**
from the runtime's JSDoc by `chartlang docs` (see
[`packages/cli/src/commands/genDocs.ts`](../../../packages/cli/src/commands/genDocs.ts)).
This index page is hand-maintained.

## Phase-1 primitives

| ID | Page | Output | Warmup |
|---|---|---|---|
| `sma` | [`./sma.md`](./sma.md) | `Series<number>` | `length − 1` |
| `ema` | [`./ema.md`](./ema.md) | `Series<number>` | `length − 1` |
| `stdev` | [`./stdev.md`](./stdev.md) | `Series<number>` | `length − 1` |
| `bb` | [`./bb.md`](./bb.md) | `{ upper, middle, lower }` | `length − 1` |
| `rsi` | [`./rsi.md`](./rsi.md) | `Series<number>` | `length` |
| `macd` | [`./macd.md`](./macd.md) | `{ macd, signal, hist }` | `slowLength + signalLength − 1` |
| `atr` | [`./atr.md`](./atr.md) | `Series<number>` | `length − 1` |
| `crossover` | [`./crossover.md`](./crossover.md) | `Series<boolean>` | `1` |
| `crossunder` | [`./crossunder.md`](./crossunder.md) | `Series<boolean>` | `1` |

## Phase-2 primitives

Phase-2 ports populate this index as their PRs land (see
[`tasks/phase-2-indicator-parity/`](../../../tasks/phase-2-indicator-parity/)).
Each port commits its `<id>.md` alongside the impl + five-file
test set + conformance scenario per PLAN.md §22.10.

### Cross-functional (Task 5)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `nz` | [`./nz.md`](./nz.md) | `number` | `0` (stateless) |
| `highest` | [`./highest.md`](./highest.md) | `Series<number>` | `length − 1` |
| `lowest` | [`./lowest.md`](./lowest.md) | `Series<number>` | `length − 1` |
| `change` | [`./change.md`](./change.md) | `Series<number>` | `length` |
| `valuewhen` | [`./valuewhen.md`](./valuewhen.md) | `Series<number>` | data-dependent (NaN until `occurrence + 1` matches) |
| `barssince` | [`./barssince.md`](./barssince.md) | `Series<number>` | data-dependent (NaN until first match) |

### Trend (Task 15)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `aroon` | [`./aroon.md`](./aroon.md) | `{ up, down }` | `length` |
| `aroonOsc` | [`./aroonOsc.md`](./aroonOsc.md) | `Series<number>` | `length` |

### Trend (Task 16)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `adx` | [`./adx.md`](./adx.md) | `Series<number>` (clamped `[0, 100]`) | `2 · length − 1` |
| `dmi` | [`./dmi.md`](./dmi.md) | `{ plusDi, minusDi }` (clamped `[0, 100]`) | `length` |
| `trix` | [`./trix.md`](./trix.md) | `{ trix, signal }` (unbounded, oscillator around zero) | `3 · length + signalLength − 3` |

### Trend (Task 17)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `vortex` | [`./vortex.md`](./vortex.md) | `{ plus, minus }` (≥ 0) | `length` |
| `trendStrengthIndex` | [`./trendStrengthIndex.md`](./trendStrengthIndex.md) | `Series<number>` (clamped `[-1, 1]`; Pearson correlation of source vs bar-index) | `length − 1` |
| `ichimoku` | [`./ichimoku.md`](./ichimoku.md) | `{ tenkan, kijun, senkouA, senkouB, chikou }` | `senkouBLength` for the full set |

### Momentum (Task 13)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `ao` | [`./ao.md`](./ao.md) | `Series<number>` | `slowLength − 1` (defaults `5` / `34`) |
| `cmo` | [`./cmo.md`](./cmo.md) | `Series<number>` (bounded `[-100, 100]`) | `length` |
| `momentum` | [`./momentum.md`](./momentum.md) | `Series<number>` | `length` |
| `roc` | [`./roc.md`](./roc.md) | `Series<number>` | `length` |

### Momentum (Task 14)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `pmo` | [`./pmo.md`](./pmo.md) | `{ pmo, signal }` | `firstSmoothing + secondSmoothing + signalLength − 3` |
| `smi` | [`./smi.md`](./smi.md) | `{ smi, signal }` (bounded `[-100, 100]`) | `kLength + firstSmoothing + secondSmoothing + dLength − 4` |
| `tsi` | [`./tsi.md`](./tsi.md) | `{ tsi, signal }` (bounded `[-100, 100]`) | `firstSmoothing + secondSmoothing + signalLength − 3` |

### MA ports (Task 6)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `wma` | [`./wma.md`](./wma.md) | `Series<number>` | `length − 1` |
| `vwma` | [`./vwma.md`](./vwma.md) | `Series<number>` | `length − 1` |
| `hma` | [`./hma.md`](./hma.md) | `Series<number>` | `length + ⌈√length⌉ − 2` |
| `smma` | [`./smma.md`](./smma.md) | `Series<number>` (Wilder's RMA) | `length − 1` |

### MA ports (Task 7)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `dema` | [`./dema.md`](./dema.md) | `Series<number>` | `2 · length − 2` |
| `tema` | [`./tema.md`](./tema.md) | `Series<number>` | `3 · length − 3` |
| `kama` | [`./kama.md`](./kama.md) | `Series<number>` (Kaufman Adaptive MA) | `length` |
| `alma` | [`./alma.md`](./alma.md) | `Series<number>` (Gaussian-weighted) | `length − 1` |

### MA ports (Task 8)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `lsma` | [`./lsma.md`](./lsma.md) | `Series<number>` (least-squares regression value) | `length − 1` |
| `mcginley` | [`./mcginley.md`](./mcginley.md) | `Series<number>` (McGinley Dynamic) | `length` |
| `maRibbon` | [`./maRibbon.md`](./maRibbon.md) | `{ ma_<length>: Series<number> }` (dynamic-key fan; defaults `lengths=[10,20,30,40,50]`, `maType="sma"`) | per-output: matches source MA at that length |

### Oscillators (Task 9)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `cci` | [`./cci.md`](./cci.md) | `Series<number>` (unbounded, typically ±200) | `length − 1` |
| `stoch` | [`./stoch.md`](./stoch.md) | `{ k, d }` (bounded `[0, 100]`) | `kLength + kSmoothing + dLength − 3` |
| `williamsR` | [`./williamsR.md`](./williamsR.md) | `Series<number>` (bounded `[-100, 0]`) | `length − 1` |

### Oscillators (Task 11)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `stochRsi` | [`./stochRsi.md`](./stochRsi.md) | `{ k, d }` (bounded `[0, 100]`) | `rsiLength + stochLength + kSmoothing + dSmoothing − 4` |
| `ultimateOsc` | [`./ultimateOsc.md`](./ultimateOsc.md) | `Series<number>` (bounded `[0, 100]`) | `longLength` |
| `coppock` | [`./coppock.md`](./coppock.md) | `Series<number>` (unbounded; zero-crossings signal regime change) | `max(roc1Length, roc2Length) + wmaLength − 1` |

### Oscillators (Task 10)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `ppo` | [`./ppo.md`](./ppo.md) | `{ ppo, signal, hist }` (unbounded, MACD-shape normalised by slow EMA) | `slowLength + signalLength − 2` |
| `dpo` | [`./dpo.md`](./dpo.md) | `Series<number>` (unbounded, detrended around zero) | `length` |
| `connorsRsi` | [`./connorsRsi.md`](./connorsRsi.md) | `Series<number>` (bounded `[0, 100]`) | `max(rsiLength, streakLength, rocLength) + 1` |

### Oscillators (Task 12)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `kst` | [`./kst.md`](./kst.md) | `{ kst, signal }` (unbounded; zero-crossings signal regime change) | `max_N(rocNLength + rocNSmooth) + signalLength − 2` |
| `fisher` | [`./fisher.md`](./fisher.md) | `{ fisher, trigger }` (unbounded, typically `[-3, 3]`) | `length` |
| `klinger` | [`./klinger.md`](./klinger.md) | `{ klinger, signal }` (unbounded; volume-flow oscillator) | `slowLength + signalLength − 2` |
| `rvgi` | [`./rvgi.md`](./rvgi.md) | `{ rvgi, signal }` (unbounded; close-open vs high-low ratio) | `length + 3` |

### Volatility (Task 18)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `bbPercentB` | [`./bbPercentB.md`](./bbPercentB.md) | `Series<number>` (typically `[0, 1]`, can excurse) | `length − 1` |
| `bbw` | [`./bbw.md`](./bbw.md) | `Series<number>` (≥ 0, raw ratio) | `length − 1` |
| `donchian` | [`./donchian.md`](./donchian.md) | `{ upper, middle, lower }` | `length − 1` |

### Volatility (Task 19)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `keltner` | [`./keltner.md`](./keltner.md) | `{ upper, middle, lower }` | `length` |
| `envelope` | [`./envelope.md`](./envelope.md) | `{ upper, middle, lower }` | `length − 1` |
| `chop` | [`./chop.md`](./chop.md) | `Series<number>` (clamped `[0, 100]`) | `length` |

### Volatility (Task 20)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `historicalVolatility` | [`./historicalVolatility.md`](./historicalVolatility.md) | `Series<number>` (≥ 0, annualised stddev of log returns ×100) | `length` |
| `rvi` | [`./rvi.md`](./rvi.md) | `Series<number>` (bounded `[0, 100]`) | `2 · length − 1` |
| `massIndex` | [`./massIndex.md`](./massIndex.md) | `Series<number>` (≥ 0, range-EMA "bulge" sum) | `2 · emaLength + sumLength − 3` |

### S/R (Task 25)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `psar` | [`./psar.md`](./psar.md) | `{ sar, direction }` | `1` |
| `supertrend` | [`./supertrend.md`](./supertrend.md) | `{ line, direction }` | `length` |

### S/R (Task 26)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `chandelier` | [`./chandelier.md`](./chandelier.md) | `{ long, short }` | `length` |
| `chandeKrollStop` | [`./chandeKrollStop.md`](./chandeKrollStop.md) | `{ long, short }` | `length + smoothingLength − 1` |
| `williamsFractal` | [`./williamsFractal.md`](./williamsFractal.md) | `{ up, down }` (centred markers) | `2 · length` |

### S/R (Task 27)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `zigZag` | [`./zigZag.md`](./zigZag.md) | `{ value, direction }` | input-dependent (NaN until first confirmed pivot) |
| `pivotsHighLow` | [`./pivotsHighLow.md`](./pivotsHighLow.md) | `{ high, low }` (centred markers) | `leftLength + rightLength` |
| `pivotsStandard` | [`./pivotsStandard.md`](./pivotsStandard.md) | `{ pp, r1, s1, r2, s2, r3, s3 }` | 1 UTC-day boundary |
| `volatilityStop` | [`./volatilityStop.md`](./volatilityStop.md) | `{ value, direction }` | `length` |

### Volume (Task 21)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `vol` | [`./vol.md`](./vol.md) | `Series<number>` (passthrough of `bar.volume`) | `0` |
| `vwap` | [`./vwap.md`](./vwap.md) | `Series<number>` (UTC-day session-anchored) | `0` (NaN until `cumV > 0`) |
| `anchoredVwap` | [`./anchoredVwap.md`](./anchoredVwap.md) | `Series<number>` (anchored to a literal time) | `0` (NaN until `bar.time ≥ anchorTime`) |
| `obv` | [`./obv.md`](./obv.md) | `Series<number>` (cumulative signed volume) | `1` (bar 0 emits 0) |
| `adl` | [`./adl.md`](./adl.md) | `Series<number>` (cumulative CLV × volume) | `0` |
| `bop` | [`./bop.md`](./bop.md) | `Series<number>` (raw per-bar `(C-O)/(H-L)`) | `0` |
| `cmf` | [`./cmf.md`](./cmf.md) | `Series<number>` (bounded `[-1, 1]`) | `length − 1` |

### Volume (Task 23)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `chaikinOsc` | [`./chaikinOsc.md`](./chaikinOsc.md) | `Series<number>` (EMA-diff over ADL; unbounded, oscillator-shape around zero) | `slowLength − 1` |
| `mfi` | [`./mfi.md`](./mfi.md) | `Series<number>` (bounded `[0, 100]`; volume-weighted RSI) | `length + 1` |
| `netVolume` | [`./netVolume.md`](./netVolume.md) | `Series<number>` (cumulative signed volume — equivalent to `obv`, naming-parity dup) | `1` (bar 0 emits 0) |
| `pvo` | [`./pvo.md`](./pvo.md) | `{ pvo, signal, hist }` (MACD-shape on volume) | `slowLength + signalLength − 2` |

### Volume (Task 24)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `pvt` | [`./pvt.md`](./pvt.md) | `Series<number>` (cumulative `volume · close-pct-change`) | `1` (bar 0 emits 0) |
| `eom` | [`./eom.md`](./eom.md) | `Series<number>` (SMA-smoothed midpoint-move / box-ratio) | `length` |
| `nvi` | [`./nvi.md`](./nvi.md) | `Series<number>` (cumulative on lower-volume bars, seeded at 1000) | `1` (bar 0 emits seed) |
| `pvi` | [`./pvi.md`](./pvi.md) | `Series<number>` (cumulative on higher-volume bars, seeded at 1000) | `1` (bar 0 emits seed) |

### Statistical (Task 28)

| ID | Page | Output | Warmup |
|---|---|---|---|
| `median` | [`./median.md`](./median.md) | `Series<number>` | `length − 1` |
| `adr` | [`./adr.md`](./adr.md) | `Series<number>` (≥ 0, UTC-day SMA of `high − low`) | `length` daily bars |
| `ulcerIndex` | [`./ulcerIndex.md`](./ulcerIndex.md) | `Series<number>` (≥ 0, drawdown RMS) | `length − 1` |

## Regenerating

```bash
pnpm docs:generate     # runs `chartlang docs`
pnpm docs:gate         # CI gate — fails on any per-page drift
```

The gate diffs the regenerated pages against the committed tree
byte-for-byte. Hand-edits to any `<id>.md` page (except this
`index.md`) are rejected.
