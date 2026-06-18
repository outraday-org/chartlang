var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../runtime/dist/ringBuffer.js
var RingBuffer = class {
  constructor(capacity) {
    __publicField(this, "capacity");
    __publicField(this, "buf");
    __publicField(this, "head", -1);
    __publicField(this, "filled", 0);
    this.capacity = capacity;
    this.buf = new Array(capacity);
  }
  append(v) {
    this.head = (this.head + 1) % this.capacity;
    this.buf[this.head] = v;
    if (this.filled < this.capacity)
      this.filled += 1;
  }
  replaceHead(v) {
    if (this.head === -1) {
      this.append(v);
      return;
    }
    this.buf[this.head] = v;
  }
  at(n) {
    if (n < 0 || n >= this.filled)
      return void 0;
    return this.buf[(this.head - n + this.capacity) % this.capacity];
  }
  get length() {
    return this.filled;
  }
  reset() {
    this.buf = new Array(this.capacity);
    this.head = -1;
    this.filled = 0;
  }
};
var Float64RingBuffer = class {
  constructor(capacity) {
    __publicField(this, "capacity");
    __publicField(this, "buf");
    __publicField(this, "head", -1);
    __publicField(this, "filled", 0);
    this.capacity = capacity;
    this.buf = new Float64Array(capacity);
  }
  append(v) {
    this.head = (this.head + 1) % this.capacity;
    this.buf[this.head] = v;
    if (this.filled < this.capacity)
      this.filled += 1;
  }
  replaceHead(v) {
    if (this.head === -1) {
      this.append(v);
      return;
    }
    this.buf[this.head] = v;
  }
  at(n) {
    if (n < 0 || n >= this.filled)
      return Number.NaN;
    return this.buf[(this.head - n + this.capacity) % this.capacity];
  }
  get length() {
    return this.filled;
  }
  serialiseSnapshotBuffer() {
    const values = [];
    for (const value of this.buf) {
      values.push(Number.isNaN(value) ? null : value);
    }
    return Object.freeze({
      headIndex: this.head,
      filled: this.filled,
      values: Object.freeze(values)
    });
  }
  restoreFromSnapshotBuffer(args) {
    if (args.values.length !== this.capacity || !Number.isInteger(args.headIndex) || args.headIndex < -1 || args.headIndex >= this.capacity || !Number.isInteger(args.filled) || args.filled < 0 || args.filled > this.capacity || args.filled === 0 && args.headIndex !== -1 || args.filled > 0 && args.headIndex < 0) {
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
  reset() {
    this.buf = new Float64Array(this.capacity);
    this.head = -1;
    this.filled = 0;
  }
};

// ../runtime/dist/seriesView.js
function makeSeriesView(buf) {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === "current")
        return buf.at(0);
      if (prop === "length")
        return buf.length;
      if (typeof prop === "string") {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0)
          return buf.at(n);
      }
      return void 0;
    },
    has(_target, prop) {
      if (prop === "current" || prop === "length")
        return true;
      if (typeof prop === "string") {
        const n = Number(prop);
        return Number.isInteger(n) && n >= 0;
      }
      return false;
    }
  });
}
function makeShiftedSeriesView(buf, offset) {
  if (offset === 0)
    return makeSeriesView(buf);
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === "current")
        return buf.at(offset);
      if (prop === "length")
        return buf.length;
      if (typeof prop === "string") {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0)
          return buf.at(n + offset);
      }
      return void 0;
    },
    has(_target, prop) {
      if (prop === "current" || prop === "length")
        return true;
      if (typeof prop === "string") {
        const n = Number(prop);
        return Number.isInteger(n) && n >= 0;
      }
      return false;
    }
  });
}

// ../core/dist/types.js
var isCompiledScriptBundle = (v) => Object.prototype.hasOwnProperty.call(v, "primary");

// ../core/dist/interval/intervalToSeconds.js
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
function intervalToSeconds(d) {
  if (d.intervalSeconds !== void 0) {
    if (!Number.isFinite(d.intervalSeconds) || d.intervalSeconds <= 0) {
      throw new Error(`intervalToSeconds: intervalSeconds must be a positive finite number; received ${d.intervalSeconds}`);
    }
    return Math.round(d.intervalSeconds);
  }
  const match = /^(\d+)([smHhDWMY]?)$/.exec(d.value);
  if (match === null) {
    throw new Error(`intervalToSeconds: cannot parse interval value ${JSON.stringify(d.value)}`);
  }
  const n = Number.parseInt(match[1], 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`intervalToSeconds: numeric prefix must be a positive integer; received ${JSON.stringify(d.value)}`);
  }
  const suffix = match[2];
  const multiplier = MULTIPLIERS[suffix];
  return n * multiplier;
}

// ../core/dist/input/input.js
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

// ../core/dist/state/state.js
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

// ../core/dist/views/barstate.js
var barstate = Object.freeze({
  isfirst: false,
  islast: false,
  isnew: false,
  ishistory: false,
  isrealtime: false,
  isconfirmed: false
});

// ../core/dist/views/syminfo.js
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

// ../core/dist/views/timeframe.js
var timeframe = Object.freeze({
  period: "",
  isintraday: false,
  isdaily: false,
  isweekly: false,
  ismonthly: false,
  inSeconds: Number.NaN
});

// ../core/dist/request/request.js
var sentinel2 = (name) => {
  throw new Error(`${name} called outside an active script step`);
};
var request = Object.freeze({
  /**
   * Read a secondary candle stream at a script-author-fixed **higher**
   * interval. The returned `SecurityBar` exposes every OHLCV field —
   * plus the derived `hl2` / `hlc3` / `ohlc4` / `hlcc4` and `symbol` /
   * `interval` — as a `Series<...>`, aligned no-lookahead to the chart's
   * bars so a script can read prior secondary values such as
   * `weekly.close[5]`. The `interval` must be a compile-time literal (a
   * string literal or an `input.enum` value); the compiler walks every call
   * to populate `manifest.requestedIntervals`. When the adapter does not
   * advertise `Capabilities.multiTimeframe`, the series degrades to all-NaN
   * rather than erroring. See the multi-timeframe guide for alignment and
   * interval-format details.
   *
   * @since 0.4
   * @stable
   * @example
   *     // Pull weekly candles aligned to the chart and read the close.
   *     const weekly = request.security({ interval: "1W" });
   *     const weeklyClose = weekly.close.current;
   *     void weeklyClose;
   */
  security(_opts) {
    return sentinel2("request.security");
  },
  /**
   * Read **lower**-timeframe bars contained by each main-stream bar. The
   * result is a `Series<ReadonlyArray<Bar>>` — for every main bar, the array
   * of finer-grained bars that fall inside it (an empty frozen array for
   * out-of-range or unsupported reads). The requested `interval` must be a
   * compile-time literal and **strictly lower** than the chart interval; an
   * equal-or-higher ordering is rejected at compile time with
   * `lower-tf-not-lower` when statically known. Like `request.security`, it
   * degrades to empty arrays when the adapter lacks
   * `Capabilities.multiTimeframe`. See the multi-timeframe guide for the
   * contained-bar model and interval format.
   *
   * @since 0.6
   * @stable
   * @example
   *     // Each main bar carries the array of intrabar 30-second candles.
   *     const intrabar = request.lowerTf({ interval: "30s" });
   *     const count = intrabar.current.length;
   *     void count;
   */
  lowerTf(_opts) {
    return sentinel2("request.lowerTf");
  }
});

// ../core/dist/runtime/runtime.js
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

// ../core/dist/color/parseColor.js
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

// ../core/dist/color/colorHelpers.js
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

// ../core/dist/color/index.js
var color = Object.freeze({
  ...COLOR_PALETTE,
  fromGradient,
  withAlpha,
  rgb,
  hsl
});

// ../core/dist/statefulPrimitives.js
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

// ../core/dist/draw/drawingKind.js
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

// ../core/dist/draw/buckets.js
var KIND_BUCKET = /* @__PURE__ */ new Map([
  ["line", "lines"],
  ["horizontal-line", "lines"],
  ["horizontal-ray", "lines"],
  ["vertical-line", "lines"],
  ["cross-line", "lines"],
  ["trend-angle", "lines"],
  ["rectangle", "boxes"],
  ["rotated-rectangle", "boxes"],
  ["triangle", "boxes"],
  ["polyline", "polylines"],
  ["circle", "boxes"],
  ["ellipse", "boxes"],
  ["path", "polylines"],
  ["marker", "labels"],
  ["arc", "polylines"],
  ["curve", "polylines"],
  ["double-curve", "polylines"],
  ["pen", "polylines"],
  ["highlighter", "polylines"],
  ["brush", "polylines"],
  ["text", "labels"],
  ["arrow", "labels"],
  ["arrow-marker", "labels"],
  ["arrow-mark-up", "labels"],
  ["arrow-mark-down", "labels"],
  ["trend-channel", "polylines"],
  ["flat-top-bottom", "polylines"],
  ["disjoint-channel", "polylines"],
  ["regression-trend", "polylines"],
  ["fib-retracement", "other"],
  ["fib-trend-extension", "other"],
  ["fib-channel", "other"],
  ["fib-time-zone", "other"],
  ["fib-wedge", "other"],
  ["fib-speed-fan", "other"],
  ["fib-speed-arcs", "other"],
  ["fib-spiral", "other"],
  ["fib-circles", "other"],
  ["fib-trend-time", "other"],
  ["gann-box", "other"],
  ["gann-square-fixed", "other"],
  ["gann-square", "other"],
  ["gann-fan", "other"],
  ["pitchfork", "polylines"],
  ["pitchfan", "polylines"],
  ["xabcd-pattern", "polylines"],
  ["cypher-pattern", "polylines"],
  ["head-and-shoulders", "polylines"],
  ["abcd-pattern", "polylines"],
  ["triangle-pattern", "polylines"],
  ["three-drives-pattern", "polylines"],
  ["elliott-impulse-wave", "polylines"],
  ["elliott-correction-wave", "polylines"],
  ["elliott-triangle-wave", "polylines"],
  ["elliott-double-combo", "polylines"],
  ["elliott-triple-combo", "polylines"],
  ["cyclic-lines", "other"],
  ["time-cycles", "other"],
  ["sine-line", "other"],
  ["group", "other"],
  ["frame", "other"],
  ["table", "other"]
]);
function bucketFor(kind) {
  const bucket = KIND_BUCKET.get(kind);
  if (bucket === void 0) {
    throw new Error(`No bucket assigned for drawing kind '${kind}'`);
  }
  return bucket;
}

// ../core/dist/draw/draw.js
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

// ../runtime/dist/barPoint.js
function intervalSpacingMs(interval) {
  try {
    return intervalToSeconds({ value: interval, label: interval, group: "" }) * 1e3;
  } catch {
    return Number.NaN;
  }
}
function medianSpacingMs(time) {
  const pairs = Math.min(time.length - 1, 100);
  if (pairs < 1)
    return Number.NaN;
  const deltas = [];
  for (let i = 0; i < pairs; i += 1) {
    const delta = time.at(i) - time.at(i + 1);
    if (Number.isFinite(delta))
      deltas.push(delta);
  }
  if (deltas.length === 0)
    return Number.NaN;
  deltas.sort((a, b) => a - b);
  const mid = deltas.length >> 1;
  return deltas.length % 2 === 1 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
}
function resolveBarPoint(time, interval, currentTime, offset, price) {
  if (offset === 0)
    return { time: currentTime, price };
  if (offset < 0)
    return { time: time.at(-offset), price };
  const spacing = (() => {
    const median2 = medianSpacingMs(time);
    return Number.isFinite(median2) ? median2 : intervalSpacingMs(interval);
  })();
  return { time: currentTime + offset * spacing, price };
}

// ../runtime/dist/streamState.js
function deriveBarSources(rawBar) {
  return {
    hl2: (rawBar.high + rawBar.low) / 2,
    hlc3: (rawBar.high + rawBar.low + rawBar.close) / 3,
    ohlc4: (rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4,
    hlcc4: (rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4
  };
}
var rawBufferKeys = ["time", "open", "high", "low", "close", "volume"];
function rawBuffers(ohlcv) {
  return {
    time: ohlcv.time,
    open: ohlcv.open,
    high: ohlcv.high,
    low: ohlcv.low,
    close: ohlcv.close,
    volume: ohlcv.volume
  };
}
function valueAt(values, index) {
  const value = values[index];
  return value === null || value === void 0 ? Number.NaN : value;
}
function recomputeDerivedBuffers(ohlcv, snapshot6) {
  const { headIndex, filled, buffers } = snapshot6;
  const capacity = ohlcv.hl2.capacity;
  const derived = {
    hl2: new Array(capacity),
    hlc3: new Array(capacity),
    ohlc4: new Array(capacity),
    hlcc4: new Array(capacity)
  };
  for (let i = 0; i < capacity; i += 1) {
    const high = valueAt(buffers.high, i);
    const low = valueAt(buffers.low, i);
    const open = valueAt(buffers.open, i);
    const close = valueAt(buffers.close, i);
    derived.hl2[i] = Number.isNaN(high) || Number.isNaN(low) ? null : (high + low) / 2;
    derived.hlc3[i] = Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close) ? null : (high + low + close) / 3;
    derived.ohlc4[i] = Number.isNaN(open) || Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close) ? null : (open + high + low + close) / 4;
    derived.hlcc4[i] = Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close) ? null : (high + low + close + close) / 4;
  }
  ohlcv.hl2.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.hl2 });
  ohlcv.hlc3.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.hlc3 });
  ohlcv.ohlc4.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.ohlc4 });
  ohlcv.hlcc4.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.hlcc4 });
}
function createStreamState(args) {
  const { interval, capacity, symbol } = args;
  const ohlcv = {
    time: new Float64RingBuffer(capacity),
    open: new Float64RingBuffer(capacity),
    high: new Float64RingBuffer(capacity),
    low: new Float64RingBuffer(capacity),
    close: new Float64RingBuffer(capacity),
    volume: new Float64RingBuffer(capacity),
    hl2: new Float64RingBuffer(capacity),
    hlc3: new Float64RingBuffer(capacity),
    ohlc4: new Float64RingBuffer(capacity),
    hlcc4: new Float64RingBuffer(capacity)
  };
  const bar = {
    time: 0,
    open: Number.NaN,
    high: Number.NaN,
    low: Number.NaN,
    close: Number.NaN,
    volume: 0,
    hl2: Number.NaN,
    hlc3: Number.NaN,
    ohlc4: Number.NaN,
    hlcc4: Number.NaN,
    symbol,
    interval,
    viewport: Object.freeze({ fromTime: 0, toTime: 0 }),
    // Closes over the stream's time history + the live `BarView` scalars so
    // offset-anchored drawings resolve against the real / extrapolated time
    // at compute time. The `WorldPoint` it returns is the only persisted
    // anchor frame — `bar.point` adds no new wire shape.
    point: (offset, price) => resolveBarPoint(ohlcv.time, bar.interval, bar.time, offset, price)
  };
  const seriesViews = {
    time: makeSeriesView(ohlcv.time),
    open: makeSeriesView(ohlcv.open),
    high: makeSeriesView(ohlcv.high),
    low: makeSeriesView(ohlcv.low),
    close: makeSeriesView(ohlcv.close),
    volume: makeSeriesView(ohlcv.volume),
    hl2: makeSeriesView(ohlcv.hl2),
    hlc3: makeSeriesView(ohlcv.hlc3),
    ohlc4: makeSeriesView(ohlcv.ohlc4),
    hlcc4: makeSeriesView(ohlcv.hlcc4)
  };
  const stream = {
    interval,
    ohlcv,
    bar,
    seriesViews,
    taSlots: /* @__PURE__ */ new Map(),
    serialiseSnapshot() {
      const close = ohlcv.close.serialiseSnapshotBuffer();
      const buffers = rawBuffers(ohlcv);
      return Object.freeze({
        interval: bar.interval,
        headIndex: close.headIndex,
        filled: close.filled,
        buffers: Object.freeze({
          time: buffers.time.serialiseSnapshotBuffer().values,
          open: buffers.open.serialiseSnapshotBuffer().values,
          high: buffers.high.serialiseSnapshotBuffer().values,
          low: buffers.low.serialiseSnapshotBuffer().values,
          close: close.values,
          volume: buffers.volume.serialiseSnapshotBuffer().values
        })
      });
    },
    restoreFromSnapshot(snapshot6) {
      const buffers = rawBuffers(ohlcv);
      for (const key of rawBufferKeys) {
        buffers[key].restoreFromSnapshotBuffer({
          headIndex: snapshot6.headIndex,
          filled: snapshot6.filled,
          values: snapshot6.buffers[key]
        });
      }
      recomputeDerivedBuffers(ohlcv, snapshot6);
      const current = snapshot6.headIndex;
      if (snapshot6.filled === 0 || current < 0) {
        bar.time = 0;
        bar.open = Number.NaN;
        bar.high = Number.NaN;
        bar.low = Number.NaN;
        bar.close = Number.NaN;
        bar.volume = 0;
        bar.hl2 = Number.NaN;
        bar.hlc3 = Number.NaN;
        bar.ohlc4 = Number.NaN;
        bar.hlcc4 = Number.NaN;
      } else {
        bar.time = valueAt(snapshot6.buffers.time, current);
        bar.open = valueAt(snapshot6.buffers.open, current);
        bar.high = valueAt(snapshot6.buffers.high, current);
        bar.low = valueAt(snapshot6.buffers.low, current);
        bar.close = valueAt(snapshot6.buffers.close, current);
        bar.volume = valueAt(snapshot6.buffers.volume, current);
        bar.hl2 = (bar.high + bar.low) / 2;
        bar.hlc3 = (bar.high + bar.low + bar.close) / 3;
        bar.ohlc4 = (bar.open + bar.high + bar.low + bar.close) / 4;
        bar.hlcc4 = (bar.high + bar.low + bar.close + bar.close) / 4;
      }
      bar.interval = snapshot6.interval;
    }
  };
  return stream;
}
function appendBarToStream(stream, rawBar) {
  const values = deriveBarSources(rawBar);
  const { ohlcv, bar } = stream;
  ohlcv.time.append(rawBar.time);
  ohlcv.open.append(rawBar.open);
  ohlcv.high.append(rawBar.high);
  ohlcv.low.append(rawBar.low);
  ohlcv.close.append(rawBar.close);
  ohlcv.volume.append(rawBar.volume);
  ohlcv.hl2.append(values.hl2);
  ohlcv.hlc3.append(values.hlc3);
  ohlcv.ohlc4.append(values.ohlc4);
  ohlcv.hlcc4.append(values.hlcc4);
  bar.time = rawBar.time;
  bar.open = rawBar.open;
  bar.high = rawBar.high;
  bar.low = rawBar.low;
  bar.close = rawBar.close;
  bar.volume = rawBar.volume;
  bar.hl2 = values.hl2;
  bar.hlc3 = values.hlc3;
  bar.ohlc4 = values.ohlc4;
  bar.hlcc4 = values.hlcc4;
  bar.symbol = rawBar.symbol;
  bar.interval = rawBar.interval;
}
function replaceStreamHead(stream, rawBar) {
  if (stream.ohlcv.close.length === 0) {
    appendBarToStream(stream, rawBar);
    return;
  }
  const values = deriveBarSources(rawBar);
  const { ohlcv, bar } = stream;
  ohlcv.time.replaceHead(rawBar.time);
  ohlcv.open.replaceHead(rawBar.open);
  ohlcv.high.replaceHead(rawBar.high);
  ohlcv.low.replaceHead(rawBar.low);
  ohlcv.close.replaceHead(rawBar.close);
  ohlcv.volume.replaceHead(rawBar.volume);
  ohlcv.hl2.replaceHead(values.hl2);
  ohlcv.hlc3.replaceHead(values.hlc3);
  ohlcv.ohlc4.replaceHead(values.ohlc4);
  ohlcv.hlcc4.replaceHead(values.hlcc4);
  bar.time = rawBar.time;
  bar.open = rawBar.open;
  bar.high = rawBar.high;
  bar.low = rawBar.low;
  bar.close = rawBar.close;
  bar.volume = rawBar.volume;
  bar.hl2 = values.hl2;
  bar.hlc3 = values.hlc3;
  bar.ohlc4 = values.ohlc4;
  bar.hlcc4 = values.hlcc4;
  bar.symbol = rawBar.symbol;
  bar.interval = rawBar.interval;
}
function replaceTickHead(stream, rawBar) {
  const values = deriveBarSources(rawBar);
  const { ohlcv, bar } = stream;
  ohlcv.close.replaceHead(rawBar.close);
  ohlcv.high.replaceHead(rawBar.high);
  ohlcv.low.replaceHead(rawBar.low);
  ohlcv.volume.replaceHead(rawBar.volume);
  ohlcv.hl2.replaceHead(values.hl2);
  ohlcv.hlc3.replaceHead(values.hlc3);
  ohlcv.ohlc4.replaceHead(values.ohlc4);
  ohlcv.hlcc4.replaceHead(values.hlcc4);
  bar.close = rawBar.close;
  bar.high = rawBar.high;
  bar.low = rawBar.low;
  bar.volume = rawBar.volume;
  bar.hl2 = values.hl2;
  bar.hlc3 = values.hlc3;
  bar.ohlc4 = values.ohlc4;
  bar.hlcc4 = values.hlcc4;
}
function updateFallbackViewport(stream, limit = 100) {
  const length = stream.ohlcv.time.length;
  if (length === 0) {
    stream.bar.viewport = Object.freeze({ fromTime: 0, toTime: 0 });
    return;
  }
  const lookback = Math.min(length - 1, Math.max(0, limit - 1));
  const fromTime = stream.ohlcv.time.at(lookback);
  const toTime = stream.ohlcv.time.at(0);
  stream.bar.viewport = Object.freeze({
    fromTime: Number.isFinite(fromTime) ? fromTime : toTime,
    toTime
  });
}

// ../runtime/dist/stateStore.js
function inMemoryStateStore() {
  const store = /* @__PURE__ */ new Map();
  return {
    get(id) {
      return store.get(id);
    },
    set(id, value) {
      store.set(id, value);
    },
    has(id) {
      return store.has(id);
    },
    clear() {
      store.clear();
    }
  };
}

// ../runtime/dist/state/lifecycle.js
function resetTentativeStateSlots(ctx) {
  for (const slot of ctx.stateSlots.values()) {
    slot.onBarTick();
  }
}
function commitStateSlots(ctx) {
  for (const slot of ctx.stateSlots.values()) {
    slot.onBarClose();
  }
}
function flushStateSlots(ctx) {
  for (const [key, slot] of ctx.stateSlots.entries()) {
    ctx.stateStore.set(key, {
      committed: slot.committed,
      tentative: slot.tentative
    });
  }
}
function serialiseStateSlots(ctx) {
  const out = {};
  for (const [key, slot] of ctx.stateSlots.entries()) {
    out[key] = {
      committed: slot.serialise(slot.committed),
      tentative: slot.serialise(slot.tentative)
    };
  }
  return Object.freeze(out);
}
function restoreStateSlots(ctx, slots) {
  ctx.stateSlots.clear();
  for (const [key, value] of Object.entries(slots)) {
    ctx.stateStore.set(key, value);
  }
}

// ../runtime/dist/runtimeContext.js
var ACTIVE_RUNTIME_CONTEXT = {
  current: null
};

// ../runtime/dist/state/stateSlot.js
var StateSlot = class {
  constructor(init, tickPersistent, serialisers = {}) {
    __publicField(this, "tickPersistent");
    __publicField(this, "serialisers");
    __publicField(this, "committed");
    __publicField(this, "tentative");
    this.tickPersistent = tickPersistent;
    this.serialisers = serialisers;
    this.committed = init;
    this.tentative = init;
  }
  get() {
    return this.tickPersistent ? this.committed : this.tentative;
  }
  set(value) {
    if (this.tickPersistent) {
      this.committed = value;
    } else {
      this.tentative = value;
    }
  }
  onBarClose() {
    if (!this.tickPersistent) {
      this.committed = this.tentative;
    }
  }
  onBarTick() {
    if (!this.tickPersistent) {
      this.tentative = this.committed;
    }
  }
  serialise(value) {
    return this.serialisers.serialiseState?.(value) ?? value;
  }
};
function asMutableSlot(slot) {
  return {
    get value() {
      return slot.get();
    },
    set value(value) {
      slot.set(value);
    }
  };
}

// ../runtime/dist/state/stateNamespace.js
var stateKey = (ctx, slotId) => `${ctx.slotIdPrefix ?? ""}${slotId}:state`;
function getCtx(name) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error(`${name} called outside an active script step`);
  }
  return ctx;
}
function getOrAllocate(name, slotId, init, tickPersistent) {
  const ctx = getCtx(name);
  const key = stateKey(ctx, slotId);
  const existing = ctx.stateSlots.get(key);
  if (existing !== void 0) {
    return asMutableSlot(existing);
  }
  const stored = ctx.stateStore.get(key);
  const slot = new StateSlot(stored?.committed ?? init, tickPersistent);
  if (stored !== void 0) {
    slot.tentative = stored.tentative;
  }
  ctx.stateSlots.set(key, slot);
  return asMutableSlot(slot);
}
function buildStateNamespace() {
  const ns = {
    float: (slotId, init) => getOrAllocate("state.float", slotId, init, false),
    int: (slotId, init) => getOrAllocate("state.int", slotId, init, false),
    bool: (slotId, init) => getOrAllocate("state.bool", slotId, init, false),
    string: (slotId, init) => getOrAllocate("state.string", slotId, init, false),
    tick: {
      float: (slotId, init) => getOrAllocate("state.tick.float", slotId, init, true),
      int: (slotId, init) => getOrAllocate("state.tick.int", slotId, init, true),
      bool: (slotId, init) => getOrAllocate("state.tick.bool", slotId, init, true),
      string: (slotId, init) => getOrAllocate("state.tick.string", slotId, init, true)
    }
  };
  Object.freeze(ns.tick);
  Object.freeze(ns);
  return ns;
}

// ../runtime/dist/inputs/resolveInputs.js
var SOURCE_FIELDS = /* @__PURE__ */ new Set([
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
  "hlcc4"
]);
function resolveInputs(manifest, overrides, ctx) {
  const out = {};
  for (const [key, descriptor] of Object.entries(manifest.inputs)) {
    const fallback2 = defaultValueFor(descriptor);
    if (!Object.hasOwn(overrides, key) || overrides[key] === void 0) {
      out[key] = fallback2;
      continue;
    }
    const override = overrides[key];
    if (matchesDescriptor(descriptor, override)) {
      out[key] = override;
      continue;
    }
    pushInputDiagnostic(ctx, key, descriptor.kind, override);
    out[key] = fallback2;
  }
  return Object.freeze(out);
}
function defaultValueFor(descriptor) {
  if ("defaultValue" in descriptor)
    return descriptor.defaultValue;
  return void 0;
}
function matchesDescriptor(descriptor, value) {
  switch (descriptor.kind) {
    case "int":
      return typeof value === "number" && Number.isInteger(value);
    case "float":
    case "time":
    case "price":
      return typeof value === "number" && Number.isFinite(value);
    case "bool":
      return typeof value === "boolean";
    case "string":
    case "color":
    case "symbol":
    case "interval":
      return typeof value === "string";
    case "enum":
      return typeof value === "string" && descriptor.options.includes(value);
    case "source":
      return typeof value === "string" && SOURCE_FIELDS.has(value);
    case "external-series":
      return value !== null && typeof value === "object";
  }
}
function pushInputDiagnostic(ctx, key, expected, value) {
  if (ctx.diagnosedInputKeys.has(key))
    return;
  ctx.diagnosedInputKeys.add(key);
  ctx.emissions.diagnostics.push({
    kind: "diagnostic",
    severity: "warning",
    code: "input-coercion-failed",
    message: `input "${key}" expected ${expected}, got ${describeValue(value)}`,
    slotId: key,
    bar: null
  });
}
function describeValue(value) {
  if (value === null)
    return "null";
  if (typeof value === "number" && Number.isNaN(value))
    return "NaN";
  return typeof value;
}

// ../runtime/dist/request/bucketLtfBarsByMainContainment.js
function bucketLtfBarsByMainContainment(mainBars, ltfBars) {
  if (mainBars.length === 0)
    return [];
  const buckets = Array.from({ length: mainBars.length }, () => []);
  let mainIndex = 0;
  let ltfIndex = 0;
  while (ltfIndex < ltfBars.length && ltfBars[ltfIndex].time < mainBars[0].time) {
    ltfIndex += 1;
  }
  while (ltfIndex < ltfBars.length) {
    const ltf = ltfBars[ltfIndex];
    while (mainIndex + 1 < mainBars.length && mainBars[mainIndex + 1].time <= ltf.time) {
      mainIndex += 1;
    }
    buckets[mainIndex].push(ltf);
    ltfIndex += 1;
  }
  return buckets;
}

// ../runtime/dist/request/bucketLtfBarsCache.js
var CACHE = /* @__PURE__ */ new WeakMap();
function getOrBucket(mainBars, ltfBars) {
  let byLtf = CACHE.get(mainBars);
  if (byLtf === void 0) {
    byLtf = /* @__PURE__ */ new WeakMap();
    CACHE.set(mainBars, byLtf);
  }
  const cached = byLtf.get(ltfBars);
  if (cached !== void 0 && cached.mainLength === mainBars.length && cached.ltfLength === ltfBars.length) {
    return cached.buckets;
  }
  const buckets = bucketLtfBarsByMainContainment(mainBars, ltfBars);
  byLtf.set(ltfBars, { mainLength: mainBars.length, ltfLength: ltfBars.length, buckets });
  return buckets;
}

// ../runtime/dist/request/pushOnce.js
function pushOnce(ctx, code, slotId, interval, kind, message2) {
  const key = `${code}|${slotId}|${interval}|${kind}`;
  if (ctx.diagnosedRequestKeys.has(key))
    return;
  ctx.diagnosedRequestKeys.add(key);
  ctx.emissions.diagnostics.push({
    kind: "diagnostic",
    severity: "warning",
    code,
    message: message2,
    slotId,
    bar: ctx.barIndex()
  });
}

// ../runtime/dist/request/streamBars.js
function barFromStream(stream, age) {
  const open = stream.ohlcv.open.at(age);
  const high = stream.ohlcv.high.at(age);
  const low = stream.ohlcv.low.at(age);
  const close = stream.ohlcv.close.at(age);
  const barTime = stream.ohlcv.time.at(age);
  return {
    time: barTime,
    open,
    high,
    low,
    close,
    volume: stream.ohlcv.volume.at(age),
    symbol: stream.bar.symbol,
    interval: stream.bar.interval,
    hl2: (high + low) / 2,
    hlc3: (high + low + close) / 3,
    ohlc4: (open + high + low + close) / 4,
    hlcc4: (high + low + close + close) / 4,
    // Anchored at this materialised bar's own `age`: a negative offset
    // reads `time.at(age - offset)` (further back in this stream's
    // history) so a snapshot bar's offsets stay relative to itself.
    point: (offset, price) => resolveBarPoint(stream.ohlcv.time, stream.bar.interval, barTime, offset - age, price)
  };
}
function ascendingBarsFor(ctx, stream) {
  const cached = ctx.requestSecurityAscendingBars.get(stream);
  if (cached !== void 0)
    return cached;
  const bars = [];
  for (let age = stream.ohlcv.close.length - 1; age >= 0; age -= 1) {
    bars.push(barFromStream(stream, age));
  }
  ctx.requestSecurityAscendingBars.set(stream, bars);
  return bars;
}

// ../runtime/dist/request/lowerTf.js
var EMPTY_BUCKET = Object.freeze([]);
function fallback(ctx, slotId, interval, code, message2) {
  pushOnce(ctx, code, slotId, interval, "lowerTf", message2);
  return EMPTY_BUCKET;
}
function bucketAt(ctx, slotId, interval, age) {
  if (!ctx.capabilities.multiTimeframe) {
    return fallback(ctx, slotId, interval, "multi-timeframe-not-supported", "Adapter declares multiTimeframe: false; request.lowerTf returns empty buckets");
  }
  const known = ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval);
  if (!known) {
    return fallback(ctx, slotId, interval, "unsupported-interval", `Requested interval "${interval}" is not in Capabilities.intervals`);
  }
  const secondary = ctx.secondaryStreams.get(interval);
  if (secondary === void 0) {
    return fallback(ctx, slotId, interval, "unknown-secondary-stream", `Requested interval "${interval}" has no registered secondary stream`);
  }
  const mainBars = ascendingBarsFor(ctx, ctx.stream);
  const ltfBars = ascendingBarsFor(ctx, secondary);
  const buckets = getOrBucket(mainBars, ltfBars);
  const index = buckets.length - 1 - age;
  return buckets[index] ?? EMPTY_BUCKET;
}
function makeLowerTfSeries(ctx, slotId, interval) {
  const cacheKey = `${slotId}|${interval}`;
  const existing = ctx.requestLowerTfViews.get(cacheKey);
  if (existing !== void 0)
    return existing;
  const target = {
    get current() {
      return bucketAt(ctx, slotId, interval, 0);
    },
    get length() {
      return ctx.stream.ohlcv.close.length;
    }
  };
  const view = new Proxy(Object.freeze(target), {
    get(obj, prop, receiver) {
      if (typeof prop === "string") {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0)
          return bucketAt(ctx, slotId, interval, n);
      }
      return Reflect.get(obj, prop, receiver);
    }
  });
  ctx.requestLowerTfViews.set(cacheKey, view);
  return view;
}

// ../runtime/dist/request/alignHtfSeriesToLtf.js
function alignHtfSeriesToLtf(htf, htfSeries, ltf) {
  const out = new Array(ltf.length);
  if (htf.length === 0 || ltf.length === 0) {
    out.fill(Number.NaN);
    return out;
  }
  let htfCursor = 0;
  let lastIdx = -1;
  for (let i = 0; i < ltf.length; i += 1) {
    const t = ltf[i].time;
    while (htfCursor < htf.length && htf[htfCursor].time <= t) {
      lastIdx = htfCursor;
      htfCursor += 1;
    }
    out[i] = lastIdx >= 0 ? htfSeries[lastIdx] : Number.NaN;
  }
  return out;
}

// ../runtime/dist/request/alignHtfSeriesCache.js
var CACHE2 = /* @__PURE__ */ new WeakMap();
function getOrAlign(htfBars, htfSeries, ltfBars) {
  let byLtf = CACHE2.get(htfBars);
  if (byLtf === void 0) {
    byLtf = /* @__PURE__ */ new WeakMap();
    CACHE2.set(htfBars, byLtf);
  }
  let bySeries = byLtf.get(ltfBars);
  if (bySeries === void 0) {
    bySeries = /* @__PURE__ */ new WeakMap();
    byLtf.set(ltfBars, bySeries);
  }
  const cached = bySeries.get(htfSeries);
  if (cached !== void 0 && cached.htfLength === htfBars.length && cached.ltfLength === ltfBars.length) {
    return cached.aligned;
  }
  const aligned = alignHtfSeriesToLtf(htfBars, htfSeries, ltfBars);
  bySeries.set(htfSeries, {
    htfLength: htfBars.length,
    ltfLength: ltfBars.length,
    aligned
  });
  return aligned;
}

// ../runtime/dist/request/security.js
var NUMERIC_SOURCE_KEYS = Object.freeze([
  "time",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "hl2",
  "hlc3",
  "ohlc4",
  "hlcc4"
]);
function makeSeries(current) {
  return Object.freeze({ current, length: 0 });
}
function makeNanSecurityBar() {
  const nanNumberSeries = makeSeries(Number.NaN);
  const nanStringSeries = makeSeries("");
  return Object.freeze({
    time: nanNumberSeries,
    open: nanNumberSeries,
    high: nanNumberSeries,
    low: nanNumberSeries,
    close: nanNumberSeries,
    volume: nanNumberSeries,
    hl2: nanNumberSeries,
    hlc3: nanNumberSeries,
    ohlc4: nanNumberSeries,
    hlcc4: nanNumberSeries,
    symbol: nanStringSeries,
    interval: nanStringSeries
  });
}
function seriesAscending(stream, sourceKey) {
  const values = [];
  const source = stream.ohlcv[sourceKey];
  for (let age = source.length - 1; age >= 0; age -= 1) {
    values.push(source.at(age));
  }
  return values;
}
function alignmentKey(slotId, interval, sourceKey) {
  return `${slotId}|${interval}|${sourceKey}`;
}
function alignedSeries(ctx, slotId, interval, sourceKey, secondary) {
  const key = alignmentKey(slotId, interval, sourceKey);
  const existing = ctx.requestSecurityAlignments.get(key);
  if (existing !== void 0)
    return existing;
  const htfBars = ascendingBarsFor(ctx, secondary);
  const ltfBars = ascendingBarsFor(ctx, ctx.stream);
  const aligned = getOrAlign(htfBars, seriesAscending(secondary, sourceKey), ltfBars);
  ctx.requestSecurityAlignments.set(key, aligned);
  return aligned;
}
function makeAlignedNumberSeries(ctx, slotId, interval, sourceKey, secondary) {
  const target = {
    get current() {
      const aligned = alignedSeries(ctx, slotId, interval, sourceKey, secondary);
      const value = aligned[aligned.length - 1];
      return value === void 0 ? Number.NaN : value;
    },
    get length() {
      return ctx.stream.ohlcv.close.length;
    }
  };
  return new Proxy(Object.freeze(target), {
    get(obj, prop, receiver) {
      if (typeof prop === "string") {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0) {
          const aligned = alignedSeries(ctx, slotId, interval, sourceKey, secondary);
          const value = aligned[aligned.length - 1 - n];
          return value === void 0 ? Number.NaN : value;
        }
      }
      return Reflect.get(obj, prop, receiver);
    }
  });
}
function makeConstantStringSeries(value) {
  const target = {
    get current() {
      return value;
    },
    get length() {
      return 0;
    }
  };
  return new Proxy(Object.freeze(target), {
    get(obj, prop, receiver) {
      if (typeof prop === "string") {
        const n = Number(prop);
        if (Number.isInteger(n) && n >= 0)
          return value;
      }
      return Reflect.get(obj, prop, receiver);
    }
  });
}
function makeLiveSecurityBar(ctx, slotId, interval, secondary) {
  const numeric = /* @__PURE__ */ new Map();
  for (const key of NUMERIC_SOURCE_KEYS) {
    numeric.set(key, makeAlignedNumberSeries(ctx, slotId, interval, key, secondary));
  }
  return Object.freeze({
    time: numeric.get("time") ?? makeSeries(Number.NaN),
    open: numeric.get("open") ?? makeSeries(Number.NaN),
    high: numeric.get("high") ?? makeSeries(Number.NaN),
    low: numeric.get("low") ?? makeSeries(Number.NaN),
    close: numeric.get("close") ?? makeSeries(Number.NaN),
    volume: numeric.get("volume") ?? makeSeries(Number.NaN),
    hl2: numeric.get("hl2") ?? makeSeries(Number.NaN),
    hlc3: numeric.get("hlc3") ?? makeSeries(Number.NaN),
    ohlc4: numeric.get("ohlc4") ?? makeSeries(Number.NaN),
    hlcc4: numeric.get("hlcc4") ?? makeSeries(Number.NaN),
    symbol: makeConstantStringSeries(secondary.bar.symbol),
    interval: makeConstantStringSeries(interval)
  });
}
function fallbackNaN(ctx, cacheKey, slotId, interval, code, message2) {
  pushOnce(ctx, code, slotId, interval, "security", message2);
  const bar = makeNanSecurityBar();
  ctx.requestSecurityBars.set(cacheKey, bar);
  return bar;
}
function makeSecurityBar(ctx, slotId, interval) {
  const cacheKey = `${slotId}|${interval}`;
  const existing = ctx.requestSecurityBars.get(cacheKey);
  if (existing !== void 0)
    return existing;
  if (!ctx.capabilities.multiTimeframe) {
    return fallbackNaN(ctx, cacheKey, slotId, interval, "multi-timeframe-not-supported", "Adapter declares multiTimeframe: false; request.security returns NaN");
  }
  const known = ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval);
  if (!known) {
    return fallbackNaN(ctx, cacheKey, slotId, interval, "unsupported-interval", `Requested interval "${interval}" is not in Capabilities.intervals`);
  }
  const secondary = ctx.secondaryStreams.get(interval);
  if (secondary === void 0) {
    return fallbackNaN(ctx, cacheKey, slotId, interval, "unknown-secondary-stream", `Requested interval "${interval}" has no registered secondary stream`);
  }
  const bar = makeLiveSecurityBar(ctx, slotId, interval, secondary);
  ctx.requestSecurityBars.set(cacheKey, bar);
  return bar;
}

// ../runtime/dist/request/requestNamespace.js
function getCtx2(name) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error(`${name} called outside an active script step`);
  }
  return ctx;
}
function security(slotId, opts) {
  const ctx = getCtx2("request.security");
  return makeSecurityBar(ctx, slotId, opts.interval);
}
function lowerTf(slotId, opts) {
  const ctx = getCtx2("request.lowerTf");
  return makeLowerTfSeries(ctx, slotId, opts.interval);
}
function buildRequestNamespace() {
  const ns = Object.freeze({ security, lowerTf });
  return ns;
}

// ../runtime/dist/views/barstateView.js
function makeBarStateView(inputs) {
  const { eventKind, barIndex, isLastBar } = inputs;
  return Object.freeze({
    isfirst: barIndex === 0,
    islast: isLastBar,
    isnew: eventKind === "history" || eventKind === "close",
    ishistory: eventKind === "history",
    isrealtime: eventKind === "tick",
    isconfirmed: eventKind === "close"
  });
}

// ../runtime/dist/views/timeframeView.js
function parsePrefix(value) {
  const match = /^(\d+)/.exec(value);
  return match === null ? null : Number(match[1]);
}
var GROUP_SECONDS = Object.freeze({
  second: 1,
  minute: 60,
  hour: 3600,
  daily: 86400,
  weekly: 604800,
  monthly: 2629800,
  quarterly: 7889400,
  yearly: 31557600
});
var INTRADAY_GROUPS = /* @__PURE__ */ new Set(["second", "minute", "hour"]);
var MONTHLY_LONGER = /* @__PURE__ */ new Set(["monthly", "quarterly", "yearly"]);
function makeTimeframeView(interval, descriptor) {
  const group2 = descriptor?.group ?? "";
  const prefix = parsePrefix(interval) ?? Number.NaN;
  const unitSeconds = GROUP_SECONDS[group2] ?? Number.NaN;
  const inSeconds = Number.isFinite(prefix) && Number.isFinite(unitSeconds) ? prefix * unitSeconds : Number.NaN;
  return Object.freeze({
    period: interval,
    isintraday: INTRADAY_GROUPS.has(group2),
    isdaily: group2 === "daily",
    isweekly: group2 === "weekly",
    ismonthly: MONTHLY_LONGER.has(group2),
    inSeconds
  });
}

// ../runtime/dist/views/refreshRuntimeViews.js
function findDescriptor(intervals, interval) {
  return intervals.find((candidate) => candidate.value === interval);
}
function refreshRuntimeViews(state2, eventKind) {
  const { runtimeContext } = state2;
  const interval = runtimeContext.stream.bar.interval;
  runtimeContext.views.barstate = makeBarStateView({
    eventKind,
    barIndex: runtimeContext.barIndex(),
    isLastBar: eventKind !== "history"
  });
  runtimeContext.views.timeframe = makeTimeframeView(interval, findDescriptor(runtimeContext.capabilities.intervals, interval));
}

// ../runtime/dist/views/symInfoView.js
var EMPTY_META = Object.freeze({});
function makeSymInfoView(payload, enabled) {
  return Object.freeze({
    ticker: enabled.has("ticker") ? payload.ticker ?? "" : "",
    type: enabled.has("type") ? payload.type ?? "custom" : "custom",
    mintick: enabled.has("mintick") ? payload.mintick ?? Number.NaN : Number.NaN,
    currency: enabled.has("currency") ? payload.currency ?? "" : "",
    basecurrency: enabled.has("basecurrency") ? payload.basecurrency ?? "" : "",
    exchange: enabled.has("exchange") ? payload.exchange ?? "" : "",
    timezone: enabled.has("timezone") ? payload.timezone ?? "" : "",
    session: enabled.has("session") ? payload.session ?? "" : "",
    meta: enabled.has("meta") ? Object.freeze({ ...payload.meta ?? {} }) : EMPTY_META
  });
}

// ../runtime/dist/views/index.js
function createRuntimeViews(opts = {}) {
  return {
    barstate: makeBarStateView({ eventKind: "history", barIndex: 0, isLastBar: false }),
    syminfo: opts.syminfo ?? makeSymInfoView({}, /* @__PURE__ */ new Set()),
    timeframe: makeTimeframeView("", void 0)
  };
}

// ../runtime/dist/dep/DepOutputStore.js
var ENTRY_KEY_SEP = "\0";
function entryKey(producerId, title) {
  return `${producerId}${ENTRY_KEY_SEP}${title}`;
}
function createDepOutputStore(args) {
  const capacity = Math.max(1, args.capacity);
  const entries = /* @__PURE__ */ new Map();
  for (const producer of args.producers) {
    for (const output of producer.outputs) {
      const key = entryKey(producer.producerId, output.title);
      if (entries.has(key))
        continue;
      const buffer = new Float64RingBuffer(capacity);
      entries.set(key, { buffer, view: makeSeriesView(buffer) });
    }
  }
  function lookup(producerId, title) {
    const entry = entries.get(entryKey(producerId, title));
    if (entry === void 0) {
      throw new Error(`dep output "${producerId}.${title}" is not declared`);
    }
    return entry;
  }
  return Object.freeze({
    push(producerId, title, value) {
      lookup(producerId, title).buffer.append(value);
    },
    read(producerId, title) {
      return lookup(producerId, title).view;
    },
    beginBar() {
    },
    dispose() {
      for (const entry of entries.values()) {
        entry.buffer.reset();
      }
      entries.clear();
    }
  });
}

// ../adapter-kit/dist/capabilities/capabilities.js
var PHASE_5_PLOT_KINDS = Object.freeze([
  "line",
  "step-line",
  "horizontal-line",
  "histogram",
  "area",
  "filled-band",
  "label",
  "marker",
  "shape",
  "character",
  "arrow",
  "candle-override",
  "bar-override",
  "bg-color",
  "bar-color",
  "horizontal-histogram"
]);

// ../adapter-kit/dist/validation/validateEmission.js
var VALID_PLOT_STYLE_KINDS = /* @__PURE__ */ new Set([
  "line",
  "step-line",
  "horizontal-line",
  "histogram",
  "area",
  "filled-band",
  "label",
  "marker",
  "shape",
  "character",
  "arrow",
  "candle-override",
  "bar-override",
  "bg-color",
  "bar-color",
  "horizontal-histogram"
]);
var VALID_LINE_STYLES = /* @__PURE__ */ new Set(["solid", "dashed", "dotted"]);
var VALID_MARKER_SHAPES = /* @__PURE__ */ new Set([
  "circle",
  "triangle-up",
  "triangle-down",
  "square",
  "diamond"
]);
var VALID_SHAPE_GLYPHS = /* @__PURE__ */ new Set([
  "circle",
  "triangle-up",
  "triangle-down",
  "square",
  "diamond",
  "cross",
  "xcross",
  "flag"
]);
var VALID_PLOT_LOCATIONS = /* @__PURE__ */ new Set(["above", "below", "absolute"]);
var VALID_ARROW_DIRECTIONS = /* @__PURE__ */ new Set(["up", "down"]);
var VALID_LABEL_POSITIONS = /* @__PURE__ */ new Set(["above", "below", "anchor"]);
var MAX_LABEL_LENGTH = 128;
var VALID_ALERT_SEVERITIES = /* @__PURE__ */ new Set(["info", "warning", "critical"]);
var VALID_LOG_LEVELS = /* @__PURE__ */ new Set(["info", "warn", "error"]);
var VALID_ALERT_CHANNELS = /* @__PURE__ */ new Set([
  "log",
  "toast",
  "webhook",
  "email",
  "sms",
  "push"
]);
var VALID_DIAGNOSTIC_SEVERITIES = /* @__PURE__ */ new Set(["info", "warning", "error"]);
var VALID_DRAWING_KINDS = new Set(DRAWING_KINDS);
var VALID_DRAWING_OPS = /* @__PURE__ */ new Set(["create", "update", "remove"]);
var VALID_DIAGNOSTIC_CODES = /* @__PURE__ */ new Set([
  "unsupported-plot-kind",
  "unsupported-drawing-kind",
  "unsupported-alert-channel",
  "unsupported-pane",
  "unsupported-interval",
  "multi-timeframe-not-supported",
  "unknown-secondary-stream",
  "lookback-exceeded",
  "drawing-budget-exceeded",
  "dropped-by-policy",
  "input-coercion-failed",
  "alert-conditions-not-supported",
  "unknown-alert-condition",
  "alert-rate-limited",
  "runtime-cpu-budget-exceeded",
  "runtime-memory-budget-exceeded",
  "runtime-log-budget-exceeded",
  "malformed-log-meta",
  "runtime-error-thrown",
  "session-info-missing",
  "fixed-range-inverted",
  "state-snapshot-restored",
  "state-snapshot-future-dated",
  "state-snapshot-malformed",
  "state-snapshot-save-failed",
  "malformed-emission",
  "dep-error",
  "dep-cycle",
  "dep-unknown-output",
  "dep-invalid-input-override",
  "dep-dynamic",
  "dep-output-not-titled"
]);
function bad(message2, code = "malformed-emission") {
  return { ok: false, code, message: message2 };
}
function isPlainObject(v) {
  if (typeof v !== "object" || v === null)
    return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function isNonNegativeInteger(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}
function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}
function walkMeta(v, path2) {
  if (v === null)
    return { ok: true };
  const t = typeof v;
  if (t === "boolean" || t === "string")
    return { ok: true };
  if (t === "number") {
    if (!Number.isFinite(v)) {
      return bad(`${path2}: non-finite number`);
    }
    return { ok: true };
  }
  if (t === "undefined")
    return bad(`${path2}: undefined values are forbidden`);
  if (t === "bigint")
    return bad(`${path2}: bigint is forbidden`);
  if (t === "function")
    return bad(`${path2}: function is forbidden`);
  if (t === "symbol")
    return bad(`${path2}: symbol is forbidden`);
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = walkMeta(v[i], `${path2}[${i}]`);
      if (!r.ok)
        return r;
    }
    return { ok: true };
  }
  if (!isPlainObject(v)) {
    return bad(`${path2}: only plain objects are allowed`);
  }
  for (const key of Object.keys(v)) {
    let child;
    try {
      child = Reflect.get(v, key);
    } catch {
      return bad(`${path2}.${key}: getter threw during traversal`);
    }
    const r = walkMeta(child, `${path2}.${key}`);
    if (!r.ok)
      return r;
  }
  return { ok: true };
}
function validateLineLikeStyle(style) {
  const lineWidth = style.lineWidth;
  if (!isFiniteNumber(lineWidth) || lineWidth <= 0) {
    return bad("style.lineWidth: must be a finite positive number");
  }
  const lineStyle = style.lineStyle;
  if (typeof lineStyle !== "string" || !VALID_LINE_STYLES.has(lineStyle)) {
    return bad(`style.lineStyle: '${String(lineStyle)}' is not a valid line style`);
  }
  return { ok: true };
}
function validateAreaStyle(style) {
  const lineCheck = validateLineLikeStyle(style);
  if (!lineCheck.ok)
    return lineCheck;
  const fillAlpha = style.fillAlpha;
  if (!isFiniteNumber(fillAlpha) || fillAlpha < 0 || fillAlpha > 1) {
    return bad("style.fillAlpha: must be a finite number in [0, 1]");
  }
  return { ok: true };
}
function validateHistogramStyle(style) {
  const baseline = style.baseline;
  if (!isFiniteNumber(baseline)) {
    return bad("style.baseline: must be a finite number");
  }
  return { ok: true };
}
function validateFilledBandStyle(style) {
  const upper = style.upper;
  if (upper !== null && !isFiniteNumber(upper)) {
    return bad("style.upper: must be a finite number or null");
  }
  const lower = style.lower;
  if (lower !== null && !isFiniteNumber(lower)) {
    return bad("style.lower: must be a finite number or null");
  }
  if (upper === null && lower === null) {
    return bad("style.upper / style.lower: at least one bound must be non-null");
  }
  const alpha = style.alpha;
  if (!isFiniteNumber(alpha) || alpha < 0 || alpha > 1) {
    return bad("style.alpha: must be a finite number in [0, 1]");
  }
  return { ok: true };
}
function validateLabelStyle(style) {
  const text2 = style.text;
  if (typeof text2 !== "string" || text2.length === 0) {
    return bad("style.text: must be a non-empty string");
  }
  if (text2.length > MAX_LABEL_LENGTH) {
    return bad(`style.text: must be at most ${MAX_LABEL_LENGTH} characters`);
  }
  const position = style.position;
  if (typeof position !== "string" || !VALID_LABEL_POSITIONS.has(position)) {
    return bad(`style.position: '${String(position)}' is not a valid label position`);
  }
  return { ok: true };
}
function validateMarkerStyle(style) {
  const shape = style.shape;
  if (typeof shape !== "string" || !VALID_MARKER_SHAPES.has(shape)) {
    return bad(`style.shape: '${String(shape)}' is not a valid marker shape`);
  }
  const size = style.size;
  if (!isFiniteNumber(size) || size <= 0) {
    return bad("style.size: must be a finite positive number");
  }
  return { ok: true };
}
function validateOptionalLocation(style) {
  const location = style.location;
  if (location !== void 0 && (typeof location !== "string" || !VALID_PLOT_LOCATIONS.has(location))) {
    return bad(`style.location: '${String(location)}' is not a valid plot location`);
  }
  return { ok: true };
}
function validatePlotShapeStyle(style) {
  const shape = style.shape;
  if (typeof shape !== "string" || !VALID_SHAPE_GLYPHS.has(shape)) {
    return bad(`style.shape: '${String(shape)}' is not a valid shape glyph`);
  }
  const size = style.size;
  if (!isFiniteNumber(size) || size <= 0) {
    return bad("style.size: must be a finite positive number");
  }
  return validateOptionalLocation(style);
}
function validateCharacterStyle(style) {
  const char = style.char;
  if (typeof char !== "string" || char.length === 0) {
    return bad("style.char: must be a non-empty string");
  }
  const size = style.size;
  if (!isFiniteNumber(size) || size <= 0) {
    return bad("style.size: must be a finite positive number");
  }
  return validateOptionalLocation(style);
}
function validateArrowStyle(style) {
  const direction = style.direction;
  if (typeof direction !== "string" || !VALID_ARROW_DIRECTIONS.has(direction)) {
    return bad(`style.direction: '${String(direction)}' is not a valid arrow direction`);
  }
  const size = style.size;
  if (!isFiniteNumber(size) || size <= 0) {
    return bad("style.size: must be a finite positive number");
  }
  return { ok: true };
}
function validateColor(value, path2) {
  if (typeof value !== "string" || value.length === 0) {
    return bad(`${path2}: must be a non-empty string`);
  }
  return { ok: true };
}
function validateCandleOverrideStyle(style) {
  const bull = validateColor(style.bull, "style.bull");
  if (!bull.ok)
    return bull;
  const bear = validateColor(style.bear, "style.bear");
  if (!bear.ok)
    return bear;
  if (style.doji !== void 0) {
    return validateColor(style.doji, "style.doji");
  }
  return { ok: true };
}
function validateSingleColorStyle(style, path2) {
  return validateColor(style.color, path2);
}
function validateBgColorStyle(style) {
  const color2 = validateSingleColorStyle(style, "style.color");
  if (!color2.ok)
    return color2;
  const transp = style.transp;
  if (transp !== void 0 && (!isFiniteNumber(transp) || transp < 0 || transp > 100)) {
    return bad("style.transp: must be a finite number in [0, 100]");
  }
  return { ok: true };
}
function validateHorizontalHistogramStyle(style) {
  const buckets = style.buckets;
  if (!Array.isArray(buckets)) {
    return bad("style.buckets: must be an array");
  }
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    if (!isPlainObject(bucket)) {
      return bad(`style.buckets[${i}]: must be an object`);
    }
    if (!isFiniteNumber(bucket.price)) {
      return bad(`style.buckets[${i}].price: must be a finite number`);
    }
    if (!isFiniteNumber(bucket.volume) || bucket.volume < 0) {
      return bad(`style.buckets[${i}].volume: must be a finite non-negative number`);
    }
    if (bucket.color !== void 0) {
      const color2 = validateColor(bucket.color, `style.buckets[${i}].color`);
      if (!color2.ok)
        return color2;
    }
  }
  return { ok: true };
}
function validatePlotStyle(style) {
  if (!isPlainObject(style))
    return bad("style: not an object");
  const kind = style.kind;
  if (typeof kind !== "string" || !VALID_PLOT_STYLE_KINDS.has(kind)) {
    return bad(`style.kind: '${String(kind)}' is not a known plot kind`);
  }
  switch (kind) {
    case "line":
    case "step-line":
    case "horizontal-line":
      return validateLineLikeStyle(style);
    case "histogram":
      return validateHistogramStyle(style);
    case "area":
      return validateAreaStyle(style);
    case "filled-band":
      return validateFilledBandStyle(style);
    case "label":
      return validateLabelStyle(style);
    case "marker":
      return validateMarkerStyle(style);
    case "shape":
      return validatePlotShapeStyle(style);
    case "character":
      return validateCharacterStyle(style);
    case "arrow":
      return validateArrowStyle(style);
    case "candle-override":
      return validateCandleOverrideStyle(style);
    case "bar-override":
    case "bar-color":
      return validateSingleColorStyle(style, "style.color");
    case "bg-color":
      return validateBgColorStyle(style);
    case "horizontal-histogram":
      return validateHorizontalHistogramStyle(style);
    /* v8 ignore next 2 -- kind is already gated by VALID_PLOT_STYLE_KINDS */
    default:
      return bad(`style.kind: '${kind}' has no validator`);
  }
}
function validatePlotEmission(e) {
  if (!isNonEmptyString(e.slotId))
    return bad("plot.slotId: must be a non-empty string");
  if (typeof e.title !== "string")
    return bad("plot.title: must be a string");
  const styleResult = validatePlotStyle(e.style);
  if (!styleResult.ok)
    return styleResult;
  if (!isNonNegativeInteger(e.bar)) {
    return bad("plot.bar: must be a non-negative integer");
  }
  if (!isFiniteNumber(e.time))
    return bad("plot.time: must be a finite number");
  const value = e.value;
  if (value !== null && !isFiniteNumber(value)) {
    return bad("plot.value: must be a finite number or null");
  }
  const color2 = e.color;
  if (color2 !== null && typeof color2 !== "string") {
    return bad("plot.color: must be a string or null");
  }
  if (!isPlainObject(e.meta))
    return bad("plot.meta: must be a plain object");
  const metaResult = walkMeta(e.meta, "plot.meta");
  if (!metaResult.ok)
    return metaResult;
  if (typeof e.pane !== "string")
    return bad("plot.pane: must be a string");
  if (e.visible !== void 0 && typeof e.visible !== "boolean") {
    return bad("plot.visible: must be a boolean");
  }
  return { ok: true };
}
function validateAlertEmission(e) {
  if (!isNonEmptyString(e.slotId))
    return bad("alert.slotId: must be a non-empty string");
  const severity = e.severity;
  if (typeof severity !== "string" || !VALID_ALERT_SEVERITIES.has(severity)) {
    return bad(`alert.severity: '${String(severity)}' is not a valid severity`);
  }
  if (!isNonEmptyString(e.message)) {
    return bad("alert.message: must be a non-empty string");
  }
  if (!isNonNegativeInteger(e.bar)) {
    return bad("alert.bar: must be a non-negative integer");
  }
  if (!isFiniteNumber(e.time))
    return bad("alert.time: must be a finite number");
  if (!isPlainObject(e.meta))
    return bad("alert.meta: must be a plain object");
  const metaResult = walkMeta(e.meta, "alert.meta");
  if (!metaResult.ok)
    return metaResult;
  const channels = e.channels;
  if (!Array.isArray(channels))
    return bad("alert.channels: must be an array");
  for (let i = 0; i < channels.length; i++) {
    const c = channels[i];
    if (typeof c !== "string" || !VALID_ALERT_CHANNELS.has(c)) {
      return bad(`alert.channels[${i}]: '${String(c)}' is not a valid alert channel`);
    }
  }
  if (!isNonEmptyString(e.dedupeKey)) {
    return bad("alert.dedupeKey: must be a non-empty string");
  }
  return { ok: true };
}
function validateAlertConditionEmission(e) {
  if (!isNonEmptyString(e.conditionId)) {
    return bad("alert-condition.conditionId: must be a non-empty string");
  }
  if (typeof e.title !== "string") {
    return bad("alert-condition.title: must be a string");
  }
  if (typeof e.description !== "string") {
    return bad("alert-condition.description: must be a string");
  }
  if (typeof e.defaultMessage !== "string") {
    return bad("alert-condition.defaultMessage: must be a string");
  }
  if (typeof e.fired !== "boolean") {
    return bad("alert-condition.fired: must be a boolean");
  }
  if (!isNonNegativeInteger(e.bar)) {
    return bad("alert-condition.bar: must be a non-negative integer");
  }
  if (!isFiniteNumber(e.time)) {
    return bad("alert-condition.time: must be a finite number");
  }
  return { ok: true };
}
function validateLogEmission(e) {
  const level = e.level;
  if (typeof level !== "string" || !VALID_LOG_LEVELS.has(level)) {
    return bad(`log.level: '${String(level)}' is not a valid log level`);
  }
  if (!isNonEmptyString(e.message)) {
    return bad("log.message: must be a non-empty string");
  }
  const meta = e.meta;
  if (meta !== void 0) {
    if (!isPlainObject(meta))
      return bad("log.meta: must be a plain object");
    const metaResult = walkMeta(meta, "log.meta");
    if (!metaResult.ok)
      return metaResult;
  }
  if (!isNonNegativeInteger(e.bar)) {
    return bad("log.bar: must be a non-negative integer");
  }
  if (!isFiniteNumber(e.time)) {
    return bad("log.time: must be a finite number");
  }
  return { ok: true };
}
function isWorldPoint(v) {
  if (!isPlainObject(v))
    return false;
  return isFiniteNumber(v.time) && isFiniteNumber(v.price);
}
function validateAnchorFixed(v, path2, count) {
  if (!Array.isArray(v) || v.length !== count) {
    return bad(`${path2}: must be a ${count}-element WorldPoint tuple`);
  }
  for (let i = 0; i < count; i++) {
    if (!isWorldPoint(v[i])) {
      return bad(`${path2}[${i}]: not a WorldPoint (need finite time + price)`);
    }
  }
  return { ok: true };
}
function validateAnchorPair(v, path2) {
  return validateAnchorFixed(v, path2, 2);
}
function validateAnchorTriple(v, path2) {
  return validateAnchorFixed(v, path2, 3);
}
function validateAnchorQuad(v, path2) {
  return validateAnchorFixed(v, path2, 4);
}
function validateAnchorQuint(v, path2) {
  return validateAnchorFixed(v, path2, 5);
}
function validateAnchorHept(v, path2) {
  return validateAnchorFixed(v, path2, 7);
}
function validateOptionalLabels(v, path2, expectedCount) {
  if (v === void 0)
    return { ok: true };
  if (!Array.isArray(v) || v.length !== expectedCount) {
    return bad(`${path2}: must be an array of ${expectedCount} strings`);
  }
  for (let i = 0; i < expectedCount; i++) {
    if (typeof v[i] !== "string") {
      return bad(`${path2}[${i}]: must be a string`);
    }
  }
  return { ok: true };
}
function validateAnchorVariable(v, path2, min, max) {
  if (!Array.isArray(v) || v.length < min || v.length > max) {
    return bad(`${path2}: must be an array of ${min}..${max} WorldPoints`);
  }
  for (let i = 0; i < v.length; i++) {
    if (!isWorldPoint(v[i])) {
      return bad(`${path2}[${i}]: not a WorldPoint (need finite time + price)`);
    }
  }
  return { ok: true };
}
function validateLineDrawStyle(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.color !== void 0 && typeof s.color !== "string") {
    return bad(`${path2}.color: must be a string`);
  }
  if (s.lineWidth !== void 0 && (!isFiniteNumber(s.lineWidth) || s.lineWidth <= 0)) {
    return bad(`${path2}.lineWidth: must be a finite positive number`);
  }
  if (s.lineStyle !== void 0 && !VALID_LINE_STYLES.has(String(s.lineStyle))) {
    return bad(`${path2}.lineStyle: '${String(s.lineStyle)}' is not a valid line style`);
  }
  if (s.extendLeft !== void 0 && typeof s.extendLeft !== "boolean") {
    return bad(`${path2}.extendLeft: must be a boolean`);
  }
  if (s.extendRight !== void 0 && typeof s.extendRight !== "boolean") {
    return bad(`${path2}.extendRight: must be a boolean`);
  }
  return { ok: true };
}
function validateShapeStyle(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.stroke !== void 0 && typeof s.stroke !== "string") {
    return bad(`${path2}.stroke: must be a string`);
  }
  if (s.fill !== void 0 && typeof s.fill !== "string") {
    return bad(`${path2}.fill: must be a string`);
  }
  if (s.lineWidth !== void 0 && (!isFiniteNumber(s.lineWidth) || s.lineWidth <= 0)) {
    return bad(`${path2}.lineWidth: must be a finite positive number`);
  }
  if (s.lineStyle !== void 0 && !VALID_LINE_STYLES.has(String(s.lineStyle))) {
    return bad(`${path2}.lineStyle: '${String(s.lineStyle)}' is not a valid line style`);
  }
  if (s.fillAlpha !== void 0 && (!isFiniteNumber(s.fillAlpha) || s.fillAlpha < 0 || s.fillAlpha > 1)) {
    return bad(`${path2}.fillAlpha: must be a finite number in [0, 1]`);
  }
  return { ok: true };
}
function validateDrawingMeta(state2) {
  if (state2.name !== void 0 && typeof state2.name !== "string") {
    return bad("drawing.state.name: must be a string");
  }
  if (state2.visible !== void 0 && typeof state2.visible !== "boolean") {
    return bad("drawing.state.visible: must be a boolean");
  }
  return { ok: true };
}
function validateLineState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateHorizontalLineState(state2) {
  if (!isFiniteNumber(state2.price))
    return bad("drawing.state.price: must be a finite number");
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateHorizontalRayState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateVerticalLineState(state2) {
  if (!isFiniteNumber(state2.time))
    return bad("drawing.state.time: must be a finite number");
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateCrossLineState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateTrendAngleState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateRectangleState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateShapeStyle(state2.style, "drawing.state.style");
}
function validateRotatedRectangleState(state2) {
  const anchorsCheck = validateAnchorQuad(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateShapeStyle(state2.style, "drawing.state.style");
}
function validateTriangleState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateShapeStyle(state2.style, "drawing.state.style");
}
var POLYLINE_MIN_ANCHORS = 3;
var POLYLINE_MAX_ANCHORS = 20;
function validatePolylineState(state2) {
  const anchorsCheck = validateAnchorVariable(state2.anchors, "drawing.state.anchors", POLYLINE_MIN_ANCHORS, POLYLINE_MAX_ANCHORS);
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateCircleState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateShapeStyle(state2.style, "drawing.state.style");
}
function validateEllipseState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateShapeStyle(state2.style, "drawing.state.style");
}
function validatePathOpts(s, path2) {
  const lineCheck = validateLineDrawStyle(s, path2);
  if (!lineCheck.ok)
    return lineCheck;
  const obj = s;
  if (obj.closed !== void 0 && typeof obj.closed !== "boolean") {
    return bad(`${path2}.closed: must be a boolean`);
  }
  return { ok: true };
}
var PATH_MIN_ANCHORS = 2;
var PATH_MAX_ANCHORS = 20;
function validatePathState(state2) {
  const anchorsCheck = validateAnchorVariable(state2.anchors, "drawing.state.anchors", PATH_MIN_ANCHORS, PATH_MAX_ANCHORS);
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validatePathOpts(state2.style, "drawing.state.style");
}
var VALID_TEXT_SIZES = /* @__PURE__ */ new Set(["tiny", "small", "normal", "large", "huge"]);
var VALID_TEXT_HALIGN = /* @__PURE__ */ new Set(["left", "center", "right"]);
var VALID_TEXT_VALIGN = /* @__PURE__ */ new Set(["top", "middle", "bottom"]);
var VALID_TABLE_POSITIONS = /* @__PURE__ */ new Set([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
]);
function validateTextOpts(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.color !== void 0 && typeof s.color !== "string") {
    return bad(`${path2}.color: must be a string`);
  }
  if (s.size !== void 0 && !VALID_TEXT_SIZES.has(String(s.size))) {
    return bad(`${path2}.size: '${String(s.size)}' is not a valid text size`);
  }
  if (s.halign !== void 0 && !VALID_TEXT_HALIGN.has(String(s.halign))) {
    return bad(`${path2}.halign: '${String(s.halign)}' is not a valid halign`);
  }
  if (s.valign !== void 0 && !VALID_TEXT_VALIGN.has(String(s.valign))) {
    return bad(`${path2}.valign: '${String(s.valign)}' is not a valid valign`);
  }
  if (s.bgColor !== void 0 && typeof s.bgColor !== "string") {
    return bad(`${path2}.bgColor: must be a string`);
  }
  return { ok: true };
}
function validateMarkerState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  if (state2.text !== void 0 && typeof state2.text !== "string") {
    return bad("drawing.state.text: must be a string");
  }
  if (state2.value !== void 0 && !isFiniteNumber(state2.value)) {
    return bad("drawing.state.value: must be a finite number");
  }
  return validateTextOpts(state2.style, "drawing.state.style");
}
var FREEHAND_MIN_ANCHORS = 2;
var FREEHAND_MAX_ANCHORS = 500;
function validateHighlighterStyle(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (typeof s.color !== "string")
    return bad(`${path2}.color: must be a string`);
  if (!isFiniteNumber(s.alpha) || s.alpha < 0 || s.alpha > 1) {
    return bad(`${path2}.alpha: must be a finite number in [0, 1]`);
  }
  return { ok: true };
}
function validateBrushStyle(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (typeof s.stroke !== "string")
    return bad(`${path2}.stroke: must be a string`);
  if (typeof s.fill !== "string")
    return bad(`${path2}.fill: must be a string`);
  return { ok: true };
}
function validateArcState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateCurveState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateDoubleCurveState(state2) {
  const anchorsCheck = validateAnchorQuint(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validatePenState(state2) {
  const anchorsCheck = validateAnchorVariable(state2.anchors, "drawing.state.anchors", FREEHAND_MIN_ANCHORS, FREEHAND_MAX_ANCHORS);
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateHighlighterState(state2) {
  const anchorsCheck = validateAnchorVariable(state2.anchors, "drawing.state.anchors", FREEHAND_MIN_ANCHORS, FREEHAND_MAX_ANCHORS);
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateHighlighterStyle(state2.style, "drawing.state.style");
}
function validateBrushState(state2) {
  const anchorsCheck = validateAnchorVariable(state2.anchors, "drawing.state.anchors", FREEHAND_MIN_ANCHORS, FREEHAND_MAX_ANCHORS);
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateBrushStyle(state2.style, "drawing.state.style");
}
var TEXT_BODY_MAX_LENGTH = 256;
function validateArrowOpts(s, path2) {
  const lineCheck = validateLineDrawStyle(s, path2);
  if (!lineCheck.ok)
    return lineCheck;
  const obj = s;
  if (obj.label !== void 0 && typeof obj.label !== "string") {
    return bad(`${path2}.label: must be a string`);
  }
  return { ok: true };
}
function validateArrowMarkerOpts(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.color !== void 0 && typeof s.color !== "string") {
    return bad(`${path2}.color: must be a string`);
  }
  if (s.text !== void 0 && typeof s.text !== "string") {
    return bad(`${path2}.text: must be a string`);
  }
  return { ok: true };
}
function validateTextState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  const bodyMetaCheck = walkMeta(state2.body, "drawing.state.body");
  if (!bodyMetaCheck.ok)
    return bodyMetaCheck;
  if (typeof state2.body !== "string") {
    return bad("drawing.state.body: must be a string");
  }
  if (state2.body.length === 0) {
    return bad("drawing.state.body: must be a non-empty string");
  }
  if (state2.body.length > TEXT_BODY_MAX_LENGTH) {
    return bad(`drawing.state.body: must be at most ${TEXT_BODY_MAX_LENGTH} characters`);
  }
  return validateTextOpts(state2.style, "drawing.state.style");
}
function validateArrowState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateArrowOpts(state2.style, "drawing.state.style");
}
function validateArrowMarkerState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  return validateArrowMarkerOpts(state2.style, "drawing.state.style");
}
function validateArrowMarkUpState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  return validateArrowMarkerOpts(state2.style, "drawing.state.style");
}
function validateArrowMarkDownState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  return validateArrowMarkerOpts(state2.style, "drawing.state.style");
}
var VALID_REGRESSION_SOURCES = /* @__PURE__ */ new Set([
  "close",
  "open",
  "high",
  "low",
  "hl2",
  "hlc3",
  "ohlc4",
  "hlcc4"
]);
function validateRegressionTrendOpts(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.source !== void 0 && !VALID_REGRESSION_SOURCES.has(String(s.source))) {
    return bad(`${path2}.source: '${String(s.source)}' is not a valid source`);
  }
  if (s.stdevMultiplier !== void 0) {
    if (!isFiniteNumber(s.stdevMultiplier) || s.stdevMultiplier < 0) {
      return bad(`${path2}.stdevMultiplier: must be a non-negative finite number`);
    }
  }
  if (s.showUpperBand !== void 0 && typeof s.showUpperBand !== "boolean") {
    return bad(`${path2}.showUpperBand: must be a boolean`);
  }
  if (s.showLowerBand !== void 0 && typeof s.showLowerBand !== "boolean") {
    return bad(`${path2}.showLowerBand: must be a boolean`);
  }
  if (s.color !== void 0 && typeof s.color !== "string") {
    return bad(`${path2}.color: must be a string`);
  }
  return { ok: true };
}
function validateTrendChannelState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateFlatTopBottomState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateDisjointChannelState(state2) {
  const anchorsCheck = validateAnchorQuad(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateRegressionTrendState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const anchors = state2.anchors;
  if (!(anchors[0].time < anchors[1].time)) {
    return bad("drawing.state.anchors: anchors[0].time must be < anchors[1].time");
  }
  return validateRegressionTrendOpts(state2.style, "drawing.state.style");
}
function validateFibOpts(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.levels !== void 0) {
    if (!Array.isArray(s.levels)) {
      return bad(`${path2}.levels: must be an array of finite numbers`);
    }
    if (s.levels.length === 0) {
      return bad(`${path2}.levels: must contain at least one level`);
    }
    for (let i = 0; i < s.levels.length; i++) {
      if (!isFiniteNumber(s.levels[i])) {
        return bad(`${path2}.levels[${i}]: must be a finite number`);
      }
    }
  }
  if (s.showLabels !== void 0 && typeof s.showLabels !== "boolean") {
    return bad(`${path2}.showLabels: must be a boolean`);
  }
  if (s.color !== void 0 && typeof s.color !== "string") {
    return bad(`${path2}.color: must be a string`);
  }
  if (s.extendLeft !== void 0 && typeof s.extendLeft !== "boolean") {
    return bad(`${path2}.extendLeft: must be a boolean`);
  }
  if (s.extendRight !== void 0 && typeof s.extendRight !== "boolean") {
    return bad(`${path2}.extendRight: must be a boolean`);
  }
  return { ok: true };
}
function validateFibRetracementState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibTrendExtensionState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibChannelState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibTimeZoneState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibWedgeState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibSpeedFanState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibSpeedArcsState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibSpiralState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibCirclesState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateFibTrendTimeState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateFibOpts(state2.style, "drawing.state.style");
}
function validateGannBoxState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateGannSquareFixedState(state2) {
  if (!isWorldPoint(state2.anchor))
    return bad("drawing.state.anchor: not a WorldPoint");
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateGannSquareState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateGannFanState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
var PITCHFORK_VARIANTS = /* @__PURE__ */ new Set([
  "standard",
  "schiff",
  "modifiedSchiff",
  "inside"
]);
function validatePitchforkState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  if (typeof state2.variant !== "string" || !PITCHFORK_VARIANTS.has(state2.variant)) {
    return bad(`drawing.state.variant: '${String(state2.variant)}' must be 'standard' | 'schiff' | 'modifiedSchiff' | 'inside'`);
  }
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validatePitchfanState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateXabcdPatternState(state2) {
  const anchorsCheck = validateAnchorQuint(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateCypherPatternState(state2) {
  const anchorsCheck = validateAnchorQuint(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateHeadAndShouldersState(state2) {
  const anchorsCheck = validateAnchorQuint(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateAbcdPatternState(state2) {
  const anchorsCheck = validateAnchorQuad(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateTrianglePatternState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateThreeDrivesPatternState(state2) {
  const anchorsCheck = validateAnchorHept(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateElliottImpulseWaveState(state2) {
  const anchorsCheck = validateAnchorQuint(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const labelsCheck = validateOptionalLabels(state2.labels, "drawing.state.labels", 5);
  if (!labelsCheck.ok)
    return labelsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateElliottCorrectionWaveState(state2) {
  const anchorsCheck = validateAnchorTriple(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const labelsCheck = validateOptionalLabels(state2.labels, "drawing.state.labels", 3);
  if (!labelsCheck.ok)
    return labelsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateElliottTriangleWaveState(state2) {
  const anchorsCheck = validateAnchorQuint(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const labelsCheck = validateOptionalLabels(state2.labels, "drawing.state.labels", 5);
  if (!labelsCheck.ok)
    return labelsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateElliottDoubleComboState(state2) {
  const anchorsCheck = validateAnchorHept(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const labelsCheck = validateOptionalLabels(state2.labels, "drawing.state.labels", 7);
  if (!labelsCheck.ok)
    return labelsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateElliottTripleComboState(state2) {
  const anchorsCheck = validateAnchorHept(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const labelsCheck = validateOptionalLabels(state2.labels, "drawing.state.labels", 7);
  if (!labelsCheck.ok)
    return labelsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateCyclicLinesState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateTimeCyclesState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
function validateSineLineState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  return validateLineDrawStyle(state2.style, "drawing.state.style");
}
var MAX_CHILD_HANDLE_IDS = 100;
function validateChildHandleIds(v, path2) {
  if (!Array.isArray(v)) {
    return bad(`${path2}: must be an array of handle id strings`);
  }
  if (v.length > MAX_CHILD_HANDLE_IDS) {
    return bad(`${path2}: must be at most ${MAX_CHILD_HANDLE_IDS} entries`);
  }
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string") {
      return bad(`${path2}[${i}]: must be a string`);
    }
  }
  return { ok: true };
}
function validateFrameOpts(s, path2) {
  if (!isPlainObject(s))
    return bad(`${path2}: must be a plain object`);
  if (s.label !== void 0 && typeof s.label !== "string") {
    return bad(`${path2}.label: must be a string`);
  }
  if (s.bgColor !== void 0 && typeof s.bgColor !== "string") {
    return bad(`${path2}.bgColor: must be a string`);
  }
  return { ok: true };
}
function validateGroupState(state2) {
  return validateChildHandleIds(state2.childHandleIds, "drawing.state.childHandleIds");
}
function validateFrameState(state2) {
  const anchorsCheck = validateAnchorPair(state2.anchors, "drawing.state.anchors");
  if (!anchorsCheck.ok)
    return anchorsCheck;
  const childCheck = validateChildHandleIds(state2.childHandleIds, "drawing.state.childHandleIds");
  if (!childCheck.ok)
    return childCheck;
  return validateFrameOpts(state2.style, "drawing.state.style");
}
function validateTableCell(cell, path2) {
  if (!isPlainObject(cell))
    return bad(`${path2}: must be a plain object`);
  if (typeof cell.text !== "string")
    return bad(`${path2}.text: must be a string`);
  if (cell.bgColor !== void 0 && typeof cell.bgColor !== "string") {
    return bad(`${path2}.bgColor: must be a string`);
  }
  if (cell.textColor !== void 0 && typeof cell.textColor !== "string") {
    return bad(`${path2}.textColor: must be a string`);
  }
  if (cell.textHalign !== void 0 && !VALID_TEXT_HALIGN.has(String(cell.textHalign))) {
    return bad(`${path2}.textHalign: '${String(cell.textHalign)}' is not a valid halign`);
  }
  if (cell.textValign !== void 0 && !VALID_TEXT_VALIGN.has(String(cell.textValign))) {
    return bad(`${path2}.textValign: '${String(cell.textValign)}' is not a valid valign`);
  }
  if (cell.textSize !== void 0 && !VALID_TEXT_SIZES.has(String(cell.textSize))) {
    return bad(`${path2}.textSize: '${String(cell.textSize)}' is not a valid text size`);
  }
  return { ok: true };
}
function validateTableState(state2) {
  const position = state2.position;
  if (typeof position !== "string" || !VALID_TABLE_POSITIONS.has(position)) {
    return bad(`drawing.state.position: '${String(position)}' is not a valid table position`);
  }
  const cells = state2.cells;
  if (!Array.isArray(cells) || cells.length === 0) {
    return bad("drawing.state.cells: must be a non-empty 2D array");
  }
  for (let rowIndex = 0; rowIndex < cells.length; rowIndex++) {
    const row = cells[rowIndex];
    if (!Array.isArray(row) || row.length === 0) {
      return bad(`drawing.state.cells[${rowIndex}]: must be a non-empty array`);
    }
    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const cellCheck = validateTableCell(row[columnIndex], `drawing.state.cells[${rowIndex}][${columnIndex}]`);
      if (!cellCheck.ok)
        return cellCheck;
    }
  }
  const hasBorderColor = state2.borderColor !== void 0;
  const hasBorderWidth = state2.borderWidth !== void 0;
  if (hasBorderColor !== hasBorderWidth) {
    return bad("drawing.state.borderColor/borderWidth: must be provided together");
  }
  if (hasBorderColor) {
    const colorCheck = validateColor(state2.borderColor, "drawing.state.borderColor");
    if (!colorCheck.ok)
      return colorCheck;
    if (!isFiniteNumber(state2.borderWidth) || state2.borderWidth <= 0) {
      return bad("drawing.state.borderWidth: must be a finite positive number");
    }
  }
  if (state2.frame !== void 0) {
    if (!isPlainObject(state2.frame))
      return bad("drawing.state.frame: must be a plain object");
    const colorCheck = validateColor(state2.frame.color, "drawing.state.frame.color");
    if (!colorCheck.ok)
      return colorCheck;
    if (!isFiniteNumber(state2.frame.width) || state2.frame.width <= 0) {
      return bad("drawing.state.frame.width: must be a finite positive number");
    }
  }
  return { ok: true };
}
function validateStateByKind(kind, state2) {
  switch (kind) {
    case "line":
      return validateLineState(state2);
    case "horizontal-line":
      return validateHorizontalLineState(state2);
    case "horizontal-ray":
      return validateHorizontalRayState(state2);
    case "vertical-line":
      return validateVerticalLineState(state2);
    case "cross-line":
      return validateCrossLineState(state2);
    case "trend-angle":
      return validateTrendAngleState(state2);
    case "rectangle":
      return validateRectangleState(state2);
    case "rotated-rectangle":
      return validateRotatedRectangleState(state2);
    case "triangle":
      return validateTriangleState(state2);
    case "polyline":
      return validatePolylineState(state2);
    case "circle":
      return validateCircleState(state2);
    case "ellipse":
      return validateEllipseState(state2);
    case "path":
      return validatePathState(state2);
    case "marker":
      return validateMarkerState(state2);
    case "arc":
      return validateArcState(state2);
    case "curve":
      return validateCurveState(state2);
    case "double-curve":
      return validateDoubleCurveState(state2);
    case "pen":
      return validatePenState(state2);
    case "highlighter":
      return validateHighlighterState(state2);
    case "brush":
      return validateBrushState(state2);
    case "text":
      return validateTextState(state2);
    case "arrow":
      return validateArrowState(state2);
    case "arrow-marker":
      return validateArrowMarkerState(state2);
    case "arrow-mark-up":
      return validateArrowMarkUpState(state2);
    case "arrow-mark-down":
      return validateArrowMarkDownState(state2);
    case "trend-channel":
      return validateTrendChannelState(state2);
    case "flat-top-bottom":
      return validateFlatTopBottomState(state2);
    case "disjoint-channel":
      return validateDisjointChannelState(state2);
    case "regression-trend":
      return validateRegressionTrendState(state2);
    case "fib-retracement":
      return validateFibRetracementState(state2);
    case "fib-trend-extension":
      return validateFibTrendExtensionState(state2);
    case "fib-channel":
      return validateFibChannelState(state2);
    case "fib-time-zone":
      return validateFibTimeZoneState(state2);
    case "fib-wedge":
      return validateFibWedgeState(state2);
    case "fib-speed-fan":
      return validateFibSpeedFanState(state2);
    case "fib-speed-arcs":
      return validateFibSpeedArcsState(state2);
    case "fib-spiral":
      return validateFibSpiralState(state2);
    case "fib-circles":
      return validateFibCirclesState(state2);
    case "fib-trend-time":
      return validateFibTrendTimeState(state2);
    case "gann-box":
      return validateGannBoxState(state2);
    case "gann-square-fixed":
      return validateGannSquareFixedState(state2);
    case "gann-square":
      return validateGannSquareState(state2);
    case "gann-fan":
      return validateGannFanState(state2);
    case "pitchfork":
      return validatePitchforkState(state2);
    case "pitchfan":
      return validatePitchfanState(state2);
    case "xabcd-pattern":
      return validateXabcdPatternState(state2);
    case "cypher-pattern":
      return validateCypherPatternState(state2);
    case "head-and-shoulders":
      return validateHeadAndShouldersState(state2);
    case "abcd-pattern":
      return validateAbcdPatternState(state2);
    case "triangle-pattern":
      return validateTrianglePatternState(state2);
    case "three-drives-pattern":
      return validateThreeDrivesPatternState(state2);
    case "elliott-impulse-wave":
      return validateElliottImpulseWaveState(state2);
    case "elliott-correction-wave":
      return validateElliottCorrectionWaveState(state2);
    case "elliott-triangle-wave":
      return validateElliottTriangleWaveState(state2);
    case "elliott-double-combo":
      return validateElliottDoubleComboState(state2);
    case "elliott-triple-combo":
      return validateElliottTripleComboState(state2);
    case "cyclic-lines":
      return validateCyclicLinesState(state2);
    case "time-cycles":
      return validateTimeCyclesState(state2);
    case "sine-line":
      return validateSineLineState(state2);
    case "group":
      return validateGroupState(state2);
    case "frame":
      return validateFrameState(state2);
    case "table":
      return validateTableState(state2);
  }
}
function validateDrawingEmission(e) {
  if (!isNonEmptyString(e.handleId)) {
    return bad("drawing.handleId: must be a non-empty string");
  }
  const drawingKind = e.drawingKind;
  if (typeof drawingKind !== "string" || !VALID_DRAWING_KINDS.has(drawingKind)) {
    return {
      ok: false,
      code: "unsupported-drawing-kind",
      message: `drawing.drawingKind: '${String(drawingKind)}' is not a known DrawingKind`
    };
  }
  if (typeof e.op !== "string" || !VALID_DRAWING_OPS.has(e.op)) {
    return bad(`drawing.op: '${String(e.op)}' must be 'create' | 'update' | 'remove'`);
  }
  if (!isNonNegativeInteger(e.bar)) {
    return bad("drawing.bar: must be a non-negative integer");
  }
  if (!isFiniteNumber(e.time)) {
    return bad("drawing.time: must be a finite number");
  }
  const state2 = e.state;
  if (!isPlainObject(state2)) {
    return bad("drawing.state: must be a plain object");
  }
  if (state2.kind !== drawingKind) {
    return bad(`drawing.state.kind: '${String(state2.kind)}' must equal drawing.drawingKind '${drawingKind}'`);
  }
  const metaCheck = validateDrawingMeta(state2);
  if (!metaCheck.ok)
    return metaCheck;
  return validateStateByKind(drawingKind, state2);
}
function validateDiagnostic(e) {
  const severity = e.severity;
  if (typeof severity !== "string" || !VALID_DIAGNOSTIC_SEVERITIES.has(severity)) {
    return bad(`diagnostic.severity: '${String(severity)}' is not a valid severity`);
  }
  const code = e.code;
  if (typeof code !== "string" || !VALID_DIAGNOSTIC_CODES.has(code)) {
    return bad(`diagnostic.code: '${String(code)}' is not a known DiagnosticCode`);
  }
  if (typeof e.message !== "string")
    return bad("diagnostic.message: must be a string");
  const slotId = e.slotId;
  if (slotId !== null && typeof slotId !== "string") {
    return bad("diagnostic.slotId: must be a string or null");
  }
  const bar = e.bar;
  if (bar !== null && !isNonNegativeInteger(bar)) {
    return bad("diagnostic.bar: must be a non-negative integer or null");
  }
  return { ok: true };
}
function validateEmission(e) {
  if (!isPlainObject(e)) {
    return bad("emission: not a plain object");
  }
  if (!("kind" in e)) {
    return bad("emission: missing 'kind' discriminant");
  }
  const kind = e.kind;
  switch (kind) {
    case "plot":
      return validatePlotEmission(e);
    case "alert":
      return validateAlertEmission(e);
    case "alert-condition":
      return validateAlertConditionEmission(e);
    case "log":
      return validateLogEmission(e);
    case "drawing":
      return validateDrawingEmission(e);
    case "diagnostic":
      return validateDiagnostic(e);
    default:
      return bad(`emission.kind: '${String(kind)}' is not a known emission kind`);
  }
}

// ../runtime/dist/emit/emissionsQueue.js
function pushPlot(queue, e) {
  const result = validateEmission(e);
  if (!result.ok) {
    pushDiagnostic(queue, {
      kind: "diagnostic",
      severity: "warning",
      code: "malformed-emission",
      message: result.message,
      slotId: e.slotId,
      bar: e.bar
    });
    return;
  }
  for (let i = queue.plots.length - 1; i >= 0; i -= 1) {
    const existing = queue.plots[i];
    if (existing.slotId === e.slotId && existing.bar === e.bar) {
      queue.plots[i] = e;
      return;
    }
  }
  queue.plots.push(e);
}
function pushAlert(queue, e) {
  const result = validateEmission(e);
  if (!result.ok) {
    pushDiagnostic(queue, {
      kind: "diagnostic",
      severity: "warning",
      code: "malformed-emission",
      message: result.message,
      slotId: e.slotId,
      bar: e.bar
    });
    return;
  }
  for (let i = queue.alerts.length - 1; i >= 0; i -= 1) {
    const existing = queue.alerts[i];
    if (existing.slotId === e.slotId && existing.bar === e.bar) {
      queue.alerts[i] = e;
      return;
    }
  }
  queue.alerts.push(e);
}
function pushAlertCondition(queue, e) {
  const result = validateEmission(e);
  if (!result.ok) {
    pushDiagnostic(queue, {
      kind: "diagnostic",
      severity: "warning",
      code: "malformed-emission",
      message: result.message,
      slotId: null,
      bar: e.bar
    });
    return;
  }
  const target = queue.alertConditions ?? [];
  queue.alertConditions = target;
  target.push(e);
}
function pushLog(queue, e) {
  const result = validateEmission(e);
  if (!result.ok) {
    pushDiagnostic(queue, {
      kind: "diagnostic",
      severity: "warning",
      code: "malformed-emission",
      message: result.message,
      slotId: null,
      bar: e.bar
    });
    return;
  }
  queue.logs.push(e);
}
function pushDiagnostic(queue, d) {
  queue.diagnostics.push(d);
}

// ../runtime/dist/emit/paneResolver.js
var SANITISE_PANE_KEY = /[^a-zA-Z0-9_-]/g;
function resolveScriptPane(manifest) {
  const sanitised = manifest.name.replace(SANITISE_PANE_KEY, "-");
  return `script:${sanitised === "" ? "default" : sanitised}`;
}
function resolveDefaultPane(manifest) {
  return manifest.overlay === false ? resolveScriptPane(manifest) : "overlay";
}
function resolveNamedPane(pane, ctx, slotId) {
  if (ctx.capabilities.subPanes >= 1)
    return pane;
  pushDiagnostic(ctx.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code: "unsupported-pane",
    message: `Adapter declares subPanes: 0; pane "${pane}" folded to overlay.`,
    slotId,
    bar: ctx.barIndex()
  });
  return "overlay";
}
function resolvePane(requested, ctx, slotId) {
  if (requested === "overlay")
    return "overlay";
  if (requested === void 0)
    return ctx.defaultPane;
  if (requested === "new")
    return resolveNamedPane(ctx.scriptPane, ctx, slotId);
  return resolveNamedPane(requested, ctx, slotId);
}

// ../runtime/dist/ta/adl.js
function getCtx3() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.adl called outside an active script step");
  }
  return ctx;
}
function initSlot(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    cumAdl: 0,
    prevClosedCumAdl: 0
  };
}
function mfvAt(close, high, low, volume) {
  if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(volume)) {
    return 0;
  }
  const range = high - low;
  if (range === 0)
    return 0;
  const clv = (close - low - (high - close)) / range;
  return clv * volume;
}
function adl(slotId, _opts) {
  const ctx = getCtx3();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { close, high, low, volume } = ctx.stream.bar;
  const mfv = mfvAt(close, high, low, volume);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(slot.prevClosedCumAdl + mfv);
    return slot.series;
  }
  slot.prevClosedCumAdl = slot.cumAdl;
  slot.cumAdl += mfv;
  slot.outBuffer.append(slot.cumAdl);
  return slot.series;
}

// ../runtime/dist/ta/adr.js
var DEFAULT_LENGTH = 14;
var MS_PER_DAY = 864e5;
function getCtx4() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.adr called outside an active script step");
  }
  return ctx;
}
function initSlot2(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    completedRanges: new Float64RingBuffer(length),
    sumRanges: 0,
    dailyHigh: Number.NaN,
    dailyLow: Number.NaN,
    currentDayKey: Number.NaN
  };
}
function commitDay(slot) {
  if (!Number.isFinite(slot.dailyHigh) || !Number.isFinite(slot.dailyLow))
    return;
  const range = slot.dailyHigh - slot.dailyLow;
  if (slot.completedRanges.length === slot.length) {
    slot.sumRanges -= slot.completedRanges.at(slot.length - 1);
  }
  slot.completedRanges.append(range);
  slot.sumRanges += range;
}
function emit(slot) {
  if (slot.completedRanges.length < slot.length)
    return Number.NaN;
  return slot.sumRanges / slot.length;
}
function closeStep(slot, high, low, time) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(time)) {
    return emit(slot);
  }
  const dayKey = Math.floor(time / MS_PER_DAY);
  if (Number.isNaN(slot.currentDayKey)) {
    slot.currentDayKey = dayKey;
    slot.dailyHigh = high;
    slot.dailyLow = low;
    return emit(slot);
  }
  if (dayKey !== slot.currentDayKey) {
    commitDay(slot);
    slot.currentDayKey = dayKey;
    slot.dailyHigh = high;
    slot.dailyLow = low;
    return emit(slot);
  }
  if (high > slot.dailyHigh)
    slot.dailyHigh = high;
  if (low < slot.dailyLow)
    slot.dailyLow = low;
  return emit(slot);
}
function adr(slotId, opts) {
  const ctx = getCtx4();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const length = opts?.length ?? DEFAULT_LENGTH;
    slot = initSlot2(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { high, low, time } = ctx.stream.bar;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(emit(slot));
  } else {
    slot.outBuffer.append(closeStep(slot, high, low, time));
  }
  return slot.series;
}

// ../runtime/dist/ta/lib/wilderSmoothing.js
function wilderStep(prev, sample, length) {
  return (prev * (length - 1) + sample) / length;
}

// ../runtime/dist/ta/lib/directionalState.js
function initDirectionalState(length) {
  return {
    length,
    barCount: 0,
    prevHigh: Number.NaN,
    prevLow: Number.NaN,
    prevClose: Number.NaN,
    prevPrevHigh: Number.NaN,
    prevPrevLow: Number.NaN,
    prevPrevClose: Number.NaN,
    seedPlusDm: 0,
    seedMinusDm: 0,
    seedTr: 0,
    smoothedPlusDm: Number.NaN,
    smoothedMinusDm: Number.NaN,
    smoothedTr: Number.NaN,
    prevClosedSmoothedPlusDm: Number.NaN,
    prevClosedSmoothedMinusDm: Number.NaN,
    prevClosedSmoothedTr: Number.NaN,
    plusDi: Number.NaN,
    minusDi: Number.NaN
  };
}
function trueRange(high, low, prevClose) {
  if (!Number.isFinite(prevClose))
    return high - low;
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}
function rawDirectionalMovement(high, low, prevHigh, prevLow) {
  const upMove = high - prevHigh;
  const downMove = prevLow - low;
  const pDm = upMove > downMove && upMove > 0 ? upMove : 0;
  const mDm = downMove > upMove && downMove > 0 ? downMove : 0;
  return { pDm, mDm };
}
function advanceDirectionalClose(dirState, high, low, close) {
  const { length } = dirState;
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { plusDi: dirState.plusDi, minusDi: dirState.minusDi };
  }
  dirState.barCount += 1;
  if (dirState.barCount === 1) {
    dirState.prevPrevHigh = dirState.prevHigh;
    dirState.prevPrevLow = dirState.prevLow;
    dirState.prevPrevClose = dirState.prevClose;
    dirState.prevHigh = high;
    dirState.prevLow = low;
    dirState.prevClose = close;
    dirState.seedTr += high - low;
    return { plusDi: Number.NaN, minusDi: Number.NaN };
  }
  const tr = trueRange(high, low, dirState.prevClose);
  const { pDm, mDm } = rawDirectionalMovement(high, low, dirState.prevHigh, dirState.prevLow);
  dirState.prevPrevHigh = dirState.prevHigh;
  dirState.prevPrevLow = dirState.prevLow;
  dirState.prevPrevClose = dirState.prevClose;
  dirState.prevHigh = high;
  dirState.prevLow = low;
  dirState.prevClose = close;
  if (dirState.barCount <= length) {
    dirState.seedPlusDm += pDm;
    dirState.seedMinusDm += mDm;
    dirState.seedTr += tr;
    return { plusDi: Number.NaN, minusDi: Number.NaN };
  }
  if (dirState.barCount === length + 1) {
    dirState.prevClosedSmoothedPlusDm = dirState.seedPlusDm;
    dirState.prevClosedSmoothedMinusDm = dirState.seedMinusDm;
    dirState.prevClosedSmoothedTr = dirState.seedTr;
    dirState.seedPlusDm += pDm;
    dirState.seedMinusDm += mDm;
    dirState.seedTr += tr;
    dirState.smoothedPlusDm = dirState.seedPlusDm;
    dirState.smoothedMinusDm = dirState.seedMinusDm;
    dirState.smoothedTr = dirState.seedTr;
    const tr0 = dirState.smoothedTr;
    const plusDi2 = tr0 === 0 ? 0 : 100 * dirState.smoothedPlusDm / tr0;
    const minusDi2 = tr0 === 0 ? 0 : 100 * dirState.smoothedMinusDm / tr0;
    dirState.plusDi = plusDi2;
    dirState.minusDi = minusDi2;
    return { plusDi: plusDi2, minusDi: minusDi2 };
  }
  dirState.prevClosedSmoothedPlusDm = dirState.smoothedPlusDm;
  dirState.prevClosedSmoothedMinusDm = dirState.smoothedMinusDm;
  dirState.prevClosedSmoothedTr = dirState.smoothedTr;
  dirState.smoothedPlusDm = wilderStep(dirState.smoothedPlusDm, pDm, length);
  dirState.smoothedMinusDm = wilderStep(dirState.smoothedMinusDm, mDm, length);
  dirState.smoothedTr = wilderStep(dirState.smoothedTr, tr, length);
  const tr1 = dirState.smoothedTr;
  const plusDi = tr1 === 0 ? 0 : 100 * dirState.smoothedPlusDm / tr1;
  const minusDi = tr1 === 0 ? 0 : 100 * dirState.smoothedMinusDm / tr1;
  dirState.plusDi = plusDi;
  dirState.minusDi = minusDi;
  return { plusDi, minusDi };
}
function tickDirectional(dirState, high, low, close) {
  if (dirState.barCount < dirState.length + 1) {
    return { plusDi: Number.NaN, minusDi: Number.NaN };
  }
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { plusDi: dirState.plusDi, minusDi: dirState.minusDi };
  }
  const tr = trueRange(high, low, dirState.prevPrevClose);
  const { pDm, mDm } = rawDirectionalMovement(high, low, dirState.prevPrevHigh, dirState.prevPrevLow);
  if (dirState.barCount === dirState.length + 1) {
    const seedPlusDm = dirState.prevClosedSmoothedPlusDm + pDm;
    const seedMinusDm = dirState.prevClosedSmoothedMinusDm + mDm;
    const seedTr = dirState.prevClosedSmoothedTr + tr;
    const plusDi2 = (
      /* c8 ignore next */
      seedTr === 0 ? 0 : 100 * seedPlusDm / seedTr
    );
    const minusDi2 = (
      /* c8 ignore next */
      seedTr === 0 ? 0 : 100 * seedMinusDm / seedTr
    );
    return { plusDi: plusDi2, minusDi: minusDi2 };
  }
  const plusDmSm = wilderStep(dirState.prevClosedSmoothedPlusDm, pDm, dirState.length);
  const minusDmSm = wilderStep(dirState.prevClosedSmoothedMinusDm, mDm, dirState.length);
  const trSm = wilderStep(dirState.prevClosedSmoothedTr, tr, dirState.length);
  const plusDi = (
    /* c8 ignore next */
    trSm === 0 ? 0 : 100 * plusDmSm / trSm
  );
  const minusDi = (
    /* c8 ignore next */
    trSm === 0 ? 0 : 100 * minusDmSm / trSm
  );
  return { plusDi, minusDi };
}

// ../runtime/dist/ta/adx.js
var DEFAULT_SMOOTHING = 14;
function getCtx5() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.adx called outside an active script step");
  }
  return ctx;
}
function initSlot3(length, smoothingLength, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    smoothingLength,
    dirState: initDirectionalState(length),
    dxSeed: 0,
    dxSeedCount: 0,
    adx: Number.NaN,
    prevClosedAdx: Number.NaN,
    prevClosedDxSeed: 0,
    prevClosedDxSeedCount: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function dxFromDi(plusDi, minusDi) {
  const sum = plusDi + minusDi;
  if (sum === 0)
    return 0;
  return 100 * Math.abs(plusDi - minusDi) / sum;
}
function closeValue(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return Number.isFinite(slot.adx) ? slot.adx : Number.NaN;
  }
  const { plusDi, minusDi } = advanceDirectionalClose(slot.dirState, high, low, close);
  if (!Number.isFinite(plusDi) || !Number.isFinite(minusDi)) {
    slot.prevClosedAdx = slot.adx;
    slot.prevClosedDxSeed = slot.dxSeed;
    slot.prevClosedDxSeedCount = slot.dxSeedCount;
    return Number.NaN;
  }
  const dx = dxFromDi(plusDi, minusDi);
  slot.prevClosedAdx = slot.adx;
  slot.prevClosedDxSeed = slot.dxSeed;
  slot.prevClosedDxSeedCount = slot.dxSeedCount;
  if (slot.dxSeedCount < slot.smoothingLength) {
    slot.dxSeed += dx;
    slot.dxSeedCount += 1;
    if (slot.dxSeedCount === slot.smoothingLength) {
      slot.adx = slot.dxSeed / slot.smoothingLength;
      return slot.adx;
    }
    return Number.NaN;
  }
  slot.adx = wilderStep(slot.adx, dx, slot.smoothingLength);
  return slot.adx;
}
function tickValue(slot, high, low, close) {
  const { plusDi, minusDi } = tickDirectional(slot.dirState, high, low, close);
  if (!Number.isFinite(plusDi) || !Number.isFinite(minusDi)) {
    return (
      /* c8 ignore next */
      Number.isFinite(slot.adx) ? slot.adx : Number.NaN
    );
  }
  const dx = dxFromDi(plusDi, minusDi);
  if (slot.prevClosedDxSeedCount < slot.smoothingLength) {
    const provisionalCount = slot.prevClosedDxSeedCount + 1;
    if (provisionalCount < slot.smoothingLength)
      return Number.NaN;
    return (slot.prevClosedDxSeed + dx) / slot.smoothingLength;
  }
  return wilderStep(slot.prevClosedAdx, dx, slot.smoothingLength);
}
function adx(slotId, length, opts) {
  const ctx = getCtx5();
  const smoothingLength = opts?.smoothing ?? DEFAULT_SMOOTHING;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot3(length, smoothingLength, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue(slot, bar.high, bar.low, bar.close));
  } else {
    slot.outBuffer.append(closeValue(slot, bar.high, bar.low, bar.close));
  }
  return viewForOffset(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/lib/sourceValue.js
function readSourceValue(source) {
  if (typeof source === "number")
    return source;
  return source.current;
}

// ../runtime/dist/ta/alma.js
var DEFAULT_OFFSET = 0.85;
var DEFAULT_SIGMA = 6;
function getCtx6() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.alma called outside an active script step");
  }
  return ctx;
}
function initSlot4(length, offsetCentre, sigma, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  const m = offsetCentre * (length - 1);
  const s = length / sigma;
  const weights = new Float64Array(length);
  let normaliser = 0;
  for (let j = 0; j < length; j += 1) {
    const d = j - m;
    const w = Math.exp(-(d * d) / (2 * s * s));
    weights[j] = w;
    normaliser += w;
  }
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length),
    weights,
    normaliser
  };
}
function weightedFromWindow(slot, headOverride) {
  let sum = 0;
  for (let j = 0; j < slot.length; j += 1) {
    const ageFromHead = slot.length - 1 - j;
    const v = ageFromHead === 0 && headOverride !== void 0 ? headOverride : slot.sourceWindow.at(ageFromHead);
    if (!Number.isFinite(v))
      return Number.NaN;
    sum += v * slot.weights[j];
  }
  return sum / slot.normaliser;
}
function closeValue2(slot, src) {
  slot.sourceWindow.append(src);
  if (slot.sourceWindow.length < slot.length)
    return Number.NaN;
  return weightedFromWindow(slot);
}
function tickValue2(slot, src) {
  if (slot.sourceWindow.length < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src))
    return Number.NaN;
  return weightedFromWindow(slot, src);
}
function alma(slotId, source, length, opts) {
  const ctx = getCtx6();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot4(length, opts?.offset ?? DEFAULT_OFFSET, opts?.sigma ?? DEFAULT_SIGMA, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue2(slot, src));
  } else {
    slot.outBuffer.append(closeValue2(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/lib/volume-profile/bucketEdges.js
function buildBucketEdges(priceMin, priceMax, rowsLayout, rowSize, tickSize) {
  if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax) || rowSize <= 0) {
    return new Float64Array([priceMin, priceMin]);
  }
  if (priceMax <= priceMin)
    return new Float64Array([priceMin, priceMin]);
  if (rowsLayout === "ticksPerRow") {
    const bucketWidth = rowSize * tickSize;
    if (bucketWidth <= 0)
      return new Float64Array([priceMin, priceMin]);
    const startEdge = Math.floor(priceMin / bucketWidth) * bucketWidth;
    const endEdge = Math.ceil(priceMax / bucketWidth) * bucketWidth;
    const count2 = Math.max(1, Math.round((endEdge - startEdge) / bucketWidth));
    const edges2 = new Float64Array(count2 + 1);
    for (let i = 0; i <= count2; i += 1)
      edges2[i] = startEdge + i * bucketWidth;
    return edges2;
  }
  const count = Math.max(1, Math.floor(rowSize));
  const width = (priceMax - priceMin) / count;
  const edges = new Float64Array(count + 1);
  for (let i = 0; i <= count; i += 1)
    edges[i] = priceMin + i * width;
  return edges;
}

// ../runtime/dist/ta/lib/volume-profile/bucketizeVolume.js
function bucketizeVolumeDetailed(bars, bucketEdges, volumeSplit) {
  const bucketCount = bucketEdges.length - 1;
  if (bucketCount <= 0)
    return { buckets: [], pocIdx: -1, rows: [], totalVolume: 0 };
  const upPerBucket = new Float64Array(bucketCount);
  const downPerBucket = new Float64Array(bucketCount);
  for (const bar of bars) {
    const vol2 = Number.isFinite(bar.volume) ? bar.volume : 0;
    if (vol2 <= 0)
      continue;
    const low = bar.low;
    const high = bar.high;
    if (!Number.isFinite(low) || !Number.isFinite(high))
      continue;
    if (!Number.isFinite(bar.open) || !Number.isFinite(bar.close))
      continue;
    if (high <= low)
      continue;
    const span = high - low;
    const isUp = bar.close >= bar.open;
    for (let b = 0; b < bucketCount; b += 1) {
      const edgeLow = bucketEdges[b];
      const edgeHigh = bucketEdges[b + 1];
      if (edgeHigh <= low)
        continue;
      if (edgeLow >= high)
        break;
      const overlap = Math.min(edgeHigh, high) - Math.max(edgeLow, low);
      if (overlap <= 0)
        continue;
      const share = vol2 * overlap / span;
      if (isUp)
        upPerBucket[b] += share;
      else
        downPerBucket[b] += share;
    }
  }
  const rows = new Array(bucketCount);
  const buckets = new Array(bucketCount);
  let totalVolume = 0;
  let pocIdx = -1;
  let pocVolume = -1;
  for (let b = 0; b < bucketCount; b += 1) {
    const rawUp = upPerBucket[b];
    const rawDown = downPerBucket[b];
    const split = splitVolume(rawUp, rawDown, volumeSplit);
    const low = bucketEdges[b];
    const high = bucketEdges[b + 1];
    const mid = (low + high) / 2;
    rows[b] = {
      downVolume: split.downVolume,
      high,
      low,
      mid,
      upVolume: split.upVolume,
      volume: split.volume
    };
    buckets[b] = { price: mid, volume: split.volume };
    totalVolume += split.volume;
    if (split.volume > pocVolume) {
      pocVolume = split.volume;
      pocIdx = b;
    }
  }
  return { buckets, pocIdx, rows, totalVolume };
}
function splitVolume(rawUp, rawDown, volumeSplit) {
  switch (volumeSplit) {
    case "total": {
      const volume = rawUp + rawDown;
      return { downVolume: 0, upVolume: volume, volume };
    }
    case "delta": {
      const upVolume = Math.max(0, rawUp - rawDown);
      const downVolume = Math.max(0, rawDown - rawUp);
      return { downVolume, upVolume, volume: upVolume + downVolume };
    }
    case "upDown":
      return { downVolume: rawDown, upVolume: rawUp, volume: rawUp + rawDown };
  }
}

// ../runtime/dist/ta/lib/volume-profile/types.js
var DEFAULT_TICK_SIZE = 0.01;

// ../runtime/dist/ta/lib/volume-profile/valueArea.js
function computeValueArea(rows, valueAreaPct = 70, pocIdx = findPocIndex(rows)) {
  if (rows.length === 0 || pocIdx < 0 || pocIdx >= rows.length) {
    return {
      cumulativeVolume: 0,
      poc: Number.NaN,
      pocIdx,
      vahIdx: pocIdx,
      valHigh: Number.NaN,
      valIdx: pocIdx,
      valLow: Number.NaN
    };
  }
  const totalVolume = rows.reduce((sum, row) => sum + row.volume, 0);
  const targetPct = Math.max(0, Math.min(100, valueAreaPct));
  const target = totalVolume * (targetPct / 100);
  let lowIdx = pocIdx;
  let highIdx = pocIdx;
  let cumulative = rows[pocIdx].volume;
  while (cumulative < target && (lowIdx > 0 || highIdx + 1 < rows.length)) {
    const aboveAvailable = highIdx + 1 < rows.length;
    const belowAvailable = lowIdx - 1 >= 0;
    let aboveSum = 0;
    if (aboveAvailable) {
      aboveSum = rows[highIdx + 1].volume;
      if (highIdx + 2 < rows.length)
        aboveSum += rows[highIdx + 2].volume;
    }
    let belowSum = 0;
    if (belowAvailable) {
      belowSum = rows[lowIdx - 1].volume;
      if (lowIdx - 2 >= 0)
        belowSum += rows[lowIdx - 2].volume;
    }
    if (aboveAvailable && (!belowAvailable || aboveSum >= belowSum)) {
      const takeTwo = highIdx + 2 < rows.length;
      cumulative += rows[highIdx + 1].volume;
      highIdx += 1;
      if (takeTwo && cumulative < target) {
        cumulative += rows[highIdx + 1].volume;
        highIdx += 1;
      }
    } else {
      const takeTwo = lowIdx - 2 >= 0;
      cumulative += rows[lowIdx - 1].volume;
      lowIdx -= 1;
      if (takeTwo && cumulative < target) {
        cumulative += rows[lowIdx - 1].volume;
        lowIdx -= 1;
      }
    }
  }
  return {
    cumulativeVolume: cumulative,
    poc: rows[pocIdx].mid,
    pocIdx,
    vahIdx: highIdx,
    valHigh: rows[highIdx].high,
    valIdx: lowIdx,
    valLow: rows[lowIdx].low
  };
}
function findPocIndex(rows) {
  let pocIdx = -1;
  let pocVolume = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].volume > pocVolume) {
      pocIdx = i;
      pocVolume = rows[i].volume;
    }
  }
  return pocIdx;
}

// ../runtime/dist/ta/lib/volume-profile/developingSeries.js
var WARMUP_BARS = 30;
function computeDevelopingSeries(args) {
  const { laneBars, finerBars, windowFromIdx, windowToIdx, config } = args;
  const laneCount = laneBars.length;
  const developingPoc = new Float64Array(laneCount);
  const developingVahHigh = new Float64Array(laneCount);
  const developingVahLow = new Float64Array(laneCount);
  developingPoc.fill(Number.NaN);
  developingVahHigh.fill(Number.NaN);
  developingVahLow.fill(Number.NaN);
  if (laneCount === 0)
    return { developingPoc, developingVahHigh, developingVahLow };
  const fromIdx = Math.max(0, Math.min(laneCount - 1, windowFromIdx));
  const toIdx = Math.max(fromIdx, Math.min(laneCount - 1, windowToIdx));
  const source = finerBars.length > 0 ? finerBars : laneBars;
  const sourceStart = lowerBoundTime(source, laneBars[fromIdx].time);
  let sourceEnd = sourceStart;
  for (let i = fromIdx; i <= toIdx; i += 1) {
    while (sourceEnd < source.length && source[sourceEnd].time <= laneBars[i].time)
      sourceEnd += 1;
    const slice = source.slice(sourceStart, sourceEnd);
    if (slice.length <= WARMUP_BARS)
      continue;
    const { priceMax, priceMin } = derivePriceRange(slice);
    const edges = buildBucketEdges(priceMin, priceMax, config.rowsLayout ?? "numberOfRows", config.rowSize, config.tickSize ?? DEFAULT_TICK_SIZE);
    const bucketized = bucketizeVolumeDetailed(slice, edges, config.volumeSplit ?? "upDown");
    if (bucketized.totalVolume <= 0)
      continue;
    const valueArea = computeValueArea(bucketized.rows, config.valueAreaPct, bucketized.pocIdx);
    developingPoc[i] = valueArea.poc;
    developingVahHigh[i] = valueArea.valHigh;
    developingVahLow[i] = valueArea.valLow;
  }
  return { developingPoc, developingVahHigh, developingVahLow };
}
function lowerBoundTime(bars, target) {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (bars[mid].time < target)
      lo = mid + 1;
    else
      hi = mid;
  }
  return lo;
}
function derivePriceRange(bars) {
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = Number.NEGATIVE_INFINITY;
  for (const bar of bars) {
    if (!Number.isFinite(bar.low) || !Number.isFinite(bar.high))
      continue;
    if (bar.low < priceMin)
      priceMin = bar.low;
    if (bar.high > priceMax)
      priceMax = bar.high;
  }
  if (priceMin === Number.POSITIVE_INFINITY)
    return { priceMax: 0, priceMin: 0 };
  return { priceMax, priceMin };
}

// ../runtime/dist/ta/lib/volume-profile/tooHeavy.js
var VOLUME_PROFILE_HEAVY_THRESHOLD = 5e4;
var VOLUME_PROFILE_MAX_BUCKETS = 2e3;
function assessVolumeProfileCost(args) {
  if (args.finerCandleCount > VOLUME_PROFILE_HEAVY_THRESHOLD) {
    return { heavy: true, reason: "too-many-finer-bars", recommendedRowSize: null };
  }
  const maxBuckets = args.maxBuckets ?? VOLUME_PROFILE_MAX_BUCKETS;
  const estimate = estimateBucketCount(args);
  if (estimate.kind === "estimated" && estimate.bucketCount > maxBuckets) {
    return {
      heavy: true,
      reason: "too-many-buckets",
      recommendedRowSize: args.rowsLayout === "ticksPerRow" ? Math.ceil((estimate.priceMax - estimate.priceMin) / (maxBuckets * estimate.tickSize)) : Math.max(1, maxBuckets)
    };
  }
  return { heavy: false, reason: null, recommendedRowSize: null };
}
function estimateBucketCount(args) {
  const { priceMax, priceMin, rowSize } = args;
  if (rowSize === void 0 || priceMin === void 0 || priceMax === void 0 || !Number.isFinite(priceMin) || !Number.isFinite(priceMax) || rowSize <= 0 || priceMax <= priceMin) {
    return { bucketCount: 0, kind: "invalid" };
  }
  const tickSize = args.tickSize ?? 0.01;
  if (args.rowsLayout === "ticksPerRow") {
    const width = rowSize * tickSize;
    return width > 0 ? {
      bucketCount: Math.ceil((priceMax - priceMin) / width),
      kind: "estimated",
      priceMax,
      priceMin,
      rowSize,
      tickSize
    } : { bucketCount: 0, kind: "invalid" };
  }
  return {
    bucketCount: Math.floor(rowSize),
    kind: "estimated",
    priceMax,
    priceMin,
    rowSize,
    tickSize
  };
}

// ../runtime/dist/ta/lib/volume-profile/volumeProfileShared.js
function computeProfile(args) {
  const { laneBars, config } = args;
  const finerBars = args.finerBars ?? [];
  if (laneBars.length === 0)
    return emptyProfile(false, null, null);
  const fromIdx = Math.max(0, Math.min(laneBars.length - 1, args.windowFromIdx));
  const toIdx = Math.max(fromIdx, Math.min(laneBars.length - 1, args.windowToIdx));
  const laneSlice = laneBars.slice(fromIdx, toIdx + 1);
  const finerSlice = sliceBarsByTime(finerBars, laneSlice[0].time, laneSlice[laneSlice.length - 1].time);
  const bucketSource = finerSlice.length > 0 ? finerSlice : laneSlice;
  const range = derivePriceRange(bucketSource);
  const costStatus = assessVolumeProfileCost({
    finerCandleCount: finerSlice.length,
    priceMax: range.priceMax,
    priceMin: range.priceMin,
    rowSize: config.rowSize,
    rowsLayout: config.rowsLayout ?? "numberOfRows",
    tickSize: config.tickSize ?? DEFAULT_TICK_SIZE
  });
  if (costStatus.heavy)
    return emptyProfile(costStatus.heavy, costStatus.reason, costStatus.recommendedRowSize);
  if (range.priceMax <= range.priceMin)
    return emptyProfile(false, null, null);
  const edges = buildBucketEdges(range.priceMin, range.priceMax, config.rowsLayout ?? "numberOfRows", config.rowSize, config.tickSize ?? DEFAULT_TICK_SIZE);
  const bucketized = bucketizeVolumeDetailed(bucketSource, edges, config.volumeSplit ?? "upDown");
  if (bucketized.totalVolume <= 0)
    return emptyProfile(false, null, null);
  const valueArea = computeValueArea(bucketized.rows, config.valueAreaPct, bucketized.pocIdx);
  const valueAreaMask = new Float64Array(bucketized.rows.length);
  const lo = Math.min(valueArea.vahIdx, valueArea.valIdx);
  const hi = Math.max(valueArea.vahIdx, valueArea.valIdx);
  for (let i = 0; i < valueAreaMask.length; i += 1)
    valueAreaMask[i] = i >= lo && i <= hi ? 1 : 0;
  const base = {
    buckets: bucketized.buckets,
    costStatus,
    poc: valueArea.poc,
    rows: bucketized.rows,
    valHigh: valueArea.valHigh,
    valLow: valueArea.valLow,
    valueAreaMask
  };
  if (args.computeDeveloping === true) {
    return {
      ...base,
      developing: computeDevelopingSeries({
        config,
        finerBars,
        laneBars,
        windowFromIdx: fromIdx,
        windowToIdx: toIdx
      })
    };
  }
  return base;
}
function emptyProfile(heavy, reason, recommendedRowSize) {
  return {
    buckets: [],
    costStatus: { heavy, reason, recommendedRowSize },
    poc: Number.NaN,
    rows: [],
    valHigh: Number.NaN,
    valLow: Number.NaN,
    valueAreaMask: new Float64Array(0)
  };
}
function sliceBarsByTime(bars, timeFromMs, timeToMs) {
  if (bars.length === 0)
    return bars;
  const start = lowerBoundTime2(bars, timeFromMs);
  const end = upperBoundTime(bars, timeToMs);
  if (start >= end)
    return [];
  return bars.slice(start, end);
}
function lowerBoundTime2(bars, target) {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (bars[mid].time < target)
      lo = mid + 1;
    else
      hi = mid;
  }
  return lo;
}
function upperBoundTime(bars, target) {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = lo + hi >>> 1;
    if (bars[mid].time <= target)
      lo = mid + 1;
    else
      hi = mid;
  }
  return lo;
}

// ../runtime/dist/emit/hash.js
var FNV_OFFSET_BASIS_32 = 2166136261;
var FNV_PRIME_32 = 16777619;
function hashStringStable(s) {
  let h = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME_32);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ../runtime/dist/emit/alert.js
var OUTSIDE_CTX_MESSAGE = "alert called outside an active script step";
function computeDedupeKey(slotId, bar, message2, meta) {
  return `${slotId}::${bar}::${hashStringStable(message2 + JSON.stringify(meta))}`;
}
function snapshotUnknown(value) {
  if (Array.isArray(value)) {
    return value.map((item) => snapshotUnknown(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshotUnknown(item)]));
  }
  return value;
}
function snapshotMeta(meta) {
  return snapshotUnknown(meta);
}
function alertImpl(ctx, slotId, message2, opts) {
  if (ctx.capabilities.alerts.size === 0) {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "unsupported-alert-channel",
      message: "Adapter declares no alert channels; alert dropped.",
      slotId,
      bar: ctx.barIndex()
    });
    return;
  }
  const channels = Array.from(ctx.capabilities.alerts);
  const bar = ctx.barIndex();
  const meta = snapshotMeta(opts.meta ?? {});
  const emission = {
    kind: "alert",
    slotId,
    severity: opts.severity ?? "info",
    message: message2,
    bar,
    time: ctx.stream.bar.time,
    meta,
    channels: Object.freeze(channels.slice()),
    dedupeKey: computeDedupeKey(slotId, bar, message2, meta)
  };
  pushAlert(ctx.emissions, emission);
}
function alert2(arg1, arg2, arg3) {
  if (typeof arg2 !== "string") {
    throw new Error(OUTSIDE_CTX_MESSAGE);
  }
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (!ctx)
    throw new Error(OUTSIDE_CTX_MESSAGE);
  alertImpl(ctx, arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/alertConditionEmission.js
function diagnoseOnce(ctx, code, conditionId, message2) {
  const key = `${code}|${conditionId}`;
  const diagnosed = ctx.diagnosedAlertConditionKeys;
  if (diagnosed?.has(key))
    return;
  diagnosed?.add(key);
  pushDiagnostic(ctx.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code,
    message: message2,
    slotId: null,
    bar: ctx.barIndex()
  });
}
function emitAlertCondition(ctx, conditionId, fired) {
  if (!ctx.capabilities.alertConditions) {
    diagnoseOnce(ctx, "alert-conditions-not-supported", conditionId, "Adapter does not support alert conditions; signal dropped.");
    return;
  }
  const condition = ctx.alertConditions?.get(conditionId);
  if (condition === void 0) {
    diagnoseOnce(ctx, "unknown-alert-condition", conditionId, `Alert condition "${conditionId}" is not declared in the script manifest.`);
    return;
  }
  const emission = {
    kind: "alert-condition",
    conditionId,
    title: condition.title,
    description: condition.description,
    defaultMessage: condition.defaultMessage,
    fired,
    bar: ctx.barIndex(),
    time: ctx.stream.bar.time
  };
  pushAlertCondition(ctx.emissions, emission);
}

// ../runtime/dist/emit/applyPlotOverride.js
function isLineFamily(kind) {
  return kind === "line" || kind === "step-line" || kind === "horizontal-line" || kind === "area";
}
function applyPlotOverride(emission, override) {
  if (override === void 0)
    return emission;
  let next = emission;
  if (override.visible === false)
    next = { ...next, visible: false };
  if (override.color !== void 0)
    next = { ...next, color: override.color };
  if ((override.lineWidth !== void 0 || override.lineStyle !== void 0) && isLineFamily(next.style.kind)) {
    next = {
      ...next,
      style: {
        ...next.style,
        ...override.lineWidth !== void 0 ? { lineWidth: override.lineWidth } : {},
        ...override.lineStyle !== void 0 ? { lineStyle: override.lineStyle } : {}
      }
    };
  }
  return next;
}

// ../runtime/dist/emit/draw/pushDrawing.js
function effectiveBudget(ctx, bucket) {
  const adapterCap = ctx.capabilities.maxDrawingsPerScript[bucket];
  const scriptCap = ctx.scriptMaxDrawings?.[bucket] ?? Number.POSITIVE_INFINITY;
  return Math.min(adapterCap, scriptCap);
}
function pushDrawing(ctx, e) {
  if (!ctx.capabilities.drawings.has(e.drawingKind)) {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "unsupported-drawing-kind",
      message: `Adapter cannot render drawing kind "${e.drawingKind}".`,
      slotId: e.handleId,
      bar: e.bar
    });
    return;
  }
  const validation = validateEmission(e);
  if (!validation.ok) {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: validation.code,
      message: validation.message,
      slotId: e.handleId,
      bar: e.bar
    });
    return;
  }
  const bucket = bucketFor(e.drawingKind);
  if (e.op === "create") {
    const used = ctx.drawingBucketCounters[bucket];
    const cap = effectiveBudget(ctx, bucket);
    if (used >= cap) {
      pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "drawing-budget-exceeded",
        message: `Bucket '${bucket}' budget (${cap}) exhausted; drawing dropped.`,
        slotId: e.handleId,
        bar: e.bar
      });
      return;
    }
    ctx.drawingBucketCounters[bucket] = used + 1;
  } else if (e.op === "remove") {
    const used = ctx.drawingBucketCounters[bucket];
    ctx.drawingBucketCounters[bucket] = Math.max(0, used - 1);
  }
  const drawings = ctx.emissions.drawings;
  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const existing = drawings[i];
    if (existing.handleId === e.handleId && existing.bar === e.bar) {
      drawings[i] = e;
      return;
    }
  }
  drawings.push(e);
}

// ../runtime/dist/emit/draw/handle.js
var OUTSIDE_CTX_MESSAGE2 = "draw called outside an active script step";
function mergeState(prev, patch) {
  return { ...prev, ...patch, kind: prev.kind };
}
function emit2(ctx, handleId, kind, op, state2) {
  pushDrawing(ctx, {
    kind: "drawing",
    handleId,
    drawingKind: kind,
    op,
    state: state2,
    bar: ctx.barIndex(),
    time: ctx.stream.bar.time
  });
}
function createDrawingHandle(slotId, subId, kind, initialState) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE2);
  const handleId = `${slotId}#${subId}`;
  const existing = ctx.drawingSlots.get(handleId);
  let slot;
  let op;
  if (existing === void 0) {
    slot = { handleId, kind, state: initialState, removed: false };
    ctx.drawingSlots.set(handleId, slot);
    op = "create";
  } else {
    existing.state = mergeState(existing.state, initialState);
    existing.removed = false;
    slot = existing;
    op = "update";
  }
  emit2(ctx, handleId, kind, op, slot.state);
  return {
    id: handleId,
    update(patch) {
      const liveCtx = ACTIVE_RUNTIME_CONTEXT.current;
      if (liveCtx === null)
        return;
      const s = liveCtx.drawingSlots.get(handleId);
      if (s === void 0 || s.removed)
        return;
      s.state = mergeState(s.state, patch);
      emit2(liveCtx, handleId, kind, "update", s.state);
    },
    remove() {
      const liveCtx = ACTIVE_RUNTIME_CONTEXT.current;
      if (liveCtx === null)
        return;
      const s = liveCtx.drawingSlots.get(handleId);
      if (s === void 0 || s.removed)
        return;
      s.removed = true;
      emit2(liveCtx, handleId, kind, "remove", s.state);
    }
  };
}

// ../runtime/dist/emit/draw/subIdAllocator.js
function nextSubId(ctx, slotId) {
  const counters = ctx.drawingSubIdCounters;
  const current = counters.get(slotId) ?? 0;
  counters.set(slotId, current + 1);
  return current;
}
function resetSubIdCounters(ctx) {
  ctx.drawingSubIdCounters.clear();
}

// ../runtime/dist/emit/draw/annotations/arrow.js
var OUTSIDE_CTX_MESSAGE3 = "draw.arrow called outside an active script step";
function arrowImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE3);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "arrow", anchors: [a, b], style: opts };
  return createDrawingHandle(slotId, subId, "arrow", state2);
}
function arrow(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE3);
  }
  return arrowImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/annotations/arrowMarkDown.js
var OUTSIDE_CTX_MESSAGE4 = "draw.arrowMarkDown called outside an active script step";
function arrowMarkDownImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE4);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "arrow-mark-down", anchor, style: opts };
  return createDrawingHandle(slotId, subId, "arrow-mark-down", state2);
}
function arrowMarkDown(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE4);
  }
  return arrowMarkDownImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/annotations/arrowMarkUp.js
var OUTSIDE_CTX_MESSAGE5 = "draw.arrowMarkUp called outside an active script step";
function arrowMarkUpImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE5);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "arrow-mark-up", anchor, style: opts };
  return createDrawingHandle(slotId, subId, "arrow-mark-up", state2);
}
function arrowMarkUp(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE5);
  }
  return arrowMarkUpImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/annotations/arrowMarker.js
var OUTSIDE_CTX_MESSAGE6 = "draw.arrowMarker called outside an active script step";
function arrowMarkerImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE6);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "arrow-marker", anchor, style: opts };
  return createDrawingHandle(slotId, subId, "arrow-marker", state2);
}
function arrowMarker(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE6);
  }
  return arrowMarkerImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/annotations/text.js
var OUTSIDE_CTX_MESSAGE7 = "draw.text called outside an active script step";
function textImpl(slotId, anchor, body, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE7);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "text", anchor, body, style: opts };
  return createDrawingHandle(slotId, subId, "text", state2);
}
function text(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || typeof arg2 === "string" || typeof arg3 !== "string") {
    throw new Error(OUTSIDE_CTX_MESSAGE7);
  }
  return textImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/boxes/circle.js
var OUTSIDE_CTX_MESSAGE8 = "draw.circle called outside an active script step";
function circleImpl(slotId, centre, radiusAnchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE8);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "circle",
    anchors: [centre, radiusAnchor],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "circle", state2);
}
function circle(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE8);
  }
  return circleImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/boxes/ellipse.js
var OUTSIDE_CTX_MESSAGE9 = "draw.ellipse called outside an active script step";
function ellipseImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE9);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "ellipse", anchors: [a, b], style: opts };
  return createDrawingHandle(slotId, subId, "ellipse", state2);
}
function ellipse(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE9);
  }
  return ellipseImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/boxes/marker.js
var OUTSIDE_CTX_MESSAGE10 = "draw.marker called outside an active script step";
function markerImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE10);
  const subId = nextSubId(ctx, slotId);
  const { text: text2, value, ...style } = opts;
  const state2 = {
    kind: "marker",
    anchor,
    ...text2 !== void 0 ? { text: text2 } : {},
    ...value !== void 0 ? { value } : {},
    style
  };
  return createDrawingHandle(slotId, subId, "marker", state2);
}
function marker(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE10);
  }
  return markerImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/boxes/path.js
var OUTSIDE_CTX_MESSAGE11 = "draw.path called outside an active script step";
function pathImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE11);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "path", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "path", state2);
}
function path(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE11);
  }
  return pathImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/boxes/polyline.js
var OUTSIDE_CTX_MESSAGE12 = "draw.polyline called outside an active script step";
function polylineImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE12);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "polyline", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "polyline", state2);
}
function polyline(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE12);
  }
  return polylineImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/boxes/rectangle.js
var OUTSIDE_CTX_MESSAGE13 = "draw.rectangle called outside an active script step";
function rectangleImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE13);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "rectangle", anchors: [a, b], style: opts };
  return createDrawingHandle(slotId, subId, "rectangle", state2);
}
function rectangle(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE13);
  }
  return rectangleImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/boxes/rotatedRectangle.js
var OUTSIDE_CTX_MESSAGE14 = "draw.rotatedRectangle called outside an active script step";
function rotatedRectangleImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE14);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "rotated-rectangle", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "rotated-rectangle", state2);
}
function rotatedRectangle(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE14);
  }
  return rotatedRectangleImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/boxes/triangle.js
var OUTSIDE_CTX_MESSAGE15 = "draw.triangle called outside an active script step";
function triangleImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE15);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "triangle", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "triangle", state2);
}
function triangle(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE15);
  }
  return triangleImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/channels/disjointChannel.js
var OUTSIDE_CTX_MESSAGE16 = "draw.disjointChannel called outside an active script step";
function disjointChannelImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE16);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "disjoint-channel", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "disjoint-channel", state2);
}
function disjointChannel(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE16);
  }
  return disjointChannelImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/channels/flatTopBottom.js
var OUTSIDE_CTX_MESSAGE17 = "draw.flatTopBottom called outside an active script step";
function flatTopBottomImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE17);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "flat-top-bottom", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "flat-top-bottom", state2);
}
function flatTopBottom(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE17);
  }
  return flatTopBottomImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/channels/regressionTrend.js
var OUTSIDE_CTX_MESSAGE18 = "draw.regressionTrend called outside an active script step";
function regressionTrendImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE18);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "regression-trend",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "regression-trend", state2);
}
function regressionTrend(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE18);
  }
  return regressionTrendImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/channels/trendChannel.js
var OUTSIDE_CTX_MESSAGE19 = "draw.trendChannel called outside an active script step";
function trendChannelImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE19);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "trend-channel", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "trend-channel", state2);
}
function trendChannel(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE19);
  }
  return trendChannelImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/containers/frame.js
var OUTSIDE_CTX_MESSAGE20 = "draw.frame called outside an active script step";
function frameImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE20);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "frame",
    anchors: [a, b],
    childHandleIds: [],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "frame", state2);
}
function frame(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE20);
  }
  return frameImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/containers/group.js
var OUTSIDE_CTX_MESSAGE21 = "draw.group called outside an active script step";
function groupImpl(slotId, childHandleIds) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE21);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "group",
    childHandleIds
  };
  return createDrawingHandle(slotId, subId, "group", state2);
}
function group(arg1, arg2) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE21);
  }
  return groupImpl(arg1, arg2);
}

// ../runtime/dist/emit/draw/curves/arc.js
var OUTSIDE_CTX_MESSAGE22 = "draw.arc called outside an active script step";
function arcImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE22);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "arc", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "arc", state2);
}
function arc(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE22);
  }
  return arcImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/curves/brush.js
var OUTSIDE_CTX_MESSAGE23 = "draw.brush called outside an active script step";
function brushImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE23);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "brush", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "brush", state2);
}
function brush(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2) || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE23);
  }
  return brushImpl(arg1, arg2, arg3);
}

// ../runtime/dist/emit/draw/curves/curve.js
var OUTSIDE_CTX_MESSAGE24 = "draw.curve called outside an active script step";
function curveImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE24);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "curve", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "curve", state2);
}
function curve(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE24);
  }
  return curveImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/curves/doubleCurve.js
var OUTSIDE_CTX_MESSAGE25 = "draw.doubleCurve called outside an active script step";
function doubleCurveImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE25);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "double-curve", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "double-curve", state2);
}
function doubleCurve(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE25);
  }
  return doubleCurveImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/curves/highlighter.js
var OUTSIDE_CTX_MESSAGE26 = "draw.highlighter called outside an active script step";
function highlighterImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE26);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "highlighter", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "highlighter", state2);
}
function highlighter(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2) || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE26);
  }
  return highlighterImpl(arg1, arg2, arg3);
}

// ../runtime/dist/emit/draw/curves/pen.js
var OUTSIDE_CTX_MESSAGE27 = "draw.pen called outside an active script step";
function penImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE27);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "pen", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "pen", state2);
}
function pen(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE27);
  }
  return penImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/cycles/cyclicLines.js
var OUTSIDE_CTX_MESSAGE28 = "draw.cyclicLines called outside an active script step";
function cyclicLinesImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE28);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "cyclic-lines",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "cyclic-lines", state2);
}
function cyclicLines(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE28);
  }
  return cyclicLinesImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/cycles/sineLine.js
var OUTSIDE_CTX_MESSAGE29 = "draw.sineLine called outside an active script step";
function sineLineImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE29);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "sine-line",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "sine-line", state2);
}
function sineLine(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE29);
  }
  return sineLineImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/cycles/timeCycles.js
var OUTSIDE_CTX_MESSAGE30 = "draw.timeCycles called outside an active script step";
function timeCyclesImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE30);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "time-cycles",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "time-cycles", state2);
}
function timeCycles(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE30);
  }
  return timeCyclesImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/elliott/elliottCorrectionWave.js
var OUTSIDE_CTX_MESSAGE31 = "draw.elliottCorrectionWave called outside an active script step";
function elliottCorrectionWaveImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE31);
  const subId = nextSubId(ctx, slotId);
  const { labels, ...style } = opts;
  const state2 = labels === void 0 ? { kind: "elliott-correction-wave", anchors, style } : { kind: "elliott-correction-wave", anchors, labels, style };
  return createDrawingHandle(slotId, subId, "elliott-correction-wave", state2);
}
function elliottCorrectionWave(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE31);
  }
  return elliottCorrectionWaveImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/elliott/elliottDoubleCombo.js
var OUTSIDE_CTX_MESSAGE32 = "draw.elliottDoubleCombo called outside an active script step";
function elliottDoubleComboImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE32);
  const subId = nextSubId(ctx, slotId);
  const { labels, ...style } = opts;
  const state2 = labels === void 0 ? { kind: "elliott-double-combo", anchors, style } : { kind: "elliott-double-combo", anchors, labels, style };
  return createDrawingHandle(slotId, subId, "elliott-double-combo", state2);
}
function elliottDoubleCombo(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE32);
  }
  return elliottDoubleComboImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/elliott/elliottImpulseWave.js
var OUTSIDE_CTX_MESSAGE33 = "draw.elliottImpulseWave called outside an active script step";
function elliottImpulseWaveImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE33);
  const subId = nextSubId(ctx, slotId);
  const { labels, ...style } = opts;
  const state2 = labels === void 0 ? { kind: "elliott-impulse-wave", anchors, style } : { kind: "elliott-impulse-wave", anchors, labels, style };
  return createDrawingHandle(slotId, subId, "elliott-impulse-wave", state2);
}
function elliottImpulseWave(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE33);
  }
  return elliottImpulseWaveImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/elliott/elliottTriangleWave.js
var OUTSIDE_CTX_MESSAGE34 = "draw.elliottTriangleWave called outside an active script step";
function elliottTriangleWaveImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE34);
  const subId = nextSubId(ctx, slotId);
  const { labels, ...style } = opts;
  const state2 = labels === void 0 ? { kind: "elliott-triangle-wave", anchors, style } : { kind: "elliott-triangle-wave", anchors, labels, style };
  return createDrawingHandle(slotId, subId, "elliott-triangle-wave", state2);
}
function elliottTriangleWave(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE34);
  }
  return elliottTriangleWaveImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/elliott/elliottTripleCombo.js
var OUTSIDE_CTX_MESSAGE35 = "draw.elliottTripleCombo called outside an active script step";
function elliottTripleComboImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE35);
  const subId = nextSubId(ctx, slotId);
  const { labels, ...style } = opts;
  const state2 = labels === void 0 ? { kind: "elliott-triple-combo", anchors, style } : { kind: "elliott-triple-combo", anchors, labels, style };
  return createDrawingHandle(slotId, subId, "elliott-triple-combo", state2);
}
function elliottTripleCombo(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE35);
  }
  return elliottTripleComboImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/fibA/fibChannel.js
var OUTSIDE_CTX_MESSAGE36 = "draw.fibChannel called outside an active script step";
function fibChannelImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE36);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "fib-channel", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "fib-channel", state2);
}
function fibChannel(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE36);
  }
  return fibChannelImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/fibA/fibRetracement.js
var OUTSIDE_CTX_MESSAGE37 = "draw.fibRetracement called outside an active script step";
function fibRetracementImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE37);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-retracement",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-retracement", state2);
}
function fibRetracement(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE37);
  }
  return fibRetracementImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/fibA/fibTimeZone.js
var OUTSIDE_CTX_MESSAGE38 = "draw.fibTimeZone called outside an active script step";
function fibTimeZoneImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE38);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-time-zone",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-time-zone", state2);
}
function fibTimeZone(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE38);
  }
  return fibTimeZoneImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/fibA/fibTrendExtension.js
var OUTSIDE_CTX_MESSAGE39 = "draw.fibTrendExtension called outside an active script step";
function fibTrendExtensionImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE39);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-trend-extension",
    anchors,
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-trend-extension", state2);
}
function fibTrendExtension(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE39);
  }
  return fibTrendExtensionImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/fibA/fibWedge.js
var OUTSIDE_CTX_MESSAGE40 = "draw.fibWedge called outside an active script step";
function fibWedgeImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE40);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "fib-wedge", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "fib-wedge", state2);
}
function fibWedge(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE40);
  }
  return fibWedgeImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/fibB/fibCircles.js
var OUTSIDE_CTX_MESSAGE41 = "draw.fibCircles called outside an active script step";
function fibCirclesImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE41);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-circles",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-circles", state2);
}
function fibCircles(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE41);
  }
  return fibCirclesImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/fibB/fibSpeedArcs.js
var OUTSIDE_CTX_MESSAGE42 = "draw.fibSpeedArcs called outside an active script step";
function fibSpeedArcsImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE42);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-speed-arcs",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-speed-arcs", state2);
}
function fibSpeedArcs(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE42);
  }
  return fibSpeedArcsImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/fibB/fibSpeedFan.js
var OUTSIDE_CTX_MESSAGE43 = "draw.fibSpeedFan called outside an active script step";
function fibSpeedFanImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE43);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-speed-fan",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-speed-fan", state2);
}
function fibSpeedFan(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE43);
  }
  return fibSpeedFanImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/fibB/fibSpiral.js
var OUTSIDE_CTX_MESSAGE44 = "draw.fibSpiral called outside an active script step";
function fibSpiralImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE44);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-spiral",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-spiral", state2);
}
function fibSpiral(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE44);
  }
  return fibSpiralImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/fibB/fibTrendTime.js
var OUTSIDE_CTX_MESSAGE45 = "draw.fibTrendTime called outside an active script step";
function fibTrendTimeImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE45);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "fib-trend-time",
    anchors,
    style: opts
  };
  return createDrawingHandle(slotId, subId, "fib-trend-time", state2);
}
function fibTrendTime(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE45);
  }
  return fibTrendTimeImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/gann/gannBox.js
var OUTSIDE_CTX_MESSAGE46 = "draw.gannBox called outside an active script step";
function gannBoxImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE46);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "gann-box",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "gann-box", state2);
}
function gannBox(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE46);
  }
  return gannBoxImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/gann/gannFan.js
var OUTSIDE_CTX_MESSAGE47 = "draw.gannFan called outside an active script step";
function gannFanImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE47);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "gann-fan",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "gann-fan", state2);
}
function gannFan(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE47);
  }
  return gannFanImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/gann/gannSquare.js
var OUTSIDE_CTX_MESSAGE48 = "draw.gannSquare called outside an active script step";
function gannSquareImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE48);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "gann-square",
    anchors: [a, b],
    style: opts
  };
  return createDrawingHandle(slotId, subId, "gann-square", state2);
}
function gannSquare(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE48);
  }
  return gannSquareImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/gann/gannSquareFixed.js
var OUTSIDE_CTX_MESSAGE49 = "draw.gannSquareFixed called outside an active script step";
function gannSquareFixedImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE49);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "gann-square-fixed",
    anchor,
    style: opts
  };
  return createDrawingHandle(slotId, subId, "gann-square-fixed", state2);
}
function gannSquareFixed(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE49);
  }
  return gannSquareFixedImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/lines/crossLine.js
var OUTSIDE_CTX_MESSAGE50 = "draw.crossLine called outside an active script step";
function crossLineImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE50);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "cross-line", anchor, style: opts };
  return createDrawingHandle(slotId, subId, "cross-line", state2);
}
function crossLine(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || typeof arg2 !== "object") {
    throw new Error(OUTSIDE_CTX_MESSAGE50);
  }
  return crossLineImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/lines/horizontalLine.js
var OUTSIDE_CTX_MESSAGE51 = "draw.horizontalLine called outside an active script step";
function horizontalLineImpl(slotId, price, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE51);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "horizontal-line", price, style: opts };
  return createDrawingHandle(slotId, subId, "horizontal-line", state2);
}
function horizontalLine(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || typeof arg2 !== "number") {
    throw new Error(OUTSIDE_CTX_MESSAGE51);
  }
  return horizontalLineImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/lines/horizontalRay.js
var OUTSIDE_CTX_MESSAGE52 = "draw.horizontalRay called outside an active script step";
function horizontalRayImpl(slotId, anchor, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE52);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "horizontal-ray", anchor, style: opts };
  return createDrawingHandle(slotId, subId, "horizontal-ray", state2);
}
function horizontalRay(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || typeof arg2 !== "object") {
    throw new Error(OUTSIDE_CTX_MESSAGE52);
  }
  return horizontalRayImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/lines/line.js
var OUTSIDE_CTX_MESSAGE53 = "draw.line called outside an active script step";
function lineImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE53);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "line", anchors: [a, b], style: opts };
  return createDrawingHandle(slotId, subId, "line", state2);
}
function line(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE53);
  }
  return lineImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/lines/trendAngle.js
var OUTSIDE_CTX_MESSAGE54 = "draw.trendAngle called outside an active script step";
function trendAngleImpl(slotId, a, b, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE54);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "trend-angle", anchors: [a, b], style: opts };
  return createDrawingHandle(slotId, subId, "trend-angle", state2);
}
function trendAngle(arg1, arg2, arg3, arg4) {
  if (typeof arg1 !== "string" || arg2 === void 0 || arg3 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE54);
  }
  return trendAngleImpl(arg1, arg2, arg3, arg4 ?? {});
}

// ../runtime/dist/emit/draw/lines/verticalLine.js
var OUTSIDE_CTX_MESSAGE55 = "draw.verticalLine called outside an active script step";
function verticalLineImpl(slotId, time, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE55);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "vertical-line", time, style: opts };
  return createDrawingHandle(slotId, subId, "vertical-line", state2);
}
function verticalLine(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || typeof arg2 !== "number") {
    throw new Error(OUTSIDE_CTX_MESSAGE55);
  }
  return verticalLineImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/patterns/abcdPattern.js
var OUTSIDE_CTX_MESSAGE56 = "draw.abcdPattern called outside an active script step";
function abcdPatternImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE56);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "abcd-pattern", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "abcd-pattern", state2);
}
function abcdPattern(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE56);
  }
  return abcdPatternImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/patterns/cypherPattern.js
var OUTSIDE_CTX_MESSAGE57 = "draw.cypherPattern called outside an active script step";
function cypherPatternImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE57);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "cypher-pattern", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "cypher-pattern", state2);
}
function cypherPattern(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE57);
  }
  return cypherPatternImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/patterns/headAndShoulders.js
var OUTSIDE_CTX_MESSAGE58 = "draw.headAndShoulders called outside an active script step";
function headAndShouldersImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE58);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "head-and-shoulders",
    anchors,
    style: opts
  };
  return createDrawingHandle(slotId, subId, "head-and-shoulders", state2);
}
function headAndShoulders(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE58);
  }
  return headAndShouldersImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/patterns/threeDrivesPattern.js
var OUTSIDE_CTX_MESSAGE59 = "draw.threeDrivesPattern called outside an active script step";
function threeDrivesPatternImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE59);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "three-drives-pattern",
    anchors,
    style: opts
  };
  return createDrawingHandle(slotId, subId, "three-drives-pattern", state2);
}
function threeDrivesPattern(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE59);
  }
  return threeDrivesPatternImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/patterns/trianglePattern.js
var OUTSIDE_CTX_MESSAGE60 = "draw.trianglePattern called outside an active script step";
function trianglePatternImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE60);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "triangle-pattern",
    anchors,
    style: opts
  };
  return createDrawingHandle(slotId, subId, "triangle-pattern", state2);
}
function trianglePattern(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE60);
  }
  return trianglePatternImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/patterns/xabcdPattern.js
var OUTSIDE_CTX_MESSAGE61 = "draw.xabcdPattern called outside an active script step";
function xabcdPatternImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE61);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "xabcd-pattern", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "xabcd-pattern", state2);
}
function xabcdPattern(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE61);
  }
  return xabcdPatternImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/pitchforks/pitchfan.js
var OUTSIDE_CTX_MESSAGE62 = "draw.pitchfan called outside an active script step";
function pitchfanImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE62);
  const subId = nextSubId(ctx, slotId);
  const state2 = { kind: "pitchfan", anchors, style: opts };
  return createDrawingHandle(slotId, subId, "pitchfan", state2);
}
function pitchfan(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE62);
  }
  return pitchfanImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/pitchforks/pitchfork.js
var OUTSIDE_CTX_MESSAGE63 = "draw.pitchfork called outside an active script step";
function pitchforkImpl(slotId, anchors, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE63);
  const subId = nextSubId(ctx, slotId);
  const { variant: variantOpt, ...style } = opts;
  const state2 = {
    kind: "pitchfork",
    anchors,
    variant: variantOpt ?? "standard",
    style
  };
  return createDrawingHandle(slotId, subId, "pitchfork", state2);
}
function pitchfork(arg1, arg2, arg3) {
  if (typeof arg1 !== "string" || arg2 === void 0 || !Array.isArray(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE63);
  }
  return pitchforkImpl(arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/draw/table/table.js
var OUTSIDE_CTX_MESSAGE64 = "draw.table called outside an active script step";
function tableImpl(slotId, opts) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null)
    throw new Error(OUTSIDE_CTX_MESSAGE64);
  const subId = nextSubId(ctx, slotId);
  const state2 = {
    kind: "table",
    position: opts.position,
    cells: opts.cells,
    ...opts.borderColor === void 0 ? {} : { borderColor: opts.borderColor },
    ...opts.borderWidth === void 0 ? {} : { borderWidth: opts.borderWidth },
    ...opts.frame === void 0 ? {} : { frame: opts.frame }
  };
  return createDrawingHandle(slotId, subId, "table", state2);
}
function table2(arg1, arg2) {
  if (typeof arg1 !== "string" || arg2 === void 0) {
    throw new Error(OUTSIDE_CTX_MESSAGE64);
  }
  return tableImpl(arg1, arg2);
}

// ../runtime/dist/emit/draw/namespace.js
var KIND_IMPLS = {
  // Task 5 — Lines/Rays
  line,
  horizontalLine,
  horizontalRay,
  verticalLine,
  crossLine,
  trendAngle,
  // Task 6 — Boxes A
  rectangle,
  rotatedRectangle,
  triangle,
  polyline,
  // Task 7 — Boxes B
  circle,
  ellipse,
  path,
  marker,
  // Task 8 — Curves
  arc,
  curve,
  doubleCurve,
  // Task 8 — Freehand
  pen,
  highlighter,
  brush,
  // Task 9 — Annotations
  text,
  arrow,
  arrowMarker,
  arrowMarkUp,
  arrowMarkDown,
  // Task 10 — Channels
  trendChannel,
  flatTopBottom,
  disjointChannel,
  regressionTrend,
  // Task 11 — Fibonacci A
  fibRetracement,
  fibTrendExtension,
  fibChannel,
  fibTimeZone,
  fibWedge,
  // Task 12 — Fibonacci B
  fibSpeedFan,
  fibSpeedArcs,
  fibSpiral,
  fibCircles,
  fibTrendTime,
  // Task 13 — Gann
  gannBox,
  gannSquareFixed,
  gannSquare,
  gannFan,
  // Task 14 — Pitchforks
  pitchfork,
  pitchfan,
  // Task 15 — Harmonic Patterns
  xabcdPattern,
  cypherPattern,
  headAndShoulders,
  abcdPattern,
  trianglePattern,
  threeDrivesPattern,
  // Task 16 — Elliott Waves
  elliottImpulseWave,
  elliottCorrectionWave,
  elliottTriangleWave,
  elliottDoubleCombo,
  elliottTripleCombo,
  // Task 17 — Cycles
  cyclicLines,
  timeCycles,
  sineLine,
  // Task 18 — Containers
  group,
  frame,
  // Phase 5 — Viewport overlays
  table: table2
};
var IMPL_KIND_NAMES = new Set(Object.keys(KIND_IMPLS));
var DRAW_NAMESPACE = new Proxy(KIND_IMPLS, {
  get(target, property) {
    const name = String(property);
    if (IMPL_KIND_NAMES.has(name)) {
      return Reflect.get(target, property);
    }
    return Reflect.get(draw, property);
  }
});

// ../runtime/dist/emit/hline.js
var OUTSIDE_CTX_MESSAGE65 = "hline called outside an active script step";
function hlineImpl(ctx, slotId, price, opts) {
  const style = {
    kind: "horizontal-line",
    lineWidth: opts.lineWidth ?? 1,
    lineStyle: opts.lineStyle ?? "solid"
  };
  if (!ctx.capabilities.plots.has("horizontal-line")) {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "unsupported-plot-kind",
      message: 'Adapter cannot render plot kind "horizontal-line".',
      slotId,
      bar: ctx.barIndex()
    });
    return;
  }
  const pane = resolvePane(opts.pane, ctx, slotId);
  const emission = {
    kind: "plot",
    slotId,
    title: opts.title ?? "",
    style,
    bar: ctx.barIndex(),
    time: ctx.stream.bar.time,
    value: Number.isFinite(price) ? price : null,
    color: opts.color ?? null,
    meta: {},
    pane
  };
  pushPlot(ctx.emissions, applyPlotOverride(emission, ctx.plotOverrides[slotId]));
}
function hline2(arg1, arg2, arg3) {
  if (typeof arg1 !== "string") {
    throw new Error(OUTSIDE_CTX_MESSAGE65);
  }
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (!ctx)
    throw new Error(OUTSIDE_CTX_MESSAGE65);
  if (typeof arg2 !== "number") {
    throw new Error(OUTSIDE_CTX_MESSAGE65);
  }
  hlineImpl(ctx, arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/emit/runtimeError.js
var RUNTIME_ERROR_SENTINEL = Symbol("runtime-error-halt");
function makeRuntimeErrorHalt(message2) {
  return Object.freeze({ sentinel: RUNTIME_ERROR_SENTINEL, message: message2 });
}
function isRuntimeErrorHalt(err) {
  return typeof err === "object" && err !== null && "sentinel" in err && err.sentinel === RUNTIME_ERROR_SENTINEL && "message" in err && typeof err.message === "string";
}

// ../runtime/dist/emit/logEmission.js
var MAX_LOGS_PER_STEP = 1e3;
function isPlainObject2(v) {
  if (typeof v !== "object" || v === null)
    return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
function isJsonValue(v) {
  if (v === null)
    return true;
  const t = typeof v;
  if (t === "boolean" || t === "string")
    return true;
  if (t === "number")
    return Number.isFinite(v);
  if (Array.isArray(v))
    return v.every(isJsonValue);
  if (!isPlainObject2(v))
    return false;
  for (const key of Object.keys(v)) {
    let child;
    try {
      child = Reflect.get(v, key);
    } catch {
      return false;
    }
    if (!isJsonValue(child))
      return false;
  }
  return true;
}
function snapshotJsonValue(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => snapshotJsonValue(item)));
  }
  if (isPlainObject2(value)) {
    const entries = Object.entries(value).map(([key, item]) => [
      key,
      snapshotJsonValue(item)
    ]);
    return Object.freeze(Object.fromEntries(entries));
  }
  return value;
}
function snapshotMeta2(meta) {
  return snapshotJsonValue(meta);
}
function diagnoseLogBudget(ctx) {
  if (ctx.logBudgetExceededDiagnosed)
    return;
  ctx.logBudgetExceededDiagnosed = true;
  pushDiagnostic(ctx.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code: "runtime-log-budget-exceeded",
    message: "runtime.log.* emitted more than 1000 messages in one compute step; later logs were dropped.",
    slotId: null,
    bar: ctx.barIndex()
  });
}
function emitLog(ctx, level, message2, meta) {
  if (!ctx.capabilities.logs)
    return;
  if (ctx.logBudget >= MAX_LOGS_PER_STEP) {
    diagnoseLogBudget(ctx);
    return;
  }
  if (meta !== void 0 && !isJsonValue(meta)) {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "malformed-log-meta",
      message: "runtime.log.* meta must be JSON-serialisable.",
      slotId: null,
      bar: ctx.barIndex()
    });
    return;
  }
  const emission = {
    kind: "log",
    level,
    message: message2,
    ...meta === void 0 ? {} : { meta: snapshotMeta2(meta) },
    bar: ctx.barIndex(),
    time: ctx.stream.bar.time
  };
  ctx.logBudget += 1;
  pushLog(ctx.emissions, emission);
}
function buildRuntimeNamespace(ctx) {
  return Object.freeze({
    log: Object.freeze({
      info: (message2, meta) => emitLog(ctx, "info", message2, meta),
      warn: (message2, meta) => emitLog(ctx, "warn", message2, meta),
      error: (message2, meta) => emitLog(ctx, "error", message2, meta)
    }),
    error: (message2) => {
      throw makeRuntimeErrorHalt(message2);
    }
  });
}

// ../runtime/dist/emit/plot.js
var OUTSIDE_CTX_MESSAGE66 = "plot called outside an active script step";
function isSeriesNumber(v) {
  return typeof v === "object" && v !== null && "current" in v;
}
function isNumberOrSeries(v) {
  return typeof v === "number" || isSeriesNumber(v);
}
function resolveValue(value) {
  const resolved = typeof value === "number" ? value : value.current;
  return Number.isFinite(resolved) ? resolved : null;
}
function buildStyle(opts) {
  const style = opts.style;
  if (style === void 0) {
    return {
      kind: "line",
      lineWidth: opts.lineWidth ?? 1,
      lineStyle: opts.lineStyle ?? "solid"
    };
  }
  switch (style.kind) {
    case "histogram":
      return { kind: "histogram", baseline: style.baseline ?? 0 };
    case "marker":
      return { kind: "marker", shape: style.shape, size: style.size };
    case "shape":
      return {
        kind: "shape",
        shape: style.shape,
        size: style.size,
        ...style.location === void 0 ? {} : { location: style.location }
      };
    case "character":
      return {
        kind: "character",
        char: style.char,
        size: style.size,
        ...style.location === void 0 ? {} : { location: style.location }
      };
    case "arrow":
      return { kind: "arrow", direction: style.direction, size: style.size };
    case "candle-override":
      return {
        kind: "candle-override",
        bull: style.bull,
        bear: style.bear,
        ...style.doji === void 0 ? {} : { doji: style.doji }
      };
    case "bar-override":
      return { kind: "bar-override", color: style.color };
    case "bg-color":
      return {
        kind: "bg-color",
        color: style.color,
        ...style.transp === void 0 ? {} : { transp: style.transp }
      };
    case "bar-color":
      return { kind: "bar-color", color: style.color };
    case "horizontal-histogram":
      return { kind: "horizontal-histogram", buckets: style.buckets };
    case "line":
    case "step-line":
    case "horizontal-line":
      return {
        kind: style.kind,
        lineWidth: opts.lineWidth ?? 1,
        lineStyle: opts.lineStyle ?? "solid"
      };
  }
}
function plotImpl(ctx, slotId, value, opts) {
  const style = buildStyle(opts);
  if (!ctx.capabilities.plots.has(style.kind)) {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "unsupported-plot-kind",
      message: `Adapter cannot render plot kind "${style.kind}".`,
      slotId,
      bar: ctx.barIndex()
    });
    return;
  }
  const pane = resolvePane(opts.pane, ctx, slotId);
  const emission = {
    kind: "plot",
    slotId,
    title: opts.title ?? "",
    style,
    bar: ctx.barIndex(),
    time: ctx.stream.bar.time,
    value: resolveValue(value),
    color: opts.color ?? null,
    meta: {},
    pane
  };
  pushPlot(ctx.emissions, applyPlotOverride(emission, ctx.plotOverrides[slotId]));
}
function plot2(arg1, arg2, arg3) {
  if (typeof arg1 !== "string") {
    throw new Error(OUTSIDE_CTX_MESSAGE66);
  }
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (!ctx)
    throw new Error(OUTSIDE_CTX_MESSAGE66);
  if (!isNumberOrSeries(arg2)) {
    throw new Error(OUTSIDE_CTX_MESSAGE66);
  }
  plotImpl(ctx, arg1, arg2, arg3 ?? {});
}

// ../runtime/dist/ta/lib/volume-profile/scaffold.js
var DEFAULT_ROW_SIZE = 24;
var DEFAULT_VALUE_AREA_PCT = 0.7;
var HISTOGRAM_SLOT_SUFFIX = "/histogram";
function createVolumeProfileCore(capacity) {
  return {
    buckets: [],
    pocBuffer: new Float64RingBuffer(capacity),
    valHighBuffer: new Float64RingBuffer(capacity),
    valLowBuffer: new Float64RingBuffer(capacity)
  };
}
function volumeProfileConfigFromOpts(opts) {
  const rowSize = opts.rowSize;
  const valueAreaPct = opts.valueAreaPct ?? DEFAULT_VALUE_AREA_PCT;
  return {
    rowSize: rowSize === void 0 || rowSize <= 0 ? DEFAULT_ROW_SIZE : rowSize,
    valueAreaPct: valueAreaPct <= 1 ? valueAreaPct * 100 : valueAreaPct
  };
}
function degenerateVolumeProfile(bars, bucketColor) {
  let totalVolume = 0;
  let price = Number.NaN;
  for (const bar of bars) {
    if (!Number.isFinite(bar.close))
      continue;
    price = bar.close;
    if (Number.isFinite(bar.volume) && bar.volume > 0)
      totalVolume += bar.volume;
  }
  if (!Number.isFinite(price) || totalVolume <= 0)
    return null;
  const bucket = bucketColor === void 0 ? { price, volume: totalVolume } : { price, volume: totalVolume, color: bucketColor };
  return {
    buckets: [bucket],
    poc: price,
    valHigh: price,
    valLow: price
  };
}
function emptyVolumeProfileSnapshot() {
  return {
    buckets: [],
    poc: Number.NaN,
    valHigh: Number.NaN,
    valLow: Number.NaN
  };
}
function resolveVolumeProfileSnapshot(args) {
  const { bars, config, bucketColor } = args;
  const profile = bars.length === 0 ? null : computeProfile({
    config,
    laneBars: bars,
    windowFromIdx: 0,
    windowToIdx: bars.length - 1
  });
  if (profile !== null && profile.buckets.length > 0) {
    return {
      buckets: profile.buckets.map((bucket) => bucketColor === void 0 ? bucket : { ...bucket, color: bucketColor }),
      poc: profile.poc,
      valHigh: profile.valHigh,
      valLow: profile.valLow
    };
  }
  return degenerateVolumeProfile(bars, bucketColor) ?? emptyVolumeProfileSnapshot();
}
function commitVolumeProfileSnapshot(core, isTick, snapshot6) {
  core.buckets = snapshot6.buckets;
  if (isTick) {
    core.pocBuffer.replaceHead(snapshot6.poc);
    core.valHighBuffer.replaceHead(snapshot6.valHigh);
    core.valLowBuffer.replaceHead(snapshot6.valLow);
  } else {
    core.pocBuffer.append(snapshot6.poc);
    core.valHighBuffer.append(snapshot6.valHigh);
    core.valLowBuffer.append(snapshot6.valLow);
  }
}
function emitVolumeProfileHistogram(ctx, slotId, title, value, buckets) {
  if (!ctx.capabilities.plots.has("horizontal-histogram")) {
    const key = `unsupported-plot-kind|${slotId}`;
    if (ctx.diagnosedRequestKeys.has(key))
      return;
    ctx.diagnosedRequestKeys.add(key);
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "unsupported-plot-kind",
      message: 'Adapter cannot render plot kind "horizontal-histogram".',
      slotId,
      bar: ctx.barIndex()
    });
    return;
  }
  const emission = {
    bar: ctx.barIndex(),
    color: null,
    kind: "plot",
    meta: {},
    pane: "overlay",
    slotId: `${slotId}${HISTOGRAM_SLOT_SUFFIX}`,
    style: { kind: "horizontal-histogram", buckets },
    time: ctx.stream.bar.time,
    title,
    value: Number.isFinite(value) ? value : null
  };
  pushPlot(ctx.emissions, emission);
}

// ../runtime/dist/ta/anchoredVolumeProfile.js
function getCtx7() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.anchoredVolumeProfile called outside an active script step");
  }
  return ctx;
}
function initSlot5(capacity) {
  const core = createVolumeProfileCore(capacity);
  const slot = {
    ...core,
    result: Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeSeriesView(core.pocBuffer),
      valHigh: makeSeriesView(core.valHighBuffer),
      valLow: makeSeriesView(core.valLowBuffer)
    }),
    shiftedResults: /* @__PURE__ */ new Map()
  };
  return slot;
}
function resultForOffset(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeShiftedSeriesView(slot.pocBuffer, offset),
      valHigh: makeShiftedSeriesView(slot.valHighBuffer, offset),
      valLow: makeShiftedSeriesView(slot.valLowBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function collectBars(ctx, anchor) {
  if (ctx.stream.bar.time <= anchor)
    return [];
  const { ohlcv } = ctx.stream;
  const bars = [];
  for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
    const time = ohlcv.time.at(lookback);
    if (time < anchor)
      continue;
    bars.push({
      close: ohlcv.close.at(lookback),
      high: ohlcv.high.at(lookback),
      low: ohlcv.low.at(lookback),
      open: ohlcv.open.at(lookback),
      time,
      volume: ohlcv.volume.at(lookback)
    });
  }
  return bars;
}
function anchoredVolumeProfile(slotId, opts) {
  const ctx = getCtx7();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot5(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const snapshot6 = resolveVolumeProfileSnapshot({
    bars: collectBars(ctx, opts.anchor),
    bucketColor: opts.bucketColor,
    config: volumeProfileConfigFromOpts(opts)
  });
  commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot6);
  emitVolumeProfileHistogram(ctx, slotId, "Anchored Volume Profile", snapshot6.poc, snapshot6.buckets);
  return resultForOffset(slot, opts.offset ?? 0);
}

// ../runtime/dist/ta/anchoredVwap.js
var DEFAULT_SOURCE = "hlc3";
function getCtx8() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.anchoredVwap called outside an active script step");
  }
  return ctx;
}
function initSlot6(capacity, anchorTime) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    anchorTime,
    cumPV: 0,
    cumV: 0,
    started: false,
    prevClosedCumPV: 0,
    prevClosedCumV: 0,
    prevClosedStarted: false
  };
}
function readSource(ctx, source) {
  switch (source) {
    case "close":
      return ctx.stream.bar.close;
    case "hl2":
      return ctx.stream.bar.hl2;
    case "hlc3":
      return ctx.stream.bar.hlc3;
    case "ohlc4":
      return ctx.stream.bar.ohlc4;
    case "hlcc4":
      return ctx.stream.bar.hlcc4;
  }
}
function fold(inCumPV, inCumV, inStarted, anchorTime, time, src, volume) {
  if (time < anchorTime) {
    return { cumPV: inCumPV, cumV: inCumV, started: inStarted };
  }
  let cumPV = inCumPV;
  let cumV = inCumV;
  if (Number.isFinite(src) && Number.isFinite(volume) && volume > 0) {
    cumPV += src * volume;
    cumV += volume;
  }
  return { cumPV, cumV, started: true };
}
function valueFromCum(started, cumPV, cumV) {
  if (!started || cumV === 0)
    return Number.NaN;
  return cumPV / cumV;
}
function anchoredVwap(slotId, anchorTime, opts) {
  const ctx = getCtx8();
  const source = opts?.source ?? DEFAULT_SOURCE;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot6(ctx.stream.ohlcv.close.capacity, anchorTime);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSource(ctx, source);
  const volume = ctx.stream.bar.volume;
  const time = ctx.stream.bar.time;
  if (ctx.isTick) {
    const next2 = fold(slot.prevClosedCumPV, slot.prevClosedCumV, slot.prevClosedStarted, slot.anchorTime, time, src, volume);
    slot.outBuffer.replaceHead(valueFromCum(next2.started, next2.cumPV, next2.cumV));
    return slot.series;
  }
  slot.prevClosedCumPV = slot.cumPV;
  slot.prevClosedCumV = slot.cumV;
  slot.prevClosedStarted = slot.started;
  const next = fold(slot.cumPV, slot.cumV, slot.started, slot.anchorTime, time, src, volume);
  slot.cumPV = next.cumPV;
  slot.cumV = next.cumV;
  slot.started = next.started;
  slot.outBuffer.append(valueFromCum(slot.started, slot.cumPV, slot.cumV));
  return slot.series;
}

// ../runtime/dist/ta/sma.js
function getCtx9() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.sma called outside an active script step");
  }
  return ctx;
}
function initSlot7(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    kind: "ta.sma",
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    window: new Float64RingBuffer(length),
    sum: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset2(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function tickValue3(slot, src) {
  if (!Number.isFinite(src))
    return Number.NaN;
  if (slot.window.length < slot.length)
    return Number.NaN;
  const oldestInHead = slot.window.at(0);
  return (slot.sum - oldestInHead + src) / slot.length;
}
function closeValue3(slot, src) {
  if (!Number.isFinite(src)) {
    if (slot.window.length < slot.length)
      return Number.NaN;
    return slot.sum / slot.length;
  }
  if (slot.window.length < slot.length) {
    slot.window.append(src);
    slot.sum += src;
    if (slot.window.length < slot.length)
      return Number.NaN;
    return slot.sum / slot.length;
  }
  const outgoing = slot.window.at(slot.length - 1);
  slot.window.append(src);
  slot.sum = slot.sum + src - outgoing;
  return slot.sum / slot.length;
}
function sma(slotId, source, length, opts) {
  const ctx = getCtx9();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot7(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue3(slot, src));
  } else {
    slot.outBuffer.append(closeValue3(slot, src));
  }
  return viewForOffset2(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/ao.js
var DEFAULT_FAST_LENGTH = 5;
var DEFAULT_SLOW_LENGTH = 34;
function getCtx10() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.ao called outside an active script step");
  }
  return ctx;
}
function initSlot8(capacity, slotId) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    fastSmaSub: `${slotId}/fastSma`,
    slowSmaSub: `${slotId}/slowSma`
  };
}
function combine(fast, slow) {
  if (!Number.isFinite(fast) || !Number.isFinite(slow))
    return Number.NaN;
  return fast - slow;
}
function ao(slotId, opts) {
  const ctx = getCtx10();
  const fastLength = opts?.fastLength ?? DEFAULT_FAST_LENGTH;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW_LENGTH;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot8(ctx.stream.ohlcv.close.capacity, slotId);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const hl2 = ctx.stream.bar.hl2;
  const fastSeries = sma(slot.fastSmaSub, hl2, fastLength);
  const slowSeries = sma(slot.slowSmaSub, hl2, slowLength);
  const value = combine(fastSeries.current, slowSeries.current);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/aroon.js
function getCtx11() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.aroon called outside an active script step");
  }
  return ctx;
}
function initSlot9(length, capacity) {
  const upBuffer = new Float64RingBuffer(capacity);
  const downBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      up: makeSeriesView(upBuffer),
      down: makeSeriesView(downBuffer)
    }),
    upBuffer,
    downBuffer,
    length,
    highWindow: new Float64RingBuffer(length + 1),
    lowWindow: new Float64RingBuffer(length + 1),
    barCount: 0,
    lastHighIndex: 0,
    lastLowIndex: 0
  };
}
function scanHighArgmax(window, headHigh, length) {
  let bestIdx = -1;
  let bestVal = Number.NEGATIVE_INFINITY;
  if (Number.isFinite(headHigh)) {
    bestIdx = 0;
    bestVal = headHigh;
  }
  for (let k = 1; k <= length; k += 1) {
    const v = window.at(k);
    if (Number.isFinite(v) && v > bestVal) {
      bestVal = v;
      bestIdx = k;
    }
  }
  return bestIdx;
}
function scanLowArgmin(window, headLow, length) {
  let bestIdx = -1;
  let bestVal = Number.POSITIVE_INFINITY;
  if (Number.isFinite(headLow)) {
    bestIdx = 0;
    bestVal = headLow;
  }
  for (let k = 1; k <= length; k += 1) {
    const v = window.at(k);
    if (Number.isFinite(v) && v < bestVal) {
      bestVal = v;
      bestIdx = k;
    }
  }
  return bestIdx;
}
function closeStep2(slot, high, low) {
  slot.barCount += 1;
  slot.highWindow.append(high);
  slot.lowWindow.append(low);
  if (slot.barCount <= slot.length) {
    return { up: Number.NaN, down: Number.NaN };
  }
  const barsSinceHigh = scanHighArgmax(slot.highWindow, slot.highWindow.at(0), slot.length);
  const barsSinceLow = scanLowArgmin(slot.lowWindow, slot.lowWindow.at(0), slot.length);
  if (barsSinceHigh === -1 || barsSinceLow === -1) {
    return { up: Number.NaN, down: Number.NaN };
  }
  slot.lastHighIndex = barsSinceHigh;
  slot.lastLowIndex = barsSinceLow;
  const up = 100 * (slot.length - barsSinceHigh) / slot.length;
  const down = 100 * (slot.length - barsSinceLow) / slot.length;
  return { up, down };
}
function tickStep(slot, high, low) {
  if (slot.barCount <= slot.length)
    return { up: Number.NaN, down: Number.NaN };
  const barsSinceHigh = scanHighArgmax(slot.highWindow, high, slot.length);
  const barsSinceLow = scanLowArgmin(slot.lowWindow, low, slot.length);
  if (barsSinceHigh === -1 || barsSinceLow === -1) {
    return { up: Number.NaN, down: Number.NaN };
  }
  const up = 100 * (slot.length - barsSinceHigh) / slot.length;
  const down = 100 * (slot.length - barsSinceLow) / slot.length;
  return { up, down };
}
function aroon(slotId, length, _opts) {
  const ctx = getCtx11();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot9(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const high = ctx.stream.bar.high;
  const low = ctx.stream.bar.low;
  if (ctx.isTick) {
    const { up, down } = tickStep(slot, high, low);
    slot.upBuffer.replaceHead(up);
    slot.downBuffer.replaceHead(down);
  } else {
    const { up, down } = closeStep2(slot, high, low);
    slot.upBuffer.append(up);
    slot.downBuffer.append(down);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/aroonOsc.js
function getCtx12() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.aroonOsc called outside an active script step");
  }
  return ctx;
}
function initSlot10(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer)
  };
}
function aroonOsc(slotId, length, _opts) {
  const ctx = getCtx12();
  const r = aroon(`${slotId}/aroon`, length);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot10(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const up = r.up.current;
  const down = r.down.current;
  const value = Number.isFinite(up) && Number.isFinite(down) ? up - down : Number.NaN;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/atr.js
function getCtx13() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.atr called outside an active script step");
  }
  return ctx;
}
function initSlot11(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    seedTrSum: 0,
    trCount: 0,
    atr: Number.NaN,
    prevClose: Number.NaN,
    prevPrevClose: Number.NaN,
    prevClosedAtr: Number.NaN,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset3(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function trueRange2(high, low, prevClose) {
  if (!Number.isFinite(prevClose))
    return high - low;
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}
function closeValue4(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    if (Number.isFinite(slot.atr))
      return slot.atr;
    return Number.NaN;
  }
  const tr = trueRange2(high, low, slot.prevClose);
  slot.prevPrevClose = slot.prevClose;
  slot.prevClose = close;
  slot.trCount += 1;
  if (slot.trCount < slot.length) {
    slot.seedTrSum += tr;
    return Number.NaN;
  }
  if (slot.trCount === slot.length) {
    slot.seedTrSum += tr;
    slot.atr = slot.seedTrSum / slot.length;
    slot.prevClosedAtr = slot.atr;
    return slot.atr;
  }
  slot.prevClosedAtr = slot.atr;
  slot.atr = wilderStep(slot.atr, tr, slot.length);
  return slot.atr;
}
function tickValue4(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return Number.isFinite(slot.atr) ? slot.atr : Number.NaN;
  }
  if (slot.trCount < slot.length)
    return Number.NaN;
  const tr = trueRange2(high, low, slot.prevPrevClose);
  if (slot.trCount === slot.length) {
    return slot.atr;
  }
  return wilderStep(slot.prevClosedAtr, tr, slot.length);
}
function atr(slotId, length, opts) {
  const ctx = getCtx13();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot11(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue4(slot, bar.high, bar.low, bar.close));
  } else {
    slot.outBuffer.append(closeValue4(slot, bar.high, bar.low, bar.close));
  }
  return viewForOffset3(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/barssince.js
function getCtx14() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.barssince called outside an active script step");
  }
  return ctx;
}
function initSlot12(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedSeries: /* @__PURE__ */ new Map(),
    sinceTrue: 0,
    seenTrue: false,
    prevSinceTrue: 0,
    prevSeenTrue: false
  };
}
function closeValue5(slot, fired) {
  slot.prevSinceTrue = slot.sinceTrue;
  slot.prevSeenTrue = slot.seenTrue;
  if (fired) {
    slot.sinceTrue = 0;
    slot.seenTrue = true;
  } else if (slot.seenTrue) {
    slot.sinceTrue += 1;
  }
  return slot.seenTrue ? slot.sinceTrue : Number.NaN;
}
function tickValue5(slot, fired) {
  let sinceTrue = slot.prevSinceTrue;
  let seenTrue = slot.prevSeenTrue;
  if (fired) {
    sinceTrue = 0;
    seenTrue = true;
  } else if (seenTrue) {
    sinceTrue += 1;
  }
  return seenTrue ? sinceTrue : Number.NaN;
}
function barssince(slotId, condition, opts = {}) {
  const ctx = getCtx14();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot12(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const fired = condition.current === true;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue5(slot, fired));
  } else {
    slot.outBuffer.append(closeValue5(slot, fired));
  }
  const offset = opts.offset ?? 0;
  if (offset === 0)
    return slot.series;
  const shifted = slot.shiftedSeries.get(offset);
  if (shifted !== void 0)
    return shifted;
  const next = makeShiftedSeriesView(slot.outBuffer, offset);
  slot.shiftedSeries.set(offset, next);
  return next;
}

// ../runtime/dist/ta/stdev.js
function getCtx15() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.stdev called outside an active script step");
  }
  return ctx;
}
function initSlot13(length, capacity, biased) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    biased,
    window: new Float64RingBuffer(length),
    sumX: 0,
    sumX2: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset4(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function denominator(slot) {
  return slot.biased ? slot.length : slot.length - 1;
}
function stddevFromSums(sumX, sumX2, slot) {
  const denom = denominator(slot);
  if (denom <= 0)
    return Number.NaN;
  const mean = sumX / slot.length;
  const variance = (sumX2 - slot.length * mean * mean) / denom;
  return Math.sqrt(Math.max(0, variance));
}
function closeValue6(slot, src) {
  if (!Number.isFinite(src)) {
    if (slot.window.length < slot.length)
      return Number.NaN;
    return stddevFromSums(slot.sumX, slot.sumX2, slot);
  }
  if (slot.window.length < slot.length) {
    slot.window.append(src);
    slot.sumX += src;
    slot.sumX2 += src * src;
    if (slot.window.length < slot.length)
      return Number.NaN;
    return stddevFromSums(slot.sumX, slot.sumX2, slot);
  }
  const outgoing = slot.window.at(slot.length - 1);
  slot.window.append(src);
  slot.sumX = slot.sumX + src - outgoing;
  slot.sumX2 = slot.sumX2 + src * src - outgoing * outgoing;
  return stddevFromSums(slot.sumX, slot.sumX2, slot);
}
function tickValue6(slot, src) {
  if (!Number.isFinite(src))
    return Number.NaN;
  if (slot.window.length < slot.length)
    return Number.NaN;
  const oldestInHead = slot.window.at(0);
  const sumX = slot.sumX - oldestInHead + src;
  const sumX2 = slot.sumX2 - oldestInHead * oldestInHead + src * src;
  return stddevFromSums(sumX, sumX2, slot);
}
function stdev(slotId, source, length, opts) {
  const ctx = getCtx15();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const biased = opts?.biased === true;
    slot = initSlot13(length, ctx.stream.ohlcv.close.capacity, biased);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue6(slot, src));
  } else {
    slot.outBuffer.append(closeValue6(slot, src));
  }
  return viewForOffset4(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/bb.js
var DEFAULT_MULTIPLIER = 2;
function getCtx16() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.bb called outside an active script step");
  }
  return ctx;
}
function initSlot14(capacity, middle, middleBuf) {
  const upper = new Float64RingBuffer(capacity);
  const lower = new Float64RingBuffer(capacity);
  const upperView = makeSeriesView(upper);
  const lowerView = makeSeriesView(lower);
  return {
    result: Object.freeze({ upper: upperView, middle, lower: lowerView }),
    upper,
    middle,
    lower,
    middleBuf,
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset2(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      upper: makeShiftedSeriesView(slot.upper, offset),
      middle: makeShiftedSeriesView(slot.middleBuf, offset),
      lower: makeShiftedSeriesView(slot.lower, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function bb(slotId, source, length, opts) {
  const ctx = getCtx16();
  const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER;
  const src = readSourceValue(source);
  const middleSlotId = `${slotId}/sma`;
  const stdevSlotId = `${slotId}/stdev`;
  const middleSeries = sma(middleSlotId, src, length);
  const sigmaSeries = stdev(stdevSlotId, src, length, { biased: true });
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const smaSlot = ctx.stream.taSlots.get(middleSlotId);
    slot = initSlot14(ctx.stream.ohlcv.close.capacity, middleSeries, smaSlot.outBuffer);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const mid = middleSeries.current;
  const sigma = sigmaSeries.current;
  let upperValue;
  let lowerValue;
  if (Number.isFinite(mid) && Number.isFinite(sigma)) {
    upperValue = mid + multiplier * sigma;
    lowerValue = mid - multiplier * sigma;
  } else {
    upperValue = Number.NaN;
    lowerValue = Number.NaN;
  }
  if (ctx.isTick) {
    slot.upper.replaceHead(upperValue);
    slot.lower.replaceHead(lowerValue);
  } else {
    slot.upper.append(upperValue);
    slot.lower.append(lowerValue);
  }
  return resultForOffset2(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/bbPercentB.js
var DEFAULT_MULTIPLIER2 = 2;
function getCtx17() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.bbPercentB called outside an active script step");
  }
  return ctx;
}
function initSlot15(length, multiplier, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    multiplier,
    bbSub: null
  };
}
function percentBValue(src, upper, lower) {
  if (!Number.isFinite(src) || !Number.isFinite(upper) || !Number.isFinite(lower)) {
    return Number.NaN;
  }
  const denom = upper - lower;
  if (denom === 0)
    return Number.NaN;
  return (src - lower) / denom;
}
function bbPercentB(slotId, source, length, opts) {
  const ctx = getCtx17();
  const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER2;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot15(length, multiplier, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  const bands = bb(`${slotId}/bb`, source, length, { multiplier });
  if (slot.bbSub === null)
    slot.bbSub = bands;
  const value = percentBValue(src, bands.upper.current, bands.lower.current);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/bbw.js
var DEFAULT_MULTIPLIER3 = 2;
function getCtx18() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.bbw called outside an active script step");
  }
  return ctx;
}
function initSlot16(length, multiplier, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    multiplier,
    bbSub: null
  };
}
function bbwValue(upper, middle, lower) {
  if (!Number.isFinite(upper) || !Number.isFinite(middle) || !Number.isFinite(lower) || middle === 0) {
    return Number.NaN;
  }
  return (upper - lower) / middle;
}
function bbw(slotId, source, length, opts) {
  const ctx = getCtx18();
  const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER3;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot16(length, multiplier, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bands = bb(`${slotId}/bb`, source, length, { multiplier });
  if (slot.bbSub === null)
    slot.bbSub = bands;
  const value = bbwValue(bands.upper.current, bands.middle.current, bands.lower.current);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/bop.js
function getCtx19() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.bop called outside an active script step");
  }
  return ctx;
}
function initSlot17(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return { outBuffer, series: makeSeriesView(outBuffer) };
}
function bopAt(open, high, low, close) {
  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return Number.NaN;
  }
  const range = high - low;
  if (range === 0)
    return 0;
  return (close - open) / range;
}
function bop(slotId, _opts) {
  const ctx = getCtx19();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot17(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { open, high, low, close } = ctx.stream.bar;
  const value = bopAt(open, high, low, close);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/cci.js
var SCALING = 0.015;
function getCtx20() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.cci called outside an active script step");
  }
  return ctx;
}
function initSlot18(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    typicalPriceWindow: new Float64RingBuffer(length),
    sumTp: 0,
    count: 0
  };
}
function cciFromCenter(center, currentTp, meanDev) {
  if (meanDev === 0)
    return Number.NaN;
  return (currentTp - center) / (SCALING * meanDev);
}
function meanAbsDev(window, center, length) {
  let sumAbs = 0;
  for (let i = 0; i < length; i += 1) {
    const v = window.at(i);
    const dev = v - center;
    sumAbs += dev < 0 ? -dev : dev;
  }
  return sumAbs / length;
}
function closeValue7(slot, src) {
  if (!Number.isFinite(src)) {
    if (slot.count < slot.length)
      return Number.NaN;
    const center2 = slot.sumTp / slot.length;
    const currentTp = slot.typicalPriceWindow.at(0);
    if (!Number.isFinite(currentTp))
      return Number.NaN;
    const md2 = meanAbsDev(slot.typicalPriceWindow, center2, slot.length);
    return cciFromCenter(center2, currentTp, md2);
  }
  if (slot.count < slot.length) {
    slot.typicalPriceWindow.append(src);
    slot.sumTp += src;
    slot.count += 1;
    if (slot.count < slot.length)
      return Number.NaN;
    const center2 = slot.sumTp / slot.length;
    const md2 = meanAbsDev(slot.typicalPriceWindow, center2, slot.length);
    return cciFromCenter(center2, src, md2);
  }
  const outgoing = slot.typicalPriceWindow.at(slot.length - 1);
  slot.typicalPriceWindow.append(src);
  slot.sumTp = slot.sumTp + src - outgoing;
  const center = slot.sumTp / slot.length;
  const md = meanAbsDev(slot.typicalPriceWindow, center, slot.length);
  return cciFromCenter(center, src, md);
}
function tickValue7(slot, src) {
  if (slot.count < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src)) {
    const center2 = slot.sumTp / slot.length;
    const currentTp = slot.typicalPriceWindow.at(0);
    if (!Number.isFinite(currentTp))
      return Number.NaN;
    const md2 = meanAbsDev(slot.typicalPriceWindow, center2, slot.length);
    return cciFromCenter(center2, currentTp, md2);
  }
  const headValue = slot.typicalPriceWindow.at(0);
  const adjustedSum = slot.sumTp - headValue + src;
  const center = adjustedSum / slot.length;
  let sumAbs = 0;
  for (let i = 0; i < slot.length; i += 1) {
    const v = i === 0 ? src : slot.typicalPriceWindow.at(i);
    const dev = v - center;
    sumAbs += dev < 0 ? -dev : dev;
  }
  const md = sumAbs / slot.length;
  return cciFromCenter(center, src, md);
}
function cci(slotId, source, length, _opts) {
  const ctx = getCtx20();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot18(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue7(slot, src));
  } else {
    slot.outBuffer.append(closeValue7(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/ema.js
function getCtx21() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.ema called outside an active script step");
  }
  return ctx;
}
function initSlot19(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    kind: "ta.ema",
    outBuffer,
    series: makeSeriesView(outBuffer),
    alpha: 2 / (length + 1),
    length,
    seedSum: 0,
    seedCount: 0,
    prevEma: Number.NaN,
    prevClosedEma: Number.NaN,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset5(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function compute(slot, src, isTick) {
  if (!Number.isFinite(src)) {
    return isTick ? slot.prevEma : slot.prevClosedEma;
  }
  if (slot.seedCount < slot.length) {
    if (isTick) {
      const nextSum = slot.seedSum + src;
      const nextCount = slot.seedCount + 1;
      if (nextCount < slot.length)
        return Number.NaN;
      return nextSum / slot.length;
    }
    slot.seedSum += src;
    slot.seedCount += 1;
    if (slot.seedCount < slot.length) {
      slot.prevClosedEma = Number.NaN;
      return Number.NaN;
    }
    const seedValue = slot.seedSum / slot.length;
    slot.prevClosedEma = seedValue;
    slot.prevEma = seedValue;
    return seedValue;
  }
  const prev = slot.prevClosedEma;
  const next = src * slot.alpha + prev * (1 - slot.alpha);
  if (!isTick) {
    slot.prevClosedEma = next;
    slot.prevEma = next;
  }
  return next;
}
function ema(slotId, source, length, opts) {
  const ctx = getCtx21();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot19(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const value = compute(slot, readSourceValue(source), ctx.isTick);
  if (ctx.isTick)
    slot.outBuffer.replaceHead(value);
  else
    slot.outBuffer.append(value);
  return viewForOffset5(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/chaikinOsc.js
var DEFAULT_FAST = 3;
var DEFAULT_SLOW = 10;
function getCtx22() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.chaikinOsc called outside an active script step");
  }
  return ctx;
}
function initSlot20(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset6(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function diff(fast, slow) {
  if (!Number.isFinite(fast) || !Number.isFinite(slow))
    return Number.NaN;
  return fast - slow;
}
function chaikinOsc(slotId, opts) {
  const ctx = getCtx22();
  const fastLength = opts?.fastLength ?? DEFAULT_FAST;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW;
  const offset = opts?.offset ?? 0;
  const adlSeries = adl(`${slotId}/adl`);
  const fastSeries = ema(`${slotId}/fast`, adlSeries.current, fastLength);
  const slowSeries = ema(`${slotId}/slow`, adlSeries.current, slowLength);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot20(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const value = diff(fastSeries.current, slowSeries.current);
  if (ctx.isTick)
    slot.outBuffer.replaceHead(value);
  else
    slot.outBuffer.append(value);
  return viewForOffset6(slot, offset);
}

// ../runtime/dist/ta/highest.js
function getCtx23() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.highest called outside an active script step");
  }
  return ctx;
}
function initSlot21(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length),
    monoIndices: [],
    monoValues: [],
    barCount: 0,
    closedMaxExcludingHead: Number.NEGATIVE_INFINITY
  };
}
function recomputeMaxExcludingHead(slot) {
  let maxV = Number.NEGATIVE_INFINITY;
  const filled = slot.sourceWindow.length;
  for (let i = 1; i < filled; i += 1) {
    const v = slot.sourceWindow.at(i);
    if (Number.isFinite(v) && v > maxV)
      maxV = v;
  }
  return maxV;
}
function closeValue8(slot, src) {
  slot.barCount += 1;
  const headIndex = slot.barCount - 1;
  slot.sourceWindow.append(src);
  const oldestAllowed = headIndex - slot.length + 1;
  while (slot.monoIndices.length > 0 && slot.monoIndices[0] < oldestAllowed) {
    slot.monoIndices.shift();
    slot.monoValues.shift();
  }
  if (Number.isFinite(src)) {
    while (slot.monoIndices.length > 0 && slot.monoValues[slot.monoValues.length - 1] < src) {
      slot.monoIndices.pop();
      slot.monoValues.pop();
    }
    slot.monoIndices.push(headIndex);
    slot.monoValues.push(src);
  }
  if (slot.barCount < slot.length) {
    slot.closedMaxExcludingHead = Number.NEGATIVE_INFINITY;
    return Number.NaN;
  }
  slot.closedMaxExcludingHead = recomputeMaxExcludingHead(slot);
  if (slot.monoIndices.length === 0) {
    return Number.NaN;
  }
  return slot.monoValues[0];
}
function tickValue8(slot, src) {
  if (slot.barCount < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src)) {
    return slot.closedMaxExcludingHead === Number.NEGATIVE_INFINITY ? Number.NaN : slot.closedMaxExcludingHead;
  }
  if (slot.closedMaxExcludingHead === Number.NEGATIVE_INFINITY) {
    return src;
  }
  return Math.max(slot.closedMaxExcludingHead, src);
}
function highest(slotId, source, length, _opts) {
  const ctx = getCtx23();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot21(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue8(slot, src));
  } else {
    slot.outBuffer.append(closeValue8(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/lowest.js
function getCtx24() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.lowest called outside an active script step");
  }
  return ctx;
}
function initSlot22(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length),
    monoIndices: [],
    monoValues: [],
    barCount: 0,
    closedMinExcludingHead: Number.POSITIVE_INFINITY
  };
}
function recomputeMinExcludingHead(slot) {
  let minV = Number.POSITIVE_INFINITY;
  const filled = slot.sourceWindow.length;
  for (let i = 1; i < filled; i += 1) {
    const v = slot.sourceWindow.at(i);
    if (Number.isFinite(v) && v < minV)
      minV = v;
  }
  return minV;
}
function closeValue9(slot, src) {
  slot.barCount += 1;
  const headIndex = slot.barCount - 1;
  slot.sourceWindow.append(src);
  const oldestAllowed = headIndex - slot.length + 1;
  while (slot.monoIndices.length > 0 && slot.monoIndices[0] < oldestAllowed) {
    slot.monoIndices.shift();
    slot.monoValues.shift();
  }
  if (Number.isFinite(src)) {
    while (slot.monoIndices.length > 0 && slot.monoValues[slot.monoValues.length - 1] > src) {
      slot.monoIndices.pop();
      slot.monoValues.pop();
    }
    slot.monoIndices.push(headIndex);
    slot.monoValues.push(src);
  }
  if (slot.barCount < slot.length) {
    slot.closedMinExcludingHead = Number.POSITIVE_INFINITY;
    return Number.NaN;
  }
  slot.closedMinExcludingHead = recomputeMinExcludingHead(slot);
  if (slot.monoIndices.length === 0)
    return Number.NaN;
  return slot.monoValues[0];
}
function tickValue9(slot, src) {
  if (slot.barCount < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src)) {
    return slot.closedMinExcludingHead === Number.POSITIVE_INFINITY ? Number.NaN : slot.closedMinExcludingHead;
  }
  if (slot.closedMinExcludingHead === Number.POSITIVE_INFINITY) {
    return src;
  }
  return Math.min(slot.closedMinExcludingHead, src);
}
function lowest(slotId, source, length, _opts) {
  const ctx = getCtx24();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot22(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue9(slot, src));
  } else {
    slot.outBuffer.append(closeValue9(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/chandeKrollStop.js
var DEFAULT_LENGTH2 = 10;
var DEFAULT_MULTIPLIER4 = 1;
var DEFAULT_SMOOTHING2 = 9;
function getCtx25() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.chandeKrollStop called outside an active script step");
  }
  return ctx;
}
function initSlot23(capacity, length, multiplier, smoothingLength) {
  const longBuffer = new Float64RingBuffer(capacity);
  const shortBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      long: makeSeriesView(longBuffer),
      short: makeSeriesView(shortBuffer)
    }),
    longBuffer,
    shortBuffer,
    length,
    multiplier,
    smoothingLength,
    firstHighWindow: new Float64RingBuffer(smoothingLength),
    firstLowWindow: new Float64RingBuffer(smoothingLength),
    barCount: 0
  };
}
function firstPass(hi, lo, atrValue, multiplier) {
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || !Number.isFinite(atrValue)) {
    return { firstHigh: Number.NaN, firstLow: Number.NaN };
  }
  return {
    firstHigh: hi - multiplier * atrValue,
    firstLow: lo + multiplier * atrValue
  };
}
function maxOver(window, headOverride, startExclusiveOfHead, smoothingLength) {
  let best = Number.NEGATIVE_INFINITY;
  if (Number.isFinite(headOverride))
    best = headOverride;
  const startAge = startExclusiveOfHead ? 1 : 0;
  const filled = window.length;
  for (let k = startAge; k < filled && k < smoothingLength; k += 1) {
    const v = window.at(k);
    if (Number.isFinite(v) && v > best)
      best = v;
  }
  return best === Number.NEGATIVE_INFINITY ? Number.NaN : best;
}
function minOver(window, headOverride, startExclusiveOfHead, smoothingLength) {
  let best = Number.POSITIVE_INFINITY;
  if (Number.isFinite(headOverride))
    best = headOverride;
  const startAge = startExclusiveOfHead ? 1 : 0;
  const filled = window.length;
  for (let k = startAge; k < filled && k < smoothingLength; k += 1) {
    const v = window.at(k);
    if (Number.isFinite(v) && v < best)
      best = v;
  }
  return best === Number.POSITIVE_INFINITY ? Number.NaN : best;
}
function chandeKrollStop(slotId, opts) {
  const ctx = getCtx25();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const length = opts?.length ?? DEFAULT_LENGTH2;
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER4;
    const smoothingLength = opts?.smoothingLength ?? DEFAULT_SMOOTHING2;
    slot = initSlot23(ctx.stream.ohlcv.close.capacity, length, multiplier, smoothingLength);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  const atrSeries = atr(`${slotId}/atr`, slot.length);
  const highSeries = highest(`${slotId}/highHigh`, bar.high, slot.length);
  const lowSeries = lowest(`${slotId}/lowLow`, bar.low, slot.length);
  const { firstHigh, firstLow } = firstPass(highSeries.current, lowSeries.current, atrSeries.current, slot.multiplier);
  if (ctx.isTick) {
    const long = maxOver(slot.firstHighWindow, firstHigh, true, slot.smoothingLength);
    const short = minOver(slot.firstLowWindow, firstLow, true, slot.smoothingLength);
    const warm = slot.barCount >= slot.smoothingLength;
    slot.longBuffer.replaceHead(warm ? long : Number.NaN);
    slot.shortBuffer.replaceHead(warm ? short : Number.NaN);
  } else {
    slot.firstHighWindow.append(firstHigh);
    slot.firstLowWindow.append(firstLow);
    slot.barCount += 1;
    const warm = slot.barCount >= slot.length + slot.smoothingLength - 1;
    if (!warm) {
      slot.longBuffer.append(Number.NaN);
      slot.shortBuffer.append(Number.NaN);
    } else {
      const long = maxOver(slot.firstHighWindow, Number.NaN, false, slot.smoothingLength);
      const short = minOver(slot.firstLowWindow, Number.NaN, false, slot.smoothingLength);
      slot.longBuffer.append(long);
      slot.shortBuffer.append(short);
    }
  }
  return slot.outputs;
}

// ../runtime/dist/ta/chandelier.js
var DEFAULT_LENGTH3 = 22;
var DEFAULT_MULTIPLIER5 = 3;
function getCtx26() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.chandelier called outside an active script step");
  }
  return ctx;
}
function initSlot24(capacity, length, multiplier) {
  const longBuffer = new Float64RingBuffer(capacity);
  const shortBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      long: makeSeriesView(longBuffer),
      short: makeSeriesView(shortBuffer)
    }),
    longBuffer,
    shortBuffer,
    length,
    multiplier
  };
}
function compute2(hi, lo, atrValue, multiplier) {
  if (!Number.isFinite(hi) || !Number.isFinite(lo) || !Number.isFinite(atrValue)) {
    return { long: Number.NaN, short: Number.NaN };
  }
  return {
    long: hi - multiplier * atrValue,
    short: lo + multiplier * atrValue
  };
}
function chandelier(slotId, opts) {
  const ctx = getCtx26();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const length = opts?.length ?? DEFAULT_LENGTH3;
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER5;
    slot = initSlot24(ctx.stream.ohlcv.close.capacity, length, multiplier);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  const atrSeries = atr(`${slotId}/atr`, slot.length);
  const highSeries = highest(`${slotId}/highHigh`, bar.high, slot.length);
  const lowSeries = lowest(`${slotId}/lowLow`, bar.low, slot.length);
  const result = compute2(highSeries.current, lowSeries.current, atrSeries.current, slot.multiplier);
  if (ctx.isTick) {
    slot.longBuffer.replaceHead(result.long);
    slot.shortBuffer.replaceHead(result.short);
  } else {
    slot.longBuffer.append(result.long);
    slot.shortBuffer.append(result.short);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/change.js
function getCtx27() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.change called outside an active script step");
  }
  return ctx;
}
function initSlot25(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length + 1)
  };
}
function closeValue10(slot, src) {
  slot.sourceWindow.append(src);
  if (slot.sourceWindow.length <= slot.length)
    return Number.NaN;
  const head = slot.sourceWindow.at(0);
  const old = slot.sourceWindow.at(slot.length);
  if (!Number.isFinite(head) || !Number.isFinite(old))
    return Number.NaN;
  return head - old;
}
function tickValue10(slot, src) {
  if (slot.sourceWindow.length <= slot.length)
    return Number.NaN;
  const old = slot.sourceWindow.at(slot.length);
  if (!Number.isFinite(src) || !Number.isFinite(old))
    return Number.NaN;
  return src - old;
}
function change(slotId, source, opts) {
  const ctx = getCtx27();
  const length = opts?.length ?? 1;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot25(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue10(slot, src));
  } else {
    slot.outBuffer.append(closeValue10(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/chop.js
function getCtx28() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.chop called outside an active script step");
  }
  return ctx;
}
function initSlot26(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    logN: Math.log10(length),
    trWindow: new Float64RingBuffer(length),
    sumTr: 0,
    prevClose: Number.NaN,
    prevPrevClose: Number.NaN,
    prevClosedSumTr: 0,
    prevClosedHeadTr: Number.NaN,
    prevClosedEvictedTr: Number.NaN,
    barCount: 0
  };
}
function trueRange3(high, low, prevClose) {
  if (!Number.isFinite(prevClose))
    return high - low;
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}
function chopValue(slot, upper, lower) {
  if (slot.barCount < slot.length)
    return Number.NaN;
  if (!Number.isFinite(upper) || !Number.isFinite(lower))
    return Number.NaN;
  const range = upper - lower;
  if (range <= 0)
    return Number.NaN;
  if (!Number.isFinite(slot.sumTr) || slot.sumTr <= 0)
    return Number.NaN;
  const raw = 100 * Math.log10(slot.sumTr / range) / slot.logN;
  if (raw < 0)
    return 0;
  if (raw > 100)
    return 100;
  return raw;
}
function closeValue11(slot, high, low, close, upper, lower) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return Number.NaN;
  }
  const tr = trueRange3(high, low, slot.prevClose);
  slot.prevClosedSumTr = slot.sumTr;
  const evicted = slot.trWindow.length === slot.length ? slot.trWindow.at(slot.length - 1) : Number.NaN;
  slot.prevClosedEvictedTr = evicted;
  if (Number.isFinite(evicted))
    slot.sumTr -= evicted;
  slot.trWindow.append(tr);
  slot.sumTr += tr;
  slot.prevClosedHeadTr = tr;
  slot.prevPrevClose = slot.prevClose;
  slot.prevClose = close;
  slot.barCount += 1;
  return chopValue(slot, upper, lower);
}
function tickValue11(slot, high, low, close, upper, lower) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return Number.NaN;
  }
  if (slot.barCount === 0)
    return Number.NaN;
  const tr = trueRange3(high, low, slot.prevPrevClose);
  let synthSum = slot.prevClosedSumTr;
  if (Number.isFinite(slot.prevClosedEvictedTr))
    synthSum -= slot.prevClosedEvictedTr;
  synthSum += tr;
  const savedSum = slot.sumTr;
  slot.sumTr = synthSum;
  const value = chopValue(slot, upper, lower);
  slot.sumTr = savedSum;
  return value;
}
function chop(slotId, length, _opts) {
  const ctx = getCtx28();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot26(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  const upperSeries = highest(`${slotId}/highest`, bar.high, length);
  const lowerSeries = lowest(`${slotId}/lowest`, bar.low, length);
  const upper = upperSeries.current;
  const lower = lowerSeries.current;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue11(slot, bar.high, bar.low, bar.close, upper, lower));
  } else {
    slot.outBuffer.append(closeValue11(slot, bar.high, bar.low, bar.close, upper, lower));
  }
  return slot.series;
}

// ../runtime/dist/ta/cmf.js
function getCtx29() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.cmf called outside an active script step");
  }
  return ctx;
}
function initSlot27(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    mfvWindow: new Float64RingBuffer(length),
    volWindow: new Float64RingBuffer(length),
    sumMfv: 0,
    sumVol: 0
  };
}
function mfvAt2(close, high, low, volume) {
  if (!Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(volume)) {
    return 0;
  }
  const range = high - low;
  if (range === 0)
    return 0;
  const clv = (close - low - (high - close)) / range;
  return clv * volume;
}
function safeVol(volume) {
  return Number.isFinite(volume) ? volume : 0;
}
function emit3(sumMfv, sumVol, ready) {
  if (!ready || sumVol === 0)
    return Number.NaN;
  return sumMfv / sumVol;
}
function cmf(slotId, length, _opts) {
  const ctx = getCtx29();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot27(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { close, high, low, volume } = ctx.stream.bar;
  const mfv = mfvAt2(close, high, low, volume);
  const vol2 = safeVol(volume);
  if (ctx.isTick) {
    if (slot.mfvWindow.length < slot.length) {
      slot.outBuffer.replaceHead(Number.NaN);
      return slot.series;
    }
    const headMfv = slot.mfvWindow.at(0);
    const headVol = slot.volWindow.at(0);
    const hypMfv = slot.sumMfv - headMfv + mfv;
    const hypVol = slot.sumVol - headVol + vol2;
    slot.outBuffer.replaceHead(emit3(hypMfv, hypVol, true));
    return slot.series;
  }
  if (slot.mfvWindow.length === slot.length) {
    slot.sumMfv -= slot.mfvWindow.at(slot.length - 1);
    slot.sumVol -= slot.volWindow.at(slot.length - 1);
  }
  slot.mfvWindow.append(mfv);
  slot.volWindow.append(vol2);
  slot.sumMfv += mfv;
  slot.sumVol += vol2;
  slot.outBuffer.append(emit3(slot.sumMfv, slot.sumVol, slot.mfvWindow.length === slot.length));
  return slot.series;
}

// ../runtime/dist/ta/cmo.js
function getCtx30() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.cmo called outside an active script step");
  }
  return ctx;
}
function initSlot28(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    gainWindow: new Float64RingBuffer(length),
    lossWindow: new Float64RingBuffer(length),
    sumGain: 0,
    sumLoss: 0,
    prevSrc: Number.NaN,
    prevClosedSrc: Number.NaN,
    cmo: Number.NaN,
    closedHeadGain: 0,
    closedHeadLoss: 0
  };
}
function cmoFromSums(sumGain, sumLoss) {
  const denom = sumGain + sumLoss;
  if (denom === 0)
    return Number.NaN;
  const raw = 100 * (sumGain - sumLoss) / denom;
  return Math.min(100, Math.max(-100, raw));
}
function closeValue12(slot, src) {
  if (!Number.isFinite(src)) {
    slot.closedHeadGain = 0;
    slot.closedHeadLoss = 0;
    return slot.cmo;
  }
  if (!Number.isFinite(slot.prevSrc)) {
    slot.prevSrc = src;
    slot.prevClosedSrc = src;
    slot.closedHeadGain = 0;
    slot.closedHeadLoss = 0;
    return Number.NaN;
  }
  const diff2 = src - slot.prevSrc;
  const gain = diff2 > 0 ? diff2 : 0;
  const loss = diff2 < 0 ? -diff2 : 0;
  slot.prevClosedSrc = slot.prevSrc;
  slot.prevSrc = src;
  slot.closedHeadGain = gain;
  slot.closedHeadLoss = loss;
  if (slot.gainWindow.length === slot.length) {
    const oldestGain = slot.gainWindow.at(slot.length - 1);
    const oldestLoss = slot.lossWindow.at(slot.length - 1);
    slot.sumGain -= oldestGain;
    slot.sumLoss -= oldestLoss;
  }
  slot.gainWindow.append(gain);
  slot.lossWindow.append(loss);
  slot.sumGain += gain;
  slot.sumLoss += loss;
  if (slot.gainWindow.length < slot.length) {
    slot.cmo = Number.NaN;
    return Number.NaN;
  }
  slot.cmo = cmoFromSums(slot.sumGain, slot.sumLoss);
  return slot.cmo;
}
function tickValue12(slot, src) {
  if (!Number.isFinite(src) || !Number.isFinite(slot.prevClosedSrc)) {
    return slot.cmo;
  }
  if (slot.gainWindow.length < slot.length)
    return Number.NaN;
  const diff2 = src - slot.prevClosedSrc;
  const gain = diff2 > 0 ? diff2 : 0;
  const loss = diff2 < 0 ? -diff2 : 0;
  const provGain = slot.sumGain - slot.closedHeadGain + gain;
  const provLoss = slot.sumLoss - slot.closedHeadLoss + loss;
  return cmoFromSums(provGain, provLoss);
}
function cmo(slotId, source, length, _opts) {
  const ctx = getCtx30();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot28(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue12(slot, src));
  } else {
    slot.outBuffer.append(closeValue12(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/rsi.js
function getCtx31() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.rsi called outside an active script step");
  }
  return ctx;
}
function initSlot29(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    kind: "ta.rsi",
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    seedGainSum: 0,
    seedLossSum: 0,
    diffCount: 0,
    avgGain: Number.NaN,
    avgLoss: Number.NaN,
    prevSrc: Number.NaN,
    prevClosedSrc: Number.NaN,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset7(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function rsiFromAvgs(avgGain, avgLoss) {
  if (avgLoss === 0)
    return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function closeValue13(slot, src) {
  if (!Number.isFinite(src)) {
    if (Number.isFinite(slot.avgGain) && Number.isFinite(slot.avgLoss)) {
      return rsiFromAvgs(slot.avgGain, slot.avgLoss);
    }
    return Number.NaN;
  }
  if (!Number.isFinite(slot.prevSrc)) {
    slot.prevSrc = src;
    slot.prevClosedSrc = src;
    return Number.NaN;
  }
  const diff2 = src - slot.prevSrc;
  const gain = diff2 > 0 ? diff2 : 0;
  const loss = diff2 < 0 ? -diff2 : 0;
  slot.prevClosedSrc = slot.prevSrc;
  slot.prevSrc = src;
  slot.diffCount += 1;
  if (slot.diffCount < slot.length) {
    slot.seedGainSum += gain;
    slot.seedLossSum += loss;
    return Number.NaN;
  }
  if (slot.diffCount === slot.length) {
    slot.seedGainSum += gain;
    slot.seedLossSum += loss;
    slot.avgGain = slot.seedGainSum / slot.length;
    slot.avgLoss = slot.seedLossSum / slot.length;
    return rsiFromAvgs(slot.avgGain, slot.avgLoss);
  }
  slot.avgGain = wilderStep(slot.avgGain, gain, slot.length);
  slot.avgLoss = wilderStep(slot.avgLoss, loss, slot.length);
  return rsiFromAvgs(slot.avgGain, slot.avgLoss);
}
function tickValue13(slot, src) {
  if (!Number.isFinite(src) || !Number.isFinite(slot.prevClosedSrc)) {
    if (Number.isFinite(slot.avgGain) && Number.isFinite(slot.avgLoss)) {
      return rsiFromAvgs(slot.avgGain, slot.avgLoss);
    }
    return Number.NaN;
  }
  if (slot.diffCount < slot.length) {
    const diff3 = src - slot.prevClosedSrc;
    const gain2 = diff3 > 0 ? diff3 : 0;
    const loss2 = diff3 < 0 ? -diff3 : 0;
    const provisionalCount = slot.diffCount + 1;
    if (provisionalCount < slot.length)
      return Number.NaN;
    const provGain2 = (slot.seedGainSum + gain2) / slot.length;
    const provLoss2 = (slot.seedLossSum + loss2) / slot.length;
    return rsiFromAvgs(provGain2, provLoss2);
  }
  const diffClosed = slot.prevSrc - slot.prevClosedSrc;
  const closedGain = diffClosed > 0 ? diffClosed : 0;
  const closedLoss = diffClosed < 0 ? -diffClosed : 0;
  const priorAvgGain = (slot.avgGain * slot.length - closedGain) / (slot.length - 1);
  const priorAvgLoss = (slot.avgLoss * slot.length - closedLoss) / (slot.length - 1);
  const diff2 = src - slot.prevClosedSrc;
  const gain = diff2 > 0 ? diff2 : 0;
  const loss = diff2 < 0 ? -diff2 : 0;
  const provGain = wilderStep(priorAvgGain, gain, slot.length);
  const provLoss = wilderStep(priorAvgLoss, loss, slot.length);
  return rsiFromAvgs(provGain, provLoss);
}
function rsi(slotId, source, length, opts) {
  const ctx = getCtx31();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot29(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue13(slot, src));
  } else {
    slot.outBuffer.append(closeValue13(slot, src));
  }
  return viewForOffset7(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/connorsRsi.js
var DEFAULT_RSI_LENGTH = 3;
var DEFAULT_STREAK_LENGTH = 2;
var DEFAULT_ROC_LENGTH = 100;
function getCtx32() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.connorsRsi called outside an active script step");
  }
  return ctx;
}
function initSlot30(rsiLength, streakLength, rocLength, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    rsiLength,
    streakLength,
    rocLength,
    streakSign: 0,
    streakRun: 0,
    prevClosedStreakSign: 0,
    prevClosedStreakRun: 0,
    prevClosedSrc: Number.NaN,
    // rocWindow capacity = rocLength + 1: room for the current
    // bar's ROC at `at(0)` plus the trailing `rocLength` values
    // we percent-rank against.
    rocWindow: new Float64RingBuffer(rocLength + 1),
    barCount: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset8(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function stepStreak(prevSign, prevRun, diff2) {
  if (!Number.isFinite(diff2) || diff2 === 0) {
    return { sign: 0, run: 0 };
  }
  if (diff2 > 0) {
    return { sign: 1, run: prevSign === 1 ? prevRun + 1 : 1 };
  }
  return { sign: -1, run: prevSign === -1 ? prevRun + 1 : 1 };
}
function streakScalar(sign, run) {
  if (sign === 0)
    return 0;
  return sign * run;
}
function pctChange(curr, prev) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev === 0)
    return Number.NaN;
  return 100 * (curr - prev) / prev;
}
function percentRankHead(slot) {
  const target = slot.rocWindow.at(0);
  if (!Number.isFinite(target))
    return Number.NaN;
  const windowSize = slot.rocWindow.length - 1;
  if (windowSize <= 0)
    return 50;
  const upper = Math.min(windowSize, slot.rocLength);
  let countBelow = 0;
  let validCount = 0;
  for (let j = 1; j <= upper; j += 1) {
    const v = slot.rocWindow.at(j);
    if (!Number.isFinite(v))
      continue;
    validCount += 1;
    if (v < target)
      countBelow += 1;
  }
  return validCount === 0 ? 50 : 100 * countBelow / validCount;
}
function blendCrsi(rsiHead, streakRsiHead, pctRank) {
  let sum = 0;
  let count = 0;
  if (Number.isFinite(rsiHead)) {
    sum += rsiHead;
    count += 1;
  }
  if (Number.isFinite(streakRsiHead)) {
    sum += streakRsiHead;
    count += 1;
  }
  if (Number.isFinite(pctRank)) {
    sum += pctRank;
    count += 1;
  }
  return count === 0 ? Number.NaN : sum / count;
}
function connorsRsi(slotId, source, opts) {
  const ctx = getCtx32();
  const rsiLength = opts?.rsiLength ?? DEFAULT_RSI_LENGTH;
  const streakLength = opts?.streakLength ?? DEFAULT_STREAK_LENGTH;
  const rocLength = opts?.rocLength ?? DEFAULT_ROC_LENGTH;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot30(rsiLength, streakLength, rocLength, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    const diff2 = pctChange(src, slot.prevClosedSrc);
    const { sign, run } = stepStreak(
      slot.prevClosedStreakSign,
      slot.prevClosedStreakRun,
      /* c8 ignore next */
      Number.isFinite(slot.prevClosedSrc) ? src - slot.prevClosedSrc : Number.NaN
    );
    const roc2 = diff2;
    slot.rocWindow.replaceHead(roc2);
    const rsiHead = rsi(`${slotId}/rsi`, src, rsiLength).current;
    const streakRsiHead = rsi(`${slotId}/streakRsi`, streakScalar(sign, run), streakLength).current;
    const pr = percentRankHead(slot);
    slot.outBuffer.replaceHead(blendCrsi(rsiHead, streakRsiHead, pr));
  } else {
    const diff2 = Number.isFinite(slot.prevClosedSrc) ? src - slot.prevClosedSrc : Number.NaN;
    const { sign, run } = stepStreak(slot.streakSign, slot.streakRun, diff2);
    const roc2 = pctChange(src, slot.prevClosedSrc);
    slot.rocWindow.append(roc2);
    const rsiHead = rsi(`${slotId}/rsi`, src, rsiLength).current;
    const streakRsiHead = rsi(`${slotId}/streakRsi`, streakScalar(sign, run), streakLength).current;
    const pr = percentRankHead(slot);
    slot.outBuffer.append(blendCrsi(rsiHead, streakRsiHead, pr));
    slot.prevClosedStreakSign = slot.streakSign;
    slot.prevClosedStreakRun = slot.streakRun;
    slot.streakSign = sign;
    slot.streakRun = run;
    slot.prevClosedSrc = src;
    slot.barCount += 1;
  }
  return viewForOffset8(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/coppock.js
var DEFAULT_ROC1_LENGTH = 11;
var DEFAULT_ROC2_LENGTH = 14;
var DEFAULT_WMA_LENGTH = 10;
function getCtx33() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.coppock called outside an active script step");
  }
  return ctx;
}
function initSlot31(roc1Length, roc2Length, wmaLength, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  const lookbackCapacity = Math.max(roc1Length, roc2Length) + 1;
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    roc1Length,
    roc2Length,
    wmaLength,
    sourceWindow: new Float64RingBuffer(lookbackCapacity),
    sumWindow: new Float64RingBuffer(wmaLength),
    barCount: 0
  };
}
function pctRoc(current, lookback) {
  if (!Number.isFinite(lookback) || lookback === 0 || !Number.isFinite(current)) {
    return Number.NaN;
  }
  return 100 * (current - lookback) / lookback;
}
function wmaOverSumWindow(slot) {
  if (slot.sumWindow.length < slot.wmaLength)
    return Number.NaN;
  const denom = slot.wmaLength * (slot.wmaLength + 1) / 2;
  let acc = 0;
  for (let i = 0; i < slot.wmaLength; i += 1) {
    const v = slot.sumWindow.at(i);
    if (!Number.isFinite(v))
      return Number.NaN;
    acc += v * (slot.wmaLength - i);
  }
  return acc / denom;
}
function computeRocSum(slot, src) {
  if (slot.sourceWindow.length <= slot.roc1Length)
    return Number.NaN;
  if (slot.sourceWindow.length <= slot.roc2Length)
    return Number.NaN;
  const lookback1 = slot.sourceWindow.at(slot.roc1Length);
  const lookback2 = slot.sourceWindow.at(slot.roc2Length);
  const roc1 = pctRoc(src, lookback1);
  const roc2 = pctRoc(src, lookback2);
  if (!Number.isFinite(roc1) || !Number.isFinite(roc2))
    return Number.NaN;
  return roc1 + roc2;
}
function closeValue14(slot, src) {
  slot.sourceWindow.append(src);
  slot.barCount += 1;
  const sum = computeRocSum(slot, src);
  slot.sumWindow.append(sum);
  return wmaOverSumWindow(slot);
}
function tickValue14(slot, src) {
  if (slot.sourceWindow.length === 0)
    return Number.NaN;
  slot.sourceWindow.replaceHead(src);
  const sum = computeRocSum(slot, src);
  slot.sumWindow.replaceHead(sum);
  return wmaOverSumWindow(slot);
}
function coppock(slotId, source, opts) {
  const ctx = getCtx33();
  const roc1Length = opts?.roc1Length ?? DEFAULT_ROC1_LENGTH;
  const roc2Length = opts?.roc2Length ?? DEFAULT_ROC2_LENGTH;
  const wmaLength = opts?.wmaLength ?? DEFAULT_WMA_LENGTH;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot31(roc1Length, roc2Length, wmaLength, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue14(slot, src));
  } else {
    slot.outBuffer.append(closeValue14(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/crossover.js
function getCtx34() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.crossover called outside an active script step");
  }
  return ctx;
}
function initSlot32(capacity) {
  const outBuffer = new RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    prevA: Number.NaN,
    prevB: Number.NaN,
    currA: Number.NaN,
    currB: Number.NaN,
    initialised: false,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset9(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function detect(prevA, prevB, currA, currB) {
  if (!Number.isFinite(prevA) || !Number.isFinite(prevB) || !Number.isFinite(currA) || !Number.isFinite(currB)) {
    return false;
  }
  return currA > currB && prevA <= prevB;
}
function crossover(slotId, a, b, opts) {
  const ctx = getCtx34();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot32(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const aValue = readSourceValue(a);
  const bValue = readSourceValue(b);
  const offset = opts?.offset ?? 0;
  if (ctx.isTick) {
    const out = detect(slot.prevA, slot.prevB, aValue, bValue);
    slot.outBuffer.replaceHead(out);
    return viewForOffset9(slot, offset);
  }
  if (!slot.initialised) {
    slot.initialised = true;
    slot.prevA = aValue;
    slot.prevB = bValue;
    slot.currA = aValue;
    slot.currB = bValue;
    slot.outBuffer.append(false);
    return viewForOffset9(slot, offset);
  }
  slot.prevA = slot.currA;
  slot.prevB = slot.currB;
  slot.currA = aValue;
  slot.currB = bValue;
  slot.outBuffer.append(detect(slot.prevA, slot.prevB, slot.currA, slot.currB));
  return viewForOffset9(slot, offset);
}

// ../runtime/dist/ta/crossunder.js
function getCtx35() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.crossunder called outside an active script step");
  }
  return ctx;
}
function initSlot33(capacity) {
  const outBuffer = new RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    prevA: Number.NaN,
    prevB: Number.NaN,
    currA: Number.NaN,
    currB: Number.NaN,
    initialised: false,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset10(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function detect2(prevA, prevB, currA, currB) {
  if (!Number.isFinite(prevA) || !Number.isFinite(prevB) || !Number.isFinite(currA) || !Number.isFinite(currB)) {
    return false;
  }
  return currA < currB && prevA >= prevB;
}
function crossunder(slotId, a, b, opts) {
  const ctx = getCtx35();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot33(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const aValue = readSourceValue(a);
  const bValue = readSourceValue(b);
  const offset = opts?.offset ?? 0;
  if (ctx.isTick) {
    const out = detect2(slot.prevA, slot.prevB, aValue, bValue);
    slot.outBuffer.replaceHead(out);
    return viewForOffset10(slot, offset);
  }
  if (!slot.initialised) {
    slot.initialised = true;
    slot.prevA = aValue;
    slot.prevB = bValue;
    slot.currA = aValue;
    slot.currB = bValue;
    slot.outBuffer.append(false);
    return viewForOffset10(slot, offset);
  }
  slot.prevA = slot.currA;
  slot.prevB = slot.currB;
  slot.currA = aValue;
  slot.currB = bValue;
  slot.outBuffer.append(detect2(slot.prevA, slot.prevB, slot.currA, slot.currB));
  return viewForOffset10(slot, offset);
}

// ../runtime/dist/ta/dema.js
function getCtx36() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.dema called outside an active script step");
  }
  return ctx;
}
function initSlot34(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length
  };
}
function dema(slotId, source, length, _opts) {
  const ctx = getCtx36();
  const src = readSourceValue(source);
  const ema1Series = ema(`${slotId}/ema1`, src, length);
  const e1 = ema1Series.current;
  const ema2Series = ema(`${slotId}/ema2`, e1, length);
  const e2 = ema2Series.current;
  const value = Number.isFinite(e1) && Number.isFinite(e2) ? 2 * e1 - e2 : Number.NaN;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot34(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  if (ctx.isTick)
    slot.outBuffer.replaceHead(value);
  else
    slot.outBuffer.append(value);
  return slot.series;
}

// ../runtime/dist/ta/dmi.js
function getCtx37() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.dmi called outside an active script step");
  }
  return ctx;
}
function initSlot35(length, capacity) {
  const plusDiBuffer = new Float64RingBuffer(capacity);
  const minusDiBuffer = new Float64RingBuffer(capacity);
  return {
    result: Object.freeze({
      plusDi: makeSeriesView(plusDiBuffer),
      minusDi: makeSeriesView(minusDiBuffer)
    }),
    plusDiBuffer,
    minusDiBuffer,
    dirState: initDirectionalState(length),
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset3(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      plusDi: makeShiftedSeriesView(slot.plusDiBuffer, offset),
      minusDi: makeShiftedSeriesView(slot.minusDiBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function dmi(slotId, length, opts) {
  const ctx = getCtx37();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot35(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  if (ctx.isTick) {
    const { plusDi, minusDi } = tickDirectional(slot.dirState, bar.high, bar.low, bar.close);
    slot.plusDiBuffer.replaceHead(plusDi);
    slot.minusDiBuffer.replaceHead(minusDi);
  } else {
    const { plusDi, minusDi } = advanceDirectionalClose(slot.dirState, bar.high, bar.low, bar.close);
    slot.plusDiBuffer.append(plusDi);
    slot.minusDiBuffer.append(minusDi);
  }
  return resultForOffset3(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/donchian.js
function getCtx38() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.donchian called outside an active script step");
  }
  return ctx;
}
function initSlot36(length, capacity) {
  return {
    middleBuffer: new Float64RingBuffer(capacity),
    length,
    outputs: null
  };
}
function middleValue(upper, lower) {
  if (!Number.isFinite(upper) || !Number.isFinite(lower))
    return Number.NaN;
  return (upper + lower) / 2;
}
function donchian(slotId, length, _opts) {
  const ctx = getCtx38();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot36(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const upperSeries = highest(`${slotId}/highest`, ctx.stream.bar.high, length);
  const lowerSeries = lowest(`${slotId}/lowest`, ctx.stream.bar.low, length);
  if (slot.outputs === null) {
    slot.outputs = Object.freeze({
      upper: upperSeries,
      middle: makeSeriesView(slot.middleBuffer),
      lower: lowerSeries
    });
  }
  const value = middleValue(upperSeries.current, lowerSeries.current);
  if (ctx.isTick) {
    slot.middleBuffer.replaceHead(value);
  } else {
    slot.middleBuffer.append(value);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/dpo.js
function getCtx39() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.dpo called outside an active script step");
  }
  return ctx;
}
function initSlot37(length, capacity) {
  const displacement = Math.floor(length / 2) + 1;
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    displacement,
    sourceWindow: new Float64RingBuffer(displacement + 1),
    barCount: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset11(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function computeDpo(slot, smaCurrent) {
  if (slot.sourceWindow.length <= slot.displacement)
    return Number.NaN;
  if (!Number.isFinite(smaCurrent))
    return Number.NaN;
  const shifted = slot.sourceWindow.at(slot.displacement);
  if (!Number.isFinite(shifted))
    return Number.NaN;
  return shifted - smaCurrent;
}
function dpo(slotId, source, length, opts) {
  const ctx = getCtx39();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot37(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.sourceWindow.replaceHead(src);
    const smaSeries = sma(`${slotId}/sma`, src, length);
    slot.outBuffer.replaceHead(computeDpo(slot, smaSeries.current));
  } else {
    slot.sourceWindow.append(src);
    slot.barCount += 1;
    const smaSeries = sma(`${slotId}/sma`, src, length);
    slot.outBuffer.append(computeDpo(slot, smaSeries.current));
  }
  return viewForOffset11(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/smma.js
function getCtx40() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.smma called outside an active script step");
  }
  return ctx;
}
function initSlot38(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    alpha: 1 / length,
    length,
    seedSum: 0,
    seedCount: 0,
    prevSmma: Number.NaN,
    prevClosedSmma: Number.NaN
  };
}
function compute3(slot, src, isTick) {
  if (!Number.isFinite(src)) {
    return isTick ? slot.prevSmma : slot.prevClosedSmma;
  }
  if (slot.seedCount < slot.length) {
    if (isTick) {
      const nextSum = slot.seedSum + src;
      const nextCount = slot.seedCount + 1;
      if (nextCount < slot.length)
        return Number.NaN;
      return nextSum / slot.length;
    }
    slot.seedSum += src;
    slot.seedCount += 1;
    if (slot.seedCount < slot.length) {
      slot.prevClosedSmma = Number.NaN;
      return Number.NaN;
    }
    const seedValue = slot.seedSum / slot.length;
    slot.prevClosedSmma = seedValue;
    slot.prevSmma = seedValue;
    return seedValue;
  }
  const prev = slot.prevClosedSmma;
  const next = src * slot.alpha + prev * (1 - slot.alpha);
  if (!isTick) {
    slot.prevClosedSmma = next;
    slot.prevSmma = next;
  }
  return next;
}
function smma(slotId, source, length, _opts) {
  const ctx = getCtx40();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot38(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const value = compute3(slot, readSourceValue(source), ctx.isTick);
  if (ctx.isTick)
    slot.outBuffer.replaceHead(value);
  else
    slot.outBuffer.append(value);
  return slot.series;
}

// ../runtime/dist/ta/wma.js
function getCtx41() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.wma called outside an active script step");
  }
  return ctx;
}
function initSlot39(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    denom: length * (length + 1) / 2,
    window: new Float64RingBuffer(length)
  };
}
function weightedFromWindow2(slot) {
  let sum = 0;
  for (let j = 0; j < slot.length; j += 1) {
    const v = slot.window.at(j);
    if (!Number.isFinite(v))
      return Number.NaN;
    sum += v * (slot.length - j);
  }
  return sum / slot.denom;
}
function closeValue15(slot, src) {
  slot.window.append(src);
  if (slot.window.length < slot.length)
    return Number.NaN;
  return weightedFromWindow2(slot);
}
function tickValue15(slot, src) {
  if (slot.window.length < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src))
    return Number.NaN;
  let sum = src * slot.length;
  for (let j = 1; j < slot.length; j += 1) {
    const v = slot.window.at(j);
    if (!Number.isFinite(v))
      return Number.NaN;
    sum += v * (slot.length - j);
  }
  return sum / slot.denom;
}
function wma(slotId, source, length, _opts) {
  const ctx = getCtx41();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot39(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue15(slot, src));
  } else {
    slot.outBuffer.append(closeValue15(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/envelope.js
var DEFAULT_LENGTH4 = 20;
var DEFAULT_PERCENT = 10;
var DEFAULT_MA_TYPE = "sma";
function getCtx42() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.envelope called outside an active script step");
  }
  return ctx;
}
function initSlot40(length, percent, maType, capacity) {
  return {
    upperBuffer: new Float64RingBuffer(capacity),
    lowerBuffer: new Float64RingBuffer(capacity),
    length,
    percent,
    maType,
    outputs: null
  };
}
function dispatchMa(maType, subSlotId, source, length) {
  switch (maType) {
    case "sma":
      return sma(subSlotId, source, length);
    case "ema":
      return ema(subSlotId, source, length);
    case "wma":
      return wma(subSlotId, source, length);
    case "smma":
      return smma(subSlotId, source, length);
  }
}
function envelope(slotId, source, opts) {
  const ctx = getCtx42();
  const length = opts?.length ?? DEFAULT_LENGTH4;
  const percent = opts?.percent ?? DEFAULT_PERCENT;
  const maType = opts?.maType ?? DEFAULT_MA_TYPE;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot40(length, percent, maType, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  const middleSeries = dispatchMa(slot.maType, `${slotId}/${slot.maType}`, src, slot.length);
  if (slot.outputs === null) {
    slot.outputs = Object.freeze({
      upper: makeSeriesView(slot.upperBuffer),
      middle: middleSeries,
      lower: makeSeriesView(slot.lowerBuffer)
    });
  }
  const mid = middleSeries.current;
  const factor = slot.percent / 100;
  let upperValue;
  let lowerValue;
  if (Number.isFinite(mid)) {
    upperValue = mid * (1 + factor);
    lowerValue = mid * (1 - factor);
  } else {
    upperValue = Number.NaN;
    lowerValue = Number.NaN;
  }
  if (ctx.isTick) {
    slot.upperBuffer.replaceHead(upperValue);
    slot.lowerBuffer.replaceHead(lowerValue);
  } else {
    slot.upperBuffer.append(upperValue);
    slot.lowerBuffer.append(lowerValue);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/eom.js
var DIVISOR = 1e4;
function getCtx43() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.eom called outside an active script step");
  }
  return ctx;
}
function initSlot41(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map(),
    length,
    rawEomWindow: new Float64RingBuffer(length),
    sumRawEom: 0,
    nanCount: 0,
    prevMid: Number.NaN,
    prevPrevMid: Number.NaN
  };
}
function viewForOffset12(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function safeVol2(volume) {
  return Number.isFinite(volume) ? volume : 0;
}
function rawEomAt(high, low, volume, prevMid) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevMid)) {
    return Number.NaN;
  }
  const range = high - low;
  if (range === 0)
    return Number.NaN;
  const boxRatio = safeVol2(volume) / DIVISOR / range;
  if (boxRatio === 0)
    return Number.NaN;
  const midpointMove = (high + low) / 2 - prevMid;
  return midpointMove / boxRatio;
}
function emit4(slot, ready) {
  if (!ready || slot.nanCount > 0)
    return Number.NaN;
  return slot.sumRawEom / slot.length;
}
function eom(slotId, length, opts) {
  const ctx = getCtx43();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot41(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const offset = opts?.offset ?? 0;
  const { high, low, volume } = ctx.stream.bar;
  if (ctx.isTick) {
    if (slot.rawEomWindow.length < slot.length) {
      slot.outBuffer.replaceHead(Number.NaN);
      return viewForOffset12(slot, offset);
    }
    const tickRaw = rawEomAt(high, low, volume, slot.prevPrevMid);
    const headRaw = slot.rawEomWindow.at(0);
    const headWasNaN = !Number.isFinite(headRaw);
    const tickIsNaN = !Number.isFinite(tickRaw);
    const hypNan = slot.nanCount - (headWasNaN ? 1 : 0) + (tickIsNaN ? 1 : 0);
    if (hypNan > 0) {
      slot.outBuffer.replaceHead(Number.NaN);
      return viewForOffset12(slot, offset);
    }
    const hypSum = slot.sumRawEom - (headWasNaN ? 0 : headRaw) + tickRaw;
    slot.outBuffer.replaceHead(hypSum / slot.length);
    return viewForOffset12(slot, offset);
  }
  slot.prevPrevMid = slot.prevMid;
  const raw = rawEomAt(high, low, volume, slot.prevMid);
  const midpoint2 = Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : slot.prevMid;
  if (slot.rawEomWindow.length === slot.length) {
    const oldest = slot.rawEomWindow.at(slot.length - 1);
    if (Number.isFinite(oldest))
      slot.sumRawEom -= oldest;
    else
      slot.nanCount -= 1;
  }
  slot.rawEomWindow.append(raw);
  if (Number.isFinite(raw))
    slot.sumRawEom += raw;
  else
    slot.nanCount += 1;
  slot.prevMid = midpoint2;
  const ready = slot.rawEomWindow.length === slot.length;
  slot.outBuffer.append(emit4(slot, ready));
  return viewForOffset12(slot, offset);
}

// ../runtime/dist/ta/fisher.js
function getCtx44() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.fisher called outside an active script step");
  }
  return ctx;
}
function initSlot42(length, capacity) {
  const fisherBuf = new Float64RingBuffer(capacity);
  const triggerBuf = new Float64RingBuffer(capacity);
  return {
    result: null,
    fisherBuf,
    triggerBuf,
    fisherSeries: makeSeriesView(fisherBuf),
    triggerSeries: makeSeriesView(triggerBuf),
    length,
    prevX: 0,
    prevFisher: 0,
    prevClosedX: 0,
    prevClosedFisher: 0,
    barCount: 0
  };
}
function computeStep(normalised, baseX, baseFisher) {
  const x = 0.66 * normalised + 0.67 * baseX;
  if (Math.abs(x) >= 1) {
    return {
      fisherValue: Number.NaN,
      triggerValue: baseFisher,
      nextX: baseX,
      nextFisher: baseFisher
    };
  }
  const fisherValue = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * baseFisher;
  return { fisherValue, triggerValue: baseFisher, nextX: x, nextFisher: fisherValue };
}
function fisher(slotId, length, _opts) {
  const ctx = getCtx44();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot42(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const mid = ctx.stream.bar.hl2;
  const hhSeries = highest(`${slotId}/midHigh`, mid, length);
  const llSeries = lowest(`${slotId}/midLow`, mid, length);
  const hh = hhSeries.current;
  const ll = llSeries.current;
  let normalised;
  if (!Number.isFinite(mid) || !Number.isFinite(hh) || !Number.isFinite(ll)) {
    normalised = Number.NaN;
  } else if (hh === ll) {
    normalised = 0;
  } else {
    normalised = (mid - ll) / (hh - ll) - 0.5;
  }
  if (ctx.isTick) {
    const step2 = Number.isFinite(normalised) ? computeStep(normalised, slot.prevClosedX, slot.prevClosedFisher) : {
      fisherValue: Number.NaN,
      triggerValue: slot.prevClosedFisher,
      nextX: slot.prevClosedX,
      nextFisher: slot.prevClosedFisher
    };
    const triggerOut = (
      /* c8 ignore next */
      slot.barCount === 0 ? Number.NaN : step2.triggerValue
    );
    slot.fisherBuf.replaceHead(step2.fisherValue);
    slot.triggerBuf.replaceHead(triggerOut);
  } else {
    slot.prevClosedX = slot.prevX;
    slot.prevClosedFisher = slot.prevFisher;
    const step2 = Number.isFinite(normalised) ? computeStep(normalised, slot.prevX, slot.prevFisher) : {
      fisherValue: Number.NaN,
      triggerValue: slot.prevFisher,
      nextX: slot.prevX,
      nextFisher: slot.prevFisher
    };
    const triggerOut = slot.barCount === 0 ? Number.NaN : step2.triggerValue;
    slot.fisherBuf.append(step2.fisherValue);
    slot.triggerBuf.append(triggerOut);
    slot.prevX = step2.nextX;
    slot.prevFisher = step2.nextFisher;
    slot.barCount += 1;
  }
  if (slot.result === null) {
    slot.result = Object.freeze({
      fisher: slot.fisherSeries,
      trigger: slot.triggerSeries
    });
  }
  return slot.result;
}

// ../runtime/dist/ta/fixedRangeVolumeProfile.js
function getCtx45() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.fixedRangeVolumeProfile called outside an active script step");
  }
  return ctx;
}
function initSlot43(capacity) {
  const core = createVolumeProfileCore(capacity);
  const slot = {
    ...core,
    frozen: null,
    result: Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeSeriesView(core.pocBuffer),
      valHigh: makeSeriesView(core.valHighBuffer),
      valLow: makeSeriesView(core.valLowBuffer)
    }),
    shiftedResults: /* @__PURE__ */ new Map()
  };
  return slot;
}
function resultForOffset4(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeShiftedSeriesView(slot.pocBuffer, offset),
      valHigh: makeShiftedSeriesView(slot.valHighBuffer, offset),
      valLow: makeShiftedSeriesView(slot.valLowBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function collectBars2(ctx, from, to) {
  const { ohlcv } = ctx.stream;
  const bars = [];
  for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
    const time = ohlcv.time.at(lookback);
    if (time < from || time > to)
      continue;
    bars.push({
      close: ohlcv.close.at(lookback),
      high: ohlcv.high.at(lookback),
      low: ohlcv.low.at(lookback),
      open: ohlcv.open.at(lookback),
      time,
      volume: ohlcv.volume.at(lookback)
    });
  }
  return bars;
}
function diagnoseInvertedRange(ctx, slotId) {
  const key = `fixed-range-inverted|${slotId}`;
  if (ctx.diagnosedRequestKeys.has(key))
    return;
  ctx.diagnosedRequestKeys.add(key);
  pushDiagnostic(ctx.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code: "fixed-range-inverted",
    message: "ta.fixedRangeVolumeProfile requires opts.from <= opts.to.",
    slotId,
    bar: ctx.barIndex()
  });
}
function fixedRangeVolumeProfile(slotId, opts) {
  const ctx = getCtx45();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot43(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  let snapshot6 = emptyVolumeProfileSnapshot();
  if (opts.from > opts.to) {
    diagnoseInvertedRange(ctx, slotId);
    slot.frozen = null;
  } else if (ctx.stream.bar.time < opts.from) {
    slot.frozen = null;
  } else if (ctx.stream.bar.time > opts.to && slot.frozen !== null) {
    snapshot6 = slot.frozen;
  } else {
    snapshot6 = resolveVolumeProfileSnapshot({
      bars: collectBars2(ctx, opts.from, opts.to),
      bucketColor: opts.bucketColor,
      config: volumeProfileConfigFromOpts(opts)
    });
    if (ctx.stream.bar.time >= opts.to)
      slot.frozen = snapshot6;
  }
  commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot6);
  emitVolumeProfileHistogram(ctx, slotId, "Fixed Range Volume Profile", snapshot6.poc, snapshot6.buckets);
  return resultForOffset4(slot, opts.offset ?? 0);
}

// ../runtime/dist/ta/historicalVolatility.js
var DEFAULT_ANNUALISATION_FACTOR = 365;
function getCtx46() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.historicalVolatility called outside an active script step");
  }
  return ctx;
}
function initSlot44(length, annualisationFactor, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    annualisationFactor,
    logReturnsWindow: new Float64RingBuffer(length),
    sumX: 0,
    sumX2: 0,
    prevSrc: Number.NaN,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset13(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function logReturn(prev, cur) {
  if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0 || cur <= 0) {
    return Number.NaN;
  }
  return Math.log(cur / prev);
}
function windowStdDev(window, sumX, sumX2) {
  const n = window.length;
  if (n <= 0)
    return Number.NaN;
  const mean = sumX / n;
  const variance = sumX2 / n - mean * mean;
  return Math.sqrt(Math.max(0, variance));
}
function recomputeSums(slot) {
  let sumX = 0;
  let sumX2 = 0;
  let anyNaN = false;
  for (let i = 0; i < slot.logReturnsWindow.length; i += 1) {
    const v = slot.logReturnsWindow.at(slot.logReturnsWindow.length - 1 - i);
    if (!Number.isFinite(v)) {
      anyNaN = true;
      break;
    }
    sumX += v;
    sumX2 += v * v;
  }
  if (anyNaN) {
    slot.sumX = Number.NaN;
    slot.sumX2 = Number.NaN;
  } else {
    slot.sumX = sumX;
    slot.sumX2 = sumX2;
  }
}
function closeValue16(slot, src) {
  const lr = logReturn(slot.prevSrc, src);
  if (slot.logReturnsWindow.length < slot.logReturnsWindow.capacity) {
    slot.logReturnsWindow.append(lr);
    if (Number.isFinite(lr)) {
      slot.sumX += lr;
      slot.sumX2 += lr * lr;
    } else {
      slot.sumX = Number.NaN;
      slot.sumX2 = Number.NaN;
    }
    slot.prevSrc = src;
    return Number.NaN;
  }
  const outgoing = slot.logReturnsWindow.at(slot.logReturnsWindow.length - 1);
  slot.logReturnsWindow.append(lr);
  if (!Number.isFinite(lr)) {
    slot.sumX = Number.NaN;
    slot.sumX2 = Number.NaN;
  } else if (!Number.isFinite(slot.sumX) || /* c8 ignore next */
  !Number.isFinite(outgoing)) {
    recomputeSums(slot);
  } else {
    slot.sumX = slot.sumX - outgoing + lr;
    slot.sumX2 = slot.sumX2 - outgoing * outgoing + lr * lr;
  }
  slot.prevSrc = src;
  if (!Number.isFinite(slot.sumX))
    return Number.NaN;
  const sd = windowStdDev(slot.logReturnsWindow, slot.sumX, slot.sumX2);
  return sd * Math.sqrt(slot.annualisationFactor) * 100;
}
function tickValue16(slot, src) {
  if (slot.logReturnsWindow.length < slot.logReturnsWindow.capacity)
    return Number.NaN;
  const lr = logReturn(slot.prevSrc, src);
  if (!Number.isFinite(lr) || !Number.isFinite(slot.sumX))
    return Number.NaN;
  const oldestInHead = slot.logReturnsWindow.at(0);
  if (!Number.isFinite(oldestInHead))
    return Number.NaN;
  const sumX = slot.sumX - oldestInHead + lr;
  const sumX2 = slot.sumX2 - oldestInHead * oldestInHead + lr * lr;
  const n = slot.logReturnsWindow.length;
  const mean = sumX / n;
  const variance = sumX2 / n - mean * mean;
  return Math.sqrt(Math.max(0, variance)) * Math.sqrt(slot.annualisationFactor) * 100;
}
function historicalVolatility(slotId, source, length, opts) {
  const ctx = getCtx46();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const annualisationFactor = opts?.annualisationFactor ?? DEFAULT_ANNUALISATION_FACTOR;
    slot = initSlot44(length, annualisationFactor, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue16(slot, src));
  } else {
    slot.outBuffer.append(closeValue16(slot, src));
  }
  return viewForOffset13(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/hma.js
function getCtx47() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.hma called outside an active script step");
  }
  return ctx;
}
function hma(slotId, source, length, _opts) {
  const ctx = getCtx47();
  const halfLen = Math.max(1, Math.floor(length / 2));
  const sqrtLen = Math.max(1, Math.round(Math.sqrt(length)));
  const src = readSourceValue(source);
  const halfSeries = wma(`${slotId}/half`, src, halfLen);
  const fullSeries = wma(`${slotId}/full`, src, length);
  const ha = halfSeries.current;
  const fa = fullSeries.current;
  const diff2 = Number.isFinite(ha) && Number.isFinite(fa) ? 2 * ha - fa : Number.NaN;
  const finalSeries = wma(`${slotId}/final`, diff2, sqrtLen);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = { series: finalSeries };
    ctx.stream.taSlots.set(slotId, slot);
  }
  return slot.series;
}

// ../runtime/dist/ta/ichimoku.js
var DEFAULT_CONVERSION_LENGTH = 9;
var DEFAULT_BASE_LENGTH = 26;
var DEFAULT_LEADING_SPAN_B_LENGTH = 52;
var DEFAULT_DISPLACEMENT = 26;
function getCtx48() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.ichimoku called outside an active script step");
  }
  return ctx;
}
function midpoint(hi, lo) {
  if (!Number.isFinite(hi) || !Number.isFinite(lo))
    return Number.NaN;
  return (hi + lo) / 2;
}
function spanAverage(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b))
    return Number.NaN;
  return (a + b) / 2;
}
function delayedValue(delay, displacement) {
  if (delay.length <= displacement)
    return Number.NaN;
  return delay.at(displacement);
}
function initSlot45(capacity, conversionLength, baseLength, leadingSpanBLength, displacement) {
  const tenkanBuffer = new Float64RingBuffer(capacity);
  const kijunBuffer = new Float64RingBuffer(capacity);
  const senkouABuffer = new Float64RingBuffer(capacity);
  const senkouBBuffer = new Float64RingBuffer(capacity);
  const chikouBuffer = new Float64RingBuffer(capacity);
  const delayCap = displacement + 1;
  return {
    outputs: Object.freeze({
      tenkan: makeSeriesView(tenkanBuffer),
      kijun: makeSeriesView(kijunBuffer),
      senkouA: makeSeriesView(senkouABuffer),
      senkouB: makeSeriesView(senkouBBuffer),
      chikou: makeSeriesView(chikouBuffer)
    }),
    tenkanBuffer,
    kijunBuffer,
    senkouABuffer,
    senkouBBuffer,
    chikouBuffer,
    conversionLength,
    baseLength,
    leadingSpanBLength,
    displacement,
    senkouADelay: new Float64RingBuffer(delayCap),
    senkouBDelay: new Float64RingBuffer(delayCap),
    closeDelay: new Float64RingBuffer(delayCap),
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset5(slot, offset) {
  if (offset === 0)
    return slot.outputs;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      tenkan: makeShiftedSeriesView(slot.tenkanBuffer, offset),
      kijun: makeShiftedSeriesView(slot.kijunBuffer, offset),
      senkouA: makeShiftedSeriesView(slot.senkouABuffer, offset),
      senkouB: makeShiftedSeriesView(slot.senkouBBuffer, offset),
      chikou: makeShiftedSeriesView(slot.chikouBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function ichimoku(slotId, opts) {
  const ctx = getCtx48();
  const conversionLength = opts?.conversionLength ?? DEFAULT_CONVERSION_LENGTH;
  const baseLength = opts?.baseLength ?? DEFAULT_BASE_LENGTH;
  const leadingSpanBLength = opts?.leadingSpanBLength ?? DEFAULT_LEADING_SPAN_B_LENGTH;
  const displacement = opts?.displacement ?? DEFAULT_DISPLACEMENT;
  const offset = opts?.offset ?? 0;
  const bar = ctx.stream.bar;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot45(ctx.stream.ohlcv.close.capacity, conversionLength, baseLength, leadingSpanBLength, displacement);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const tenkanHi = highest(`${slotId}/tenkanHigh`, bar.high, conversionLength).current;
  const tenkanLo = lowest(`${slotId}/tenkanLow`, bar.low, conversionLength).current;
  const kijunHi = highest(`${slotId}/kijunHigh`, bar.high, baseLength).current;
  const kijunLo = lowest(`${slotId}/kijunLow`, bar.low, baseLength).current;
  const senkouBHi = highest(`${slotId}/senkouBHigh`, bar.high, leadingSpanBLength).current;
  const senkouBLo = lowest(`${slotId}/senkouBLow`, bar.low, leadingSpanBLength).current;
  const tenkan = midpoint(tenkanHi, tenkanLo);
  const kijun = midpoint(kijunHi, kijunLo);
  const senkouBRaw = midpoint(senkouBHi, senkouBLo);
  const senkouARaw = spanAverage(tenkan, kijun);
  if (ctx.isTick) {
    slot.senkouADelay.replaceHead(senkouARaw);
    slot.senkouBDelay.replaceHead(senkouBRaw);
    slot.closeDelay.replaceHead(bar.close);
    slot.tenkanBuffer.replaceHead(tenkan);
    slot.kijunBuffer.replaceHead(kijun);
    slot.senkouABuffer.replaceHead(delayedValue(slot.senkouADelay, displacement));
    slot.senkouBBuffer.replaceHead(delayedValue(slot.senkouBDelay, displacement));
    slot.chikouBuffer.replaceHead(delayedValue(slot.closeDelay, displacement));
  } else {
    slot.senkouADelay.append(senkouARaw);
    slot.senkouBDelay.append(senkouBRaw);
    slot.closeDelay.append(bar.close);
    slot.tenkanBuffer.append(tenkan);
    slot.kijunBuffer.append(kijun);
    slot.senkouABuffer.append(delayedValue(slot.senkouADelay, displacement));
    slot.senkouBBuffer.append(delayedValue(slot.senkouBDelay, displacement));
    slot.chikouBuffer.append(delayedValue(slot.closeDelay, displacement));
  }
  return resultForOffset5(slot, offset);
}

// ../runtime/dist/ta/kama.js
var DEFAULT_LENGTH5 = 10;
var DEFAULT_FAST2 = 2;
var DEFAULT_SLOW2 = 30;
function getCtx49() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.kama called outside an active script step");
  }
  return ctx;
}
function initSlot46(length, fastLength, slowLength, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    fastAlpha: 2 / (fastLength + 1),
    slowAlpha: 2 / (slowLength + 1),
    sourceWindow: new Float64RingBuffer(length + 1),
    prevKama: Number.NaN,
    prevClosedKama: Number.NaN
  };
}
function computeKama(slot, headSrc, prev) {
  if (slot.sourceWindow.length < slot.length + 1)
    return Number.NaN;
  if (!Number.isFinite(headSrc))
    return prev;
  const oldest = slot.sourceWindow.at(slot.length);
  if (!Number.isFinite(oldest))
    return prev;
  const change2 = Math.abs(headSrc - oldest);
  let volatility = 0;
  {
    const next = headSrc;
    const prior = slot.sourceWindow.at(1);
    if (!Number.isFinite(prior))
      return prev;
    volatility += Math.abs(next - prior);
  }
  for (let j = 1; j < slot.length; j += 1) {
    const next = slot.sourceWindow.at(j);
    const prior = slot.sourceWindow.at(j + 1);
    if (!Number.isFinite(next) || !Number.isFinite(prior))
      return prev;
    volatility += Math.abs(next - prior);
  }
  const er = volatility > 0 ? change2 / volatility : 0;
  const sc = (er * (slot.fastAlpha - slot.slowAlpha) + slot.slowAlpha) ** 2;
  if (!Number.isFinite(prev))
    return headSrc;
  return prev + sc * (headSrc - prev);
}
function kama(slotId, source, opts) {
  const ctx = getCtx49();
  const length = opts?.length ?? DEFAULT_LENGTH5;
  const fastLength = opts?.fastLength ?? DEFAULT_FAST2;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW2;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot46(length, fastLength, slowLength, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    const value = computeKama(slot, src, slot.prevClosedKama);
    slot.prevKama = Number.isFinite(value) ? value : slot.prevClosedKama;
    slot.outBuffer.replaceHead(value);
  } else {
    slot.sourceWindow.append(src);
    const value = computeKama(slot, src, slot.prevClosedKama);
    slot.prevClosedKama = Number.isFinite(value) ? value : slot.prevClosedKama;
    slot.prevKama = slot.prevClosedKama;
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/keltner.js
var DEFAULT_LENGTH6 = 20;
var DEFAULT_MULTIPLIER6 = 2;
var DEFAULT_MA_TYPE2 = "ema";
function getCtx50() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.keltner called outside an active script step");
  }
  return ctx;
}
function initSlot47(length, multiplier, maType, capacity) {
  return {
    upperBuffer: new Float64RingBuffer(capacity),
    lowerBuffer: new Float64RingBuffer(capacity),
    length,
    multiplier,
    maType,
    outputs: null
  };
}
function dispatchMa2(maType, subSlotId, source, length) {
  switch (maType) {
    case "sma":
      return sma(subSlotId, source, length);
    case "ema":
      return ema(subSlotId, source, length);
    case "wma":
      return wma(subSlotId, source, length);
    case "smma":
      return smma(subSlotId, source, length);
  }
}
function keltner(slotId, opts) {
  const ctx = getCtx50();
  const length = opts?.length ?? DEFAULT_LENGTH6;
  const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER6;
  const maType = opts?.maType ?? DEFAULT_MA_TYPE2;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot47(length, multiplier, maType, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const close = ctx.stream.bar.close;
  const middleSeries = dispatchMa2(slot.maType, `${slotId}/${slot.maType}`, close, slot.length);
  const atrSeries = atr(`${slotId}/atr`, slot.length);
  if (slot.outputs === null) {
    slot.outputs = Object.freeze({
      upper: makeSeriesView(slot.upperBuffer),
      middle: middleSeries,
      lower: makeSeriesView(slot.lowerBuffer)
    });
  }
  const mid = middleSeries.current;
  const atrValue = atrSeries.current;
  let upperValue;
  let lowerValue;
  if (Number.isFinite(mid) && Number.isFinite(atrValue)) {
    upperValue = mid + slot.multiplier * atrValue;
    lowerValue = mid - slot.multiplier * atrValue;
  } else {
    upperValue = Number.NaN;
    lowerValue = Number.NaN;
  }
  if (ctx.isTick) {
    slot.upperBuffer.replaceHead(upperValue);
    slot.lowerBuffer.replaceHead(lowerValue);
  } else {
    slot.upperBuffer.append(upperValue);
    slot.lowerBuffer.append(lowerValue);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/klinger.js
var DEFAULT_FAST_LENGTH2 = 34;
var DEFAULT_SLOW_LENGTH2 = 55;
var DEFAULT_SIGNAL_LENGTH = 13;
function getCtx51() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.klinger called outside an active script step");
  }
  return ctx;
}
function initSlot48(capacity) {
  const klingerBuf = new Float64RingBuffer(capacity);
  return {
    result: null,
    klingerBuf,
    klingerSeries: makeSeriesView(klingerBuf),
    prevHlc: Number.NaN,
    prevTrend: 0,
    prevCm: 0,
    prevDm: 0,
    prevClosedHlc: Number.NaN,
    prevClosedTrend: 0,
    prevClosedCm: 0,
    prevClosedDm: 0,
    barCount: 0
  };
}
function computeVf(high, low, close, volume, baseHlc, baseTrend, baseCm, baseDm) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { vf: 0, hlc: baseHlc, trend: baseTrend, cm: baseCm, dm: baseDm };
  }
  const hlc = high + low + close;
  const dm = high - low;
  let trend;
  if (!Number.isFinite(baseHlc)) {
    return { vf: 0, hlc, trend: 0, cm: 0, dm };
  }
  if (hlc > baseHlc)
    trend = 1;
  else if (hlc < baseHlc)
    trend = -1;
  else
    trend = baseTrend;
  const cm = trend === baseTrend ? baseCm + dm : baseDm + dm;
  const volumeFinite = Number.isFinite(volume) ? volume : 0;
  let vf = 0;
  if (cm !== 0 && Number.isFinite(cm)) {
    vf = volumeFinite * Math.abs(2 * (dm / cm - 1)) * trend * 100;
    if (!Number.isFinite(vf))
      vf = 0;
  }
  return { vf, hlc, trend, cm, dm };
}
function klinger(slotId, opts) {
  const ctx = getCtx51();
  const fastLength = opts?.fastLength ?? DEFAULT_FAST_LENGTH2;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW_LENGTH2;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL_LENGTH;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot48(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { high, low, close, volume } = ctx.stream.bar;
  let vf;
  if (ctx.isTick) {
    const step2 = computeVf(high, low, close, volume, slot.prevClosedHlc, slot.prevClosedTrend, slot.prevClosedCm, slot.prevClosedDm);
    vf = step2.vf;
  } else {
    slot.prevClosedHlc = slot.prevHlc;
    slot.prevClosedTrend = slot.prevTrend;
    slot.prevClosedCm = slot.prevCm;
    slot.prevClosedDm = slot.prevDm;
    const step2 = computeVf(high, low, close, volume, slot.prevHlc, slot.prevTrend, slot.prevCm, slot.prevDm);
    vf = step2.vf;
    slot.prevHlc = step2.hlc;
    slot.prevTrend = step2.trend;
    slot.prevCm = step2.cm;
    slot.prevDm = step2.dm;
    slot.barCount += 1;
  }
  const fastSeries = ema(`${slotId}/fastEma`, vf, fastLength);
  const slowSeries = ema(`${slotId}/slowEma`, vf, slowLength);
  const fa = fastSeries.current;
  const sa = slowSeries.current;
  const klingerValue = Number.isFinite(fa) && Number.isFinite(sa) ? fa - sa : Number.NaN;
  if (ctx.isTick)
    slot.klingerBuf.replaceHead(klingerValue);
  else
    slot.klingerBuf.append(klingerValue);
  const signalSeries = ema(`${slotId}/signalEma`, klingerValue, signalLength);
  if (slot.result === null) {
    slot.result = Object.freeze({
      klinger: slot.klingerSeries,
      signal: signalSeries
    });
  }
  return slot.result;
}

// ../runtime/dist/ta/kst.js
var DEFAULT_ROC1_LENGTH2 = 10;
var DEFAULT_ROC2_LENGTH2 = 15;
var DEFAULT_ROC3_LENGTH = 20;
var DEFAULT_ROC4_LENGTH = 30;
var DEFAULT_ROC1_SMOOTH = 10;
var DEFAULT_ROC2_SMOOTH = 10;
var DEFAULT_ROC3_SMOOTH = 10;
var DEFAULT_ROC4_SMOOTH = 15;
var DEFAULT_SIGNAL_LENGTH2 = 9;
function getCtx52() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.kst called outside an active script step");
  }
  return ctx;
}
function pctRoc2(current, lookback) {
  if (!Number.isFinite(lookback) || lookback === 0 || !Number.isFinite(current)) {
    return Number.NaN;
  }
  return 100 * (current - lookback) / lookback;
}
function rocFromWindow(window, src, length) {
  if (window.length <= length)
    return Number.NaN;
  return pctRoc2(src, window.at(length));
}
function kst(slotId, source, opts) {
  const ctx = getCtx52();
  const roc1Length = opts?.roc1Length ?? DEFAULT_ROC1_LENGTH2;
  const roc2Length = opts?.roc2Length ?? DEFAULT_ROC2_LENGTH2;
  const roc3Length = opts?.roc3Length ?? DEFAULT_ROC3_LENGTH;
  const roc4Length = opts?.roc4Length ?? DEFAULT_ROC4_LENGTH;
  const roc1Smooth = opts?.roc1Smooth ?? DEFAULT_ROC1_SMOOTH;
  const roc2Smooth = opts?.roc2Smooth ?? DEFAULT_ROC2_SMOOTH;
  const roc3Smooth = opts?.roc3Smooth ?? DEFAULT_ROC3_SMOOTH;
  const roc4Smooth = opts?.roc4Smooth ?? DEFAULT_ROC4_SMOOTH;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL_LENGTH2;
  const src = readSourceValue(source);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const capacity = ctx.stream.ohlcv.close.capacity;
    const kstBuf = new Float64RingBuffer(capacity);
    const lookbackCap = Math.max(roc1Length, roc2Length, roc3Length, roc4Length) + 1;
    slot = {
      result: null,
      kstBuf,
      kstSeries: makeSeriesView(kstBuf),
      roc1Length,
      roc2Length,
      roc3Length,
      roc4Length,
      sourceWindow: new Float64RingBuffer(lookbackCap)
    };
    ctx.stream.taSlots.set(slotId, slot);
  }
  if (ctx.isTick) {
    slot.sourceWindow.replaceHead(src);
  } else {
    slot.sourceWindow.append(src);
  }
  const roc1 = rocFromWindow(slot.sourceWindow, src, slot.roc1Length);
  const roc2 = rocFromWindow(slot.sourceWindow, src, slot.roc2Length);
  const roc3 = rocFromWindow(slot.sourceWindow, src, slot.roc3Length);
  const roc4 = rocFromWindow(slot.sourceWindow, src, slot.roc4Length);
  const r1Series = sma(`${slotId}/r1Sma`, roc1, roc1Smooth);
  const r2Series = sma(`${slotId}/r2Sma`, roc2, roc2Smooth);
  const r3Series = sma(`${slotId}/r3Sma`, roc3, roc3Smooth);
  const r4Series = sma(`${slotId}/r4Sma`, roc4, roc4Smooth);
  const r1 = r1Series.current;
  const r2 = r2Series.current;
  const r3 = r3Series.current;
  const r4 = r4Series.current;
  const kstValue = Number.isFinite(r1) && Number.isFinite(r2) && Number.isFinite(r3) && Number.isFinite(r4) ? r1 + 2 * r2 + 3 * r3 + 4 * r4 : Number.NaN;
  if (ctx.isTick) {
    slot.kstBuf.replaceHead(kstValue);
  } else {
    slot.kstBuf.append(kstValue);
  }
  const signalSeries = sma(`${slotId}/signalSma`, kstValue, signalLength);
  if (slot.result === null) {
    slot.result = Object.freeze({
      kst: slot.kstSeries,
      signal: signalSeries
    });
  }
  return slot.result;
}

// ../runtime/dist/ta/lsma.js
function getCtx53() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.lsma called outside an active script step");
  }
  return ctx;
}
function initSlot49(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  const xMean = (length - 1) / 2;
  let sumXX = 0;
  for (let j = 0; j < length; j += 1) {
    const dev = j - xMean;
    sumXX += dev * dev;
  }
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    xMean,
    sumXX,
    sourceWindow: new Float64RingBuffer(length)
  };
}
function lsmaFromWindow(slot, headOverride) {
  let sumY = 0;
  for (let j = 0; j < slot.length; j += 1) {
    const ageFromHead = slot.length - 1 - j;
    const v = ageFromHead === 0 && headOverride !== void 0 ? headOverride : slot.sourceWindow.at(ageFromHead);
    if (!Number.isFinite(v))
      return Number.NaN;
    sumY += v;
  }
  const yMean = sumY / slot.length;
  let num = 0;
  for (let j = 0; j < slot.length; j += 1) {
    const ageFromHead = slot.length - 1 - j;
    const v = ageFromHead === 0 && headOverride !== void 0 ? headOverride : slot.sourceWindow.at(ageFromHead);
    num += (j - slot.xMean) * (v - yMean);
  }
  const slope = num / slot.sumXX;
  const intercept = yMean - slope * slot.xMean;
  return intercept + slope * (slot.length - 1);
}
function closeValue17(slot, src) {
  slot.sourceWindow.append(src);
  if (slot.sourceWindow.length < slot.length)
    return Number.NaN;
  return lsmaFromWindow(slot);
}
function tickValue17(slot, src) {
  if (slot.sourceWindow.length < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src))
    return Number.NaN;
  return lsmaFromWindow(slot, src);
}
function lsma(slotId, source, length, _opts) {
  const ctx = getCtx53();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot49(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue17(slot, src));
  } else {
    slot.outBuffer.append(closeValue17(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/maRibbon.js
var DEFAULT_LENGTHS = Object.freeze([10, 20, 30, 40, 50]);
var DEFAULT_MA_TYPE3 = "sma";
function getCtx54() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.maRibbon called outside an active script step");
  }
  return ctx;
}
function dispatchMa3(maType, subSlotId, source, length) {
  switch (maType) {
    case "sma":
      return sma(subSlotId, source, length);
    case "ema":
      return ema(subSlotId, source, length);
    case "wma":
      return wma(subSlotId, source, length);
    case "smma":
      return smma(subSlotId, source, length);
  }
}
function maRibbon(slotId, source, opts) {
  const ctx = getCtx54();
  const lengths = opts?.lengths ?? DEFAULT_LENGTHS;
  const maType = opts?.maType ?? DEFAULT_MA_TYPE3;
  const src = readSourceValue(source);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const outputs = {};
    for (const length of lengths) {
      const subSlotId = `${slotId}/ma_${length}`;
      outputs[`ma_${length}`] = dispatchMa3(maType, subSlotId, src, length);
    }
    slot = {
      outputs: Object.freeze(outputs),
      lengths,
      maType
    };
    ctx.stream.taSlots.set(slotId, slot);
    return slot.outputs;
  }
  for (const length of slot.lengths) {
    const subSlotId = `${slotId}/ma_${length}`;
    dispatchMa3(slot.maType, subSlotId, src, length);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/macd.js
var DEFAULT_FAST3 = 12;
var DEFAULT_SLOW3 = 26;
var DEFAULT_SIGNAL = 9;
function getCtx55() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.macd called outside an active script step");
  }
  return ctx;
}
function initSlot50(capacity, signalSeries, signalBuf) {
  const macdBuf = new Float64RingBuffer(capacity);
  const histBuf = new Float64RingBuffer(capacity);
  return {
    result: Object.freeze({
      macd: makeSeriesView(macdBuf),
      signal: signalSeries,
      hist: makeSeriesView(histBuf)
    }),
    macdBuf,
    histBuf,
    signalBuf,
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset6(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      macd: makeShiftedSeriesView(slot.macdBuf, offset),
      signal: makeShiftedSeriesView(slot.signalBuf, offset),
      hist: makeShiftedSeriesView(slot.histBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function macd(slotId, source, opts) {
  const ctx = getCtx55();
  const fastLength = opts?.fastLength ?? DEFAULT_FAST3;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW3;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL;
  const offset = opts?.offset ?? 0;
  const signalSlotId = `${slotId}/signal`;
  const src = readSourceValue(source);
  const fastSeries = ema(`${slotId}/fast`, src, fastLength);
  const slowSeries = ema(`${slotId}/slow`, src, slowLength);
  const fa = fastSeries.current;
  const sa = slowSeries.current;
  const macdValue = Number.isFinite(fa) && Number.isFinite(sa) ? fa - sa : Number.NaN;
  const signalSeries = ema(signalSlotId, macdValue, signalLength);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const emaSlot = ctx.stream.taSlots.get(signalSlotId);
    slot = initSlot50(ctx.stream.ohlcv.close.capacity, signalSeries, emaSlot.outBuffer);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const sig = signalSeries.current;
  const histValue = Number.isFinite(macdValue) && Number.isFinite(sig) ? macdValue - sig : Number.NaN;
  if (ctx.isTick) {
    slot.macdBuf.replaceHead(macdValue);
    slot.histBuf.replaceHead(histValue);
  } else {
    slot.macdBuf.append(macdValue);
    slot.histBuf.append(histValue);
  }
  return resultForOffset6(slot, offset);
}

// ../runtime/dist/ta/massIndex.js
var DEFAULT_EMA_LENGTH = 9;
var DEFAULT_SUM_LENGTH = 25;
function getCtx56() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.massIndex called outside an active script step");
  }
  return ctx;
}
function initSlot51(emaLength, sumLength, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    emaLength,
    sumLength,
    ratioWindow: new Float64RingBuffer(sumLength),
    sumRatio: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset14(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function ratioValue(e1, e2) {
  if (!Number.isFinite(e1) || !Number.isFinite(e2) || e2 === 0)
    return Number.NaN;
  return e1 / e2;
}
function recomputeSum(slot) {
  let sum = 0;
  let anyNaN = false;
  for (let i = 0; i < slot.ratioWindow.length; i += 1) {
    const v = slot.ratioWindow.at(i);
    if (!Number.isFinite(v)) {
      anyNaN = true;
      break;
    }
    sum += v;
  }
  slot.sumRatio = anyNaN ? Number.NaN : sum;
}
function closeValue18(slot, ratio) {
  if (slot.ratioWindow.length < slot.ratioWindow.capacity) {
    slot.ratioWindow.append(ratio);
    if (Number.isFinite(ratio)) {
      slot.sumRatio += ratio;
    } else {
      slot.sumRatio = Number.NaN;
    }
    if (slot.ratioWindow.length < slot.ratioWindow.capacity)
      return Number.NaN;
    return slot.sumRatio;
  }
  const outgoing = slot.ratioWindow.at(slot.ratioWindow.length - 1);
  slot.ratioWindow.append(ratio);
  if (Number.isFinite(outgoing) && Number.isFinite(ratio) && Number.isFinite(slot.sumRatio)) {
    slot.sumRatio = slot.sumRatio - outgoing + ratio;
  } else {
    recomputeSum(slot);
  }
  return slot.sumRatio;
}
function tickValue18(slot, ratio) {
  if (slot.ratioWindow.length < slot.ratioWindow.capacity)
    return Number.NaN;
  const oldestInHead = slot.ratioWindow.at(0);
  return slot.sumRatio - oldestInHead + ratio;
}
function massIndex(slotId, opts) {
  const ctx = getCtx56();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const emaLength = opts?.emaLength ?? DEFAULT_EMA_LENGTH;
    const sumLength = opts?.sumLength ?? DEFAULT_SUM_LENGTH;
    slot = initSlot51(emaLength, sumLength, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const range = ctx.stream.bar.high - ctx.stream.bar.low;
  const ema1Series = ema(`${slotId}/ema1`, range, slot.emaLength);
  const e1 = ema1Series.current;
  const ema2Series = ema(`${slotId}/ema2`, e1, slot.emaLength);
  const e2 = ema2Series.current;
  const ratio = ratioValue(e1, e2);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue18(slot, ratio));
  } else {
    slot.outBuffer.append(closeValue18(slot, ratio));
  }
  return viewForOffset14(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/mcginley.js
function getCtx57() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.mcginley called outside an active script step");
  }
  return ctx;
}
function initSlot52(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    prevMc: Number.NaN,
    prevClosedMc: Number.NaN,
    seedCount: 0
  };
}
function step(src, prev, length) {
  if (prev === 0)
    return Number.NaN;
  const ratio = src / prev;
  const denom = length * ratio * ratio * ratio * ratio;
  return prev + (src - prev) / denom;
}
function compute4(slot, src, isTick) {
  if (!Number.isFinite(src)) {
    return isTick ? slot.prevMc : slot.prevClosedMc;
  }
  if (slot.seedCount < slot.length - 1) {
    if (isTick)
      return Number.NaN;
    slot.seedCount += 1;
    slot.prevClosedMc = Number.NaN;
    slot.prevMc = Number.NaN;
    return Number.NaN;
  }
  if (!Number.isFinite(slot.prevClosedMc)) {
    if (isTick)
      return src;
    slot.seedCount += 1;
    slot.prevClosedMc = src;
    slot.prevMc = src;
    return src;
  }
  const prev = slot.prevClosedMc;
  const next = step(src, prev, slot.length);
  if (!isTick) {
    slot.prevClosedMc = next;
    slot.prevMc = next;
  }
  return next;
}
function mcginley(slotId, source, length, _opts) {
  const ctx = getCtx57();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot52(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const value = compute4(slot, readSourceValue(source), ctx.isTick);
  if (ctx.isTick)
    slot.outBuffer.replaceHead(value);
  else
    slot.outBuffer.append(value);
  return slot.series;
}

// ../runtime/dist/ta/median.js
function getCtx58() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.median called outside an active script step");
  }
  return ctx;
}
function initSlot53(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    window: new Float64RingBuffer(length),
    sortedBuffer: new Float64Array(length)
  };
}
function medianOfWindow(slot, headOverride) {
  const buf = slot.sortedBuffer;
  let k = 0;
  const filled = slot.window.length;
  for (let i = 0; i < filled; i += 1) {
    const v = i === 0 ? headOverride : slot.window.at(i);
    if (Number.isFinite(v)) {
      buf[k] = v;
      k += 1;
    }
  }
  if (k === 0)
    return Number.NaN;
  const view = buf.subarray(0, k);
  view.sort();
  if (k % 2 === 1)
    return view[k - 1 >> 1];
  return (view[(k >> 1) - 1] + view[k >> 1]) / 2;
}
function closeValue19(slot, src) {
  slot.window.append(src);
  if (slot.window.length < slot.length)
    return Number.NaN;
  return medianOfWindow(slot, slot.window.at(0));
}
function tickValue19(slot, src) {
  if (slot.window.length < slot.length)
    return Number.NaN;
  return medianOfWindow(slot, src);
}
function median(slotId, source, length, _opts) {
  const ctx = getCtx58();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot53(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue19(slot, src));
  } else {
    slot.outBuffer.append(closeValue19(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/mfi.js
function getCtx59() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.mfi called outside an active script step");
  }
  return ctx;
}
function initSlot54(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map(),
    length,
    posMfWindow: new Float64RingBuffer(length),
    negMfWindow: new Float64RingBuffer(length),
    sumPosMf: 0,
    sumNegMf: 0,
    prevTp: Number.NaN
  };
}
function viewForOffset15(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function bucketMf(tp, prevTp, volume) {
  if (!Number.isFinite(tp) || !Number.isFinite(volume)) {
    return { posMf: 0, negMf: 0 };
  }
  if (!Number.isFinite(prevTp) || tp === prevTp) {
    return { posMf: 0, negMf: 0 };
  }
  const mf = tp * volume;
  if (tp > prevTp)
    return { posMf: mf, negMf: 0 };
  return { posMf: 0, negMf: mf };
}
function emitMfi(sumPos, sumNeg, ready) {
  if (!ready)
    return Number.NaN;
  const total = sumPos + sumNeg;
  if (total === 0)
    return Number.NaN;
  return 100 * sumPos / total;
}
function mfi(slotId, length, opts) {
  const ctx = getCtx59();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot54(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const offset = opts?.offset ?? 0;
  const { high, low, close, volume } = ctx.stream.bar;
  const tp = (high + low + close) / 3;
  const { posMf, negMf } = bucketMf(tp, slot.prevTp, volume);
  const hasComparison = Number.isFinite(slot.prevTp);
  if (ctx.isTick) {
    const ready = slot.posMfWindow.length === slot.length;
    if (!ready || !hasComparison) {
      slot.outBuffer.replaceHead(Number.NaN);
      return viewForOffset15(slot, offset);
    }
    const headPos = slot.posMfWindow.at(0);
    const headNeg = slot.negMfWindow.at(0);
    const hypPos = slot.sumPosMf - headPos + posMf;
    const hypNeg = slot.sumNegMf - headNeg + negMf;
    slot.outBuffer.replaceHead(emitMfi(hypPos, hypNeg, true));
    return viewForOffset15(slot, offset);
  }
  if (hasComparison) {
    if (slot.posMfWindow.length === slot.length) {
      slot.sumPosMf -= slot.posMfWindow.at(slot.length - 1);
      slot.sumNegMf -= slot.negMfWindow.at(slot.length - 1);
    }
    slot.posMfWindow.append(posMf);
    slot.negMfWindow.append(negMf);
    slot.sumPosMf += posMf;
    slot.sumNegMf += negMf;
  }
  if (Number.isFinite(tp))
    slot.prevTp = tp;
  slot.outBuffer.append(emitMfi(slot.sumPosMf, slot.sumNegMf, slot.posMfWindow.length === slot.length));
  return viewForOffset15(slot, offset);
}

// ../runtime/dist/ta/momentum.js
function getCtx60() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.momentum called outside an active script step");
  }
  return ctx;
}
function momentum(slotId, source, length, _opts) {
  const ctx = getCtx60();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = { series: null };
    ctx.stream.taSlots.set(slotId, slot);
  }
  const sub = change(`${slotId}/change`, source, { length });
  if (slot.series === null)
    slot.series = sub;
  return slot.series;
}

// ../runtime/dist/ta/netVolume.js
function getCtx61() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.netVolume called outside an active script step");
  }
  return ctx;
}
function initSlot55(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map(),
    cumNetVol: 0,
    prevClose: Number.NaN,
    prevClosedCumNetVol: 0,
    prevClosedPrevClose: Number.NaN
  };
}
function viewForOffset16(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function signOfDelta(delta) {
  if (delta > 0)
    return 1;
  if (delta < 0)
    return -1;
  return 0;
}
function fold2(inCum, inPrevClose, close, volume) {
  if (!Number.isFinite(close)) {
    return { cum: inCum, prevClose: inPrevClose };
  }
  if (!Number.isFinite(inPrevClose)) {
    return { cum: inCum, prevClose: close };
  }
  if (!Number.isFinite(volume)) {
    return { cum: inCum, prevClose: close };
  }
  const direction = signOfDelta(close - inPrevClose);
  return { cum: inCum + direction * volume, prevClose: close };
}
function netVolume(slotId, opts) {
  const ctx = getCtx61();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot55(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const offset = opts?.offset ?? 0;
  const { close, volume } = ctx.stream.bar;
  if (ctx.isTick) {
    const next2 = fold2(slot.prevClosedCumNetVol, slot.prevClosedPrevClose, close, volume);
    slot.outBuffer.replaceHead(next2.cum);
    return viewForOffset16(slot, offset);
  }
  slot.prevClosedCumNetVol = slot.cumNetVol;
  slot.prevClosedPrevClose = slot.prevClose;
  const next = fold2(slot.cumNetVol, slot.prevClose, close, volume);
  slot.cumNetVol = next.cum;
  slot.prevClose = next.prevClose;
  slot.outBuffer.append(slot.cumNetVol);
  return viewForOffset16(slot, offset);
}

// ../runtime/dist/ta/nvi.js
var SEED_VALUE = 1e3;
function getCtx62() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.nvi called outside an active script step");
  }
  return ctx;
}
function initSlot56(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map(),
    value: SEED_VALUE,
    prevClose: Number.NaN,
    prevVolume: Number.NaN,
    prevClosedValue: SEED_VALUE,
    prevClosedPrevClose: Number.NaN,
    prevClosedPrevVolume: Number.NaN
  };
}
function viewForOffset17(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function safeVol3(volume) {
  return Number.isFinite(volume) ? volume : 0;
}
function fold3(inValue, inPrevClose, inPrevVolume, close, volume) {
  if (!Number.isFinite(close)) {
    return { value: inValue, prevClose: inPrevClose, prevVolume: inPrevVolume };
  }
  const v = safeVol3(volume);
  if (!Number.isFinite(inPrevClose)) {
    return { value: inValue, prevClose: close, prevVolume: v };
  }
  const pv = safeVol3(inPrevVolume);
  const shouldUpdate = v < pv;
  if (!shouldUpdate || inPrevClose === 0) {
    return { value: inValue, prevClose: close, prevVolume: v };
  }
  const next = inValue * (1 + (close - inPrevClose) / inPrevClose);
  return { value: next, prevClose: close, prevVolume: v };
}
function nvi(slotId, opts) {
  const ctx = getCtx62();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot56(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const offset = opts?.offset ?? 0;
  const { close, volume } = ctx.stream.bar;
  if (ctx.isTick) {
    const next2 = fold3(slot.prevClosedValue, slot.prevClosedPrevClose, slot.prevClosedPrevVolume, close, volume);
    slot.outBuffer.replaceHead(next2.value);
    return viewForOffset17(slot, offset);
  }
  slot.prevClosedValue = slot.value;
  slot.prevClosedPrevClose = slot.prevClose;
  slot.prevClosedPrevVolume = slot.prevVolume;
  const next = fold3(slot.value, slot.prevClose, slot.prevVolume, close, volume);
  slot.value = next.value;
  slot.prevClose = next.prevClose;
  slot.prevVolume = next.prevVolume;
  slot.outBuffer.append(slot.value);
  return viewForOffset17(slot, offset);
}

// ../runtime/dist/ta/nz.js
function nz(value, replacement) {
  if (Number.isNaN(value))
    return replacement ?? 0;
  return value;
}

// ../runtime/dist/ta/obv.js
function getCtx63() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.obv called outside an active script step");
  }
  return ctx;
}
function initSlot57(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    cumObv: 0,
    prevClose: Number.NaN,
    prevClosedCumObv: 0,
    prevClosedPrevClose: Number.NaN
  };
}
function signOfDelta2(delta) {
  if (delta > 0)
    return 1;
  if (delta < 0)
    return -1;
  return 0;
}
function fold4(inCumObv, inPrevClose, close, volume) {
  if (!Number.isFinite(close)) {
    return { cumObv: inCumObv, prevClose: inPrevClose };
  }
  if (!Number.isFinite(inPrevClose)) {
    return { cumObv: inCumObv, prevClose: close };
  }
  if (!Number.isFinite(volume)) {
    return { cumObv: inCumObv, prevClose: close };
  }
  const direction = signOfDelta2(close - inPrevClose);
  return { cumObv: inCumObv + direction * volume, prevClose: close };
}
function obv(slotId, _opts) {
  const ctx = getCtx63();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot57(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { close, volume } = ctx.stream.bar;
  if (ctx.isTick) {
    const next2 = fold4(slot.prevClosedCumObv, slot.prevClosedPrevClose, close, volume);
    slot.outBuffer.replaceHead(next2.cumObv);
    return slot.series;
  }
  slot.prevClosedCumObv = slot.cumObv;
  slot.prevClosedPrevClose = slot.prevClose;
  const next = fold4(slot.cumObv, slot.prevClose, close, volume);
  slot.cumObv = next.cumObv;
  slot.prevClose = next.prevClose;
  slot.outBuffer.append(slot.cumObv);
  return slot.series;
}

// ../runtime/dist/ta/pivotsHighLow.js
var DEFAULT_LEFT = 4;
var DEFAULT_RIGHT = 4;
function getCtx64() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.pivotsHighLow called outside an active script step");
  }
  return ctx;
}
function initSlot58(capacity, leftLength, rightLength) {
  const highBuffer = new Float64RingBuffer(capacity);
  const lowBuffer = new Float64RingBuffer(capacity);
  const windowSize = leftLength + rightLength + 1;
  return {
    outputs: Object.freeze({
      high: makeSeriesView(highBuffer),
      low: makeSeriesView(lowBuffer)
    }),
    highBuffer,
    lowBuffer,
    leftLength,
    rightLength,
    highWindow: new Float64RingBuffer(windowSize),
    lowWindow: new Float64RingBuffer(windowSize),
    barCount: 0
  };
}
function scanUpPivot(highWindow, headHigh, leftLength, rightLength) {
  const centreAge = rightLength;
  const centreHigh = highWindow.at(centreAge);
  if (!Number.isFinite(centreHigh))
    return Number.NaN;
  for (let k = 0; k < rightLength; k += 1) {
    const v = k === 0 ? headHigh : highWindow.at(k);
    if (!Number.isFinite(v))
      return Number.NaN;
    if (v > centreHigh)
      return Number.NaN;
  }
  for (let k = centreAge + 1; k <= centreAge + leftLength; k += 1) {
    const v = highWindow.at(k);
    if (!Number.isFinite(v))
      return Number.NaN;
    if (v >= centreHigh)
      return Number.NaN;
  }
  return centreHigh;
}
function scanDownPivot(lowWindow, headLow, leftLength, rightLength) {
  const centreAge = rightLength;
  const centreLow = lowWindow.at(centreAge);
  if (!Number.isFinite(centreLow))
    return Number.NaN;
  for (let k = 0; k < rightLength; k += 1) {
    const v = k === 0 ? headLow : lowWindow.at(k);
    if (!Number.isFinite(v))
      return Number.NaN;
    if (v < centreLow)
      return Number.NaN;
  }
  for (let k = centreAge + 1; k <= centreAge + leftLength; k += 1) {
    const v = lowWindow.at(k);
    if (!Number.isFinite(v))
      return Number.NaN;
    if (v <= centreLow)
      return Number.NaN;
  }
  return centreLow;
}
function pivotsHighLow(slotId, opts) {
  const ctx = getCtx64();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const leftLength = opts?.leftLength ?? DEFAULT_LEFT;
    const rightLength = opts?.rightLength ?? DEFAULT_RIGHT;
    slot = initSlot58(ctx.stream.ohlcv.close.capacity, leftLength, rightLength);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  const windowSize = slot.leftLength + slot.rightLength + 1;
  if (ctx.isTick) {
    if (slot.barCount < windowSize) {
      slot.highBuffer.replaceHead(Number.NaN);
      slot.lowBuffer.replaceHead(Number.NaN);
    } else {
      slot.highBuffer.replaceHead(scanUpPivot(slot.highWindow, bar.high, slot.leftLength, slot.rightLength));
      slot.lowBuffer.replaceHead(scanDownPivot(slot.lowWindow, bar.low, slot.leftLength, slot.rightLength));
    }
  } else {
    slot.highWindow.append(bar.high);
    slot.lowWindow.append(bar.low);
    slot.barCount += 1;
    if (slot.barCount < windowSize) {
      slot.highBuffer.append(Number.NaN);
      slot.lowBuffer.append(Number.NaN);
    } else {
      slot.highBuffer.append(scanUpPivot(slot.highWindow, slot.highWindow.at(0), slot.leftLength, slot.rightLength));
      slot.lowBuffer.append(scanDownPivot(slot.lowWindow, slot.lowWindow.at(0), slot.leftLength, slot.rightLength));
    }
  }
  return slot.outputs;
}

// ../runtime/dist/ta/pivotsStandard.js
var DEFAULT_SYSTEM = "classic";
var MS_PER_DAY2 = 864e5;
var NAN = Number.NaN;
function getCtx65() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.pivotsStandard called outside an active script step");
  }
  return ctx;
}
function makeNaNLevels() {
  return { pp: NAN, r1: NAN, s1: NAN, r2: NAN, s2: NAN, r3: NAN, s3: NAN };
}
function classic(h, l, c) {
  const p = (h + l + c) / 3;
  const range = h - l;
  return {
    pp: p,
    r1: 2 * p - l,
    s1: 2 * p - h,
    r2: p + range,
    s2: p - range,
    r3: p + 2 * range,
    s3: p - 2 * range
  };
}
function fibonacci(h, l, c) {
  const p = (h + l + c) / 3;
  const range = h - l;
  return {
    pp: p,
    r1: p + 0.382 * range,
    s1: p - 0.382 * range,
    r2: p + 0.618 * range,
    s2: p - 0.618 * range,
    r3: p + range,
    s3: p - range
  };
}
function camarilla(h, l, c) {
  const p = (h + l + c) / 3;
  const range = h - l;
  return {
    pp: p,
    r1: c + 1.1 * range / 12,
    s1: c - 1.1 * range / 12,
    r2: c + 1.1 * range / 6,
    s2: c - 1.1 * range / 6,
    r3: c + 1.1 * range / 4,
    s3: c - 1.1 * range / 4
  };
}
function woodie(h, l, c) {
  const p = (h + l + 2 * c) / 4;
  const range = h - l;
  return {
    pp: p,
    r1: 2 * p - l,
    s1: 2 * p - h,
    r2: p + range,
    s2: p - range,
    r3: h + 2 * (p - l),
    s3: l - 2 * (h - p)
  };
}
var FORMULA_DISPATCH = Object.freeze({
  classic,
  fibonacci,
  camarilla,
  woodie
});
function computeLevels(slot) {
  return computeLevelsFrom(slot.prevDayHigh, slot.prevDayLow, slot.prevDayClose, slot.system);
}
function computeLevelsFrom(prevHigh, prevLow, prevClose, system) {
  if (!Number.isFinite(prevHigh) || !Number.isFinite(prevLow) || !Number.isFinite(prevClose)) {
    return makeNaNLevels();
  }
  return FORMULA_DISPATCH[system](prevHigh, prevLow, prevClose);
}
function initSlot59(capacity, system) {
  const ppBuffer = new Float64RingBuffer(capacity);
  const r1Buffer = new Float64RingBuffer(capacity);
  const s1Buffer = new Float64RingBuffer(capacity);
  const r2Buffer = new Float64RingBuffer(capacity);
  const s2Buffer = new Float64RingBuffer(capacity);
  const r3Buffer = new Float64RingBuffer(capacity);
  const s3Buffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      pp: makeSeriesView(ppBuffer),
      r1: makeSeriesView(r1Buffer),
      s1: makeSeriesView(s1Buffer),
      r2: makeSeriesView(r2Buffer),
      s2: makeSeriesView(s2Buffer),
      r3: makeSeriesView(r3Buffer),
      s3: makeSeriesView(s3Buffer)
    }),
    ppBuffer,
    r1Buffer,
    s1Buffer,
    r2Buffer,
    s2Buffer,
    r3Buffer,
    s3Buffer,
    system,
    barCount: 0,
    currentDayKey: 0,
    currentDayHigh: NAN,
    currentDayLow: NAN,
    currentDayClose: NAN,
    prevDayHigh: NAN,
    prevDayLow: NAN,
    prevDayClose: NAN,
    prevClosedBarCount: 0,
    prevClosedCurrentDayKey: 0,
    prevClosedCurrentDayHigh: NAN,
    prevClosedCurrentDayLow: NAN,
    prevClosedCurrentDayClose: NAN,
    prevClosedPrevDayHigh: NAN,
    prevClosedPrevDayLow: NAN,
    prevClosedPrevDayClose: NAN
  };
}
function snapshot(slot) {
  slot.prevClosedBarCount = slot.barCount;
  slot.prevClosedCurrentDayKey = slot.currentDayKey;
  slot.prevClosedCurrentDayHigh = slot.currentDayHigh;
  slot.prevClosedCurrentDayLow = slot.currentDayLow;
  slot.prevClosedCurrentDayClose = slot.currentDayClose;
  slot.prevClosedPrevDayHigh = slot.prevDayHigh;
  slot.prevClosedPrevDayLow = slot.prevDayLow;
  slot.prevClosedPrevDayClose = slot.prevDayClose;
}
function safeMax(acc, x) {
  if (!Number.isFinite(x))
    return acc;
  if (!Number.isFinite(acc))
    return x;
  return x > acc ? x : acc;
}
function safeMin(acc, x) {
  if (!Number.isFinite(x))
    return acc;
  if (!Number.isFinite(acc))
    return x;
  return x < acc ? x : acc;
}
function emitLevels(slot, levels, isTick) {
  if (isTick) {
    slot.ppBuffer.replaceHead(levels.pp);
    slot.r1Buffer.replaceHead(levels.r1);
    slot.s1Buffer.replaceHead(levels.s1);
    slot.r2Buffer.replaceHead(levels.r2);
    slot.s2Buffer.replaceHead(levels.s2);
    slot.r3Buffer.replaceHead(levels.r3);
    slot.s3Buffer.replaceHead(levels.s3);
  } else {
    slot.ppBuffer.append(levels.pp);
    slot.r1Buffer.append(levels.r1);
    slot.s1Buffer.append(levels.s1);
    slot.r2Buffer.append(levels.r2);
    slot.s2Buffer.append(levels.s2);
    slot.r3Buffer.append(levels.r3);
    slot.s3Buffer.append(levels.s3);
  }
}
function closeStep3(slot, time, high, low, close) {
  const dayKey = Math.floor(time / MS_PER_DAY2);
  snapshot(slot);
  if (slot.barCount === 0) {
    slot.barCount = 1;
    slot.currentDayKey = dayKey;
    slot.currentDayHigh = high;
    slot.currentDayLow = low;
    slot.currentDayClose = close;
    return makeNaNLevels();
  }
  if (dayKey !== slot.currentDayKey) {
    slot.prevDayHigh = slot.currentDayHigh;
    slot.prevDayLow = slot.currentDayLow;
    slot.prevDayClose = slot.currentDayClose;
    slot.currentDayKey = dayKey;
    slot.currentDayHigh = high;
    slot.currentDayLow = low;
    slot.currentDayClose = close;
  } else {
    slot.currentDayHigh = safeMax(slot.currentDayHigh, high);
    slot.currentDayLow = safeMin(slot.currentDayLow, low);
    if (Number.isFinite(close))
      slot.currentDayClose = close;
  }
  slot.barCount += 1;
  return computeLevels(slot);
}
function tickStep2(slot, time, _high, _low, _close) {
  if (slot.prevClosedBarCount === 0) {
    return makeNaNLevels();
  }
  const dayKey = Math.floor(time / MS_PER_DAY2);
  const snapKey = slot.prevClosedCurrentDayKey;
  const snapPrevHigh = slot.prevClosedPrevDayHigh;
  const snapPrevLow = slot.prevClosedPrevDayLow;
  const snapPrevClose = slot.prevClosedPrevDayClose;
  if (dayKey !== snapKey) {
    return computeLevelsFrom(slot.prevClosedCurrentDayHigh, slot.prevClosedCurrentDayLow, slot.prevClosedCurrentDayClose, slot.system);
  }
  return computeLevelsFrom(snapPrevHigh, snapPrevLow, snapPrevClose, slot.system);
}
function pivotsStandard(slotId, opts) {
  const ctx = getCtx65();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const system = opts?.system ?? DEFAULT_SYSTEM;
    slot = initSlot59(ctx.stream.ohlcv.close.capacity, system);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  if (ctx.isTick) {
    const levels = tickStep2(slot, bar.time, bar.high, bar.low, bar.close);
    emitLevels(slot, levels, true);
  } else {
    const levels = closeStep3(slot, bar.time, bar.high, bar.low, bar.close);
    emitLevels(slot, levels, false);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/pmo.js
var DEFAULT_FIRST = 35;
var DEFAULT_SECOND = 20;
var DEFAULT_SIGNAL2 = 10;
function makeSwenlinState(length) {
  return {
    alpha: 2 / length,
    length,
    seedSum: 0,
    seedCount: 0,
    prevClosedEma: Number.NaN
  };
}
function swenlinClose(state2, src) {
  if (!Number.isFinite(src)) {
    return state2.prevClosedEma;
  }
  if (state2.seedCount < state2.length) {
    state2.seedSum += src;
    state2.seedCount += 1;
    if (state2.seedCount < state2.length) {
      state2.prevClosedEma = Number.NaN;
      return Number.NaN;
    }
    const seedValue = state2.seedSum / state2.length;
    state2.prevClosedEma = seedValue;
    return seedValue;
  }
  const prev = state2.prevClosedEma;
  const next = src * state2.alpha + prev * (1 - state2.alpha);
  state2.prevClosedEma = next;
  return next;
}
function swenlinTick(state2, src) {
  if (!Number.isFinite(src))
    return state2.prevClosedEma;
  if (state2.seedCount < state2.length) {
    const nextSum = state2.seedSum + src;
    const nextCount = state2.seedCount + 1;
    if (nextCount < state2.length)
      return Number.NaN;
    return nextSum / state2.length;
  }
  return src * state2.alpha + state2.prevClosedEma * (1 - state2.alpha);
}
function getCtx66() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.pmo called outside an active script step");
  }
  return ctx;
}
function resultForOffset7(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      pmo: makeShiftedSeriesView(slot.pmoBuf, offset),
      signal: makeShiftedSeriesView(slot.signalBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function computeRoc1(src, prevSrc) {
  if (!Number.isFinite(src) || !Number.isFinite(prevSrc) || prevSrc === 0) {
    return Number.NaN;
  }
  return (src / prevSrc - 1) * 1e3;
}
function pmo(slotId, source, opts) {
  const ctx = getCtx66();
  const firstSmoothing = opts?.firstSmoothing ?? DEFAULT_FIRST;
  const secondSmoothing = opts?.secondSmoothing ?? DEFAULT_SECOND;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL2;
  const offset = opts?.offset ?? 0;
  const signalSlotId = `${slotId}/signal`;
  const isTick = ctx.isTick;
  const src = readSourceValue(source);
  let slot = ctx.stream.taSlots.get(slotId);
  const prevForRoc = isTick ? (
    /* c8 ignore next */
    slot?.prevClosedSrc ?? Number.NaN
  ) : slot?.prevSrc ?? Number.NaN;
  const roc1 = computeRoc1(src, prevForRoc);
  if (slot === void 0) {
    const pmoBuf = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
    const stage1 = makeSwenlinState(firstSmoothing);
    const stage2 = makeSwenlinState(secondSmoothing);
    const stage1Value2 = swenlinClose(stage1, roc1);
    const scaled2 = Number.isFinite(stage1Value2) ? stage1Value2 * 10 : Number.NaN;
    const stage2Value = swenlinClose(stage2, scaled2);
    pmoBuf.append(stage2Value);
    const signalSeries = ema(signalSlotId, stage2Value, signalLength);
    const emaSlot = ctx.stream.taSlots.get(signalSlotId);
    slot = {
      result: Object.freeze({
        pmo: makeSeriesView(pmoBuf),
        signal: signalSeries
      }),
      pmoBuf,
      signalBuf: emaSlot.outBuffer,
      shiftedResults: /* @__PURE__ */ new Map(),
      stage1,
      stage2,
      prevSrc: src,
      prevClosedSrc: Number.NaN
    };
    ctx.stream.taSlots.set(slotId, slot);
    return resultForOffset7(slot, offset);
  }
  const stage1Value = isTick ? swenlinTick(slot.stage1, roc1) : swenlinClose(slot.stage1, roc1);
  const scaled = Number.isFinite(stage1Value) ? stage1Value * 10 : Number.NaN;
  const pmoValue = isTick ? swenlinTick(slot.stage2, scaled) : swenlinClose(slot.stage2, scaled);
  void ema(signalSlotId, pmoValue, signalLength);
  if (isTick) {
    slot.pmoBuf.replaceHead(pmoValue);
  } else {
    slot.pmoBuf.append(pmoValue);
    slot.prevClosedSrc = slot.prevSrc;
    slot.prevSrc = src;
  }
  return resultForOffset7(slot, offset);
}

// ../runtime/dist/ta/ppo.js
var DEFAULT_FAST4 = 12;
var DEFAULT_SLOW4 = 26;
var DEFAULT_SIGNAL3 = 9;
function getCtx67() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.ppo called outside an active script step");
  }
  return ctx;
}
function initSlot60(capacity, signalSeries, signalBuf) {
  const ppoBuf = new Float64RingBuffer(capacity);
  const histBuf = new Float64RingBuffer(capacity);
  return {
    result: Object.freeze({
      ppo: makeSeriesView(ppoBuf),
      signal: signalSeries,
      hist: makeSeriesView(histBuf)
    }),
    ppoBuf,
    histBuf,
    signalBuf,
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset8(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      ppo: makeShiftedSeriesView(slot.ppoBuf, offset),
      signal: makeShiftedSeriesView(slot.signalBuf, offset),
      hist: makeShiftedSeriesView(slot.histBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function ppoValue(fast, slow) {
  if (!Number.isFinite(fast) || !Number.isFinite(slow) || slow === 0)
    return Number.NaN;
  return 100 * (fast - slow) / slow;
}
function ppo(slotId, source, opts) {
  const ctx = getCtx67();
  const fastLength = opts?.fastLength ?? DEFAULT_FAST4;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW4;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL3;
  const offset = opts?.offset ?? 0;
  const signalSlotId = `${slotId}/signal`;
  const src = readSourceValue(source);
  const fastSeries = ema(`${slotId}/fast`, src, fastLength);
  const slowSeries = ema(`${slotId}/slow`, src, slowLength);
  const pv = ppoValue(fastSeries.current, slowSeries.current);
  const signalSeries = ema(signalSlotId, pv, signalLength);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const emaSlot = ctx.stream.taSlots.get(signalSlotId);
    slot = initSlot60(ctx.stream.ohlcv.close.capacity, signalSeries, emaSlot.outBuffer);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const sig = signalSeries.current;
  const histValue = Number.isFinite(pv) && Number.isFinite(sig) ? pv - sig : Number.NaN;
  if (ctx.isTick) {
    slot.ppoBuf.replaceHead(pv);
    slot.histBuf.replaceHead(histValue);
  } else {
    slot.ppoBuf.append(pv);
    slot.histBuf.append(histValue);
  }
  return resultForOffset8(slot, offset);
}

// ../runtime/dist/ta/psar.js
var DEFAULT_ACC_START = 0.02;
var DEFAULT_ACC_STEP = 0.02;
var DEFAULT_ACC_MAX = 0.2;
var TREND_UP = 1;
var TREND_DOWN = -1;
function getCtx68() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.psar called outside an active script step");
  }
  return ctx;
}
function initSlot61(capacity, accStart, accStep, accMax) {
  const sarBuffer = new Float64RingBuffer(capacity);
  const directionBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      sar: makeSeriesView(sarBuffer),
      direction: makeSeriesView(directionBuffer)
    }),
    sarBuffer,
    directionBuffer,
    accStart,
    accStep,
    accMax,
    barCount: 0,
    trend: TREND_UP,
    ep: Number.NaN,
    af: accStart,
    sar: Number.NaN,
    prevHigh: Number.NaN,
    prevLow: Number.NaN,
    priorHigh: Number.NaN,
    priorLow: Number.NaN,
    prevClose: Number.NaN,
    prevClosedTrend: TREND_UP,
    prevClosedEp: Number.NaN,
    prevClosedAf: accStart,
    prevClosedSar: Number.NaN,
    prevClosedPrevHigh: Number.NaN,
    prevClosedPrevLow: Number.NaN,
    prevClosedPriorHigh: Number.NaN,
    prevClosedPriorLow: Number.NaN,
    prevClosedPrevClose: Number.NaN,
    prevClosedBarCount: 0
  };
}
function snapshot2(slot) {
  slot.prevClosedTrend = slot.trend;
  slot.prevClosedEp = slot.ep;
  slot.prevClosedAf = slot.af;
  slot.prevClosedSar = slot.sar;
  slot.prevClosedPrevHigh = slot.prevHigh;
  slot.prevClosedPrevLow = slot.prevLow;
  slot.prevClosedPriorHigh = slot.priorHigh;
  slot.prevClosedPriorLow = slot.priorLow;
  slot.prevClosedPrevClose = slot.prevClose;
  slot.prevClosedBarCount = slot.barCount;
}
function recurrenceStep(prevTrend, prevEp, prevAf, prevSar, prevHigh, prevLow, priorHigh, priorLow, high, low, accStart, accStep, accMax) {
  let candidateSar = prevSar + prevAf * (prevEp - prevSar);
  if (prevTrend === TREND_UP) {
    const lowerBound = Math.min(prevLow, priorLow);
    if (candidateSar > lowerBound)
      candidateSar = lowerBound;
    if (low <= candidateSar) {
      return { trend: TREND_DOWN, ep: low, af: accStart, sar: prevEp };
    }
    let ep2 = prevEp;
    let af2 = prevAf;
    if (high > prevEp) {
      ep2 = high;
      af2 = Math.min(prevAf + accStep, accMax);
    }
    return { trend: TREND_UP, ep: ep2, af: af2, sar: candidateSar };
  }
  const upperBound = Math.max(prevHigh, priorHigh);
  if (candidateSar < upperBound)
    candidateSar = upperBound;
  if (high >= candidateSar) {
    return { trend: TREND_UP, ep: high, af: accStart, sar: prevEp };
  }
  let ep = prevEp;
  let af = prevAf;
  if (low < prevEp) {
    ep = low;
    af = Math.min(prevAf + accStep, accMax);
  }
  return { trend: TREND_DOWN, ep, af, sar: candidateSar };
}
function closeStep4(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { sar: Number.NaN, direction: Number.NaN };
  }
  snapshot2(slot);
  slot.barCount += 1;
  if (slot.prevClosedBarCount === 0) {
    slot.trend = TREND_UP;
    slot.sar = low;
    slot.ep = high;
    slot.af = slot.accStart;
    slot.prevHigh = high;
    slot.prevLow = low;
    slot.priorHigh = high;
    slot.priorLow = low;
    slot.prevClose = close;
    return { sar: low, direction: TREND_UP };
  }
  if (slot.prevClosedBarCount === 1) {
    const direction = close >= slot.prevClose ? TREND_UP : TREND_DOWN;
    slot.trend = direction;
    if (direction === TREND_UP) {
      slot.ep = high;
      slot.sar = slot.prevLow;
    } else {
      slot.ep = low;
      slot.sar = slot.prevHigh;
    }
    slot.af = slot.accStart;
    const step3 = recurrenceStep(slot.trend, slot.ep, slot.af, slot.sar, slot.prevHigh, slot.prevLow, slot.prevHigh, slot.prevLow, high, low, slot.accStart, slot.accStep, slot.accMax);
    slot.trend = step3.trend;
    slot.ep = step3.ep;
    slot.af = step3.af;
    slot.sar = step3.sar;
    slot.priorHigh = slot.prevHigh;
    slot.priorLow = slot.prevLow;
    slot.prevHigh = high;
    slot.prevLow = low;
    slot.prevClose = close;
    return { sar: step3.sar, direction: step3.trend };
  }
  const step2 = recurrenceStep(slot.trend, slot.ep, slot.af, slot.sar, slot.prevHigh, slot.prevLow, slot.priorHigh, slot.priorLow, high, low, slot.accStart, slot.accStep, slot.accMax);
  slot.trend = step2.trend;
  slot.ep = step2.ep;
  slot.af = step2.af;
  slot.sar = step2.sar;
  slot.priorHigh = slot.prevHigh;
  slot.priorLow = slot.prevLow;
  slot.prevHigh = high;
  slot.prevLow = low;
  slot.prevClose = close;
  return { sar: step2.sar, direction: step2.trend };
}
function tickStep3(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { sar: Number.NaN, direction: Number.NaN };
  }
  const seedBarCount = slot.prevClosedBarCount;
  if (seedBarCount === 0) {
    return { sar: low, direction: TREND_UP };
  }
  if (seedBarCount === 1) {
    const direction = close >= slot.prevClosedPrevClose ? TREND_UP : TREND_DOWN;
    let ep;
    let sar;
    if (direction === TREND_UP) {
      ep = high;
      sar = slot.prevClosedPrevLow;
    } else {
      ep = low;
      sar = slot.prevClosedPrevHigh;
    }
    const af = slot.accStart;
    const step3 = recurrenceStep(direction, ep, af, sar, slot.prevClosedPrevHigh, slot.prevClosedPrevLow, slot.prevClosedPrevHigh, slot.prevClosedPrevLow, high, low, slot.accStart, slot.accStep, slot.accMax);
    return { sar: step3.sar, direction: step3.trend };
  }
  const step2 = recurrenceStep(slot.prevClosedTrend, slot.prevClosedEp, slot.prevClosedAf, slot.prevClosedSar, slot.prevClosedPrevHigh, slot.prevClosedPrevLow, slot.prevClosedPriorHigh, slot.prevClosedPriorLow, high, low, slot.accStart, slot.accStep, slot.accMax);
  return { sar: step2.sar, direction: step2.trend };
}
function psar(slotId, opts) {
  const ctx = getCtx68();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const accStart = opts?.accelerationStart ?? DEFAULT_ACC_START;
    const accStep = opts?.accelerationStep ?? DEFAULT_ACC_STEP;
    const accMax = opts?.accelerationMax ?? DEFAULT_ACC_MAX;
    slot = initSlot61(ctx.stream.ohlcv.close.capacity, accStart, accStep, accMax);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const high = ctx.stream.bar.high;
  const low = ctx.stream.bar.low;
  const close = ctx.stream.bar.close;
  if (ctx.isTick) {
    const { sar, direction } = tickStep3(slot, high, low, close);
    slot.sarBuffer.replaceHead(sar);
    slot.directionBuffer.replaceHead(direction);
  } else {
    const { sar, direction } = closeStep4(slot, high, low, close);
    slot.sarBuffer.append(sar);
    slot.directionBuffer.append(direction);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/pvi.js
var SEED_VALUE2 = 1e3;
function getCtx69() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.pvi called outside an active script step");
  }
  return ctx;
}
function initSlot62(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map(),
    value: SEED_VALUE2,
    prevClose: Number.NaN,
    prevVolume: Number.NaN,
    prevClosedValue: SEED_VALUE2,
    prevClosedPrevClose: Number.NaN,
    prevClosedPrevVolume: Number.NaN
  };
}
function viewForOffset18(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function safeVol4(volume) {
  return Number.isFinite(volume) ? volume : 0;
}
function fold5(inValue, inPrevClose, inPrevVolume, close, volume) {
  if (!Number.isFinite(close)) {
    return { value: inValue, prevClose: inPrevClose, prevVolume: inPrevVolume };
  }
  const v = safeVol4(volume);
  if (!Number.isFinite(inPrevClose)) {
    return { value: inValue, prevClose: close, prevVolume: v };
  }
  const pv = safeVol4(inPrevVolume);
  const shouldUpdate = v > pv;
  if (!shouldUpdate || inPrevClose === 0) {
    return { value: inValue, prevClose: close, prevVolume: v };
  }
  const next = inValue * (1 + (close - inPrevClose) / inPrevClose);
  return { value: next, prevClose: close, prevVolume: v };
}
function pvi(slotId, opts) {
  const ctx = getCtx69();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot62(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const offset = opts?.offset ?? 0;
  const { close, volume } = ctx.stream.bar;
  if (ctx.isTick) {
    const next2 = fold5(slot.prevClosedValue, slot.prevClosedPrevClose, slot.prevClosedPrevVolume, close, volume);
    slot.outBuffer.replaceHead(next2.value);
    return viewForOffset18(slot, offset);
  }
  slot.prevClosedValue = slot.value;
  slot.prevClosedPrevClose = slot.prevClose;
  slot.prevClosedPrevVolume = slot.prevVolume;
  const next = fold5(slot.value, slot.prevClose, slot.prevVolume, close, volume);
  slot.value = next.value;
  slot.prevClose = next.prevClose;
  slot.prevVolume = next.prevVolume;
  slot.outBuffer.append(slot.value);
  return viewForOffset18(slot, offset);
}

// ../runtime/dist/ta/pvo.js
var DEFAULT_FAST5 = 12;
var DEFAULT_SLOW5 = 26;
var DEFAULT_SIGNAL4 = 9;
function getCtx70() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.pvo called outside an active script step");
  }
  return ctx;
}
function initSlot63(capacity, signalSeries, signalBuf) {
  const pvoBuf = new Float64RingBuffer(capacity);
  const histBuf = new Float64RingBuffer(capacity);
  return {
    result: Object.freeze({
      pvo: makeSeriesView(pvoBuf),
      signal: signalSeries,
      hist: makeSeriesView(histBuf)
    }),
    pvoBuf,
    histBuf,
    signalBuf,
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset9(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      pvo: makeShiftedSeriesView(slot.pvoBuf, offset),
      signal: makeShiftedSeriesView(slot.signalBuf, offset),
      hist: makeShiftedSeriesView(slot.histBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function pvoValue(fast, slow) {
  if (!Number.isFinite(fast) || !Number.isFinite(slow) || slow === 0)
    return Number.NaN;
  return 100 * (fast - slow) / slow;
}
function pvo(slotId, opts) {
  const ctx = getCtx70();
  const fastLength = opts?.fastLength ?? DEFAULT_FAST5;
  const slowLength = opts?.slowLength ?? DEFAULT_SLOW5;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL4;
  const offset = opts?.offset ?? 0;
  const signalSlotId = `${slotId}/signal`;
  const volume = ctx.stream.bar.volume;
  const fastSeries = ema(`${slotId}/fast`, volume, fastLength);
  const slowSeries = ema(`${slotId}/slow`, volume, slowLength);
  const pv = pvoValue(fastSeries.current, slowSeries.current);
  const signalSeries = ema(signalSlotId, pv, signalLength);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const emaSlot = ctx.stream.taSlots.get(signalSlotId);
    slot = initSlot63(ctx.stream.ohlcv.close.capacity, signalSeries, emaSlot.outBuffer);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const sig = signalSeries.current;
  const histValue = Number.isFinite(pv) && Number.isFinite(sig) ? pv - sig : Number.NaN;
  if (ctx.isTick) {
    slot.pvoBuf.replaceHead(pv);
    slot.histBuf.replaceHead(histValue);
  } else {
    slot.pvoBuf.append(pv);
    slot.histBuf.append(histValue);
  }
  return resultForOffset9(slot, offset);
}

// ../runtime/dist/ta/pvt.js
function getCtx71() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.pvt called outside an active script step");
  }
  return ctx;
}
function initSlot64(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map(),
    cumPvt: 0,
    prevClose: Number.NaN,
    prevClosedCumPvt: 0,
    prevClosedPrevClose: Number.NaN
  };
}
function viewForOffset19(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function contribution(prevClose, close, volume) {
  if (prevClose === 0)
    return Number.NaN;
  const v = Number.isFinite(volume) ? volume : 0;
  return v * (close - prevClose) / prevClose;
}
function fold6(inCum, inPrevClose, close, volume) {
  if (!Number.isFinite(close)) {
    return { cum: inCum, prevClose: inPrevClose, emit: inCum };
  }
  if (!Number.isFinite(inPrevClose)) {
    return { cum: inCum, prevClose: close, emit: inCum };
  }
  const c = contribution(inPrevClose, close, volume);
  if (Number.isNaN(c)) {
    return { cum: inCum, prevClose: close, emit: Number.NaN };
  }
  const next = inCum + c;
  return { cum: next, prevClose: close, emit: next };
}
function pvt(slotId, opts) {
  const ctx = getCtx71();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot64(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const offset = opts?.offset ?? 0;
  const { close, volume } = ctx.stream.bar;
  if (ctx.isTick) {
    const next2 = fold6(slot.prevClosedCumPvt, slot.prevClosedPrevClose, close, volume);
    slot.outBuffer.replaceHead(next2.emit);
    return viewForOffset19(slot, offset);
  }
  slot.prevClosedCumPvt = slot.cumPvt;
  slot.prevClosedPrevClose = slot.prevClose;
  const next = fold6(slot.cumPvt, slot.prevClose, close, volume);
  slot.cumPvt = next.cum;
  slot.prevClose = next.prevClose;
  slot.outBuffer.append(next.emit);
  return viewForOffset19(slot, offset);
}

// ../runtime/dist/ta/roc.js
function getCtx72() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.roc called outside an active script step");
  }
  return ctx;
}
function initSlot65(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length + 1)
  };
}
function rocValue(head, old) {
  if (!Number.isFinite(head) || !Number.isFinite(old) || old === 0)
    return Number.NaN;
  return 100 * (head - old) / old;
}
function closeValue20(slot, src) {
  slot.sourceWindow.append(src);
  if (slot.sourceWindow.length <= slot.length)
    return Number.NaN;
  const head = slot.sourceWindow.at(0);
  const old = slot.sourceWindow.at(slot.length);
  return rocValue(head, old);
}
function tickValue20(slot, src) {
  if (slot.sourceWindow.length <= slot.length)
    return Number.NaN;
  const old = slot.sourceWindow.at(slot.length);
  return rocValue(src, old);
}
function roc(slotId, source, length, _opts) {
  const ctx = getCtx72();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot65(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue20(slot, src));
  } else {
    slot.outBuffer.append(closeValue20(slot, src));
  }
  return slot.series;
}

// ../runtime/dist/ta/rvgi.js
var DEFAULT_LENGTH7 = 10;
function getCtx73() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.rvgi called outside an active script step");
  }
  return ctx;
}
function initSlot66(length, capacity) {
  const rvgiBuf = new Float64RingBuffer(capacity);
  const signalBuf = new Float64RingBuffer(capacity);
  return {
    result: null,
    rvgiBuf,
    signalBuf,
    rvgiSeries: makeSeriesView(rvgiBuf),
    signalSeries: makeSeriesView(signalBuf),
    length,
    coWindow: new Float64RingBuffer(4),
    hlWindow: new Float64RingBuffer(4),
    rvgiWindow: new Float64RingBuffer(4)
  };
}
function weighted4(ring) {
  if (ring.length < 4)
    return Number.NaN;
  const v0 = ring.at(0);
  const v1 = ring.at(1);
  const v2 = ring.at(2);
  const v3 = ring.at(3);
  if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) {
    return Number.NaN;
  }
  return (v0 + 2 * v1 + 2 * v2 + v3) / 6;
}
function rvgi(slotId, opts) {
  const ctx = getCtx73();
  const length = opts?.length ?? DEFAULT_LENGTH7;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot66(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const { open, high, low, close } = ctx.stream.bar;
  const co = Number.isFinite(close) && Number.isFinite(open) ? close - open : Number.NaN;
  const hl = Number.isFinite(high) && Number.isFinite(low) ? high - low : Number.NaN;
  if (ctx.isTick) {
    slot.coWindow.replaceHead(co);
    slot.hlWindow.replaceHead(hl);
  } else {
    slot.coWindow.append(co);
    slot.hlWindow.append(hl);
  }
  const numerator = weighted4(slot.coWindow);
  const denominator2 = weighted4(slot.hlWindow);
  const numSeries = sma(`${slotId}/numSma`, numerator, length);
  const denSeries = sma(`${slotId}/denSma`, denominator2, length);
  const numSma = numSeries.current;
  const denSma = denSeries.current;
  let rvgiValue;
  if (!Number.isFinite(numSma) || !Number.isFinite(denSma) || denSma === 0) {
    rvgiValue = Number.NaN;
  } else {
    rvgiValue = numSma / denSma;
  }
  if (ctx.isTick) {
    slot.rvgiWindow.replaceHead(rvgiValue);
    slot.rvgiBuf.replaceHead(rvgiValue);
  } else {
    slot.rvgiWindow.append(rvgiValue);
    slot.rvgiBuf.append(rvgiValue);
  }
  const signalValue = weighted4(slot.rvgiWindow);
  if (ctx.isTick)
    slot.signalBuf.replaceHead(signalValue);
  else
    slot.signalBuf.append(signalValue);
  if (slot.result === null) {
    slot.result = Object.freeze({
      rvgi: slot.rvgiSeries,
      signal: slot.signalSeries
    });
  }
  return slot.result;
}

// ../runtime/dist/ta/rvi.js
function getCtx74() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.rvi called outside an active script step");
  }
  return ctx;
}
function initSlot67(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sigmaWindow: new Float64RingBuffer(length),
    sumX: 0,
    sumX2: 0,
    prevSrc: Number.NaN,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset20(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function windowStdDev2(n, sumX, sumX2) {
  const mean = sumX / n;
  const variance = sumX2 / n - mean * mean;
  return Math.sqrt(Math.max(0, variance));
}
function appendToSigmaWindow(slot, src) {
  if (slot.sigmaWindow.length < slot.sigmaWindow.capacity) {
    slot.sigmaWindow.append(src);
    if (Number.isFinite(src)) {
      slot.sumX += src;
      slot.sumX2 += src * src;
    } else {
      slot.sumX = Number.NaN;
      slot.sumX2 = Number.NaN;
    }
    if (slot.sigmaWindow.length < slot.sigmaWindow.capacity)
      return Number.NaN;
    if (!Number.isFinite(slot.sumX))
      return Number.NaN;
    return windowStdDev2(slot.sigmaWindow.length, slot.sumX, slot.sumX2);
  }
  const outgoing = slot.sigmaWindow.at(slot.sigmaWindow.length - 1);
  slot.sigmaWindow.append(src);
  if (!Number.isFinite(src)) {
    slot.sumX = Number.NaN;
    slot.sumX2 = Number.NaN;
    return Number.NaN;
  }
  if (!Number.isFinite(slot.sumX) || !Number.isFinite(outgoing)) {
    let sumX = 0;
    let sumX2 = 0;
    for (let i = 0; i < slot.sigmaWindow.length; i += 1) {
      const v = slot.sigmaWindow.at(i);
      if (!Number.isFinite(v)) {
        slot.sumX = Number.NaN;
        slot.sumX2 = Number.NaN;
        return Number.NaN;
      }
      sumX += v;
      sumX2 += v * v;
    }
    slot.sumX = sumX;
    slot.sumX2 = sumX2;
  } else {
    slot.sumX = slot.sumX - outgoing + src;
    slot.sumX2 = slot.sumX2 - outgoing * outgoing + src * src;
  }
  return windowStdDev2(slot.sigmaWindow.length, slot.sumX, slot.sumX2);
}
function tickSigma(slot, src) {
  if (slot.sigmaWindow.length < slot.sigmaWindow.capacity)
    return Number.NaN;
  if (!Number.isFinite(src))
    return Number.NaN;
  const oldestInHead = slot.sigmaWindow.at(0);
  const sumX = slot.sumX - oldestInHead + src;
  const sumX2 = slot.sumX2 - oldestInHead * oldestInHead + src * src;
  return windowStdDev2(slot.sigmaWindow.length, sumX, sumX2);
}
function classify(sigma, diff2) {
  if (!Number.isFinite(sigma) || !Number.isFinite(diff2)) {
    return { up: Number.NaN, down: Number.NaN };
  }
  return {
    up: diff2 > 0 ? sigma : 0,
    down: diff2 < 0 ? sigma : 0
  };
}
function rviValue(upEma, downEma) {
  if (!Number.isFinite(upEma) || !Number.isFinite(downEma))
    return Number.NaN;
  const total = upEma + downEma;
  if (total === 0)
    return Number.NaN;
  return 100 * upEma / total;
}
function rvi(slotId, source, length, opts) {
  const ctx = getCtx74();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot67(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    const sigma = tickSigma(slot, src);
    const diff2 = src - slot.prevSrc;
    const { up, down } = classify(sigma, diff2);
    const upSeries = ema(`${slotId}/upEma`, up, slot.length);
    const downSeries = ema(`${slotId}/downEma`, down, slot.length);
    const value = Number.isFinite(src) ? rviValue(upSeries.current, downSeries.current) : Number.NaN;
    slot.outBuffer.replaceHead(value);
  } else {
    const sigma = appendToSigmaWindow(slot, src);
    const diff2 = src - slot.prevSrc;
    const { up, down } = classify(sigma, diff2);
    const upSeries = ema(`${slotId}/upEma`, up, slot.length);
    const downSeries = ema(`${slotId}/downEma`, down, slot.length);
    const value = Number.isFinite(src) ? rviValue(upSeries.current, downSeries.current) : Number.NaN;
    slot.outBuffer.append(value);
    slot.prevSrc = src;
  }
  return viewForOffset20(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/sessionVolumeProfile.js
var DAY_MS = 864e5;
function getCtx75() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.sessionVolumeProfile called outside an active script step");
  }
  return ctx;
}
function initSlot68(capacity) {
  const core = createVolumeProfileCore(capacity);
  const slot = {
    ...core,
    result: Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeSeriesView(core.pocBuffer),
      valHigh: makeSeriesView(core.valHighBuffer),
      valLow: makeSeriesView(core.valLowBuffer)
    }),
    shiftedResults: /* @__PURE__ */ new Map()
  };
  return slot;
}
function resultForOffset10(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeShiftedSeriesView(slot.pocBuffer, offset),
      valHigh: makeShiftedSeriesView(slot.valHighBuffer, offset),
      valLow: makeShiftedSeriesView(slot.valLowBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function utcDayStart(time) {
  return Math.floor(time / DAY_MS) * DAY_MS;
}
function parseSessionWindowMinutes(session) {
  const match = /^(\d{1,2})(?::?(\d{2}))?\s*-\s*(\d{1,2})(?::?(\d{2}))?$/.exec(session.trim());
  if (match === null)
    return null;
  const startHour = Number(match[1]);
  const startMinute = match[2] === void 0 ? 0 : Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = match[4] === void 0 ? 0 : Number(match[4]);
  if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59)
    return null;
  if (endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59)
    return null;
  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute
  };
}
function sessionBoundaryFromDescriptor(time, session) {
  const parsed = parseSessionWindowMinutes(session);
  if (parsed === null)
    return null;
  const dayStart = utcDayStart(time);
  const boundary = dayStart + parsed.startMinutes * 6e4;
  return time >= boundary ? boundary : boundary - DAY_MS;
}
function diagnoseMissingSession(ctx, slotId) {
  const key = `session-info-missing|${slotId}`;
  if (ctx.diagnosedRequestKeys.has(key))
    return;
  ctx.diagnosedRequestKeys.add(key);
  pushDiagnostic(ctx.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code: "session-info-missing",
    message: "Adapter did not provide syminfo.session; ta.sessionVolumeProfile used UTC-day boundaries.",
    slotId,
    bar: ctx.barIndex()
  });
}
function resolveSessionStart(ctx, slotId, opts) {
  if (opts?.sessionStart !== void 0)
    return opts.sessionStart;
  const session = ctx.views.syminfo.session;
  if (!ctx.capabilities.symInfoFields.has("session") || session === "") {
    diagnoseMissingSession(ctx, slotId);
    return utcDayStart(ctx.stream.bar.time);
  }
  const boundary = sessionBoundaryFromDescriptor(ctx.stream.bar.time, session);
  if (boundary === null) {
    diagnoseMissingSession(ctx, slotId);
    return utcDayStart(ctx.stream.bar.time);
  }
  return boundary;
}
function collectBars3(ctx, sessionStart) {
  const { ohlcv } = ctx.stream;
  const bars = [];
  for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
    const time = ohlcv.time.at(lookback);
    if (time <= sessionStart)
      continue;
    bars.push({
      close: ohlcv.close.at(lookback),
      high: ohlcv.high.at(lookback),
      low: ohlcv.low.at(lookback),
      open: ohlcv.open.at(lookback),
      time,
      volume: ohlcv.volume.at(lookback)
    });
  }
  return bars;
}
function sessionVolumeProfile(slotId, opts) {
  const ctx = getCtx75();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot68(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const sessionStart = resolveSessionStart(ctx, slotId, opts);
  const bars = ctx.stream.bar.time <= sessionStart ? [] : collectBars3(ctx, sessionStart);
  const snapshot6 = resolveVolumeProfileSnapshot({
    bars,
    bucketColor: opts?.bucketColor,
    config: volumeProfileConfigFromOpts(opts ?? {})
  });
  commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot6);
  emitVolumeProfileHistogram(ctx, slotId, "Session Volume Profile", snapshot6.poc, snapshot6.buckets);
  return resultForOffset10(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/smi.js
var DEFAULT_K_LENGTH = 10;
var DEFAULT_FIRST2 = 3;
var DEFAULT_SECOND2 = 5;
var DEFAULT_D_LENGTH = 3;
function getCtx76() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.smi called outside an active script step");
  }
  return ctx;
}
function resultForOffset11(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      smi: makeShiftedSeriesView(slot.smiBuf, offset),
      signal: makeShiftedSeriesView(slot.signalBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function smiValue(numSmoothed, denSmoothed) {
  if (!Number.isFinite(numSmoothed) || !Number.isFinite(denSmoothed) || denSmoothed === 0) {
    return Number.NaN;
  }
  return 100 * numSmoothed / denSmoothed;
}
function smi(slotId, opts) {
  const ctx = getCtx76();
  const kLength = opts?.kLength ?? DEFAULT_K_LENGTH;
  const firstSmoothing = opts?.firstSmoothing ?? DEFAULT_FIRST2;
  const secondSmoothing = opts?.secondSmoothing ?? DEFAULT_SECOND2;
  const dLength = opts?.dLength ?? DEFAULT_D_LENGTH;
  const offset = opts?.offset ?? 0;
  const isTick = ctx.isTick;
  const bar = ctx.stream.bar;
  const hh = highest(`${slotId}/hh`, bar.high, kLength).current;
  const ll = lowest(`${slotId}/ll`, bar.low, kLength).current;
  let num;
  let den;
  if (!Number.isFinite(hh) || !Number.isFinite(ll)) {
    num = Number.NaN;
    den = Number.NaN;
  } else {
    const cm = (hh + ll) / 2;
    num = bar.close - cm;
    den = (hh - ll) / 2;
  }
  const numFirst = ema(`${slotId}/nFirst`, num, firstSmoothing).current;
  const numSmoothed = ema(`${slotId}/nSecond`, numFirst, secondSmoothing).current;
  const denFirst = ema(`${slotId}/dFirst`, den, firstSmoothing).current;
  const denSmoothed = ema(`${slotId}/dSecond`, denFirst, secondSmoothing).current;
  const smiOut = smiValue(numSmoothed, denSmoothed);
  const signalSlotId = `${slotId}/signal`;
  const signalSeries = ema(signalSlotId, smiOut, dLength);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const smiBuf = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
    const emaSlot = ctx.stream.taSlots.get(signalSlotId);
    slot = {
      result: Object.freeze({
        smi: makeSeriesView(smiBuf),
        signal: signalSeries
      }),
      smiBuf,
      signalBuf: emaSlot.outBuffer,
      shiftedResults: /* @__PURE__ */ new Map()
    };
    ctx.stream.taSlots.set(slotId, slot);
  }
  if (isTick) {
    slot.smiBuf.replaceHead(smiOut);
  } else {
    slot.smiBuf.append(smiOut);
  }
  return resultForOffset11(slot, offset);
}

// ../runtime/dist/ta/stoch.js
var DEFAULT_K_LENGTH2 = 14;
var DEFAULT_K_SMOOTHING = 3;
var DEFAULT_D_LENGTH2 = 3;
function getCtx77() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.stoch called outside an active script step");
  }
  return ctx;
}
function stoch(slotId, opts) {
  const ctx = getCtx77();
  const kLength = opts?.kLength ?? DEFAULT_K_LENGTH2;
  const kSmoothing = opts?.kSmoothing ?? DEFAULT_K_SMOOTHING;
  const dLength = opts?.dLength ?? DEFAULT_D_LENGTH2;
  const bar = ctx.stream.bar;
  const hhSeries = highest(`${slotId}/hh`, bar.high, kLength);
  const llSeries = lowest(`${slotId}/ll`, bar.low, kLength);
  const hh = hhSeries.current;
  const ll = llSeries.current;
  let kRaw;
  if (!Number.isFinite(hh) || !Number.isFinite(ll)) {
    kRaw = Number.NaN;
  } else if (hh === ll) {
    kRaw = Number.NaN;
  } else {
    kRaw = 100 * (bar.close - ll) / (hh - ll);
  }
  const kSeries = sma(`${slotId}/kSmooth`, kRaw, kSmoothing);
  const dSeries = sma(`${slotId}/d`, kSeries.current, dLength);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = {
      result: Object.freeze({ k: kSeries, d: dSeries })
    };
    ctx.stream.taSlots.set(slotId, slot);
  }
  return slot.result;
}

// ../runtime/dist/ta/stochRsi.js
var DEFAULT_RSI_LENGTH2 = 14;
var DEFAULT_STOCH_LENGTH = 14;
var DEFAULT_K_SMOOTHING2 = 3;
var DEFAULT_D_SMOOTHING = 3;
function getCtx78() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.stochRsi called outside an active script step");
  }
  return ctx;
}
function stochRsi(slotId, source, opts) {
  const ctx = getCtx78();
  const rsiLength = opts?.rsiLength ?? DEFAULT_RSI_LENGTH2;
  const stochLength = opts?.stochLength ?? DEFAULT_STOCH_LENGTH;
  const kSmoothing = opts?.kSmoothing ?? DEFAULT_K_SMOOTHING2;
  const dSmoothing = opts?.dSmoothing ?? DEFAULT_D_SMOOTHING;
  const src = readSourceValue(source);
  const rsiSeries = rsi(`${slotId}/rsi`, src, rsiLength);
  const rsiCurrent = rsiSeries.current;
  const hhSeries = highest(`${slotId}/hh`, rsiCurrent, stochLength);
  const llSeries = lowest(`${slotId}/ll`, rsiCurrent, stochLength);
  const hh = hhSeries.current;
  const ll = llSeries.current;
  let kRaw;
  if (!Number.isFinite(hh) || !Number.isFinite(ll) || !Number.isFinite(rsiCurrent)) {
    kRaw = Number.NaN;
  } else if (hh === ll) {
    kRaw = Number.NaN;
  } else {
    kRaw = 100 * (rsiCurrent - ll) / (hh - ll);
  }
  const kSeries = sma(`${slotId}/kSmooth`, kRaw, kSmoothing);
  const dSeries = sma(`${slotId}/d`, kSeries.current, dSmoothing);
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = {
      result: Object.freeze({ k: kSeries, d: dSeries })
    };
    ctx.stream.taSlots.set(slotId, slot);
  }
  return slot.result;
}

// ../runtime/dist/ta/supertrend.js
var DEFAULT_LENGTH8 = 10;
var DEFAULT_MULTIPLIER7 = 3;
var TREND_UP2 = 1;
var TREND_DOWN2 = -1;
function getCtx79() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.supertrend called outside an active script step");
  }
  return ctx;
}
function initSlot69(capacity, length, multiplier) {
  const lineBuffer = new Float64RingBuffer(capacity);
  const directionBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      line: makeSeriesView(lineBuffer),
      direction: makeSeriesView(directionBuffer)
    }),
    lineBuffer,
    directionBuffer,
    length,
    multiplier,
    warmBarCount: 0,
    prevFinalUpper: Number.NaN,
    prevFinalLower: Number.NaN,
    prevDirection: TREND_UP2,
    prevClose: Number.NaN,
    prevClosedFinalUpper: Number.NaN,
    prevClosedFinalLower: Number.NaN,
    prevClosedDirection: TREND_UP2,
    prevClosedPrevClose: Number.NaN,
    prevClosedWarmBarCount: 0
  };
}
function snapshot3(slot) {
  slot.prevClosedFinalUpper = slot.prevFinalUpper;
  slot.prevClosedFinalLower = slot.prevFinalLower;
  slot.prevClosedDirection = slot.prevDirection;
  slot.prevClosedPrevClose = slot.prevClose;
  slot.prevClosedWarmBarCount = slot.warmBarCount;
}
function recurrenceStep2(mid, atrValue, close, multiplier, prevFinalUpper, prevFinalLower, prevDirection, prevClose) {
  const basicUpper = mid + multiplier * atrValue;
  const basicLower = mid - multiplier * atrValue;
  const finalUpper = basicUpper < prevFinalUpper || prevClose > prevFinalUpper ? basicUpper : prevFinalUpper;
  const finalLower = basicLower > prevFinalLower || prevClose < prevFinalLower ? basicLower : prevFinalLower;
  let direction = prevDirection;
  if (close > prevFinalUpper) {
    direction = TREND_UP2;
  } else if (close < prevFinalLower) {
    direction = TREND_DOWN2;
  }
  const line2 = direction === TREND_UP2 ? finalLower : finalUpper;
  return { finalUpper, finalLower, direction, line: line2 };
}
function closeStep5(slot, mid, atrValue, close) {
  if (!Number.isFinite(mid) || !Number.isFinite(atrValue) || !Number.isFinite(close)) {
    return { line: Number.NaN, direction: Number.NaN };
  }
  snapshot3(slot);
  slot.warmBarCount += 1;
  if (slot.prevClosedWarmBarCount === 0) {
    const basicUpper = mid + slot.multiplier * atrValue;
    const basicLower = mid - slot.multiplier * atrValue;
    slot.prevFinalUpper = basicUpper;
    slot.prevFinalLower = basicLower;
    slot.prevDirection = TREND_UP2;
    slot.prevClose = close;
    return { line: basicLower, direction: TREND_UP2 };
  }
  const step2 = recurrenceStep2(mid, atrValue, close, slot.multiplier, slot.prevFinalUpper, slot.prevFinalLower, slot.prevDirection, slot.prevClose);
  slot.prevFinalUpper = step2.finalUpper;
  slot.prevFinalLower = step2.finalLower;
  slot.prevDirection = step2.direction;
  slot.prevClose = close;
  return { line: step2.line, direction: step2.direction };
}
function tickStep4(slot, mid, atrValue, close) {
  if (!Number.isFinite(mid) || !Number.isFinite(atrValue) || !Number.isFinite(close)) {
    return { line: Number.NaN, direction: Number.NaN };
  }
  if (slot.prevClosedWarmBarCount === 0) {
    const basicLower = mid - slot.multiplier * atrValue;
    return { line: basicLower, direction: TREND_UP2 };
  }
  const step2 = recurrenceStep2(mid, atrValue, close, slot.multiplier, slot.prevClosedFinalUpper, slot.prevClosedFinalLower, slot.prevClosedDirection, slot.prevClosedPrevClose);
  return { line: step2.line, direction: step2.direction };
}
function supertrend(slotId, opts) {
  const ctx = getCtx79();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const length = opts?.length ?? DEFAULT_LENGTH8;
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER7;
    slot = initSlot69(ctx.stream.ohlcv.close.capacity, length, multiplier);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const atrSeries = atr(`${slotId}/atr`, slot.length);
  const mid = ctx.stream.bar.hl2;
  const atrValue = atrSeries.current;
  const close = ctx.stream.bar.close;
  if (ctx.isTick) {
    const { line: line2, direction } = tickStep4(slot, mid, atrValue, close);
    slot.lineBuffer.replaceHead(line2);
    slot.directionBuffer.replaceHead(direction);
  } else {
    const { line: line2, direction } = closeStep5(slot, mid, atrValue, close);
    slot.lineBuffer.append(line2);
    slot.directionBuffer.append(direction);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/tema.js
function getCtx80() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.tema called outside an active script step");
  }
  return ctx;
}
function initSlot70(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length
  };
}
function tema(slotId, source, length, _opts) {
  const ctx = getCtx80();
  const src = readSourceValue(source);
  const e1 = ema(`${slotId}/ema1`, src, length).current;
  const e2 = ema(`${slotId}/ema2`, e1, length).current;
  const e3 = ema(`${slotId}/ema3`, e2, length).current;
  const value = Number.isFinite(e1) && Number.isFinite(e2) && Number.isFinite(e3) ? 3 * e1 - 3 * e2 + e3 : Number.NaN;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot70(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  if (ctx.isTick)
    slot.outBuffer.replaceHead(value);
  else
    slot.outBuffer.append(value);
  return slot.series;
}

// ../runtime/dist/ta/trendStrengthIndex.js
function getCtx81() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.trendStrengthIndex called outside an active script step");
  }
  return ctx;
}
function initSlot71(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length),
    barCount: 0,
    nanCount: 0,
    evictedSource: Number.NaN,
    prevClosedNanCount: 0,
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function viewForOffset21(slot, offset) {
  if (offset === 0)
    return slot.series;
  let view = slot.shiftedViews.get(offset);
  if (view === void 0) {
    view = makeShiftedSeriesView(slot.outBuffer, offset);
    slot.shiftedViews.set(offset, view);
  }
  return view;
}
function pearsonHead(window, length, headSource) {
  let sumX = 0;
  let sumY = 0;
  for (let k = 0; k < length; k += 1) {
    const x = k === length - 1 ? headSource : window.at(length - 1 - k);
    if (!Number.isFinite(x))
      return Number.NaN;
    sumX += x;
    sumY += k;
  }
  const meanX = sumX / length;
  const meanY = sumY / length;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (let k = 0; k < length; k += 1) {
    const x = k === length - 1 ? headSource : window.at(length - 1 - k);
    const dX = x - meanX;
    const dY = k - meanY;
    sumXY += dX * dY;
    sumXX += dX * dX;
    sumYY += dY * dY;
  }
  if (sumXX === 0 || sumYY === 0)
    return Number.NaN;
  const r = sumXY / Math.sqrt(sumXX * sumYY);
  if (r < -1)
    return -1;
  if (r > 1)
    return 1;
  return r;
}
function closeStep6(slot, src) {
  slot.prevClosedNanCount = slot.nanCount;
  if (slot.sourceWindow.length >= slot.length) {
    slot.evictedSource = slot.sourceWindow.at(slot.length - 1);
    if (Number.isNaN(slot.evictedSource))
      slot.nanCount -= 1;
  } else {
    slot.evictedSource = Number.NaN;
  }
  slot.sourceWindow.append(src);
  if (!Number.isFinite(src))
    slot.nanCount += 1;
  slot.barCount += 1;
  if (slot.barCount < slot.length)
    return Number.NaN;
  if (slot.nanCount > 0)
    return Number.NaN;
  return pearsonHead(slot.sourceWindow, slot.length, src);
}
function tickStep5(slot, src) {
  if (slot.barCount < slot.length)
    return Number.NaN;
  let nanCount = slot.prevClosedNanCount;
  if (Number.isNaN(slot.evictedSource))
    nanCount -= 1;
  if (!Number.isFinite(src))
    nanCount += 1;
  if (nanCount > 0)
    return Number.NaN;
  return pearsonHead(slot.sourceWindow, slot.length, src);
}
function trendStrengthIndex(slotId, source, length, opts) {
  const ctx = getCtx81();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot71(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickStep5(slot, src));
  } else {
    slot.outBuffer.append(closeStep6(slot, src));
  }
  return viewForOffset21(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/trix.js
var DEFAULT_SIGNAL5 = 9;
function getCtx82() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.trix called outside an active script step");
  }
  return ctx;
}
function initSlot72(capacity, signalSeries) {
  const trixBuffer = new Float64RingBuffer(capacity);
  return {
    result: Object.freeze({
      trix: makeSeriesView(trixBuffer),
      signal: signalSeries
    }),
    trixBuffer,
    prevClosedEma3: Number.NaN,
    prevPrevClosedEma3: Number.NaN,
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset12(slot, offset, signalBuf) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      trix: makeShiftedSeriesView(slot.trixBuffer, offset),
      signal: makeShiftedSeriesView(signalBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function trix(slotId, source, length, opts) {
  const ctx = getCtx82();
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL5;
  const offset = opts?.offset ?? 0;
  const src = readSourceValue(source);
  const e1 = ema(`${slotId}/ema1`, src, length).current;
  const e2 = ema(`${slotId}/ema2`, e1, length).current;
  const e3 = ema(`${slotId}/ema3`, e2, length).current;
  let slot = ctx.stream.taSlots.get(slotId);
  let prevE3;
  if (slot === void 0)
    prevE3 = Number.NaN;
  else if (ctx.isTick)
    prevE3 = slot.prevPrevClosedEma3;
  else
    prevE3 = slot.prevClosedEma3;
  const trixValue = Number.isFinite(e3) && Number.isFinite(prevE3) && prevE3 !== 0 ? 100 * (e3 - prevE3) / prevE3 : Number.NaN;
  const signalSeries = ema(`${slotId}/signal`, trixValue, signalLength);
  if (slot === void 0) {
    slot = initSlot72(ctx.stream.ohlcv.close.capacity, signalSeries);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const signalSubSlot = ctx.stream.taSlots.get(`${slotId}/signal`);
  if (ctx.isTick) {
    slot.trixBuffer.replaceHead(trixValue);
  } else {
    slot.trixBuffer.append(trixValue);
    slot.prevPrevClosedEma3 = slot.prevClosedEma3;
    if (Number.isFinite(e3)) {
      slot.prevClosedEma3 = e3;
    }
  }
  return resultForOffset12(slot, offset, signalSubSlot.outBuffer);
}

// ../runtime/dist/ta/tsi.js
var DEFAULT_FIRST3 = 25;
var DEFAULT_SECOND3 = 13;
var DEFAULT_SIGNAL6 = 13;
function getCtx83() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.tsi called outside an active script step");
  }
  return ctx;
}
function resultForOffset13(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      tsi: makeShiftedSeriesView(slot.tsiBuf, offset),
      signal: makeShiftedSeriesView(slot.signalBuf, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function tsiValue(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0)
    return Number.NaN;
  return 100 * num / den;
}
function tsi(slotId, source, opts) {
  const ctx = getCtx83();
  const firstSmoothing = opts?.firstSmoothing ?? DEFAULT_FIRST3;
  const secondSmoothing = opts?.secondSmoothing ?? DEFAULT_SECOND3;
  const signalLength = opts?.signalLength ?? DEFAULT_SIGNAL6;
  const offset = opts?.offset ?? 0;
  const signalSlotId = `${slotId}/signal`;
  const isTick = ctx.isTick;
  const src = readSourceValue(source);
  let slot = ctx.stream.taSlots.get(slotId);
  const prevForDiff = isTick ? (
    /* c8 ignore next */
    slot?.prevClosedSrc ?? Number.NaN
  ) : slot?.prevSrc ?? Number.NaN;
  const mom = Number.isFinite(src) && Number.isFinite(prevForDiff) ? src - prevForDiff : Number.NaN;
  const absMom = Number.isFinite(mom) ? Math.abs(mom) : Number.NaN;
  const momEma1 = ema(`${slotId}/momEma1`, mom, firstSmoothing).current;
  const momEma2 = ema(`${slotId}/momEma2`, momEma1, secondSmoothing).current;
  const absEma1 = ema(`${slotId}/absMomEma1`, absMom, firstSmoothing).current;
  const absEma2 = ema(`${slotId}/absMomEma2`, absEma1, secondSmoothing).current;
  const tsiOut = tsiValue(momEma2, absEma2);
  const signalSeries = ema(signalSlotId, tsiOut, signalLength);
  if (slot === void 0) {
    const tsiBuf = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
    const emaSlot = ctx.stream.taSlots.get(signalSlotId);
    slot = {
      result: Object.freeze({
        tsi: makeSeriesView(tsiBuf),
        signal: signalSeries
      }),
      tsiBuf,
      signalBuf: emaSlot.outBuffer,
      shiftedResults: /* @__PURE__ */ new Map(),
      prevSrc: src,
      prevClosedSrc: Number.NaN
    };
    ctx.stream.taSlots.set(slotId, slot);
    slot.tsiBuf.append(tsiOut);
    return resultForOffset13(slot, offset);
  }
  if (isTick) {
    slot.tsiBuf.replaceHead(tsiOut);
  } else {
    slot.tsiBuf.append(tsiOut);
    slot.prevClosedSrc = slot.prevSrc;
    slot.prevSrc = src;
  }
  return resultForOffset13(slot, offset);
}

// ../runtime/dist/ta/ulcerIndex.js
function getCtx84() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.ulcerIndex called outside an active script step");
  }
  return ctx;
}
function initSlot73(slotId, length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    highestSub: `${slotId}/highest`,
    drawdownSqWindow: new Float64RingBuffer(length),
    sumDrawdownSq: 0
  };
}
function drawdownSquared(src, maxSrc) {
  if (!Number.isFinite(src) || !Number.isFinite(maxSrc) || maxSrc === 0) {
    return Number.NaN;
  }
  const dd = 100 * (src - maxSrc) / maxSrc;
  return dd * dd;
}
function closeValue21(slot, src, maxSrc) {
  const ddSq = drawdownSquared(src, maxSrc);
  if (!Number.isFinite(ddSq)) {
    return Number.NaN;
  }
  if (slot.drawdownSqWindow.length === slot.length) {
    slot.sumDrawdownSq -= slot.drawdownSqWindow.at(slot.length - 1);
  }
  slot.drawdownSqWindow.append(ddSq);
  slot.sumDrawdownSq += ddSq;
  return Math.sqrt(slot.sumDrawdownSq / slot.drawdownSqWindow.length);
}
function tickValue21(slot, src, maxSrc) {
  if (slot.drawdownSqWindow.length === 0)
    return Number.NaN;
  const ddSq = drawdownSquared(src, maxSrc);
  if (!Number.isFinite(ddSq))
    return Number.NaN;
  const headSq = slot.drawdownSqWindow.at(0);
  const hypSum = slot.sumDrawdownSq - headSq + ddSq;
  return Math.sqrt(hypSum / slot.drawdownSqWindow.length);
}
function ulcerIndex(slotId, source, length, _opts) {
  const ctx = getCtx84();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot73(slotId, length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  const maxSeries = highest(slot.highestSub, source, length);
  const maxSrc = maxSeries.current;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue21(slot, src, maxSrc));
  } else {
    slot.outBuffer.append(closeValue21(slot, src, maxSrc));
  }
  return slot.series;
}

// ../runtime/dist/ta/ultimateOsc.js
var DEFAULT_SHORT_LENGTH = 7;
var DEFAULT_MEDIUM_LENGTH = 14;
var DEFAULT_LONG_LENGTH = 28;
function getCtx85() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.ultimateOsc called outside an active script step");
  }
  return ctx;
}
function initSlot74(shortLength, mediumLength, longLength, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shortLength,
    mediumLength,
    longLength,
    bpShort: new Float64RingBuffer(shortLength),
    bpMedium: new Float64RingBuffer(mediumLength),
    bpLong: new Float64RingBuffer(longLength),
    trShort: new Float64RingBuffer(shortLength),
    trMedium: new Float64RingBuffer(mediumLength),
    trLong: new Float64RingBuffer(longLength),
    sumBpShort: 0,
    sumBpMedium: 0,
    sumBpLong: 0,
    sumTrShort: 0,
    sumTrMedium: 0,
    sumTrLong: 0,
    barCount: 0,
    prevClose: Number.NaN,
    prevPrevClose: Number.NaN,
    headBpShort: 0,
    headBpMedium: 0,
    headBpLong: 0,
    headTrShort: 0,
    headTrMedium: 0,
    headTrLong: 0
  };
}
function computeBpTr(high, low, close, prevClose) {
  if (!Number.isFinite(prevClose))
    return [0, 0];
  const trueLow = Math.min(low, prevClose);
  const trueHigh = Math.max(high, prevClose);
  return [close - trueLow, trueHigh - trueLow];
}
function pushToWindow(ring, sum, incoming, capacity) {
  let outgoing = 0;
  if (ring.length >= capacity) {
    outgoing = ring.at(capacity - 1);
  }
  ring.append(incoming);
  return { newSum: sum + incoming - outgoing, outgoing };
}
function uoFromSums(sumBpShort, sumTrShort, sumBpMedium, sumTrMedium, sumBpLong, sumTrLong) {
  if (sumTrShort === 0 || sumTrMedium === 0 || sumTrLong === 0)
    return Number.NaN;
  const avgShort = sumBpShort / sumTrShort;
  const avgMedium = sumBpMedium / sumTrMedium;
  const avgLong = sumBpLong / sumTrLong;
  return 100 * (4 * avgShort + 2 * avgMedium + avgLong) / 7;
}
function closeValue22(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    if (slot.barCount < slot.longLength)
      return Number.NaN;
    return uoFromSums(slot.sumBpShort, slot.sumTrShort, slot.sumBpMedium, slot.sumTrMedium, slot.sumBpLong, slot.sumTrLong);
  }
  const [bp, tr] = computeBpTr(high, low, close, slot.prevClose);
  const short = pushToWindow(slot.bpShort, slot.sumBpShort, bp, slot.shortLength);
  slot.sumBpShort = short.newSum;
  const medium = pushToWindow(slot.bpMedium, slot.sumBpMedium, bp, slot.mediumLength);
  slot.sumBpMedium = medium.newSum;
  const long = pushToWindow(slot.bpLong, slot.sumBpLong, bp, slot.longLength);
  slot.sumBpLong = long.newSum;
  const trShort = pushToWindow(slot.trShort, slot.sumTrShort, tr, slot.shortLength);
  slot.sumTrShort = trShort.newSum;
  const trMedium = pushToWindow(slot.trMedium, slot.sumTrMedium, tr, slot.mediumLength);
  slot.sumTrMedium = trMedium.newSum;
  const trLong = pushToWindow(slot.trLong, slot.sumTrLong, tr, slot.longLength);
  slot.sumTrLong = trLong.newSum;
  slot.prevPrevClose = slot.prevClose;
  slot.prevClose = close;
  slot.barCount += 1;
  slot.headBpShort = bp;
  slot.headBpMedium = bp;
  slot.headBpLong = bp;
  slot.headTrShort = tr;
  slot.headTrMedium = tr;
  slot.headTrLong = tr;
  if (slot.barCount < slot.longLength)
    return Number.NaN;
  return uoFromSums(slot.sumBpShort, slot.sumTrShort, slot.sumBpMedium, slot.sumTrMedium, slot.sumBpLong, slot.sumTrLong);
}
function tickValue22(slot, high, low, close) {
  if (slot.barCount < slot.longLength)
    return Number.NaN;
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return uoFromSums(slot.sumBpShort, slot.sumTrShort, slot.sumBpMedium, slot.sumTrMedium, slot.sumBpLong, slot.sumTrLong);
  }
  const [tickBp, tickTr] = computeBpTr(high, low, close, slot.prevPrevClose);
  return uoFromSums(slot.sumBpShort - slot.headBpShort + tickBp, slot.sumTrShort - slot.headTrShort + tickTr, slot.sumBpMedium - slot.headBpMedium + tickBp, slot.sumTrMedium - slot.headTrMedium + tickTr, slot.sumBpLong - slot.headBpLong + tickBp, slot.sumTrLong - slot.headTrLong + tickTr);
}
function ultimateOsc(slotId, opts) {
  const ctx = getCtx85();
  const shortLength = opts?.shortLength ?? DEFAULT_SHORT_LENGTH;
  const mediumLength = opts?.mediumLength ?? DEFAULT_MEDIUM_LENGTH;
  const longLength = opts?.longLength ?? DEFAULT_LONG_LENGTH;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot74(shortLength, mediumLength, longLength, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue22(slot, bar.high, bar.low, bar.close));
  } else {
    slot.outBuffer.append(closeValue22(slot, bar.high, bar.low, bar.close));
  }
  return slot.series;
}

// ../runtime/dist/ta/valuewhen.js
function getCtx86() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.valuewhen called outside an active script step");
  }
  return ctx;
}
function readBoolean(condition) {
  return condition.current;
}
function initSlot75(occurrence, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  const ringCapacity = occurrence + 1;
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedSeries: /* @__PURE__ */ new Map(),
    occurrence,
    capacity: ringCapacity,
    ring: [],
    matchCount: 0,
    prevRing: [],
    prevMatchCount: 0
  };
}
function emitFromState(occurrence, ring, matchCount) {
  if (matchCount < occurrence + 1)
    return Number.NaN;
  return ring[0];
}
function closeValue23(slot, src, fired) {
  slot.prevRing = slot.ring.slice();
  slot.prevMatchCount = slot.matchCount;
  if (fired) {
    slot.ring.push(src);
    if (slot.ring.length > slot.capacity)
      slot.ring.shift();
    slot.matchCount += 1;
  }
  return emitFromState(slot.occurrence, slot.ring, slot.matchCount);
}
function tickValue23(slot, src, fired) {
  const ring = slot.prevRing.slice();
  let count = slot.prevMatchCount;
  if (fired) {
    ring.push(src);
    if (ring.length > slot.capacity)
      ring.shift();
    count += 1;
  }
  return emitFromState(slot.occurrence, ring, count);
}
function valuewhen(slotId, condition, source, occurrence = 0, opts = {}) {
  const ctx = getCtx86();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot75(occurrence, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const fired = readBoolean(condition);
  const src = readSourceValue(source);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue23(slot, src, fired));
  } else {
    slot.outBuffer.append(closeValue23(slot, src, fired));
  }
  const offset = opts.offset ?? 0;
  if (offset === 0)
    return slot.series;
  const shifted = slot.shiftedSeries.get(offset);
  if (shifted !== void 0)
    return shifted;
  const next = makeShiftedSeriesView(slot.outBuffer, offset);
  slot.shiftedSeries.set(offset, next);
  return next;
}

// ../runtime/dist/ta/visibleRangeVolumeProfile.js
function getCtx87() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.visibleRangeVolumeProfile called outside an active script step");
  }
  return ctx;
}
function initSlot76(capacity) {
  const core = createVolumeProfileCore(capacity);
  const slot = {
    ...core,
    result: Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeSeriesView(core.pocBuffer),
      valHigh: makeSeriesView(core.valHighBuffer),
      valLow: makeSeriesView(core.valLowBuffer)
    }),
    shiftedResults: /* @__PURE__ */ new Map()
  };
  return slot;
}
function resultForOffset14(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      get buckets() {
        return slot.buckets;
      },
      poc: makeShiftedSeriesView(slot.pocBuffer, offset),
      valHigh: makeShiftedSeriesView(slot.valHighBuffer, offset),
      valLow: makeShiftedSeriesView(slot.valLowBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function collectBars4(ctx) {
  const { ohlcv } = ctx.stream;
  const { fromTime, toTime } = ctx.stream.bar.viewport;
  const bars = [];
  for (let lookback = ohlcv.close.length - 1; lookback >= 0; lookback -= 1) {
    const time = ohlcv.time.at(lookback);
    if (time < fromTime || time > toTime)
      continue;
    bars.push({
      close: ohlcv.close.at(lookback),
      high: ohlcv.high.at(lookback),
      low: ohlcv.low.at(lookback),
      open: ohlcv.open.at(lookback),
      time,
      volume: ohlcv.volume.at(lookback)
    });
  }
  return bars;
}
function visibleRangeVolumeProfile(slotId, opts) {
  const ctx = getCtx87();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot76(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const snapshot6 = resolveVolumeProfileSnapshot({
    bars: collectBars4(ctx),
    bucketColor: opts?.bucketColor,
    config: volumeProfileConfigFromOpts(opts ?? {})
  });
  commitVolumeProfileSnapshot(slot, ctx.isTick, snapshot6);
  emitVolumeProfileHistogram(ctx, slotId, "Visible Range Volume Profile", snapshot6.poc, snapshot6.buckets);
  return resultForOffset14(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/vol.js
function getCtx88() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.vol called outside an active script step");
  }
  return ctx;
}
function initSlot77(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return { outBuffer, series: makeSeriesView(outBuffer) };
}
function vol(slotId, _opts) {
  const ctx = getCtx88();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot77(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const value = ctx.stream.bar.volume;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/volatilityStop.js
var DEFAULT_LENGTH9 = 20;
var DEFAULT_MULTIPLIER8 = 2;
var TREND_UP3 = 1;
var TREND_DOWN3 = -1;
var TREND_UNKNOWN = 0;
function getCtx89() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.volatilityStop called outside an active script step");
  }
  return ctx;
}
function initSlot78(capacity, length, multiplier) {
  const valueBuffer = new Float64RingBuffer(capacity);
  const directionBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      value: makeSeriesView(valueBuffer),
      direction: makeSeriesView(directionBuffer)
    }),
    valueBuffer,
    directionBuffer,
    length,
    multiplier,
    warmBarCount: 0,
    direction: TREND_UNKNOWN,
    prevStop: Number.NaN,
    prevSrc: Number.NaN,
    prevClosedWarmBarCount: 0,
    prevClosedDirection: TREND_UNKNOWN,
    prevClosedPrevStop: Number.NaN,
    prevClosedPrevSrc: Number.NaN
  };
}
function snapshot4(slot) {
  slot.prevClosedWarmBarCount = slot.warmBarCount;
  slot.prevClosedDirection = slot.direction;
  slot.prevClosedPrevStop = slot.prevStop;
  slot.prevClosedPrevSrc = slot.prevSrc;
}
function recurrenceStep3(src, atrValue, multiplier, prevDirection, prevStop, prevSrc) {
  if (prevDirection === TREND_UNKNOWN) {
    const newDirection = src >= prevSrc ? TREND_UP3 : TREND_DOWN3;
    const stop = newDirection === TREND_UP3 ? src - multiplier * atrValue : src + multiplier * atrValue;
    return {
      value: stop,
      direction: newDirection,
      nextDirection: newDirection,
      nextStop: stop
    };
  }
  if (prevDirection === TREND_UP3) {
    let next2 = src - multiplier * atrValue;
    if (next2 < prevStop)
      next2 = prevStop;
    if (src < next2) {
      next2 = src + multiplier * atrValue;
      return {
        value: next2,
        direction: TREND_DOWN3,
        nextDirection: TREND_DOWN3,
        nextStop: next2
      };
    }
    return { value: next2, direction: TREND_UP3, nextDirection: TREND_UP3, nextStop: next2 };
  }
  let next = src + multiplier * atrValue;
  if (next > prevStop)
    next = prevStop;
  if (src > next) {
    next = src - multiplier * atrValue;
    return {
      value: next,
      direction: TREND_UP3,
      nextDirection: TREND_UP3,
      nextStop: next
    };
  }
  return { value: next, direction: TREND_DOWN3, nextDirection: TREND_DOWN3, nextStop: next };
}
function closeStep7(slot, src, atrValue) {
  if (!Number.isFinite(src) || !Number.isFinite(atrValue)) {
    return { value: Number.NaN, direction: Number.NaN };
  }
  snapshot4(slot);
  if (slot.warmBarCount === 0) {
    slot.warmBarCount = 1;
    slot.prevSrc = src;
    slot.direction = TREND_UNKNOWN;
    slot.prevStop = Number.NaN;
    return { value: Number.NaN, direction: Number.NaN };
  }
  const step2 = recurrenceStep3(src, atrValue, slot.multiplier, slot.direction, slot.prevStop, slot.prevSrc);
  slot.warmBarCount += 1;
  slot.direction = step2.nextDirection;
  slot.prevStop = step2.nextStop;
  slot.prevSrc = src;
  return { value: step2.value, direction: step2.direction };
}
function tickStep6(slot, src, atrValue) {
  if (!Number.isFinite(src) || !Number.isFinite(atrValue)) {
    return { value: Number.NaN, direction: Number.NaN };
  }
  if (slot.prevClosedWarmBarCount === 0) {
    return { value: Number.NaN, direction: Number.NaN };
  }
  const step2 = recurrenceStep3(src, atrValue, slot.multiplier, slot.prevClosedDirection, slot.prevClosedPrevStop, slot.prevClosedPrevSrc);
  return { value: step2.value, direction: step2.direction };
}
function volatilityStop(slotId, opts) {
  const ctx = getCtx89();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const length = opts?.length ?? DEFAULT_LENGTH9;
    const multiplier = opts?.multiplier ?? DEFAULT_MULTIPLIER8;
    slot = initSlot78(ctx.stream.ohlcv.close.capacity, length, multiplier);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const atrSeries = atr(`${slotId}/atr`, slot.length);
  const src = ctx.stream.bar.close;
  const atrValue = atrSeries.current;
  if (ctx.isTick) {
    const { value, direction } = tickStep6(slot, src, atrValue);
    slot.valueBuffer.replaceHead(value);
    slot.directionBuffer.replaceHead(direction);
  } else {
    const { value, direction } = closeStep7(slot, src, atrValue);
    slot.valueBuffer.append(value);
    slot.directionBuffer.append(direction);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/vortex.js
function getCtx90() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.vortex called outside an active script step");
  }
  return ctx;
}
function trueRange4(high, low, prevClose) {
  if (!Number.isFinite(prevClose))
    return high - low;
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}
function initSlot79(length, capacity) {
  const plusBuffer = new Float64RingBuffer(capacity);
  const minusBuffer = new Float64RingBuffer(capacity);
  return {
    result: Object.freeze({
      plus: makeSeriesView(plusBuffer),
      minus: makeSeriesView(minusBuffer)
    }),
    plusBuffer,
    minusBuffer,
    length,
    vmPlusWindow: new Float64RingBuffer(length),
    vmMinusWindow: new Float64RingBuffer(length),
    trWindow: new Float64RingBuffer(length),
    runningPlus: 0,
    runningMinus: 0,
    runningTr: 0,
    prevHigh: Number.NaN,
    prevLow: Number.NaN,
    prevClose: Number.NaN,
    prevPrevHigh: Number.NaN,
    prevPrevLow: Number.NaN,
    prevPrevClose: Number.NaN,
    prevClosedRunningPlus: 0,
    prevClosedRunningMinus: 0,
    prevClosedRunningTr: 0,
    evictedPlus: 0,
    evictedMinus: 0,
    evictedTr: 0,
    barCount: 0,
    shiftedResults: /* @__PURE__ */ new Map()
  };
}
function resultForOffset15(slot, offset) {
  if (offset === 0)
    return slot.result;
  let cached = slot.shiftedResults.get(offset);
  if (cached === void 0) {
    cached = Object.freeze({
      plus: makeShiftedSeriesView(slot.plusBuffer, offset),
      minus: makeShiftedSeriesView(slot.minusBuffer, offset)
    });
    slot.shiftedResults.set(offset, cached);
  }
  return cached;
}
function divide(num, den) {
  if (den === 0 || !Number.isFinite(den) || !Number.isFinite(num))
    return Number.NaN;
  return num / den;
}
function closeStep8(slot, high, low, close) {
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { plus: Number.NaN, minus: Number.NaN };
  }
  slot.barCount += 1;
  slot.prevClosedRunningPlus = slot.runningPlus;
  slot.prevClosedRunningMinus = slot.runningMinus;
  slot.prevClosedRunningTr = slot.runningTr;
  const tr = trueRange4(high, low, slot.prevClose);
  const vmPlus = Number.isFinite(slot.prevLow) ? Math.abs(high - slot.prevLow) : 0;
  const vmMinus = Number.isFinite(slot.prevHigh) ? Math.abs(low - slot.prevHigh) : 0;
  slot.prevPrevHigh = slot.prevHigh;
  slot.prevPrevLow = slot.prevLow;
  slot.prevPrevClose = slot.prevClose;
  slot.prevHigh = high;
  slot.prevLow = low;
  slot.prevClose = close;
  if (slot.vmPlusWindow.length >= slot.length) {
    slot.evictedPlus = slot.vmPlusWindow.at(slot.length - 1);
    slot.evictedMinus = slot.vmMinusWindow.at(slot.length - 1);
    slot.evictedTr = slot.trWindow.at(slot.length - 1);
    slot.runningPlus -= slot.evictedPlus;
    slot.runningMinus -= slot.evictedMinus;
    slot.runningTr -= slot.evictedTr;
  } else {
    slot.evictedPlus = 0;
    slot.evictedMinus = 0;
    slot.evictedTr = 0;
  }
  slot.vmPlusWindow.append(vmPlus);
  slot.vmMinusWindow.append(vmMinus);
  slot.trWindow.append(tr);
  slot.runningPlus += vmPlus;
  slot.runningMinus += vmMinus;
  slot.runningTr += tr;
  if (slot.barCount <= slot.length) {
    return { plus: Number.NaN, minus: Number.NaN };
  }
  return {
    plus: divide(slot.runningPlus, slot.runningTr),
    minus: divide(slot.runningMinus, slot.runningTr)
  };
}
function tickStep7(slot, high, low, close) {
  if (slot.barCount <= slot.length)
    return { plus: Number.NaN, minus: Number.NaN };
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return { plus: Number.NaN, minus: Number.NaN };
  }
  const tr = trueRange4(high, low, slot.prevPrevClose);
  const vmPlus = Number.isFinite(slot.prevPrevLow) ? Math.abs(high - slot.prevPrevLow) : 0;
  const vmMinus = Number.isFinite(slot.prevPrevHigh) ? Math.abs(low - slot.prevPrevHigh) : 0;
  const runningPlus = slot.prevClosedRunningPlus - slot.evictedPlus + vmPlus;
  const runningMinus = slot.prevClosedRunningMinus - slot.evictedMinus + vmMinus;
  const runningTr = slot.prevClosedRunningTr - slot.evictedTr + tr;
  return {
    plus: divide(runningPlus, runningTr),
    minus: divide(runningMinus, runningTr)
  };
}
function vortex(slotId, length, opts) {
  const ctx = getCtx90();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot79(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  if (ctx.isTick) {
    const { plus, minus } = tickStep7(slot, bar.high, bar.low, bar.close);
    slot.plusBuffer.replaceHead(plus);
    slot.minusBuffer.replaceHead(minus);
  } else {
    const { plus, minus } = closeStep8(slot, bar.high, bar.low, bar.close);
    slot.plusBuffer.append(plus);
    slot.minusBuffer.append(minus);
  }
  return resultForOffset15(slot, opts?.offset ?? 0);
}

// ../runtime/dist/ta/vwap.js
var DEFAULT_SOURCE2 = "hlc3";
var MS_PER_DAY3 = 864e5;
function getCtx91() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.vwap called outside an active script step");
  }
  return ctx;
}
function initSlot80(capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    cumPV: 0,
    cumV: 0,
    currentDayKey: Number.NaN,
    prevClosedCumPV: 0,
    prevClosedCumV: 0,
    prevClosedDayKey: Number.NaN
  };
}
function readSource2(ctx, source) {
  switch (source) {
    case "close":
      return ctx.stream.bar.close;
    case "hl2":
      return ctx.stream.bar.hl2;
    case "hlc3":
      return ctx.stream.bar.hlc3;
    case "ohlc4":
      return ctx.stream.bar.ohlc4;
    case "hlcc4":
      return ctx.stream.bar.hlcc4;
  }
}
function dayKeyOf(time) {
  return Math.floor(time / MS_PER_DAY3);
}
function fold7(inCumPV, inCumV, inDayKey, dayKey, src, volume) {
  let cumPV = inCumPV;
  let cumV = inCumV;
  if (inDayKey !== dayKey) {
    cumPV = 0;
    cumV = 0;
  }
  if (Number.isFinite(src) && Number.isFinite(volume) && volume > 0) {
    cumPV += src * volume;
    cumV += volume;
  }
  return { cumPV, cumV, dayKey };
}
function valueFromCum2(cumPV, cumV) {
  if (cumV === 0)
    return Number.NaN;
  return cumPV / cumV;
}
function vwap(slotId, opts) {
  const ctx = getCtx91();
  const source = opts?.source ?? DEFAULT_SOURCE2;
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot80(ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSource2(ctx, source);
  const volume = ctx.stream.bar.volume;
  const dayKey = dayKeyOf(ctx.stream.bar.time);
  if (ctx.isTick) {
    const next2 = fold7(slot.prevClosedCumPV, slot.prevClosedCumV, slot.prevClosedDayKey, dayKey, src, volume);
    slot.outBuffer.replaceHead(valueFromCum2(next2.cumPV, next2.cumV));
    return slot.series;
  }
  slot.prevClosedCumPV = slot.cumPV;
  slot.prevClosedCumV = slot.cumV;
  slot.prevClosedDayKey = slot.currentDayKey;
  const next = fold7(slot.cumPV, slot.cumV, slot.currentDayKey, dayKey, src, volume);
  slot.cumPV = next.cumPV;
  slot.cumV = next.cumV;
  slot.currentDayKey = next.dayKey;
  slot.outBuffer.append(valueFromCum2(slot.cumPV, slot.cumV));
  return slot.series;
}

// ../runtime/dist/ta/vwma.js
function getCtx92() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.vwma called outside an active script step");
  }
  return ctx;
}
function initSlot81(length, capacity) {
  const outBuffer = new Float64RingBuffer(capacity);
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    length,
    sourceWindow: new Float64RingBuffer(length),
    volumeWindow: new Float64RingBuffer(length)
  };
}
function weightedFromWindows(slot) {
  let pvSum = 0;
  let volSum = 0;
  for (let j = 0; j < slot.length; j += 1) {
    const value = slot.sourceWindow.at(j);
    if (!Number.isFinite(value))
      return Number.NaN;
    const rawVol = slot.volumeWindow.at(j);
    const v = Number.isFinite(rawVol) ? rawVol : 0;
    pvSum += value * v;
    volSum += v;
  }
  return volSum > 0 ? pvSum / volSum : Number.NaN;
}
function closeValue24(slot, src, vol2) {
  slot.sourceWindow.append(src);
  slot.volumeWindow.append(vol2);
  if (slot.sourceWindow.length < slot.length)
    return Number.NaN;
  return weightedFromWindows(slot);
}
function tickValue24(slot, src, vol2) {
  if (slot.sourceWindow.length < slot.length)
    return Number.NaN;
  if (!Number.isFinite(src))
    return Number.NaN;
  const headVol = Number.isFinite(vol2) ? vol2 : 0;
  let pvSum = src * headVol;
  let volSum = headVol;
  for (let j = 1; j < slot.length; j += 1) {
    const value = slot.sourceWindow.at(j);
    if (!Number.isFinite(value))
      return Number.NaN;
    const rawVol = slot.volumeWindow.at(j);
    const v = Number.isFinite(rawVol) ? rawVol : 0;
    pvSum += value * v;
    volSum += v;
  }
  return volSum > 0 ? pvSum / volSum : Number.NaN;
}
function vwma(slotId, source, length, _opts) {
  const ctx = getCtx92();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    slot = initSlot81(length, ctx.stream.ohlcv.close.capacity);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const src = readSourceValue(source);
  const vol2 = ctx.stream.bar.volume;
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(tickValue24(slot, src, vol2));
  } else {
    slot.outBuffer.append(closeValue24(slot, src, vol2));
  }
  return slot.series;
}

// ../runtime/dist/ta/williamsFractal.js
var DEFAULT_LENGTH10 = 2;
function getCtx93() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.williamsFractal called outside an active script step");
  }
  return ctx;
}
function initSlot82(capacity, length) {
  const upBuffer = new Float64RingBuffer(capacity);
  const downBuffer = new Float64RingBuffer(capacity);
  const windowSize = 2 * length + 1;
  return {
    outputs: Object.freeze({
      up: makeSeriesView(upBuffer),
      down: makeSeriesView(downBuffer)
    }),
    upBuffer,
    downBuffer,
    length,
    highWindow: new Float64RingBuffer(windowSize),
    lowWindow: new Float64RingBuffer(windowSize),
    barCount: 0
  };
}
function scanUpFractal(highWindow, headHigh, length) {
  const centreHigh = highWindow.at(length);
  if (!Number.isFinite(centreHigh))
    return Number.NaN;
  const windowSize = 2 * length + 1;
  for (let k = 0; k < windowSize; k += 1) {
    if (k === length)
      continue;
    const v = k === 0 ? headHigh : highWindow.at(k);
    if (!Number.isFinite(v))
      return Number.NaN;
    if (v >= centreHigh)
      return Number.NaN;
  }
  return centreHigh;
}
function scanDownFractal(lowWindow, headLow, length) {
  const centreLow = lowWindow.at(length);
  if (!Number.isFinite(centreLow))
    return Number.NaN;
  const windowSize = 2 * length + 1;
  for (let k = 0; k < windowSize; k += 1) {
    if (k === length)
      continue;
    const v = k === 0 ? headLow : lowWindow.at(k);
    if (!Number.isFinite(v))
      return Number.NaN;
    if (v <= centreLow)
      return Number.NaN;
  }
  return centreLow;
}
function williamsFractal(slotId, opts) {
  const ctx = getCtx93();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const length = opts?.length ?? DEFAULT_LENGTH10;
    slot = initSlot82(ctx.stream.ohlcv.close.capacity, length);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  const windowSize = 2 * slot.length + 1;
  if (ctx.isTick) {
    if (slot.barCount < windowSize) {
      slot.upBuffer.replaceHead(Number.NaN);
      slot.downBuffer.replaceHead(Number.NaN);
    } else {
      slot.upBuffer.replaceHead(scanUpFractal(slot.highWindow, bar.high, slot.length));
      slot.downBuffer.replaceHead(scanDownFractal(slot.lowWindow, bar.low, slot.length));
    }
  } else {
    slot.highWindow.append(bar.high);
    slot.lowWindow.append(bar.low);
    slot.barCount += 1;
    if (slot.barCount < windowSize) {
      slot.upBuffer.append(Number.NaN);
      slot.downBuffer.append(Number.NaN);
    } else {
      slot.upBuffer.append(scanUpFractal(slot.highWindow, slot.highWindow.at(0), slot.length));
      slot.downBuffer.append(scanDownFractal(slot.lowWindow, slot.lowWindow.at(0), slot.length));
    }
  }
  return slot.outputs;
}

// ../runtime/dist/ta/williamsR.js
function getCtx94() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.williamsR called outside an active script step");
  }
  return ctx;
}
function williamsRValue(hh, ll, close) {
  if (!Number.isFinite(hh) || !Number.isFinite(ll) || !Number.isFinite(close)) {
    return Number.NaN;
  }
  const denom = hh - ll;
  if (denom === 0)
    return Number.NaN;
  return -100 * (hh - close) / denom;
}
function williamsR(slotId, length, _opts) {
  const ctx = getCtx94();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const outBuffer = new Float64RingBuffer(ctx.stream.ohlcv.close.capacity);
    slot = { outBuffer, series: makeSeriesView(outBuffer) };
    ctx.stream.taSlots.set(slotId, slot);
  }
  const bar = ctx.stream.bar;
  const hh = highest(`${slotId}/hh`, bar.high, length).current;
  const ll = lowest(`${slotId}/ll`, bar.low, length).current;
  const value = williamsRValue(hh, ll, bar.close);
  if (ctx.isTick) {
    slot.outBuffer.replaceHead(value);
  } else {
    slot.outBuffer.append(value);
  }
  return slot.series;
}

// ../runtime/dist/ta/zigZag.js
var DEFAULT_DEVIATION = 5;
var DEFAULT_DEPTH = 10;
var TREND_UP4 = 1;
var TREND_DOWN4 = -1;
var TREND_UNKNOWN2 = 0;
function getCtx95() {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error("ta.zigZag called outside an active script step");
  }
  return ctx;
}
function initSlot83(capacity, deviation, depth) {
  const valueBuffer = new Float64RingBuffer(capacity);
  const directionBuffer = new Float64RingBuffer(capacity);
  return {
    outputs: Object.freeze({
      value: makeSeriesView(valueBuffer),
      direction: makeSeriesView(directionBuffer)
    }),
    valueBuffer,
    directionBuffer,
    deviation,
    depth,
    barCount: 0,
    direction: TREND_UNKNOWN2,
    lastPivotPrice: Number.NaN,
    lastPivotIndex: -1,
    peakSinceLastPivot: Number.NaN,
    peakIndex: -1,
    prevClosedBarCount: 0,
    prevClosedDirection: TREND_UNKNOWN2,
    prevClosedLastPivotPrice: Number.NaN,
    prevClosedLastPivotIndex: -1,
    prevClosedPeakSinceLastPivot: Number.NaN,
    prevClosedPeakIndex: -1
  };
}
function snapshot5(slot) {
  slot.prevClosedBarCount = slot.barCount;
  slot.prevClosedDirection = slot.direction;
  slot.prevClosedLastPivotPrice = slot.lastPivotPrice;
  slot.prevClosedLastPivotIndex = slot.lastPivotIndex;
  slot.prevClosedPeakSinceLastPivot = slot.peakSinceLastPivot;
  slot.prevClosedPeakIndex = slot.peakIndex;
}
function recurrenceStep4(close, barIndex, deviation, depth, prevDirection, prevLastPivotPrice, prevLastPivotIndex, prevPeakSinceLastPivot, prevPeakIndex) {
  const pctChangeVsPivot = (close - prevLastPivotPrice) / prevLastPivotPrice * 100;
  const barsSincePivot = barIndex - prevLastPivotIndex;
  if (prevDirection === TREND_UNKNOWN2) {
    if (Math.abs(pctChangeVsPivot) >= deviation && barsSincePivot >= depth && prevLastPivotPrice !== 0) {
      const newDirection = pctChangeVsPivot > 0 ? TREND_UP4 : TREND_DOWN4;
      return {
        value: close,
        direction: newDirection,
        nextDirection: newDirection,
        nextLastPivotPrice: close,
        nextLastPivotIndex: barIndex,
        nextPeakSinceLastPivot: close,
        nextPeakIndex: barIndex
      };
    }
    return {
      value: Number.NaN,
      direction: Number.NaN,
      nextDirection: TREND_UNKNOWN2,
      nextLastPivotPrice: prevLastPivotPrice,
      nextLastPivotIndex: prevLastPivotIndex,
      nextPeakSinceLastPivot: prevPeakSinceLastPivot,
      nextPeakIndex: prevPeakIndex
    };
  }
  if (prevDirection === TREND_UP4) {
    if (close > prevPeakSinceLastPivot) {
      return {
        value: prevLastPivotPrice,
        direction: TREND_UP4,
        nextDirection: TREND_UP4,
        nextLastPivotPrice: prevLastPivotPrice,
        nextLastPivotIndex: prevLastPivotIndex,
        nextPeakSinceLastPivot: close,
        nextPeakIndex: barIndex
      };
    }
    const pctDropFromPeak = (prevPeakSinceLastPivot - close) / prevPeakSinceLastPivot * 100;
    const barsSincePeak = barIndex - prevPeakIndex;
    if (pctDropFromPeak >= deviation && barsSincePeak >= depth) {
      return {
        value: prevPeakSinceLastPivot,
        direction: TREND_DOWN4,
        nextDirection: TREND_DOWN4,
        nextLastPivotPrice: prevPeakSinceLastPivot,
        nextLastPivotIndex: prevPeakIndex,
        nextPeakSinceLastPivot: close,
        nextPeakIndex: barIndex
      };
    }
    return {
      value: prevLastPivotPrice,
      direction: TREND_UP4,
      nextDirection: TREND_UP4,
      nextLastPivotPrice: prevLastPivotPrice,
      nextLastPivotIndex: prevLastPivotIndex,
      nextPeakSinceLastPivot: prevPeakSinceLastPivot,
      nextPeakIndex: prevPeakIndex
    };
  }
  if (close < prevPeakSinceLastPivot) {
    return {
      value: prevLastPivotPrice,
      direction: TREND_DOWN4,
      nextDirection: TREND_DOWN4,
      nextLastPivotPrice: prevLastPivotPrice,
      nextLastPivotIndex: prevLastPivotIndex,
      nextPeakSinceLastPivot: close,
      nextPeakIndex: barIndex
    };
  }
  const pctRiseFromTrough = prevPeakSinceLastPivot !== 0 ? (close - prevPeakSinceLastPivot) / prevPeakSinceLastPivot * 100 : 0;
  const barsSinceTrough = barIndex - prevPeakIndex;
  if (pctRiseFromTrough >= deviation && barsSinceTrough >= depth) {
    return {
      value: prevPeakSinceLastPivot,
      direction: TREND_UP4,
      nextDirection: TREND_UP4,
      nextLastPivotPrice: prevPeakSinceLastPivot,
      nextLastPivotIndex: prevPeakIndex,
      nextPeakSinceLastPivot: close,
      nextPeakIndex: barIndex
    };
  }
  return {
    value: prevLastPivotPrice,
    direction: TREND_DOWN4,
    nextDirection: TREND_DOWN4,
    nextLastPivotPrice: prevLastPivotPrice,
    nextLastPivotIndex: prevLastPivotIndex,
    nextPeakSinceLastPivot: prevPeakSinceLastPivot,
    nextPeakIndex: prevPeakIndex
  };
}
function closeStep9(slot, close, barIndex) {
  if (!Number.isFinite(close)) {
    return { value: Number.NaN, direction: Number.NaN };
  }
  snapshot5(slot);
  if (slot.barCount === 0) {
    slot.barCount = 1;
    slot.lastPivotPrice = close;
    slot.lastPivotIndex = 0;
    slot.peakSinceLastPivot = close;
    slot.peakIndex = 0;
    slot.direction = TREND_UNKNOWN2;
    return { value: Number.NaN, direction: Number.NaN };
  }
  const step2 = recurrenceStep4(close, barIndex, slot.deviation, slot.depth, slot.direction, slot.lastPivotPrice, slot.lastPivotIndex, slot.peakSinceLastPivot, slot.peakIndex);
  slot.barCount += 1;
  slot.direction = step2.nextDirection;
  slot.lastPivotPrice = step2.nextLastPivotPrice;
  slot.lastPivotIndex = step2.nextLastPivotIndex;
  slot.peakSinceLastPivot = step2.nextPeakSinceLastPivot;
  slot.peakIndex = step2.nextPeakIndex;
  return { value: step2.value, direction: step2.direction };
}
function tickStep8(slot, close, barIndex) {
  if (!Number.isFinite(close)) {
    return { value: Number.NaN, direction: Number.NaN };
  }
  if (slot.prevClosedBarCount === 0) {
    return { value: Number.NaN, direction: Number.NaN };
  }
  const step2 = recurrenceStep4(close, barIndex, slot.deviation, slot.depth, slot.prevClosedDirection, slot.prevClosedLastPivotPrice, slot.prevClosedLastPivotIndex, slot.prevClosedPeakSinceLastPivot, slot.prevClosedPeakIndex);
  return { value: step2.value, direction: step2.direction };
}
function zigZag(slotId, opts) {
  const ctx = getCtx95();
  let slot = ctx.stream.taSlots.get(slotId);
  if (slot === void 0) {
    const deviation = opts?.deviation ?? DEFAULT_DEVIATION;
    const depth = opts?.depth ?? DEFAULT_DEPTH;
    slot = initSlot83(ctx.stream.ohlcv.close.capacity, deviation, depth);
    ctx.stream.taSlots.set(slotId, slot);
  }
  const close = ctx.stream.bar.close;
  if (ctx.isTick) {
    const barIndexForStep = slot.prevClosedBarCount;
    const { value, direction } = tickStep8(slot, close, barIndexForStep);
    slot.valueBuffer.replaceHead(value);
    slot.directionBuffer.replaceHead(direction);
  } else {
    const barIndexForStep = slot.barCount;
    const { value, direction } = closeStep9(slot, close, barIndexForStep);
    slot.valueBuffer.append(value);
    slot.directionBuffer.append(direction);
  }
  return slot.outputs;
}

// ../runtime/dist/ta/registry.js
var TA_REGISTRY = Object.freeze({
  sma,
  ema,
  stdev,
  bb,
  rsi,
  macd,
  atr,
  crossover,
  crossunder,
  nz,
  highest,
  lowest,
  change,
  valuewhen,
  barssince,
  wma,
  vwma,
  hma,
  smma,
  dema,
  tema,
  kama,
  alma,
  lsma,
  mcginley,
  maRibbon,
  ao,
  cmo,
  momentum,
  roc,
  pmo,
  smi,
  tsi,
  cci,
  stoch,
  williamsR,
  stochRsi,
  ultimateOsc,
  coppock,
  ppo,
  dpo,
  connorsRsi,
  kst,
  fisher,
  klinger,
  rvgi,
  aroon,
  aroonOsc,
  vol,
  vwap,
  anchoredVwap,
  anchoredVolumeProfile,
  fixedRangeVolumeProfile,
  sessionVolumeProfile,
  visibleRangeVolumeProfile,
  obv,
  adl,
  bop,
  cmf,
  chaikinOsc,
  mfi,
  netVolume,
  pvo,
  pvt,
  eom,
  nvi,
  pvi,
  bbPercentB,
  bbw,
  donchian,
  keltner,
  envelope,
  chop,
  median,
  adr,
  ulcerIndex,
  historicalVolatility,
  rvi,
  massIndex,
  psar,
  supertrend,
  chandelier,
  chandeKrollStop,
  williamsFractal,
  zigZag,
  pivotsHighLow,
  pivotsStandard,
  volatilityStop,
  adx,
  dmi,
  trix,
  vortex,
  trendStrengthIndex,
  ichimoku
});
var TA_REGISTRY_METADATA = Object.freeze({
  stoch: Object.freeze({
    primarySeriesKey: "k",
    visibleSeriesKeys: Object.freeze(["k", "d"]),
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  williamsR: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: -100, max: 0 })
  }),
  stochRsi: Object.freeze({
    primarySeriesKey: "k",
    visibleSeriesKeys: Object.freeze(["k", "d"]),
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  ultimateOsc: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  ppo: Object.freeze({
    primarySeriesKey: "ppo",
    visibleSeriesKeys: Object.freeze(["ppo", "signal", "hist"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  pvo: Object.freeze({
    primarySeriesKey: "pvo",
    visibleSeriesKeys: Object.freeze(["pvo", "signal", "hist"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  sessionVolumeProfile: Object.freeze({
    primarySeriesKey: "poc",
    visibleSeriesKeys: Object.freeze(["poc", "valHigh", "valLow"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  fixedRangeVolumeProfile: Object.freeze({
    primarySeriesKey: "poc",
    visibleSeriesKeys: Object.freeze(["poc", "valHigh", "valLow"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  connorsRsi: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  pmo: Object.freeze({
    primarySeriesKey: "pmo",
    visibleSeriesKeys: Object.freeze(["pmo", "signal"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  smi: Object.freeze({
    primarySeriesKey: "smi",
    visibleSeriesKeys: Object.freeze(["smi", "signal"]),
    yDomain: Object.freeze({ kind: "fixed", min: -100, max: 100 })
  }),
  tsi: Object.freeze({
    primarySeriesKey: "tsi",
    visibleSeriesKeys: Object.freeze(["tsi", "signal"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  kst: Object.freeze({
    primarySeriesKey: "kst",
    visibleSeriesKeys: Object.freeze(["kst", "signal"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  fisher: Object.freeze({
    primarySeriesKey: "fisher",
    visibleSeriesKeys: Object.freeze(["fisher", "trigger"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  klinger: Object.freeze({
    primarySeriesKey: "klinger",
    visibleSeriesKeys: Object.freeze(["klinger", "signal"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  rvgi: Object.freeze({
    primarySeriesKey: "rvgi",
    visibleSeriesKeys: Object.freeze(["rvgi", "signal"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  anchoredVolumeProfile: Object.freeze({
    primarySeriesKey: "poc",
    visibleSeriesKeys: Object.freeze(["poc", "valHigh", "valLow"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  aroon: Object.freeze({
    primarySeriesKey: "up",
    visibleSeriesKeys: Object.freeze(["up", "down"]),
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  aroonOsc: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: -100, max: 100 })
  }),
  donchian: Object.freeze({
    primarySeriesKey: "middle",
    visibleSeriesKeys: Object.freeze(["upper", "middle", "lower"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  keltner: Object.freeze({
    primarySeriesKey: "middle",
    visibleSeriesKeys: Object.freeze(["upper", "middle", "lower"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  envelope: Object.freeze({
    primarySeriesKey: "middle",
    visibleSeriesKeys: Object.freeze(["upper", "middle", "lower"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  chop: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  psar: Object.freeze({
    primarySeriesKey: "sar",
    visibleSeriesKeys: Object.freeze(["sar", "direction"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  supertrend: Object.freeze({
    primarySeriesKey: "line",
    visibleSeriesKeys: Object.freeze(["line", "direction"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  chandelier: Object.freeze({
    primarySeriesKey: "long",
    visibleSeriesKeys: Object.freeze(["long", "short"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  chandeKrollStop: Object.freeze({
    primarySeriesKey: "long",
    visibleSeriesKeys: Object.freeze(["long", "short"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  williamsFractal: Object.freeze({
    primarySeriesKey: "up",
    visibleSeriesKeys: Object.freeze(["up", "down"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  zigZag: Object.freeze({
    primarySeriesKey: "value",
    visibleSeriesKeys: Object.freeze(["value", "direction"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  pivotsHighLow: Object.freeze({
    primarySeriesKey: "high",
    visibleSeriesKeys: Object.freeze(["high", "low"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  pivotsStandard: Object.freeze({
    primarySeriesKey: "pp",
    visibleSeriesKeys: Object.freeze([
      "pp",
      "r1",
      "s1",
      "r2",
      "s2",
      "r3",
      "s3"
    ]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  volatilityStop: Object.freeze({
    primarySeriesKey: "value",
    visibleSeriesKeys: Object.freeze(["value", "direction"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  maRibbon: Object.freeze({
    primarySeriesKey: "ma_50",
    visibleSeriesKeys: Object.freeze([
      "ma_10",
      "ma_20",
      "ma_30",
      "ma_40",
      "ma_50"
    ]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  adx: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  dmi: Object.freeze({
    primarySeriesKey: "plusDi",
    visibleSeriesKeys: Object.freeze(["plusDi", "minusDi"]),
    yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 })
  }),
  trix: Object.freeze({
    primarySeriesKey: "trix",
    visibleSeriesKeys: Object.freeze(["trix", "signal"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  vortex: Object.freeze({
    primarySeriesKey: "plus",
    visibleSeriesKeys: Object.freeze(["plus", "minus"]),
    yDomain: Object.freeze({ kind: "auto" })
  }),
  trendStrengthIndex: Object.freeze({
    yDomain: Object.freeze({ kind: "fixed", min: -1, max: 1 })
  }),
  ichimoku: Object.freeze({
    primarySeriesKey: "tenkan",
    visibleSeriesKeys: Object.freeze([
      "tenkan",
      "kijun",
      "senkouA",
      "senkouB",
      "chikou"
    ]),
    yDomain: Object.freeze({ kind: "auto" })
  })
});

// ../runtime/dist/primitives.js
var ta3 = TA_REGISTRY;

// ../runtime/dist/buildComputeContext.js
function buildComputeContext(state2) {
  const base = {
    bar: state2.mainStream.bar,
    inputs: state2.runtimeContext.resolvedInputs,
    ta: ta3,
    plot: plot2,
    hline: hline2,
    alert: alert2,
    draw: DRAW_NAMESPACE,
    state: buildStateNamespace(),
    barstate: state2.runtimeContext.views.barstate,
    syminfo: state2.runtimeContext.views.syminfo,
    timeframe: state2.runtimeContext.views.timeframe,
    request: buildRequestNamespace(),
    runtime: buildRuntimeNamespace(state2.runtimeContext)
  };
  if (state2.manifest.kind !== "alertCondition")
    return base;
  return {
    ...base,
    signal: (conditionId, fired) => emitAlertCondition(state2.runtimeContext, conditionId, fired)
  };
}

// ../runtime/dist/execution/runComputeStep.js
function resetBarEmissions(state2) {
  state2.emissions.plots = [];
  state2.emissions.drawings = [];
  state2.emissions.alerts = [];
  state2.emissions.alertConditions = [];
  state2.emissions.logs = [];
  state2.emissions.diagnostics = [];
  state2.emissions.fromBar = state2.barIndex;
  state2.emissions.toBar = state2.barIndex;
  state2.runtimeContext.requestSecurityAlignments.clear();
  state2.runtimeContext.requestSecurityAscendingBars.clear();
  state2.runtimeContext.logBudget = 0;
  state2.runtimeContext.logBudgetExceededDiagnosed = false;
}
async function runComputeBody(args) {
  const { state: state2, eventKind, isTick } = args;
  ACTIVE_RUNTIME_CONTEXT.current = state2.runtimeContext;
  state2.runtimeContext.isTick = isTick;
  let outcome = { kind: "ok" };
  try {
    resetSubIdCounters(state2.runtimeContext);
    if (isTick) {
      resetTentativeStateSlots(state2.runtimeContext);
    }
    refreshRuntimeViews(state2, eventKind);
    try {
      await Promise.resolve(state2.compute(buildComputeContext(state2)));
      if (!isTick) {
        commitStateSlots(state2.runtimeContext);
        flushStateSlots(state2.runtimeContext);
      }
    } catch (err) {
      if (!isRuntimeErrorHalt(err))
        throw err;
      state2.emissions.plots = [];
      state2.emissions.drawings = [];
      state2.emissions.alerts = [];
      state2.emissions.alertConditions = [];
      state2.emissions.logs = [];
      pushDiagnostic(state2.emissions, {
        kind: "diagnostic",
        severity: "error",
        code: "runtime-error-thrown",
        message: err.message,
        slotId: null,
        bar: state2.barIndex
      });
      outcome = { kind: "halt", message: err.message };
    }
  } finally {
    if (isTick)
      state2.runtimeContext.isTick = false;
    ACTIVE_RUNTIME_CONTEXT.current = null;
  }
  return outcome;
}

// ../runtime/dist/dep/emissionFilter.js
function prefixSlotId(slotId, prefix) {
  return `${prefix}${slotId}`;
}
function prefixNullableSlotId(slotId, prefix) {
  return slotId === null ? null : prefixSlotId(slotId, prefix);
}
function resetEmissions(emissions) {
  emissions.plots = [];
  emissions.drawings = [];
  emissions.alerts = [];
  emissions.alertConditions = [];
  emissions.logs = [];
  emissions.diagnostics = [];
}
function producerIdOf(runner) {
  return runner.kind === "dep" ? runner.localId : runner.exportName;
}
function applyDepEmissionPolicy(runner, parentEmissions, depOutputStore) {
  const producerId = producerIdOf(runner);
  const declared = new Set(runner.declaredOutputs);
  const pushedTitles = /* @__PURE__ */ new Set();
  for (const plot3 of runner.emissions.plots) {
    const title = plot3.title;
    if (declared.has(title)) {
      depOutputStore.push(producerId, title, plot3.value ?? Number.NaN);
      pushedTitles.add(title);
    } else if (runner.kind === "dep") {
      const diag = {
        kind: "diagnostic",
        severity: "warning",
        code: "dep-output-not-titled",
        message: title === "" ? `dep "${runner.localId}" emitted an untitled plot` : `dep "${runner.localId}" emitted plot with undeclared title "${title}"`,
        slotId: prefixSlotId(plot3.slotId, runner.slotIdPrefix),
        bar: plot3.bar
      };
      parentEmissions.diagnostics.push(diag);
    }
    if (runner.kind === "sibling") {
      parentEmissions.plots.push({
        ...plot3,
        slotId: prefixSlotId(plot3.slotId, runner.slotIdPrefix)
      });
    }
  }
  if (runner.kind === "sibling") {
    for (const drawing of runner.emissions.drawings) {
      parentEmissions.drawings.push(drawing);
    }
    for (const alert3 of runner.emissions.alerts) {
      parentEmissions.alerts.push({
        ...alert3,
        slotId: prefixSlotId(alert3.slotId, runner.slotIdPrefix)
      });
    }
    const siblingConditions = runner.emissions.alertConditions ?? [];
    if (siblingConditions.length > 0) {
      const target = parentEmissions.alertConditions ?? [];
      parentEmissions.alertConditions = target;
      for (const condition of siblingConditions) {
        target.push(condition);
      }
    }
    for (const log of runner.emissions.logs) {
      parentEmissions.logs.push(log);
    }
  }
  for (const diag of runner.emissions.diagnostics) {
    parentEmissions.diagnostics.push({
      ...diag,
      slotId: prefixNullableSlotId(diag.slotId, runner.slotIdPrefix)
    });
  }
  for (const title of declared) {
    if (!pushedTitles.has(title)) {
      depOutputStore.push(producerId, title, Number.NaN);
    }
  }
  resetEmissions(runner.emissions);
}

// ../runtime/dist/dep/DepRunner.js
function freshEmissions(barIndex) {
  return {
    plots: [],
    drawings: [],
    alerts: [],
    alertConditions: [],
    logs: [],
    diagnostics: [],
    fromBar: barIndex,
    toBar: barIndex
  };
}
function buildSubRunnerState(args, slotIdPrefix, isDep) {
  const stateStore = inMemoryStateStore();
  const emissions = freshEmissions(0);
  const alertConditions = new Map((args.compiled.manifest.alertConditions ?? []).map((c) => [c.id, c]));
  const state2 = {
    manifest: args.compiled.manifest,
    compute: args.compiled.compute,
    capabilities: args.parentCapabilities,
    stateStore,
    persistenceIntervalMs: Number.POSITIVE_INFINITY,
    now: args.now,
    mainStream: args.mainStream,
    runtimeContext: {
      stream: args.mainStream,
      stateStore,
      lastPersistTime: 0,
      capabilities: args.parentCapabilities,
      emissions,
      barIndex: () => state2.barIndex,
      isTick: false,
      drawingSlots: /* @__PURE__ */ new Map(),
      drawingSubIdCounters: /* @__PURE__ */ new Map(),
      drawingBucketCounters: {
        lines: 0,
        labels: 0,
        boxes: 0,
        polylines: 0,
        other: 0
      },
      scriptMaxDrawings: args.compiled.manifest.maxDrawings ?? null,
      stateSlots: /* @__PURE__ */ new Map(),
      secondaryStreams: args.secondaryStreams,
      requestSecurityBars: /* @__PURE__ */ new Map(),
      requestSecurityAlignments: /* @__PURE__ */ new Map(),
      requestSecurityAscendingBars: /* @__PURE__ */ new Map(),
      requestLowerTfViews: /* @__PURE__ */ new Map(),
      diagnosedRequestKeys: /* @__PURE__ */ new Set(),
      alertConditions,
      diagnosedAlertConditionKeys: /* @__PURE__ */ new Set(),
      logBudget: 0,
      logBudgetExceededDiagnosed: false,
      resolvedInputs: Object.freeze({}),
      defaultPane: resolveDefaultPane(args.compiled.manifest),
      scriptPane: resolveScriptPane(args.compiled.manifest),
      // Overrides target the primary script's slots only in v1;
      // dep-output plots are not host-overridable.
      plotOverrides: Object.freeze({}),
      diagnosedInputKeys: /* @__PURE__ */ new Set(),
      views: createRuntimeViews(),
      slotIdPrefix,
      isDep,
      depOutputStore: args.depOutputStore
    },
    emissions,
    depRunners: [],
    siblingRunners: [],
    depOutputStore: args.depOutputStore,
    depErroredThisBar: false,
    barIndex: 0
  };
  state2.runtimeContext.resolvedInputs = resolveInputs(args.compiled.manifest, args.inputOverrides, state2.runtimeContext);
  return state2;
}
function declaredOutputTitles(compiled) {
  return (compiled.manifest.outputs ?? []).map((o) => o.title);
}
function createDepRunner(args) {
  const slotIdPrefix = `dep:${args.localId}/`;
  return Object.freeze({
    kind: "dep",
    localId: args.localId,
    slotIdPrefix,
    declaredOutputs: declaredOutputTitles(args.compiled),
    state: buildSubRunnerState(args, slotIdPrefix, true)
  });
}
function createSiblingRunner(args) {
  const slotIdPrefix = `export:${args.exportName}/`;
  return Object.freeze({
    kind: "sibling",
    exportName: args.exportName,
    slotIdPrefix,
    declaredOutputs: declaredOutputTitles(args.compiled),
    state: buildSubRunnerState(args, slotIdPrefix, false)
  });
}
function depRunnerLike(dep) {
  return {
    kind: "dep",
    localId: dep.localId,
    slotIdPrefix: dep.slotIdPrefix,
    declaredOutputs: dep.declaredOutputs,
    emissions: dep.state.emissions
  };
}
function siblingRunnerLike(sib) {
  return {
    kind: "sibling",
    exportName: sib.exportName,
    slotIdPrefix: sib.slotIdPrefix,
    declaredOutputs: sib.declaredOutputs,
    emissions: sib.state.emissions
  };
}
async function executeSubStep(state2, eventKind, isTick) {
  resetBarEmissions(state2);
  try {
    const outcome = await runComputeBody({ state: state2, eventKind, isTick });
    return outcome.kind === "halt" ? { halted: true, message: outcome.message } : { halted: false, message: "" };
  } catch (err) {
    const message2 = err instanceof Error ? err.message : String(err);
    return { halted: true, message: message2 };
  }
}
async function runDepStep(dep, parentState, rawBar, eventKind, isTick) {
  if (parentState.depOutputStore === null) {
    throw new Error("runDepStep called on a runner with no dep output store");
  }
  const result = await executeSubStep(dep.state, eventKind, isTick);
  if (result.halted) {
    pushDiagnostic(dep.state.emissions, {
      kind: "diagnostic",
      severity: "error",
      code: "dep-error",
      message: result.message,
      slotId: "",
      bar: dep.state.barIndex
    });
    parentState.depErroredThisBar = true;
  }
  if (!isTick) {
    dep.state.barIndex += 1;
  }
  applyDepEmissionPolicy(depRunnerLike(dep), parentState.emissions, parentState.depOutputStore);
}
async function runSiblingStep(sibling, parentState, rawBar, eventKind, isTick) {
  if (parentState.depOutputStore === null) {
    throw new Error("runSiblingStep called on a runner with no dep output store");
  }
  const result = await executeSubStep(sibling.state, eventKind, isTick);
  if (result.halted) {
    pushDiagnostic(sibling.state.emissions, {
      kind: "diagnostic",
      severity: "error",
      code: "dep-error",
      message: result.message,
      slotId: "",
      bar: sibling.state.barIndex
    });
  }
  if (!isTick) {
    sibling.state.barIndex += 1;
  }
  applyDepEmissionPolicy(siblingRunnerLike(sibling), parentState.emissions, parentState.depOutputStore);
}

// ../runtime/dist/dep/depOutput.js
var DEP_OUTPUT_GLOBAL_KEY = "__chartlang_depOutput";
var OUTSIDE_CTX_MESSAGE67 = "__chartlang_depOutput called outside an active script step";
var NO_STORE_MESSAGE = "__chartlang_depOutput called on a runner with no dep output store";
var NAN_SERIES = makeSeriesView(new Float64RingBuffer(1));
function __chartlang_depOutput(slotId, localId, title) {
  const ctx = ACTIVE_RUNTIME_CONTEXT.current;
  if (ctx === null) {
    throw new Error(OUTSIDE_CTX_MESSAGE67);
  }
  const store = ctx.depOutputStore;
  if (store === void 0 || store === null) {
    throw new Error(NO_STORE_MESSAGE);
  }
  try {
    return store.read(localId, title);
  } catch {
    pushDiagnostic(ctx.emissions, {
      kind: "diagnostic",
      severity: "error",
      code: "dep-unknown-output",
      message: `dep "${localId}" did not declare output "${title}"`,
      slotId,
      bar: ctx.barIndex()
    });
    return NAN_SERIES;
  }
}
function installDepOutputGlobal() {
  const holder = globalThis;
  if (holder[DEP_OUTPUT_GLOBAL_KEY] === void 0) {
    holder[DEP_OUTPUT_GLOBAL_KEY] = __chartlang_depOutput;
  }
}

// ../runtime/dist/execution/drain.js
function drain(state2) {
  const out = Object.freeze({
    plots: state2.emissions.plots,
    drawings: state2.emissions.drawings,
    alerts: state2.emissions.alerts,
    alertConditions: state2.emissions.alertConditions ?? [],
    logs: state2.emissions.logs,
    diagnostics: state2.emissions.diagnostics,
    fromBar: state2.emissions.fromBar,
    toBar: state2.emissions.toBar
  });
  state2.emissions.plots = [];
  state2.emissions.drawings = [];
  state2.emissions.alerts = [];
  state2.emissions.alertConditions = [];
  state2.emissions.logs = [];
  state2.emissions.diagnostics = [];
  return out;
}

// ../runtime/dist/execution/dispose.js
function dispose(state2) {
  for (const dep of state2.depRunners) {
    dispose(dep.state);
  }
  for (const sibling of state2.siblingRunners) {
    dispose(sibling.state);
  }
  state2.depOutputStore?.dispose();
  flushStateSlots(state2.runtimeContext);
  for (const buf of Object.values(state2.mainStream.ohlcv)) {
    buf.reset();
  }
  for (const stream of state2.runtimeContext.secondaryStreams.values()) {
    for (const buf of Object.values(stream.ohlcv)) {
      buf.reset();
    }
    stream.taSlots.clear();
  }
  state2.mainStream.taSlots.clear();
  state2.emissions.plots = [];
  state2.emissions.drawings = [];
  state2.emissions.alerts = [];
  state2.emissions.diagnostics = [];
  state2.runtimeContext.drawingSlots.clear();
  state2.runtimeContext.drawingSubIdCounters.clear();
  state2.runtimeContext.stateSlots.clear();
  state2.runtimeContext.secondaryStreams.clear();
  state2.runtimeContext.requestSecurityBars.clear();
  state2.runtimeContext.requestSecurityAlignments.clear();
  state2.runtimeContext.requestSecurityAscendingBars.clear();
  state2.runtimeContext.requestLowerTfViews.clear();
  state2.runtimeContext.diagnosedRequestKeys.clear();
  state2.runtimeContext.diagnosedInputKeys.clear();
  const counters = state2.runtimeContext.drawingBucketCounters;
  counters.lines = 0;
  counters.labels = 0;
  counters.boxes = 0;
  counters.polylines = 0;
  counters.other = 0;
}

// ../runtime/dist/execution/onBarClose.js
function clearVisualEmissions(state2) {
  state2.emissions.plots = [];
  state2.emissions.drawings = [];
  state2.emissions.alerts = [];
  state2.emissions.alertConditions = [];
  state2.emissions.logs = [];
}
async function onBarClose(state2, rawBar, eventKind = "close") {
  appendBarToStream(state2.mainStream, rawBar);
  updateFallbackViewport(state2.mainStream);
  state2.depErroredThisBar = false;
  resetBarEmissions(state2);
  state2.depOutputStore?.beginBar();
  for (const dep of state2.depRunners) {
    await runDepStep(dep, state2, rawBar, eventKind, false);
  }
  for (const sibling of state2.siblingRunners) {
    await runSiblingStep(sibling, state2, rawBar, eventKind, false);
  }
  await runComputeBody({ state: state2, eventKind, isTick: false });
  if (state2.depErroredThisBar) {
    clearVisualEmissions(state2);
  }
  state2.barIndex += 1;
}

// ../runtime/dist/execution/onBarTick.js
function clearVisualEmissions2(state2) {
  state2.emissions.plots = [];
  state2.emissions.drawings = [];
  state2.emissions.alerts = [];
  state2.emissions.alertConditions = [];
  state2.emissions.logs = [];
}
async function onBarTick(state2, rawBar) {
  replaceTickHead(state2.mainStream, rawBar);
  updateFallbackViewport(state2.mainStream);
  state2.depErroredThisBar = false;
  resetBarEmissions(state2);
  state2.depOutputStore?.beginBar();
  for (const dep of state2.depRunners) {
    await runDepStep(dep, state2, rawBar, "tick", true);
  }
  for (const sibling of state2.siblingRunners) {
    await runSiblingStep(sibling, state2, rawBar, "tick", true);
  }
  await runComputeBody({ state: state2, eventKind: "tick", isTick: true });
  if (state2.depErroredThisBar) {
    clearVisualEmissions2(state2);
  }
}

// ../runtime/dist/execution/onHistory.js
async function onHistory(state2, bars) {
  if (bars.length === 0)
    return;
  const fromBar = state2.barIndex;
  const plots = state2.emissions.plots;
  const drawings = state2.emissions.drawings;
  const alerts = state2.emissions.alerts;
  const alertConditions = state2.emissions.alertConditions ?? [];
  const logs = state2.emissions.logs;
  const diagnostics = state2.emissions.diagnostics;
  for (const bar of bars) {
    await onBarClose(state2, bar, "history");
    plots.push(...state2.emissions.plots);
    drawings.push(...state2.emissions.drawings);
    alerts.push(...state2.emissions.alerts);
    alertConditions.push(...state2.emissions.alertConditions ?? []);
    logs.push(...state2.emissions.logs);
    diagnostics.push(...state2.emissions.diagnostics);
  }
  state2.emissions.plots = plots;
  state2.emissions.drawings = drawings;
  state2.emissions.alerts = alerts;
  state2.emissions.alertConditions = alertConditions;
  state2.emissions.logs = logs;
  state2.emissions.diagnostics = diagnostics;
  state2.emissions.fromBar = fromBar;
}

// ../runtime/dist/execution/secondaryStream.js
function appendSecondaryBar(stream, rawBar) {
  appendBarToStream(stream, rawBar);
}
function replaceSecondaryHead(stream, rawBar) {
  replaceStreamHead(stream, rawBar);
}
function appendSecondaryHistory(stream, bars) {
  for (const bar of bars) {
    appendBarToStream(stream, bar);
  }
}

// ../runtime/dist/persistentStateStore.validate.js
var bufferKeys = ["time", "open", "high", "low", "close", "volume"];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isJsonValue2(value) {
  if (value === null)
    return true;
  if (typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number")
    return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((entry) => isJsonValue2(entry));
  if (isRecord(value)) {
    return Object.values(value).every((entry) => isJsonValue2(entry));
  }
  return false;
}
function isSnapshotNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isBufferArray(value) {
  return Array.isArray(value) && value.every((entry) => entry === null || isSnapshotNumber(entry));
}
function isStreamSnapshot(value) {
  if (!isRecord(value))
    return false;
  if (typeof value.interval !== "string")
    return false;
  if (!Number.isInteger(value.headIndex) || !Number.isInteger(value.filled))
    return false;
  const buffers = value.buffers;
  if (!isRecord(buffers))
    return false;
  return bufferKeys.every((key) => isBufferArray(buffers[key]));
}
function isSlotsRecord(value) {
  return isRecord(value) && Object.values(value).every((entry) => isJsonValue2(entry));
}
function isRunnerSnapshot(value) {
  return isRecord(value) && isSlotsRecord(value.slots);
}
function isRunnerSnapshotMap(value) {
  return isRecord(value) && Object.values(value).every((entry) => isRunnerSnapshot(entry));
}
function validateSnapshot(snap) {
  if (!isRecord(snap))
    return false;
  if (snap.snapshotVersion !== 1)
    return false;
  if (!isSnapshotNumber(snap.lastBarTime) || !isSnapshotNumber(snap.savedAt))
    return false;
  if (!isRecord(snap.streams))
    return false;
  if (!Object.values(snap.streams).every((stream) => isStreamSnapshot(stream)))
    return false;
  if ("primary" in snap) {
    if (!isRunnerSnapshot(snap.primary))
      return false;
    if (snap.siblings !== void 0 && !isRunnerSnapshotMap(snap.siblings))
      return false;
    if (snap.dependencies !== void 0 && !isRunnerSnapshotMap(snap.dependencies)) {
      return false;
    }
    return true;
  }
  return isSlotsRecord(snap.slots);
}

// ../runtime/dist/ta/persistence.js
var TA_SLOT_PREFIX = "ta:";
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
function restoreNumber(value) {
  if (value === null)
    return Number.NaN;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function restoreNumbers(fields) {
  const out = {};
  for (const key of Object.keys(fields)) {
    const restored = restoreNumber(fields[key]);
    if (restored === null)
      return null;
    out[key] = restored;
  }
  return out;
}
function isInteger(value) {
  return typeof value === "number" && Number.isInteger(value);
}
function isBufferSnapshot(value) {
  if (!isRecord2(value))
    return false;
  if (!isInteger(value.headIndex) || !isInteger(value.filled))
    return false;
  return Array.isArray(value.values) && value.values.every((entry) => entry === null || typeof entry === "number" && Number.isFinite(entry));
}
function serialiseBuffer(buffer) {
  const snapshot6 = buffer.serialiseSnapshotBuffer();
  return {
    headIndex: snapshot6.headIndex,
    filled: snapshot6.filled,
    values: snapshot6.values
  };
}
function restoreBuffer(snapshot6, capacity) {
  const buffer = new Float64RingBuffer(capacity);
  try {
    buffer.restoreFromSnapshotBuffer(snapshot6);
    return buffer;
  } catch {
    return null;
  }
}
function baseSlot(outBuffer) {
  return {
    outBuffer,
    series: makeSeriesView(outBuffer),
    shiftedViews: /* @__PURE__ */ new Map()
  };
}
function isFloat64RingBuffer(value) {
  return value instanceof Float64RingBuffer;
}
function serialiseSma(slot) {
  if (slot.kind !== "ta.sma" || typeof slot.length !== "number" || typeof slot.sum !== "number" || !isFloat64RingBuffer(slot.outBuffer) || !isFloat64RingBuffer(slot.window)) {
    return null;
  }
  return {
    kind: "ta.sma",
    length: slot.length,
    outBuffer: serialiseBuffer(slot.outBuffer),
    window: serialiseBuffer(slot.window),
    sum: finiteOrNull(slot.sum)
  };
}
function serialiseEma(slot) {
  if (slot.kind !== "ta.ema" || typeof slot.alpha !== "number" || typeof slot.length !== "number" || typeof slot.seedSum !== "number" || typeof slot.seedCount !== "number" || typeof slot.prevEma !== "number" || typeof slot.prevClosedEma !== "number" || !isFloat64RingBuffer(slot.outBuffer)) {
    return null;
  }
  return {
    kind: "ta.ema",
    alpha: finiteOrNull(slot.alpha),
    length: slot.length,
    outBuffer: serialiseBuffer(slot.outBuffer),
    seedSum: finiteOrNull(slot.seedSum),
    seedCount: slot.seedCount,
    prevEma: finiteOrNull(slot.prevEma),
    prevClosedEma: finiteOrNull(slot.prevClosedEma)
  };
}
function serialiseRsi(slot) {
  if (slot.kind !== "ta.rsi" || typeof slot.length !== "number" || typeof slot.seedGainSum !== "number" || typeof slot.seedLossSum !== "number" || typeof slot.diffCount !== "number" || typeof slot.avgGain !== "number" || typeof slot.avgLoss !== "number" || typeof slot.prevSrc !== "number" || typeof slot.prevClosedSrc !== "number" || !isFloat64RingBuffer(slot.outBuffer)) {
    return null;
  }
  return {
    kind: "ta.rsi",
    length: slot.length,
    outBuffer: serialiseBuffer(slot.outBuffer),
    seedGainSum: finiteOrNull(slot.seedGainSum),
    seedLossSum: finiteOrNull(slot.seedLossSum),
    diffCount: slot.diffCount,
    avgGain: finiteOrNull(slot.avgGain),
    avgLoss: finiteOrNull(slot.avgLoss),
    prevSrc: finiteOrNull(slot.prevSrc),
    prevClosedSrc: finiteOrNull(slot.prevClosedSrc)
  };
}
function restoreSma(snapshot6) {
  const outSnapshot = snapshot6.outBuffer;
  const windowSnapshot = snapshot6.window;
  if (snapshot6.kind !== "ta.sma" || !isInteger(snapshot6.length) || !isBufferSnapshot(outSnapshot) || !isBufferSnapshot(windowSnapshot)) {
    return null;
  }
  const sum = restoreNumber(snapshot6.sum);
  if (sum === null)
    return null;
  const outBuffer = restoreBuffer(outSnapshot, outSnapshot.values.length);
  const window = restoreBuffer(windowSnapshot, snapshot6.length);
  if (outBuffer === null || window === null)
    return null;
  return {
    kind: "ta.sma",
    ...baseSlot(outBuffer),
    length: snapshot6.length,
    window,
    sum
  };
}
function restoreEma(snapshot6) {
  const outSnapshot = snapshot6.outBuffer;
  if (snapshot6.kind !== "ta.ema" || !isInteger(snapshot6.length) || !isInteger(snapshot6.seedCount) || !isBufferSnapshot(outSnapshot)) {
    return null;
  }
  const numbers = restoreNumbers({
    alpha: snapshot6.alpha,
    seedSum: snapshot6.seedSum,
    prevEma: snapshot6.prevEma,
    prevClosedEma: snapshot6.prevClosedEma
  });
  if (numbers === null)
    return null;
  const outBuffer = restoreBuffer(outSnapshot, outSnapshot.values.length);
  if (outBuffer === null)
    return null;
  return {
    kind: "ta.ema",
    ...baseSlot(outBuffer),
    alpha: numbers.alpha,
    length: snapshot6.length,
    seedSum: numbers.seedSum,
    seedCount: snapshot6.seedCount,
    prevEma: numbers.prevEma,
    prevClosedEma: numbers.prevClosedEma
  };
}
function restoreRsi(snapshot6) {
  const outSnapshot = snapshot6.outBuffer;
  if (snapshot6.kind !== "ta.rsi" || !isInteger(snapshot6.length) || !isInteger(snapshot6.diffCount) || !isBufferSnapshot(outSnapshot)) {
    return null;
  }
  const numbers = restoreNumbers({
    seedGainSum: snapshot6.seedGainSum,
    seedLossSum: snapshot6.seedLossSum,
    avgGain: snapshot6.avgGain,
    avgLoss: snapshot6.avgLoss,
    prevSrc: snapshot6.prevSrc,
    prevClosedSrc: snapshot6.prevClosedSrc
  });
  if (numbers === null)
    return null;
  const outBuffer = restoreBuffer(outSnapshot, outSnapshot.values.length);
  if (outBuffer === null)
    return null;
  return {
    kind: "ta.rsi",
    ...baseSlot(outBuffer),
    length: snapshot6.length,
    seedGainSum: numbers.seedGainSum,
    seedLossSum: numbers.seedLossSum,
    diffCount: snapshot6.diffCount,
    avgGain: numbers.avgGain,
    avgLoss: numbers.avgLoss,
    prevSrc: numbers.prevSrc,
    prevClosedSrc: numbers.prevClosedSrc
  };
}
function serialiseTaSlot(slot) {
  if (!isRecord2(slot))
    return null;
  if (slot.kind === "ta.sma")
    return serialiseSma(slot);
  if (slot.kind === "ta.ema")
    return serialiseEma(slot);
  if (slot.kind === "ta.rsi")
    return serialiseRsi(slot);
  return null;
}
function restoreTaSlot(snapshot6) {
  if (!isRecord2(snapshot6))
    return null;
  if (snapshot6.kind === "ta.sma")
    return restoreSma(snapshot6);
  if (snapshot6.kind === "ta.ema")
    return restoreEma(snapshot6);
  if (snapshot6.kind === "ta.rsi")
    return restoreRsi(snapshot6);
  return null;
}
function isTaSlotSnapshotKey(key) {
  return key.startsWith(TA_SLOT_PREFIX);
}
function serialiseTaSlots(stream) {
  const out = {};
  for (const [slotId, slot] of stream.taSlots.entries()) {
    const snapshot6 = serialiseTaSlot(slot);
    if (snapshot6 !== null) {
      out[`${TA_SLOT_PREFIX}${slotId}`] = snapshot6;
    }
  }
  return Object.freeze(out);
}
function restoreTaSlots(stream, slots) {
  stream.taSlots.clear();
  for (const [key, value] of Object.entries(slots)) {
    if (!isTaSlotSnapshotKey(key))
      continue;
    const slot = restoreTaSlot(value);
    if (slot !== null) {
      stream.taSlots.set(key.slice(TA_SLOT_PREFIX.length), slot);
    }
  }
}

// ../runtime/dist/persistentStateStore.runtime.js
var PERSISTENCE_INTERVAL_MS = 6e4;
function firstStreamKey(snapshot6) {
  const entries = Object.entries(snapshot6.streams);
  const first = entries[0];
  return first === void 0 ? null : first[0];
}
function captureStreams(state2) {
  const main = state2.mainStream.serialiseSnapshot();
  const streams = {
    [main.interval === "" ? "main" : main.interval]: main
  };
  for (const [key, stream] of state2.runtimeContext.secondaryStreams) {
    streams[key] = stream.serialiseSnapshot();
  }
  return Object.freeze(streams);
}
function primarySectionSlots(state2) {
  return Object.freeze({
    ...serialiseStateSlots(state2.runtimeContext),
    ...serialiseTaSlots(state2.mainStream)
  });
}
function runnerSection(ctx) {
  return Object.freeze({
    slots: Object.freeze({ ...serialiseStateSlots(ctx) })
  });
}
function captureSiblings(state2) {
  if (state2.siblingRunners.length === 0)
    return void 0;
  const out = {};
  for (const sibling of state2.siblingRunners) {
    out[sibling.exportName] = runnerSection(sibling.state.runtimeContext);
  }
  return Object.freeze(out);
}
function captureDependencies(state2) {
  if (state2.depRunners.length === 0)
    return void 0;
  const out = {};
  for (const dep of state2.depRunners) {
    out[dep.localId] = runnerSection(dep.state.runtimeContext);
  }
  return Object.freeze(out);
}
function captureStateSnapshot(state2, savedAt) {
  const streams = captureStreams(state2);
  const siblings = captureSiblings(state2);
  const dependencies = captureDependencies(state2);
  const candidate = {
    lastBarTime: state2.mainStream.bar.time,
    streams,
    savedAt,
    snapshotVersion: 1,
    primary: { slots: primarySectionSlots(state2) },
    ...siblings === void 0 ? {} : { siblings },
    ...dependencies === void 0 ? {} : { dependencies }
  };
  if (!validateSnapshot(candidate))
    return null;
  return candidate;
}
function resolveMainStreamSnapshot(snapshot6, mainInterval) {
  const direct = mainInterval === "" ? void 0 : snapshot6.streams[mainInterval];
  if (direct !== void 0)
    return direct;
  const fallback2 = firstStreamKey(snapshot6);
  return fallback2 === null ? void 0 : snapshot6.streams[fallback2];
}
function nonTaSlots(slots) {
  const out = {};
  for (const [slotKey, value] of Object.entries(slots)) {
    if (!isTaSlotSnapshotKey(slotKey)) {
      out[slotKey] = value;
    }
  }
  return out;
}
function pushMalformedSection(state2, message2) {
  pushDiagnostic(state2.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code: "state-snapshot-malformed",
    message: message2,
    slotId: null,
    bar: state2.barIndex
  });
}
function restoreSiblingSections(state2, siblings) {
  const lookup = new Map(state2.siblingRunners.map((sib) => [sib.exportName, sib]));
  for (const [exportName, section] of Object.entries(siblings)) {
    const sibling = lookup.get(exportName);
    if (sibling === void 0) {
      pushMalformedSection(state2, `persistent state snapshot referenced unknown sibling "${exportName}"`);
      continue;
    }
    restoreStateSlots(sibling.state.runtimeContext, section.slots);
  }
}
function restoreDependencySections(state2, dependencies) {
  const lookup = new Map(state2.depRunners.map((dep) => [dep.localId, dep]));
  for (const [localId, section] of Object.entries(dependencies)) {
    const dep = lookup.get(localId);
    if (dep === void 0) {
      pushMalformedSection(state2, `persistent state snapshot referenced unknown dependency "${localId}"`);
      continue;
    }
    restoreStateSlots(dep.state.runtimeContext, section.slots);
  }
}
function restoreStateSnapshot(state2, snapshot6) {
  const stream = resolveMainStreamSnapshot(snapshot6, state2.mainStream.bar.interval);
  if (stream !== void 0) {
    state2.mainStream.restoreFromSnapshot(stream);
    state2.barIndex = Math.max(state2.barIndex, stream.filled);
  }
  for (const [secondaryKey, secondary] of state2.runtimeContext.secondaryStreams) {
    const secondarySnapshot = snapshot6.streams[secondaryKey];
    if (secondarySnapshot !== void 0) {
      secondary.restoreFromSnapshot(secondarySnapshot);
    }
  }
  const primarySlots = primarySlotsOf(snapshot6);
  restoreTaSlots(state2.mainStream, primarySlots);
  restoreStateSlots(state2.runtimeContext, nonTaSlots(primarySlots));
  if (snapshot6.siblings !== void 0) {
    restoreSiblingSections(state2, snapshot6.siblings);
  }
  if (snapshot6.dependencies !== void 0) {
    restoreDependencySections(state2, snapshot6.dependencies);
  }
}
var EMPTY_SLOTS = Object.freeze({});
function primarySlotsOf(snapshot6) {
  const view = snapshot6;
  if (view.primary !== void 0)
    return view.primary.slots;
  if (view.slots === void 0)
    return EMPTY_SLOTS;
  return view.slots;
}
async function saveStateSnapshot(state2, savedAt) {
  const store = state2.runtimeContext.persistentStateStore;
  if (store === void 0)
    return false;
  const snapshot6 = captureStateSnapshot(state2, savedAt);
  if (snapshot6 === null) {
    pushDiagnostic(state2.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "state-snapshot-malformed",
      message: "persistent state snapshot was not JSON-clean",
      slotId: null,
      bar: state2.barIndex
    });
    return false;
  }
  try {
    await store.save(snapshot6);
    state2.runtimeContext.lastPersistTime = savedAt;
    return true;
  } catch (err) {
    pushDiagnostic(state2.emissions, {
      kind: "diagnostic",
      severity: "warning",
      code: "state-snapshot-save-failed",
      message: err instanceof Error ? err.message : String(err),
      slotId: null,
      bar: state2.barIndex
    });
    return false;
  }
}
async function maybeSaveStateSnapshot(state2, savedAt, intervalMs) {
  if (state2.runtimeContext.persistentStateStore === void 0)
    return;
  if (savedAt - state2.runtimeContext.lastPersistTime >= intervalMs) {
    await saveStateSnapshot(state2, savedAt);
  }
}

// ../runtime/dist/createScriptRunner.js
function resolveCapacity(manifest) {
  const requested = manifest.seriesCapacities.ohlcv;
  const fallback2 = manifest.maxLookback + 1;
  return Math.max(1, requested ?? fallback2);
}
function createSecondaryStreams(manifest, capacity) {
  const streams = /* @__PURE__ */ new Map();
  for (const interval of manifest.requestedIntervals) {
    if (streams.has(interval))
      continue;
    streams.set(interval, createStreamState({ interval, capacity, symbol: "" }));
  }
  return streams;
}
async function pushMainEvent(state2, event) {
  switch (event.kind) {
    case "history":
      await onHistory(state2, event.bars);
      return;
    case "close":
      await onBarClose(state2, event.bar);
      await maybeSaveStateSnapshot(state2, state2.now(), state2.persistenceIntervalMs);
      return;
    case "tick":
      await onBarTick(state2, event.bar);
      return;
  }
}
function pushUnknownSecondaryDiagnostic(state2, streamKey) {
  pushDiagnostic(state2.emissions, {
    kind: "diagnostic",
    severity: "warning",
    code: "unknown-secondary-stream",
    message: `Secondary stream "${streamKey}" was not registered by the script manifest`,
    slotId: null,
    bar: state2.barIndex
  });
}
function pushSecondaryEvent(state2, streamKey, event) {
  const stream = state2.runtimeContext.secondaryStreams.get(streamKey);
  if (stream === void 0) {
    pushUnknownSecondaryDiagnostic(state2, streamKey);
    return;
  }
  switch (event.kind) {
    case "history":
      appendSecondaryHistory(stream, event.bars);
      return;
    case "close":
      appendSecondaryBar(stream, event.bar);
      return;
    case "tick":
      replaceSecondaryHead(stream, event.bar);
      return;
  }
}
function primaryOf(compiled) {
  return isCompiledScriptBundle(compiled) ? compiled.primary : compiled;
}
function buildPrimaryState(args, primary) {
  const capacity = resolveCapacity(primary.manifest);
  const mainStream = createStreamState({ interval: "", capacity, symbol: "" });
  const secondaryStreams = createSecondaryStreams(primary.manifest, capacity);
  const stateStore = args.stateStore ?? inMemoryStateStore();
  const now = args.now ?? Date.now;
  const views = createRuntimeViews({
    syminfo: makeSymInfoView(args.symInfo ?? {}, args.capabilities.symInfoFields)
  });
  const emissions = {
    plots: [],
    drawings: [],
    alerts: [],
    alertConditions: [],
    logs: [],
    diagnostics: [],
    fromBar: 0,
    toBar: 0
  };
  const alertConditions = new Map((primary.manifest.alertConditions ?? []).map((condition) => [condition.id, condition]));
  const state2 = {
    manifest: primary.manifest,
    compute: primary.compute,
    capabilities: args.capabilities,
    stateStore,
    persistenceIntervalMs: args.persistenceIntervalMs ?? PERSISTENCE_INTERVAL_MS,
    now,
    mainStream,
    runtimeContext: {
      stream: mainStream,
      stateStore,
      ...args.persistentStateStore === void 0 ? {} : { persistentStateStore: args.persistentStateStore },
      lastPersistTime: 0,
      capabilities: args.capabilities,
      emissions,
      barIndex: () => state2.barIndex,
      isTick: false,
      drawingSlots: /* @__PURE__ */ new Map(),
      drawingSubIdCounters: /* @__PURE__ */ new Map(),
      drawingBucketCounters: {
        lines: 0,
        labels: 0,
        boxes: 0,
        polylines: 0,
        other: 0
      },
      scriptMaxDrawings: primary.manifest.maxDrawings ?? null,
      stateSlots: /* @__PURE__ */ new Map(),
      secondaryStreams,
      requestSecurityBars: /* @__PURE__ */ new Map(),
      requestSecurityAlignments: /* @__PURE__ */ new Map(),
      requestSecurityAscendingBars: /* @__PURE__ */ new Map(),
      requestLowerTfViews: /* @__PURE__ */ new Map(),
      diagnosedRequestKeys: /* @__PURE__ */ new Set(),
      alertConditions,
      diagnosedAlertConditionKeys: /* @__PURE__ */ new Set(),
      logBudget: 0,
      logBudgetExceededDiagnosed: false,
      resolvedInputs: Object.freeze({}),
      defaultPane: resolveDefaultPane(primary.manifest),
      scriptPane: resolveScriptPane(primary.manifest),
      plotOverrides: Object.freeze({}),
      diagnosedInputKeys: /* @__PURE__ */ new Set(),
      views
    },
    emissions,
    depRunners: [],
    siblingRunners: [],
    depOutputStore: null,
    depErroredThisBar: false,
    barIndex: 0
  };
  const overrides = args.inputOverrides ?? args.resolveInputs?.(primary.manifest.name) ?? Object.freeze({});
  state2.runtimeContext.resolvedInputs = resolveInputs(primary.manifest, overrides, state2.runtimeContext);
  state2.runtimeContext.plotOverrides = args.plotOverrides ?? args.resolvePlotOverrides?.(primary.manifest.name) ?? Object.freeze({});
  return state2;
}
function attachBundle(primary, bundle, capabilities2, now) {
  const consumerLookback = Math.max(primary.manifest.maxLookback, ...bundle.siblings.map((s) => s.compiled.manifest.maxLookback));
  const storeCapacity = Math.max(1, consumerLookback + 1);
  const producers = [
    ...bundle.dependencies.map((d) => ({
      producerId: d.localId,
      outputs: (d.compiled.manifest.outputs ?? []).map((o) => ({
        title: o.title
      }))
    })),
    ...bundle.siblings.map((s) => ({
      producerId: s.exportName,
      outputs: (s.compiled.manifest.outputs ?? []).map((o) => ({
        title: o.title
      }))
    }))
  ];
  const store = createDepOutputStore({ producers, capacity: storeCapacity });
  const depRunners = bundle.dependencies.map((entry) => createDepRunner({
    compiled: entry.compiled,
    localId: entry.localId,
    parentCapabilities: capabilities2,
    mainStream: primary.mainStream,
    secondaryStreams: primary.runtimeContext.secondaryStreams,
    depOutputStore: store,
    inputOverrides: entry.inputOverrides ?? Object.freeze({}),
    now
  }));
  const siblingRunners = bundle.siblings.map((entry) => createSiblingRunner({
    compiled: entry.compiled,
    exportName: entry.exportName,
    parentCapabilities: capabilities2,
    mainStream: primary.mainStream,
    secondaryStreams: primary.runtimeContext.secondaryStreams,
    depOutputStore: store,
    inputOverrides: Object.freeze({}),
    now
  }));
  Object.assign(primary, {
    depRunners,
    siblingRunners,
    depOutputStore: store
  });
  primary.runtimeContext.depOutputStore = store;
  installDepOutputGlobal();
}
function createScriptRunner(args) {
  const primary = primaryOf(args.compiled);
  const state2 = buildPrimaryState(args, primary);
  if (isCompiledScriptBundle(args.compiled)) {
    attachBundle(state2, args.compiled, args.capabilities, state2.now);
  }
  return Object.freeze({
    async onHistory(bars) {
      await onHistory(state2, bars);
    },
    async onBarClose(bar) {
      await onBarClose(state2, bar);
      await maybeSaveStateSnapshot(state2, state2.now(), state2.persistenceIntervalMs);
    },
    async onBarTick(bar) {
      await onBarTick(state2, bar);
    },
    async push(event) {
      if (event.streamKey === void 0) {
        await pushMainEvent(state2, event);
        return;
      }
      pushSecondaryEvent(state2, event.streamKey, event);
    },
    async warmStart(currentMainBarTime) {
      const store = state2.runtimeContext.persistentStateStore;
      if (store === void 0)
        return;
      const snap = await store.load();
      if (snap === null)
        return;
      if (!validateSnapshot(snap))
        return;
      if (snap.lastBarTime >= currentMainBarTime) {
        pushDiagnostic(state2.emissions, {
          kind: "diagnostic",
          severity: "warning",
          code: "state-snapshot-future-dated",
          message: "persistent state snapshot is ahead of the current bar cursor",
          slotId: null,
          bar: state2.barIndex
        });
        try {
          await store.clear();
        } catch (err) {
          pushDiagnostic(state2.emissions, {
            kind: "diagnostic",
            severity: "warning",
            code: "state-snapshot-save-failed",
            message: err instanceof Error ? err.message : String(err),
            slotId: null,
            bar: state2.barIndex
          });
        }
        return;
      }
      restoreStateSnapshot(state2, snap);
      state2.runtimeContext.lastPersistTime = snap.savedAt;
      pushDiagnostic(state2.emissions, {
        kind: "diagnostic",
        severity: "info",
        code: "state-snapshot-restored",
        message: `persistent state snapshot restored through bar ${snap.lastBarTime}`,
        slotId: null,
        bar: state2.barIndex
      });
    },
    drain() {
      return drain(state2);
    },
    setPlotOverrides(next) {
      state2.runtimeContext.plotOverrides = Object.freeze({ ...next });
    },
    async dispose() {
      const finalSave = saveStateSnapshot(state2, state2.now());
      dispose(state2);
      await finalSave;
    }
  });
}

// src/moduleSourceToScript.ts
var EXPORT_DEFAULT_RE = /^\s*export\s+default\s+/m;
var EXPORT_DEFAULT_GLOBAL_RE = /^\s*export\s+default\s+/gm;
var EXPORT_RENAMED_DEFAULT_RE = /^\s*export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*,?\s*\}\s*;?/m;
var EXPORT_RENAMED_DEFAULT_GLOBAL_RE = /^\s*export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*,?\s*\}\s*;?/gm;
var EXPORT_MANIFEST_RE = /^\s*export\s+const\s+__manifest\s*=/m;
var EXPORT_DEPENDENCIES_RE = /^\s*export\s+const\s+__dependencies\s*=/m;
var EXPORT_NAMED_CONST_GLOBAL_RE = /^(\s*)export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm;
function moduleSourceToScript(source) {
  const literalCount = (source.match(EXPORT_DEFAULT_GLOBAL_RE) ?? []).length;
  const renamedCount = (source.match(EXPORT_RENAMED_DEFAULT_GLOBAL_RE) ?? []).length;
  const total = literalCount + renamedCount;
  if (total === 0) {
    throw new Error("compiled module did not declare an export default");
  }
  if (total > 1) {
    throw new Error("compiled module declared multiple export default statements");
  }
  let out = source;
  if (literalCount === 1) {
    out = out.replace(EXPORT_DEFAULT_RE, "globalThis.__chartlang_compiled_default = ");
  } else {
    out = out.replace(
      EXPORT_RENAMED_DEFAULT_RE,
      (_match, ident) => `globalThis.__chartlang_compiled_default = ${ident};`
    );
  }
  out = out.replace(EXPORT_MANIFEST_RE, "globalThis.__chartlang_compiled_manifest =");
  out = out.replace(EXPORT_DEPENDENCIES_RE, "globalThis.__chartlang_compiled_dependencies =");
  out = out.replace(EXPORT_NAMED_CONST_GLOBAL_RE, (_match, leading, name) => {
    const key = JSON.stringify(name);
    return `${leading}(globalThis.__chartlang_compiled_named = globalThis.__chartlang_compiled_named || {})[${key}] =`;
  });
  return out;
}

// src/dispatcherCore.ts
function reply(frame2) {
  return JSON.stringify(frame2);
}
function message(err) {
  return err instanceof Error ? err.message : String(err);
}
function isSingleManifest(manifest) {
  return manifest !== void 0 && !Array.isArray(manifest);
}
function reviveSet(value) {
  if (Array.isArray(value)) {
    return new Set(value);
  }
  return /* @__PURE__ */ new Set();
}
function reviveCapabilities(value) {
  return {
    ...value,
    plots: reviveSet(value.plots),
    drawings: reviveSet(value.drawings),
    alerts: reviveSet(value.alerts),
    inputs: reviveSet(value.inputs),
    symInfoFields: reviveSet(value.symInfoFields)
  };
}
function createDispatcher(deps) {
  let runner = null;
  function loadCompiled(source) {
    deps.setCompiledDefault(void 0);
    deps.setCompiledNamed?.(void 0);
    deps.setCompiledDependencies?.(void 0);
    deps.setCompiledManifest?.(void 0);
    deps.loadEval(
      `((Function, eval) => {
${moduleSourceToScript(source)}
})(undefined, undefined);`
    );
    const compiledDefault = deps.getCompiledDefault();
    if (compiledDefault === void 0) {
      throw new Error("compiled module did not set a default export");
    }
    const manifest = deps.getCompiledManifest?.();
    const dependencies = deps.getCompiledDependencies?.() ?? [];
    const isBundle = Array.isArray(manifest) || dependencies.length > 0;
    if (!isBundle) {
      if (isSingleManifest(manifest)) {
        return Object.freeze({ ...compiledDefault, manifest });
      }
      return compiledDefault;
    }
    const named = deps.getCompiledNamed?.() ?? {};
    const siblings = [];
    if (Array.isArray(manifest)) {
      for (let i = 1; i < manifest.length; i += 1) {
        const entry = manifest[i];
        const exportName = entry.exportName;
        if (exportName === void 0 || exportName === "default") continue;
        const sibling = named[exportName];
        if (sibling === void 0) continue;
        siblings.push(Object.freeze({ exportName, compiled: sibling }));
      }
    }
    return Object.freeze({
      primary: compiledDefault,
      siblings: Object.freeze(siblings),
      dependencies: Object.freeze(
        dependencies.map(
          (d) => Object.freeze({
            localId: d.localId,
            compiled: d.compiled,
            ...d.inputOverrides === void 0 ? {} : { inputOverrides: d.inputOverrides }
          })
        )
      )
    });
  }
  async function load(json) {
    try {
      const frame2 = JSON.parse(json);
      const compiled = loadCompiled(frame2.compiled.moduleSource);
      runner = deps.runnerFactory({
        compiled,
        capabilities: reviveCapabilities(frame2.capabilities),
        ...frame2.symInfo === void 0 ? {} : { symInfo: frame2.symInfo },
        ...frame2.inputOverrides === void 0 ? {} : { inputOverrides: frame2.inputOverrides },
        ...frame2.plotOverrides === void 0 ? {} : { plotOverrides: frame2.plotOverrides }
      });
      return reply({ kind: "loaded" });
    } catch (err) {
      return reply({ kind: "loadError", message: message(err) });
    }
  }
  async function push(json) {
    try {
      if (runner === null) {
        throw new Error("candleEvent before load");
      }
      const frame2 = JSON.parse(json);
      await runner.push(frame2.event);
      return reply({ kind: "ack" });
    } catch (err) {
      return reply({ kind: "fatal", message: message(err) });
    }
  }
  function setPlotOverrides(json) {
    try {
      if (runner === null) {
        throw new Error("setPlotOverrides before load");
      }
      const frame2 = JSON.parse(json);
      runner.setPlotOverrides(frame2.overrides);
      return reply({ kind: "ack" });
    } catch (err) {
      return reply({ kind: "fatal", message: message(err) });
    }
  }
  function drain2(json) {
    try {
      if (runner === null) {
        throw new Error("drain before load");
      }
      const frame2 = JSON.parse(json);
      const emissions = runner.drain();
      return reply({ kind: "emissions", nonce: frame2.nonce, emissions });
    } catch (err) {
      return reply({ kind: "fatal", message: message(err) });
    }
  }
  function dispose2() {
    try {
      void runner?.dispose();
      runner = null;
      deps.setCompiledDefault(void 0);
      deps.setCompiledNamed?.(void 0);
      deps.setCompiledDependencies?.(void 0);
      deps.setCompiledManifest?.(void 0);
      return reply({ kind: "ack" });
    } catch (err) {
      return reply({ kind: "fatal", message: message(err) });
    }
  }
  return Object.freeze({ load, push, setPlotOverrides, drain: drain2, dispose: dispose2 });
}

// src/dispatcher.ts
var loadEval = globalThis.eval;
function hardenGuestGlobals() {
  Reflect.set(globalThis, "eval", void 0);
  Reflect.set(globalThis, "Function", void 0);
  Reflect.deleteProperty(globalThis, "eval");
  Reflect.deleteProperty(globalThis, "Function");
}
hardenGuestGlobals();
var handlers = createDispatcher({
  loadEval,
  runnerFactory: createScriptRunner,
  getCompiledDefault: () => globalThis.__chartlang_compiled_default,
  setCompiledDefault: (value) => {
    globalThis.__chartlang_compiled_default = value;
  },
  getCompiledNamed: () => globalThis.__chartlang_compiled_named,
  setCompiledNamed: (value) => {
    globalThis.__chartlang_compiled_named = value;
  },
  getCompiledDependencies: () => globalThis.__chartlang_compiled_dependencies,
  setCompiledDependencies: (value) => {
    globalThis.__chartlang_compiled_dependencies = value;
  },
  getCompiledManifest: () => globalThis.__chartlang_compiled_manifest,
  setCompiledManifest: (value) => {
    globalThis.__chartlang_compiled_manifest = value;
  }
});
globalThis.__chartlang_load = handlers.load;
globalThis.__chartlang_push = handlers.push;
globalThis.__chartlang_setPlotOverrides = handlers.setPlotOverrides;
globalThis.__chartlang_drain = handlers.drain;
globalThis.__chartlang_dispose = handlers.dispose;
