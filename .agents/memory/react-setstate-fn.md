---
name: React useState function setter quirk
description: How to store a function in useState without React calling it as an updater
---

**The problem:** `useState<((cmd: string) => void) | null>(null)`
Calling `setState(myFunction)` makes React call `myFunction(prevState)` and use the return value as new state.

**The fix:** Wrap in a thunk so React calls the outer lambda and gets the inner function as the new state:
```typescript
setState(() => (cmd: string) => { /* ... */ });
// Clearing: setState(null) — this is fine, null is not a function
```

**Where this matters:** Any `useState` holding a function type, e.g. callback refs stored in context.
