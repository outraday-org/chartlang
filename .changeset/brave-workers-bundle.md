---
"@invinite-org/chartlang-host-worker": patch
---

Republish the browser worker boot artifact with the Pine-compatible EMA runtime
bundled into it. The worker bundle snapshots runtime behavior at publish time,
so the runtime release must also republish host-worker to prevent browser
workers from retaining the previous EMA recurrence.
