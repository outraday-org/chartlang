// packages/core/dist/interval/intervalToSeconds.js
var MULTIPLIERS = Object.freeze({
  s: 1,
  "": 60,
  m: 60,
  H: 3600,
  h: 3600,
  D: 86400,
  W: 604800,
  M: 2592e3,
  Y: 31536e3
});

// packages/core/dist/define/defineIndicator.js
function defineIndicator(opts) {
  const capabilities = Object.freeze(["indicators"]);
  const requestedIntervals = Object.freeze([]);
  const seriesCapacities = Object.freeze({});
  const base = {
    apiVersion: 1,
    kind: "indicator",
    name: opts.name,
    inputs: opts.inputs ?? {},
    capabilities,
    requestedIntervals,
    userPickableInterval: false,
    seriesCapacities,
    maxLookback: 0
  };
  const manifest = {
    ...base,
    ...opts.maxDrawings === void 0 ? {} : { maxDrawings: opts.maxDrawings },
    ...opts.maxBarsBack === void 0 ? {} : { maxBarsBack: opts.maxBarsBack },
    ...opts.format === void 0 ? {} : { format: opts.format },
    ...opts.precision === void 0 ? {} : { precision: opts.precision },
    ...opts.scale === void 0 ? {} : { scale: opts.scale },
    ...opts.requiresIntervals === void 0 ? {} : { requiresIntervals: opts.requiresIntervals },
    ...opts.shortName === void 0 ? {} : { shortName: opts.shortName }
  };
  return Object.freeze({
    manifest: Object.freeze(manifest),
    compute: opts.compute
  });
}

// packages/core/dist/input/input.js
var input = Object.freeze({
  /**
   * Build an integer input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const length = input.int(20, { min: 1, max: 200 });
   *     void length;
   */
  int(defaultValue, opts) {
    return Object.freeze({ kind: "int", defaultValue, ...opts });
  },
  /**
   * Build a floating-point input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const multiplier = input.float(2.5, { step: 0.5 });
   *     void multiplier;
   */
  float(defaultValue, opts) {
    return Object.freeze({ kind: "float", defaultValue, ...opts });
  },
  /**
   * Build a boolean input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const enabled = input.bool(true);
   *     void enabled;
   */
  bool(defaultValue, opts) {
    return Object.freeze({ kind: "bool", defaultValue, ...opts });
  },
  /**
   * Build a string input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const symbol = input.string("AAPL");
   *     void symbol;
   */
  string(defaultValue, opts) {
    return Object.freeze({ kind: "string", defaultValue, ...opts });
  },
  /**
   * Build a string enum input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const mode = input.enum("fast", ["fast", "slow"]);
   *     void mode;
   */
  enum(defaultValue, options, opts) {
    return Object.freeze({
      kind: "enum",
      defaultValue,
      options: Object.freeze(options.slice()),
      ...opts
    });
  },
  /**
   * Build a color input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const c = input.color("#26a69a");
   *     void c;
   */
  color(defaultValue, opts) {
    return Object.freeze({ kind: "color", defaultValue, ...opts });
  },
  /**
   * Build a source-field input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const source = input.source("close");
   *     void source;
   */
  source(defaultValue, opts) {
    return Object.freeze({ kind: "source", defaultValue, ...opts });
  },
  /**
   * Build a time input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const anchor = input.time(1_700_000_000_000, { pickFromChart: true });
   *     void anchor;
   */
  time(defaultValue, opts) {
    return Object.freeze({ kind: "time", defaultValue, ...opts });
  },
  /**
   * Build a price input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const level = input.price(101.25);
   *     void level;
   */
  price(defaultValue, opts) {
    return Object.freeze({ kind: "price", defaultValue, ...opts });
  },
  /**
   * Build a symbol input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const ticker = input.symbol("AAPL");
   *     void ticker;
   */
  symbol(defaultValue, opts) {
    return Object.freeze({ kind: "symbol", defaultValue, ...opts });
  },
  /**
   * Build a main-interval input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const interval = input.interval("1D");
   *     void interval;
   */
  interval(defaultValue, opts) {
    return Object.freeze({ kind: "interval", defaultValue, ...opts });
  },
  /**
   * Build an adapter-supplied external series input descriptor.
   *
   * @since 0.4
   * @stable
   * @example
   *     const earnings = input.externalSeries({
   *         name: "earnings",
   *         schema: { kind: "external-series-schema" },
   *     });
   *     void earnings;
   */
  externalSeries(args) {
    return Object.freeze({
      kind: "external-series",
      name: args.name,
      schema: args.schema,
      ...args.title === void 0 ? {} : { title: args.title }
    });
  }
});

// packages/core/dist/state/state.js
var sentinel = (name) => {
  throw new Error(`${name} called outside an active script step`);
};
var state = Object.freeze({
  /**
   * Allocate or read a persistent number slot.
   *
   * @since 0.4
   * @stable
   * @example
   *     const fn: typeof state.float = state.float;
   *     void fn;
   */
  float(_init) {
    return sentinel("state.float");
  },
  /**
   * Allocate or read a persistent integer slot.
   *
   * @since 0.4
   * @stable
   * @example
   *     const fn: typeof state.int = state.int;
   *     void fn;
   */
  int(_init) {
    return sentinel("state.int");
  },
  /**
   * Allocate or read a persistent boolean slot.
   *
   * @since 0.4
   * @stable
   * @example
   *     const fn: typeof state.bool = state.bool;
   *     void fn;
   */
  bool(_init) {
    return sentinel("state.bool");
  },
  /**
   * Allocate or read a persistent string slot.
   *
   * @since 0.4
   * @stable
   * @example
   *     const fn: typeof state.string = state.string;
   *     void fn;
   */
  string(_init) {
    return sentinel("state.string");
  },
  /**
   * Tick-persistent state slots, Pine `varip` semantics. Writes commit
   * immediately, even during a tick.
   *
   * @since 0.4
   * @stable
   * @example
   *     const fn: typeof state.tick.float = state.tick.float;
   *     void fn;
   */
  tick: Object.freeze({
    float(_init) {
      return sentinel("state.tick.float");
    },
    int(_init) {
      return sentinel("state.tick.int");
    },
    bool(_init) {
      return sentinel("state.tick.bool");
    },
    string(_init) {
      return sentinel("state.tick.string");
    }
  })
});

// packages/core/dist/views/barstate.js
var barstate = Object.freeze({
  isfirst: false,
  islast: false,
  isnew: false,
  ishistory: false,
  isrealtime: false,
  isconfirmed: false
});

// packages/core/dist/views/syminfo.js
var syminfo = Object.freeze({
  ticker: "",
  type: "custom",
  mintick: Number.NaN,
  currency: "",
  basecurrency: "",
  exchange: "",
  timezone: "",
  session: "",
  meta: Object.freeze({})
});

// packages/core/dist/views/timeframe.js
var timeframe = Object.freeze({
  period: "",
  isintraday: false,
  isdaily: false,
  isweekly: false,
  ismonthly: false,
  inSeconds: Number.NaN
});

// packages/core/dist/request/request.js
var sentinel2 = (name) => {
  throw new Error(`${name} called outside an active script step`);
};
var request = Object.freeze({
  /**
   * Read a secondary candle stream at a script-author-fixed interval.
   *
   * @since 0.4
   * @stable
   * @example
   *     const fn: typeof request.security = request.security;
   *     void fn;
   */
  security(_opts) {
    return sentinel2("request.security");
  },
  /**
   * Read lower-timeframe bars contained by each main-stream bar.
   *
   * @since 0.6
   * @stable
   * @example
   *     const fn: typeof request.lowerTf = request.lowerTf;
   *     void fn;
   */
  lowerTf(_opts) {
    return sentinel2("request.lowerTf");
  }
});

// packages/core/dist/runtime/runtime.js
function _logInfo(_message, _meta) {
  throw new Error("runtime.log.info called outside compiled runtime");
}
function _logWarn(_message, _meta) {
  throw new Error("runtime.log.warn called outside compiled runtime");
}
function _logError(_message, _meta) {
  throw new Error("runtime.log.error called outside compiled runtime");
}
function _error(_message) {
  throw new Error("runtime.error called outside compiled runtime");
}
var runtime = Object.freeze({
  log: Object.freeze({
    info: _logInfo,
    warn: _logWarn,
    error: _logError
  }),
  error: _error
});

// packages/core/dist/color/parseColor.js
var COLOR_PALETTE = Object.freeze({
  aqua: "#00ffff",
  black: "#000000",
  blue: "#0000ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  green: "#008000",
  lime: "#00ff00",
  maroon: "#800000",
  navy: "#000080",
  olive: "#808000",
  orange: "#ffa500",
  purple: "#800080",
  red: "#ff0000",
  silver: "#c0c0c0",
  teal: "#008080",
  white: "#ffffff",
  yellow: "#ffff00"
});
var HEX_SHORT = /^#([0-9a-f]{3})$/i;
var HEX_LONG = /^#([0-9a-f]{6})$/i;
var RGB = /^rgba?\(\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)(?:\s*,\s*([^,\s]+))?\s*\)$/i;
var HSL = /^hsla?\(\s*([^,\s]+)\s*,\s*([^,\s%]+)%\s*,\s*([^,\s%]+)%(?:\s*,\s*([^,\s]+))?\s*\)$/i;
function isPaletteName(value) {
  return Object.prototype.hasOwnProperty.call(COLOR_PALETTE, value);
}
function clampByte(value) {
  return Math.min(255, Math.max(0, Math.floor(value)));
}
function clampRoundedByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}
function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}
function parseNumber(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed))
    return null;
  return parsed;
}
function hslToRgb(h, s, l) {
  const hue = Math.min(359.999, Math.max(0, h)) / 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const light = Math.min(100, Math.max(0, l)) / 100;
  if (sat === 0) {
    const gray = clampRoundedByte(light * 255);
    return { r: gray, g: gray, b: gray };
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t) => {
    let adjusted = t;
    if (adjusted < 0)
      adjusted += 1;
    if (adjusted > 1)
      adjusted -= 1;
    if (adjusted < 1 / 6)
      return p + (q - p) * 6 * adjusted;
    if (adjusted < 1 / 2)
      return q;
    if (adjusted < 2 / 3)
      return p + (q - p) * (2 / 3 - adjusted) * 6;
    return p;
  };
  return {
    r: clampRoundedByte(channel(hue + 1 / 3) * 255),
    g: clampRoundedByte(channel(hue) * 255),
    b: clampRoundedByte(channel(hue - 1 / 3) * 255)
  };
}
function parseColor(c) {
  const value = c.trim().toLowerCase();
  if (isPaletteName(value))
    return parseColor(COLOR_PALETTE[value]);
  const shortHex = HEX_SHORT.exec(value);
  if (shortHex) {
    const hex = shortHex[1];
    return {
      r: Number.parseInt(`${hex[0]}${hex[0]}`, 16),
      g: Number.parseInt(`${hex[1]}${hex[1]}`, 16),
      b: Number.parseInt(`${hex[2]}${hex[2]}`, 16),
      a: 1
    };
  }
  const longHex = HEX_LONG.exec(value);
  if (longHex) {
    const hex = longHex[1];
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1
    };
  }
  const rgbMatch = RGB.exec(value);
  if (rgbMatch) {
    const r = parseNumber(rgbMatch[1]);
    const g = parseNumber(rgbMatch[2]);
    const b = parseNumber(rgbMatch[3]);
    const a = rgbMatch[4] === void 0 ? 1 : parseNumber(rgbMatch[4]);
    if (r === null || g === null || b === null || a === null)
      return null;
    return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clampUnit(a) };
  }
  const hslMatch = HSL.exec(value);
  if (hslMatch) {
    const h = parseNumber(hslMatch[1]);
    const s = parseNumber(hslMatch[2]);
    const l = parseNumber(hslMatch[3]);
    const a = hslMatch[4] === void 0 ? 1 : parseNumber(hslMatch[4]);
    if (h === null || s === null || l === null || a === null)
      return null;
    return { ...hslToRgb(h, s, l), a: clampUnit(a) };
  }
  return null;
}

// packages/core/dist/color/colorHelpers.js
var TRANSPARENT_BLACK = "rgba(0, 0, 0, 0)";
function clampUnit2(value) {
  if (Number.isNaN(value))
    return 0;
  return Math.min(1, Math.max(0, value));
}
function clampByte2(value) {
  if (Number.isNaN(value))
    return 0;
  return Math.min(255, Math.max(0, Math.floor(value)));
}
function clampHue(value) {
  if (Number.isNaN(value))
    return 0;
  return Math.min(359.999, Math.max(0, value));
}
function clampPercent(value) {
  if (Number.isNaN(value))
    return 0;
  return Math.min(100, Math.max(0, value));
}
function formatNumber(value) {
  const rounded = Math.round(value * 1e3) / 1e3;
  return String(rounded);
}
function emitRgb(r, g, b, alpha) {
  if (alpha >= 1)
    return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${formatNumber(alpha)})`;
}
function emitRgba(r, g, b, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${formatNumber(alpha)})`;
}
function fromGradient(t, stops) {
  const first = stops[0];
  if (first === void 0)
    return TRANSPARENT_BLACK;
  if (stops.length === 1 || Number.isNaN(t))
    return first.color;
  const position = clampUnit2(t);
  if (position <= first.at)
    return first.color;
  const last = stops[stops.length - 1];
  if (position >= last.at)
    return last.color;
  let previous = first;
  let next = last;
  for (let i = 1; i < stops.length; i += 1) {
    const candidate = stops[i];
    if (position <= candidate.at) {
      next = candidate;
      break;
    }
    previous = candidate;
  }
  const left = parseColor(previous.color);
  const right = parseColor(next.color);
  if (left === null || right === null)
    return previous.color;
  const ratio = (position - previous.at) / (next.at - previous.at);
  const alpha = left.a + (right.a - left.a) * ratio;
  return emitRgb(clampByte2(left.r + (right.r - left.r) * ratio), clampByte2(left.g + (right.g - left.g) * ratio), clampByte2(left.b + (right.b - left.b) * ratio), clampUnit2(alpha));
}
function withAlpha(c, alpha) {
  if (Number.isNaN(alpha))
    return c;
  const parsed = parseColor(c);
  if (parsed === null)
    return c;
  return emitRgba(parsed.r, parsed.g, parsed.b, clampUnit2(alpha));
}
function rgb(r, g, b, alpha) {
  const red = clampByte2(r);
  const green = clampByte2(g);
  const blue = clampByte2(b);
  if (alpha === void 0)
    return `rgb(${red}, ${green}, ${blue})`;
  return emitRgba(red, green, blue, clampUnit2(alpha));
}
function hsl(h, s, l, alpha) {
  const hue = formatNumber(clampHue(h));
  const sat = formatNumber(clampPercent(s));
  const light = formatNumber(clampPercent(l));
  if (alpha === void 0)
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  return `hsla(${hue}, ${sat}%, ${light}%, ${formatNumber(clampUnit2(alpha))})`;
}

// packages/core/dist/color/index.js
var color = Object.freeze({
  ...COLOR_PALETTE,
  fromGradient,
  withAlpha,
  rgb,
  hsl
});

// packages/core/dist/statefulPrimitives.js
var STATEFUL_PRIMITIVE_ENTRIES = [
  { name: "ta.sma", slot: true },
  { name: "ta.ema", slot: true },
  { name: "ta.stdev", slot: true },
  { name: "ta.bb", slot: true },
  { name: "ta.rsi", slot: true },
  { name: "ta.macd", slot: true },
  { name: "ta.atr", slot: true },
  { name: "ta.crossover", slot: true },
  { name: "ta.crossunder", slot: true },
  { name: "ta.highest", slot: true },
  { name: "ta.lowest", slot: true },
  { name: "ta.change", slot: true },
  { name: "ta.valuewhen", slot: true },
  { name: "ta.barssince", slot: true },
  { name: "ta.wma", slot: true },
  { name: "ta.vwma", slot: true },
  { name: "ta.hma", slot: true },
  { name: "ta.smma", slot: true },
  { name: "ta.dema", slot: true },
  { name: "ta.tema", slot: true },
  { name: "ta.kama", slot: true },
  { name: "ta.alma", slot: true },
  { name: "ta.lsma", slot: true },
  { name: "ta.mcginley", slot: true },
  { name: "ta.maRibbon", slot: true },
  { name: "ta.cci", slot: true },
  { name: "ta.stoch", slot: true },
  { name: "ta.williamsR", slot: true },
  { name: "ta.stochRsi", slot: true },
  { name: "ta.ultimateOsc", slot: true },
  { name: "ta.coppock", slot: true },
  { name: "ta.ppo", slot: true },
  { name: "ta.dpo", slot: true },
  { name: "ta.connorsRsi", slot: true },
  { name: "ta.kst", slot: true },
  { name: "ta.fisher", slot: true },
  { name: "ta.klinger", slot: true },
  { name: "ta.rvgi", slot: true },
  { name: "ta.ao", slot: true },
  { name: "ta.cmo", slot: true },
  { name: "ta.momentum", slot: true },
  { name: "ta.roc", slot: true },
  { name: "ta.pmo", slot: true },
  { name: "ta.smi", slot: true },
  { name: "ta.tsi", slot: true },
  { name: "ta.aroon", slot: true },
  { name: "ta.aroonOsc", slot: true },
  { name: "ta.adx", slot: true },
  { name: "ta.dmi", slot: true },
  { name: "ta.trix", slot: true },
  { name: "ta.vortex", slot: true },
  { name: "ta.trendStrengthIndex", slot: true },
  { name: "ta.ichimoku", slot: true },
  { name: "ta.vol", slot: true },
  { name: "ta.vwap", slot: true },
  { name: "ta.anchoredVwap", slot: true },
  { name: "ta.obv", slot: true },
  { name: "ta.adl", slot: true },
  { name: "ta.bop", slot: true },
  { name: "ta.cmf", slot: true },
  { name: "ta.chaikinOsc", slot: true },
  { name: "ta.mfi", slot: true },
  { name: "ta.netVolume", slot: true },
  { name: "ta.pvo", slot: true },
  { name: "ta.pvt", slot: true },
  { name: "ta.eom", slot: true },
  { name: "ta.nvi", slot: true },
  { name: "ta.pvi", slot: true },
  { name: "ta.visibleRangeVolumeProfile", slot: true },
  { name: "ta.anchoredVolumeProfile", slot: true },
  { name: "ta.sessionVolumeProfile", slot: true },
  { name: "ta.fixedRangeVolumeProfile", slot: true },
  { name: "ta.median", slot: true },
  { name: "ta.adr", slot: true },
  { name: "ta.ulcerIndex", slot: true },
  { name: "ta.bbPercentB", slot: true },
  { name: "ta.bbw", slot: true },
  { name: "ta.donchian", slot: true },
  { name: "ta.keltner", slot: true },
  { name: "ta.envelope", slot: true },
  { name: "ta.chop", slot: true },
  { name: "ta.historicalVolatility", slot: true },
  { name: "ta.rvi", slot: true },
  { name: "ta.massIndex", slot: true },
  { name: "ta.psar", slot: true },
  { name: "ta.supertrend", slot: true },
  { name: "ta.chandelier", slot: true },
  { name: "ta.chandeKrollStop", slot: true },
  { name: "ta.williamsFractal", slot: true },
  { name: "ta.zigZag", slot: true },
  { name: "ta.pivotsHighLow", slot: true },
  { name: "ta.pivotsStandard", slot: true },
  { name: "ta.volatilityStop", slot: true },
  { name: "ta.nz", slot: false },
  { name: "plot", slot: true },
  { name: "hline", slot: true },
  { name: "alert", slot: true },
  // Phase 3 — draw.* namespace. One entry per kind in DRAWING_KINDS
  // order. Names are camelCase (`draw.<kindCamelCase>`); the wire
  // format keeps the kebab-case `DrawingKind`.
  { name: "draw.line", slot: true },
  { name: "draw.horizontalLine", slot: true },
  { name: "draw.horizontalRay", slot: true },
  { name: "draw.verticalLine", slot: true },
  { name: "draw.crossLine", slot: true },
  { name: "draw.trendAngle", slot: true },
  { name: "draw.rectangle", slot: true },
  { name: "draw.rotatedRectangle", slot: true },
  { name: "draw.triangle", slot: true },
  { name: "draw.polyline", slot: true },
  { name: "draw.circle", slot: true },
  { name: "draw.ellipse", slot: true },
  { name: "draw.path", slot: true },
  { name: "draw.marker", slot: true },
  { name: "draw.arc", slot: true },
  { name: "draw.curve", slot: true },
  { name: "draw.doubleCurve", slot: true },
  { name: "draw.pen", slot: true },
  { name: "draw.highlighter", slot: true },
  { name: "draw.brush", slot: true },
  { name: "draw.text", slot: true },
  { name: "draw.arrow", slot: true },
  { name: "draw.arrowMarker", slot: true },
  { name: "draw.arrowMarkUp", slot: true },
  { name: "draw.arrowMarkDown", slot: true },
  { name: "draw.trendChannel", slot: true },
  { name: "draw.flatTopBottom", slot: true },
  { name: "draw.disjointChannel", slot: true },
  { name: "draw.regressionTrend", slot: true },
  { name: "draw.fibRetracement", slot: true },
  { name: "draw.fibTrendExtension", slot: true },
  { name: "draw.fibChannel", slot: true },
  { name: "draw.fibTimeZone", slot: true },
  { name: "draw.fibWedge", slot: true },
  { name: "draw.fibSpeedFan", slot: true },
  { name: "draw.fibSpeedArcs", slot: true },
  { name: "draw.fibSpiral", slot: true },
  { name: "draw.fibCircles", slot: true },
  { name: "draw.fibTrendTime", slot: true },
  { name: "draw.gannBox", slot: true },
  { name: "draw.gannSquareFixed", slot: true },
  { name: "draw.gannSquare", slot: true },
  { name: "draw.gannFan", slot: true },
  { name: "draw.pitchfork", slot: true },
  { name: "draw.pitchfan", slot: true },
  { name: "draw.xabcdPattern", slot: true },
  { name: "draw.cypherPattern", slot: true },
  { name: "draw.headAndShoulders", slot: true },
  { name: "draw.abcdPattern", slot: true },
  { name: "draw.trianglePattern", slot: true },
  { name: "draw.threeDrivesPattern", slot: true },
  { name: "draw.elliottImpulseWave", slot: true },
  { name: "draw.elliottCorrectionWave", slot: true },
  { name: "draw.elliottTriangleWave", slot: true },
  { name: "draw.elliottDoubleCombo", slot: true },
  { name: "draw.elliottTripleCombo", slot: true },
  { name: "draw.cyclicLines", slot: true },
  { name: "draw.timeCycles", slot: true },
  { name: "draw.sineLine", slot: true },
  { name: "draw.group", slot: true },
  { name: "draw.frame", slot: true },
  { name: "draw.table", slot: true },
  { name: "state.float", slot: true },
  { name: "state.int", slot: true },
  { name: "state.bool", slot: true },
  { name: "state.string", slot: true },
  { name: "state.tick.float", slot: true },
  { name: "state.tick.int", slot: true },
  { name: "state.tick.bool", slot: true },
  { name: "state.tick.string", slot: true },
  { name: "request.security", slot: true },
  { name: "request.lowerTf", slot: true },
  { name: "defineAlertCondition.signal", slot: false },
  { name: "runtime.log", slot: false },
  { name: "runtime.error", slot: false }
];
var STATEFUL_PRIMITIVES = Object.freeze(new Set(STATEFUL_PRIMITIVE_ENTRIES));
var STATEFUL_PRIMITIVES_BY_NAME = new Map(STATEFUL_PRIMITIVE_ENTRIES.map((entry) => [entry.name, entry]));

// packages/core/dist/draw/drawingKind.js
var DRAWING_KINDS = Object.freeze([
  "line",
  "horizontal-line",
  "horizontal-ray",
  "vertical-line",
  "cross-line",
  "trend-angle",
  "rectangle",
  "rotated-rectangle",
  "triangle",
  "polyline",
  "circle",
  "ellipse",
  "path",
  "marker",
  "arc",
  "curve",
  "double-curve",
  "pen",
  "highlighter",
  "brush",
  "text",
  "arrow",
  "arrow-marker",
  "arrow-mark-up",
  "arrow-mark-down",
  "trend-channel",
  "flat-top-bottom",
  "disjoint-channel",
  "regression-trend",
  "fib-retracement",
  "fib-trend-extension",
  "fib-channel",
  "fib-time-zone",
  "fib-wedge",
  "fib-speed-fan",
  "fib-speed-arcs",
  "fib-spiral",
  "fib-circles",
  "fib-trend-time",
  "gann-box",
  "gann-square-fixed",
  "gann-square",
  "gann-fan",
  "pitchfork",
  "pitchfan",
  "xabcd-pattern",
  "cypher-pattern",
  "head-and-shoulders",
  "abcd-pattern",
  "triangle-pattern",
  "three-drives-pattern",
  "elliott-impulse-wave",
  "elliott-correction-wave",
  "elliott-triangle-wave",
  "elliott-double-combo",
  "elliott-triple-combo",
  "cyclic-lines",
  "time-cycles",
  "sine-line",
  "group",
  "frame",
  "table"
]);
var KIND_CAMELCASE = /* @__PURE__ */ new Map([
  ["line", "line"],
  ["horizontal-line", "horizontalLine"],
  ["horizontal-ray", "horizontalRay"],
  ["vertical-line", "verticalLine"],
  ["cross-line", "crossLine"],
  ["trend-angle", "trendAngle"],
  ["rectangle", "rectangle"],
  ["rotated-rectangle", "rotatedRectangle"],
  ["triangle", "triangle"],
  ["polyline", "polyline"],
  ["circle", "circle"],
  ["ellipse", "ellipse"],
  ["path", "path"],
  ["marker", "marker"],
  ["arc", "arc"],
  ["curve", "curve"],
  ["double-curve", "doubleCurve"],
  ["pen", "pen"],
  ["highlighter", "highlighter"],
  ["brush", "brush"],
  ["text", "text"],
  ["arrow", "arrow"],
  ["arrow-marker", "arrowMarker"],
  ["arrow-mark-up", "arrowMarkUp"],
  ["arrow-mark-down", "arrowMarkDown"],
  ["trend-channel", "trendChannel"],
  ["flat-top-bottom", "flatTopBottom"],
  ["disjoint-channel", "disjointChannel"],
  ["regression-trend", "regressionTrend"],
  ["fib-retracement", "fibRetracement"],
  ["fib-trend-extension", "fibTrendExtension"],
  ["fib-channel", "fibChannel"],
  ["fib-time-zone", "fibTimeZone"],
  ["fib-wedge", "fibWedge"],
  ["fib-speed-fan", "fibSpeedFan"],
  ["fib-speed-arcs", "fibSpeedArcs"],
  ["fib-spiral", "fibSpiral"],
  ["fib-circles", "fibCircles"],
  ["fib-trend-time", "fibTrendTime"],
  ["gann-box", "gannBox"],
  ["gann-square-fixed", "gannSquareFixed"],
  ["gann-square", "gannSquare"],
  ["gann-fan", "gannFan"],
  ["pitchfork", "pitchfork"],
  ["pitchfan", "pitchfan"],
  ["xabcd-pattern", "xabcdPattern"],
  ["cypher-pattern", "cypherPattern"],
  ["head-and-shoulders", "headAndShoulders"],
  ["abcd-pattern", "abcdPattern"],
  ["triangle-pattern", "trianglePattern"],
  ["three-drives-pattern", "threeDrivesPattern"],
  ["elliott-impulse-wave", "elliottImpulseWave"],
  ["elliott-correction-wave", "elliottCorrectionWave"],
  ["elliott-triangle-wave", "elliottTriangleWave"],
  ["elliott-double-combo", "elliottDoubleCombo"],
  ["elliott-triple-combo", "elliottTripleCombo"],
  ["cyclic-lines", "cyclicLines"],
  ["time-cycles", "timeCycles"],
  ["sine-line", "sineLine"],
  ["group", "group"],
  ["frame", "frame"],
  ["table", "table"]
]);
var KIND_KEBABCASE = new Map(Array.from(KIND_CAMELCASE, ([kebab, camel]) => [camel, kebab]));

// packages/core/dist/draw/draw.js
var draw = createDrawStub();
function createDrawStub() {
  const handler = {
    get(_target, property) {
      const name = String(property);
      return throwingMethod(`draw.${name}`);
    }
  };
  return new Proxy({}, handler);
}
function throwingMethod(qualified) {
  return () => {
    throw new Error(`${qualified} called outside compiled runtime`);
  };
}

// packages/compiler/examples/scripts/fib-retracement.chart.ts
var fib_retracement_chart_default = defineIndicator({
  name: "Fib Retracement",
  apiVersion: 1,
  overlay: true,
  maxDrawings: { lines: 0, labels: 5, boxes: 0, polylines: 0, other: 5 },
  compute({ bar, draw: draw3 }) {
    if (bar.time === 17e11) {
      const swingLow = { time: 17e11, price: 100 };
      const swingHigh = { time: 170003e7, price: 130 };
      draw3.fibRetracement("examples/scripts/fib-retracement.chart.ts:16:13#0", swingLow, swingHigh, {
        showLabels: true,
        extendRight: true
      });
      draw3.fibTrendExtension("examples/scripts/fib-retracement.chart.ts:21:13#0", [swingLow, swingHigh, { time: 170006e7, price: 115 }], {
        showLabels: true
      });
      draw3.text("examples/scripts/fib-retracement.chart.ts:25:13#0", { time: 170003e7, price: 135 }, "Impulse leg + 1.618 target", {
        color: "#1e293b",
        size: "normal"
      });
    }
  }
});
export {
  fib_retracement_chart_default as default
};
export const __manifest = {"apiVersion":1,"kind":"indicator","name":"Fib Retracement","inputs":{},"capabilities":["indicators"],"requestedIntervals":[],"userPickableInterval":false,"seriesCapacities":{},"maxLookback":0};
