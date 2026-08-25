---
"@invinite-org/chartlang-core": minor
---

Add the optional `Bar.closeTime` — the venue's **actual** absolute close instant for that bar, supplied by the host that knows the session calendar. A `1D` NASDAQ bar bucketed on the UTC day boundary really closes 16:00 America/New_York, and 13:00 on a half day, so `time + interval` was the wrong instant for daily and early-close sessions. Encoding it as an epoch keeps timezone/DST maths out of the deterministic runtime. The field is optional and absent means absent — existing hosts are unaffected.
