# MTF Trend Filter Audit

- Pine source shape: daily trend filter plus lower-timeframe confirmation.
- chartlang port: `request.security({ interval: "1D" })` and `request.lowerTf({ interval: "30s" })`.
- Trace: HTF scalar series remains aligned; LTF bars are bucket arrays.
- Gap: LTF interval must be strictly lower and compile-time literal.

