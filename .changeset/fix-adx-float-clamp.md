---
"@invinite-org/chartlang-runtime": patch
---

Clamp `adxFromDi` outputs to [0, 100]: the Wilder seed mean and recurrence could overshoot 100 by a few ulps of floating-point error.
