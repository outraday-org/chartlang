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

// packages/core/dist/define/depAccessorSentinel.js
var depAccessorSentinel = (name) => {
  throw new Error(`${name} can only be called on a compiled chartlang indicator binding inside another indicator's compute body`);
};
var attachDepAccessorSentinels = (base) => ({
  manifest: base.manifest,
  compute: base.compute,
  output: (name) => depAccessorSentinel(`output("${name}")`),
  withInputs: () => depAccessorSentinel("withInputs")
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
    ...opts.overlay === void 0 ? {} : { overlay: opts.overlay },
    ...opts.maxDrawings === void 0 ? {} : { maxDrawings: opts.maxDrawings },
    ...opts.maxBarsBack === void 0 ? {} : { maxBarsBack: opts.maxBarsBack },
    ...opts.format === void 0 ? {} : { format: opts.format },
    ...opts.precision === void 0 ? {} : { precision: opts.precision },
    ...opts.scale === void 0 ? {} : { scale: opts.scale },
    ...opts.requiresIntervals === void 0 ? {} : { requiresIntervals: opts.requiresIntervals },
    ...opts.shortName === void 0 ? {} : { shortName: opts.shortName },
    ...opts.outputs === void 0 ? {} : { outputs: opts.outputs }
  };
  return Object.freeze(attachDepAccessorSentinels({
    manifest: Object.freeze(manifest),
    compute: opts.compute
  }));
}

// packages/core/dist/input/input.js
function definedExternalSeriesMetadata(args) {
  return {
    ...args.title === void 0 ? {} : { title: args.title },
    ...args.group === void 0 ? {} : { group: args.group },
    ...args.inline === void 0 ? {} : { inline: args.inline },
    ...args.tooltip === void 0 ? {} : { tooltip: args.tooltip },
    ...args.display === void 0 ? {} : { display: args.display },
    ...args.confirm === void 0 ? {} : { confirm: args.confirm }
  };
}
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
   * Build an enum input descriptor (a fixed-options dropdown). Options are
   * either string labels or numeric values; the default must be one of the
   * options.
   *
   * @since 0.4 — numeric (`number`) options added in 1.6
   * @stable
   * @example
   *     const mode = input.enum("fast", ["fast", "slow"]);
   *     const length = input.enum(21, [8, 21, 30, 50, 100]);
   *     void mode;
   *     void length;
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
   * Build a source-field input descriptor. `input.source` selects only the
   * built-in OHLC and derived bar fields (`open`, `high`, `low`, `close`,
   * `hl2`, `hlc3`, `ohlc4`, `hlcc4`). Host-supplied numeric series belong
   * in `input.externalSeries`.
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
   * Build a session-window input descriptor (`"HH:MM-HH:MM"`). The value is
   * a free string in v1 (the grammar is parsed at runtime by
   * `session.isOpen`), mirroring `input.string`.
   *
   * @since 1.5
   * @stable
   * @example
   *     const sess = input.session("0930-1600", { title: "Session" });
   *     void sess;
   */
  session(defaultValue, opts) {
    return Object.freeze({ kind: "session", defaultValue, ...opts });
  },
  /**
   * Build a host-supplied external numeric series input descriptor. Use this
   * for another indicator output, another script output, fundamentals, or
   * app data aligned by the host to the primary chart stream. Missing feed
   * values read as `NaN`.
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
      ...definedExternalSeriesMetadata(args)
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
   * Allocate or read a persistent **series** slot — a writable, indexable
   * number history. `s.value = expr` writes the current bar's value;
   * `s[0]` / `s.current` / `+s` read it back, `s[1]` reads one bar ago.
   * The allocation bar's pre-write head is seeded with `init`; unwritten later
   * bars and out-of-range history reads are `NaN`. Unlike `state.float`, the
   * slot retains a bounded window of prior committed values (sized to the
   * script's deepest literal `s[n]` lookback).
   *
   * @since 1.3
   * @stable
   * @example
   *     const fn: typeof state.series = state.series;
   *     void fn;
   */
  series(_init) {
    return sentinel("state.series");
  },
  /**
   * Allocate or read a persistent **color** scalar slot — Pine's
   * `var color c = …`. `c.value = expr` writes the current bar's color;
   * `c.value` reads it back. A {@link Color} is a CSS color string the
   * adapter round-trips verbatim, so the slot stores the string directly.
   * The allocation bar's pre-write head is seeded with `init`; unlike
   * {@link state}.series there is no history window — it is a scalar, not an
   * indexable series.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof state.color = state.color;
   *     void fn;
   */
  color(_init) {
    return sentinel("state.color");
  },
  /**
   * Allocate or read a persistent **boolean series** slot — the non-numeric
   * sibling of {@link state}.series for Pine's `var bool` history. `s.value =
   * entered` writes the current bar's value; `s[1]` reads one bar ago,
   * `s.current` the current bar. Out-of-range / first-bar history reads are
   * **`false`** (Pine v6: a `bool` `[]` no longer returns `na`). The
   * allocation bar's pre-write head is seeded with `init`. The slot retains a
   * bounded window sized to the script's deepest literal `s[n]` lookback.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof state.boolSeries = state.boolSeries;
   *     void fn;
   */
  boolSeries(_init) {
    return sentinel("state.boolSeries");
  },
  /**
   * Allocate or read a persistent **string series** slot — the non-numeric
   * sibling of {@link state}.series for Pine's `var string` history.
   * `s.value = label` writes the current bar's value; `s[1]` reads one bar
   * ago, `s.current` the current bar. Out-of-range / first-bar history reads
   * are the empty string **`""`**. The allocation bar's pre-write head is
   * seeded with `init`. The slot retains a bounded window sized to the
   * script's deepest literal `s[n]` lookback.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof state.stringSeries = state.stringSeries;
   *     void fn;
   */
  stringSeries(_init) {
    return sentinel("state.stringSeries");
  },
  /**
   * Allocate or read a persistent **bounded collection** slot — a
   * fixed-capacity FIFO ring you push values into across bars. `a.push(v)`
   * appends (evicting the oldest once full); `a.get(n)` reads the `n`-th
   * element from the newest; `a.last()` is the newest; `a.size` is the
   * filled count; `a.capacity` is the bound; `a.clear()` empties it.
   * `capacity` must be a compile-time numeric literal (the slot is bounded
   * so it serializes). Unlike {@link state}.series (one value's bar-indexed
   * history), this is a collection of many pushed values. v1 supports
   * `number` element type.
   *
   * @since 1.3
   * @stable
   * @example
   *     const fn: typeof state.array = state.array;
   *     void fn;
   */
  array(_capacity) {
    return sentinel("state.array");
  },
  /**
   * Allocate or read a persistent **bounded keyed collection** slot — a
   * fixed-capacity key→value store that persists across bars. `m.set(k, v)`
   * inserts/updates; `m.get(k)` returns the value or `undefined` for an
   * absent key (distinct from a stored `0`); `m.has(k)` / `m.delete(k)`
   * test/remove a key; `m.size` is the entry count (`≤ capacity`);
   * `m.keyAt(i)` reads the `i`-th key in insertion order (`0` = oldest);
   * `m.clear()` empties it. Inserting a NEW key once full evicts the
   * oldest-inserted key (insertion-order FIFO). `capacity` must be a
   * compile-time numeric literal (the slot is bounded so it serializes).
   * Keys are `string | number`; v1 value type is `number`. Unlike
   * {@link state}.series this is a collection, not a number-coercible value.
   *
   * @since 1.4
   * @stable
   * @example
   *     const fn: typeof state.map = state.map;
   *     void fn;
   */
  map(_capacity) {
    return sentinel("state.map");
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

// packages/core/dist/time-accessors/sessionAccessors.js
var sentinel2 = (name) => {
  throw new Error(`${name} called outside an active script step`);
};
var session = Object.freeze({
  /**
   * `true` when `t` falls inside the daily session window `spec`. `spec` is
   * an `"HH:MM-HH:MM"` (or `"HHMM-HHMM"`) intraday window, e.g.
   * `"0930-1600"`. The window is interpreted in `tz` (default
   * `syminfo.timezone`, fallback `"UTC"`).
   *
   * v1 resolves UTC and fixed-offset zones only; a DST zone resolves to UTC
   * plus a one-time diagnostic (see the determinism note in the docs).
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof session.isOpen = session.isOpen;
   *     void fn;
   */
  isOpen(_t, _spec, _tz) {
    return sentinel2("session.isOpen");
  }
});

// packages/core/dist/time-accessors/timeAccessors.js
var sentinel3 = (name) => {
  throw new Error(`${name} called outside an active script step`);
};
var time = Object.freeze({
  /**
   * Calendar year of `t` (e.g. `2024`).
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.year = time.year;
   *     void fn;
   */
  year(_t, _tz) {
    return sentinel3("time.year");
  },
  /**
   * Calendar month of `t`, `1..12`.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.month = time.month;
   *     void fn;
   */
  month(_t, _tz) {
    return sentinel3("time.month");
  },
  /**
   * Day of the month of `t`, `1..31`.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.dayofmonth = time.dayofmonth;
   *     void fn;
   */
  dayofmonth(_t, _tz) {
    return sentinel3("time.dayofmonth");
  },
  /**
   * Day of the week of `t`, following Pine's convention `1=Sunday .. 7=Saturday`
   * (note: NOT the ISO `1=Monday` convention).
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.dayofweek = time.dayofweek;
   *     void fn;
   */
  dayofweek(_t, _tz) {
    return sentinel3("time.dayofweek");
  },
  /**
   * Hour-of-day of `t`, `0..23`.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.hour = time.hour;
   *     void fn;
   */
  hour(_t, _tz) {
    return sentinel3("time.hour");
  },
  /**
   * Minute-of-hour of `t`, `0..59`.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.minute = time.minute;
   *     void fn;
   */
  minute(_t, _tz) {
    return sentinel3("time.minute");
  },
  /**
   * Second-of-minute of `t`, `0..59`.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.second = time.second;
   *     void fn;
   */
  second(_t, _tz) {
    return sentinel3("time.second");
  },
  /**
   * Build a `Time` (UTC ms epoch) from calendar fields. `month` is `1..12`
   * and `day` is `1..31`; `hour`/`minute`/`second` default to `0`. The
   * fields are interpreted in `tz` (default `syminfo.timezone`, fallback
   * `"UTC"`).
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.timestamp = time.timestamp;
   *     void fn;
   */
  timestamp(_year, _month, _day, _hour, _minute, _second, _tz) {
    return sentinel3("time.timestamp");
  },
  /**
   * Host-injected wall-clock time as a UTC ms epoch. The runtime reads the
   * active mount's `now` provider at call time; unlike the calendar accessors
   * this is intentionally not a deterministic function of bar data.
   *
   * @since 1.7
   * @stable
   * @example
   *     const fn: typeof time.now = time.now;
   *     void fn;
   */
  now() {
    return sentinel3("time.now");
  },
  /**
   * Close timestamp of the bar that starts at `t` — Pine's no-arg
   * `time_close()`. Equals `t + interval`, where the interval is the active
   * bar's `timeframe.inSeconds` the runtime reads internally (so this mirrors
   * Pine's "current bar's interval" without an explicit interval argument).
   * `tz` is accepted for surface symmetry with the other `time.*` accessors.
   *
   * @since 1.5
   * @stable
   * @example
   *     const fn: typeof time.timeClose = time.timeClose;
   *     void fn;
   */
  timeClose(_t, _tz) {
    return sentinel3("time.timeClose");
  }
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
var sentinel4 = (name) => {
  throw new Error(`${name} called outside an active script step`);
};
function security(_opts, _expr) {
  return sentinel4("request.security");
}
function lowerTf(_opts) {
  return sentinel4("request.lowerTf");
}
var request = Object.freeze({ security, lowerTf });

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

// packages/core/dist/math/mathHelpers.js
var roundTo = (value, step) => step > 0 && Number.isFinite(step) ? Math.round(value / step) * step : value;
var roundToMintick = (value, mintick) => roundTo(value, mintick);
var na = (value) => !Number.isFinite(value);
var nz = (value, replacement = 0) => Number.isFinite(value) ? value : replacement;
var fixnan = (value, lastGood) => Number.isFinite(value) ? value : lastGood;
var sign = (value) => Number.isNaN(value) ? Number.NaN : Math.sign(value);
var clamp = (value, lo, hi) => value < lo ? lo : value > hi ? hi : value;
var avg = (...values) => {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      total += n;
      count++;
    }
  }
  return count === 0 ? Number.NaN : total / count;
};
var sum = (...values) => {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      total += n;
      count++;
    }
  }
  return count === 0 ? Number.NaN : total;
};

// packages/core/dist/math/index.js
var math = Object.freeze({
  roundToMintick,
  roundTo,
  na,
  nz,
  fixnan,
  sign,
  clamp,
  avg,
  sum
});

// packages/core/dist/str/strHelpers.js
var parseMask = (mask) => {
  const dot = mask.indexOf(".");
  if (dot < 0) {
    return null;
  }
  const fraction = mask.slice(dot + 1);
  const padded = fraction.includes("0");
  return { digits: fraction.length, padded };
};
var formatNumber2 = (value, mask) => {
  if (Number.isNaN(value)) {
    return "NaN";
  }
  if (value === Number.POSITIVE_INFINITY) {
    return "\u221E";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return "-\u221E";
  }
  const normalized = value === 0 ? 0 : value;
  const parsed = mask === void 0 ? null : parseMask(mask);
  if (parsed === null) {
    return String(normalized);
  }
  const fixed = normalized.toFixed(parsed.digits);
  if (parsed.padded || parsed.digits === 0) {
    return fixed;
  }
  return fixed.replace(/\.?0+$/, "");
};
var applyFormat = (template, args) => {
  return template.replace(/\{\{|\}\}|\{(\d+)(?:,number,([^}]*))?\}/g, (match, indexText, mask) => {
    if (match === "{{") {
      return "{";
    }
    if (match === "}}") {
      return "}";
    }
    const index = Number(indexText);
    const arg = args[index];
    if (arg === void 0) {
      return match;
    }
    if (mask !== void 0) {
      return formatNumber2(Number(arg), mask);
    }
    return String(arg);
  });
};

// packages/core/dist/str/index.js
var str = Object.freeze({
  tostring: (value, format) => typeof value === "number" ? formatNumber2(value, format) : String(value),
  format: (template, ...args) => applyFormat(template, args),
  length: (s) => s.length,
  contains: (s, sub) => s.includes(sub),
  startsWith: (s, sub) => s.startsWith(sub),
  endsWith: (s, sub) => s.endsWith(sub),
  replace: (s, target, repl) => s.replace(target, repl),
  replaceAll: (s, target, repl) => s.split(target).join(repl),
  split: (s, sep) => s.split(sep),
  substring: (s, start, end) => s.substring(start, end),
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  trim: (s) => s.trim(),
  repeat: (s, count) => s.repeat(Math.max(0, Math.trunc(count)))
});

// packages/core/dist/array/index.js
var array = Object.freeze({
  sum: (a) => a.sum(),
  avg: (a) => a.avg(),
  min: (a) => a.min(),
  max: (a) => a.max(),
  range: (a) => a.range(),
  variance: (a, biased) => a.variance(biased),
  stdev: (a, biased) => a.stdev(biased),
  median: (a) => a.median(),
  percentile: (a, p) => a.percentile(p),
  indexOf: (a, v) => a.indexOf(v),
  includes: (a, v) => a.includes(v),
  sort: (a, order) => a.sort(order)
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
  { name: "ta.highestbars", slot: true },
  { name: "ta.lowestbars", slot: true },
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
  // Pine-ergonomic aliases lowering to the `bg-color` / `bar-color` plot
  // styles. Slot-injected like `plot`/`hline` so each callsite gets a
  // stable slot id and is listed in `manifest.plots` with its kind.
  { name: "bgcolor", slot: true },
  { name: "barcolor", slot: true },
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
  { name: "draw.fillBetween", slot: true },
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
  { name: "state.series", slot: true },
  { name: "state.color", slot: true },
  { name: "state.boolSeries", slot: true },
  { name: "state.stringSeries", slot: true },
  { name: "state.tick.float", slot: true },
  { name: "state.tick.int", slot: true },
  { name: "state.tick.bool", slot: true },
  { name: "state.tick.string", slot: true },
  { name: "state.array", slot: true },
  { name: "state.map", slot: true },
  // Both the data form `request.security({ interval })` and the expression
  // form `request.security({ interval }, (bar) => …)` route through this one
  // entry: `slot: true` injects the slot id as the first argument regardless
  // of the optional second (callback) argument.
  { name: "request.security", slot: true },
  { name: "request.lowerTf", slot: true },
  // Calendar / session accessors — stateless (slot: false). Like `ta.nz`,
  // they ride the registry for the `stateful-call-inside-loop` diagnostic
  // (Pine-parity) but take NO injected slot id: the runtime function
  // receives the author's arguments directly.
  { name: "time.year", slot: false },
  { name: "time.month", slot: false },
  { name: "time.dayofmonth", slot: false },
  { name: "time.dayofweek", slot: false },
  { name: "time.hour", slot: false },
  { name: "time.minute", slot: false },
  { name: "time.second", slot: false },
  { name: "time.timestamp", slot: false },
  { name: "time.now", slot: false },
  { name: "time.timeClose", slot: false },
  { name: "session.isOpen", slot: false },
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
  "fill-between",
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
  ["fill-between", "fillBetween"],
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

// packages/compiler/examples/scripts/bollinger-bands.chart.ts
var bollinger_bands_chart_default = defineIndicator({
  name: "Bollinger Bands",
  apiVersion: 1,
  overlay: true,
  compute({ bar, ta: ta3, plot: plot3 }) {
    const bands = ta3.bb("examples/scripts/bollinger-bands.chart.ts:11:23#0", bar.close, 20, { multiplier: 2 });
    plot3("examples/scripts/bollinger-bands.chart.ts:12:9#0", bands.upper, { color: "#cccccc", title: "BB Upper", lineWidth: 1 });
    plot3("examples/scripts/bollinger-bands.chart.ts:13:9#0", bands.middle, { color: "#90caf9", title: "BB Middle", lineWidth: 2 });
    plot3("examples/scripts/bollinger-bands.chart.ts:14:9#0", bands.lower, { color: "#cccccc", title: "BB Lower", lineWidth: 1 });
  },
  outputs: [{ title: "BB Upper", kind: "series-number" }, { title: "BB Middle", kind: "series-number" }, { title: "BB Lower", kind: "series-number" }]
});
export {
  bollinger_bands_chart_default as default
};
export const __manifest = {"apiVersion":1,"kind":"indicator","name":"Bollinger Bands","inputs":{},"capabilities":["indicators"],"requestedIntervals":[],"userPickableInterval":false,"seriesCapacities":{},"maxLookback":0,"overlay":true,"outputs":[{"title":"BB Upper","kind":"series-number"},{"title":"BB Middle","kind":"series-number"},{"title":"BB Lower","kind":"series-number"}],"plots":[{"slotId":"examples/scripts/bollinger-bands.chart.ts:12:9#0","kind":"line","title":"BB Upper"},{"slotId":"examples/scripts/bollinger-bands.chart.ts:13:9#0","kind":"line","title":"BB Middle"},{"slotId":"examples/scripts/bollinger-bands.chart.ts:14:9#0","kind":"line","title":"BB Lower"}]};
bollinger_bands_chart_default = Object.freeze({ ...bollinger_bands_chart_default, manifest: {"apiVersion":1,"kind":"indicator","name":"Bollinger Bands","inputs":{},"capabilities":["indicators"],"requestedIntervals":[],"userPickableInterval":false,"seriesCapacities":{},"maxLookback":0,"overlay":true,"outputs":[{"title":"BB Upper","kind":"series-number"},{"title":"BB Middle","kind":"series-number"},{"title":"BB Lower","kind":"series-number"}],"plots":[{"slotId":"examples/scripts/bollinger-bands.chart.ts:12:9#0","kind":"line","title":"BB Upper"},{"slotId":"examples/scripts/bollinger-bands.chart.ts:13:9#0","kind":"line","title":"BB Middle"},{"slotId":"examples/scripts/bollinger-bands.chart.ts:14:9#0","kind":"line","title":"BB Lower"}]} });
