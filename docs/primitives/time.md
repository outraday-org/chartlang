# `time`

> **Stability:** stable
> **Since:** 1.5

## Signature

```ts
time = Object.freeze({
    year(_t: Time, _tz?: string): number {
        return sentinel("time.year");
    },
    month(_t: Time, _tz?: string): number {
        return sentinel("time.month");
    },
    dayofmonth(_t: Time, _tz?: string): number {
        return sentinel("time.dayofmonth");
    },
    dayofweek(_t: Time, _tz?: string): number {
        return sentinel("time.dayofweek");
    },
    hour(_t: Time, _tz?: string): number {
        return sentinel("time.hour");
    },
    minute(_t: Time, _tz?: string): number {
        return sentinel("time.minute");
    },
    second(_t: Time, _tz?: string): number {
        return sentinel("time.second");
    },
    timestamp(_year: number, _month: number, _day: number, _hour?: number, _minute?: number, _second?: number, _tz?: string): Time {
        return sentinel("time.timestamp");
    },
    timeClose(_t: Time, _tz?: string): Time {
        return sentinel("time.timeClose");
    },
})
```

## Example

```ts
const ns: typeof time = time;
    void ns;
```

## See also

- `time.*` accessors — [Time and sessions](/language/time-and-sessions)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/time-accessors/timeAccessors.ts)
