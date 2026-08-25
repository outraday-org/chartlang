---
"@invinite-org/chartlang-host-quickjs": patch
---

Regenerate the QuickJS dispatcher bundle so the guest runtime resolves `time.timeClose` against the host-supplied `Bar.closeTime`. The bundle inlines the built runtime, so this is required for the fix to reach a QuickJS host; the JSON boundary itself needed no change.
