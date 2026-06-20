# `defineIndicator.maxBarsBack`

> **Stability:** stable
> **Since:** 0.4

Max bars of historical lookback the script needs. `0` keeps the
runtime default. Pine `max_bars_back` parity.

## Signature

```ts
maxBarsBack?: number;
```

## Example

```ts
const v: ScriptOverrides["maxBarsBack"] = 100;
    void v;
```

## See also

- `defineIndicator` overrides
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/define/overrides.ts)
