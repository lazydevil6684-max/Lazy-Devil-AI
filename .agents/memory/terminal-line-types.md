---
name: TerminalLine types
description: The TerminalLine type union in AppContext must include every type string used in TerminalScreen rendering
---

**The problem:** Adding new line types (e.g. "agent", "thought") to TerminalScreen without updating the AppContext interface causes TypeScript errors — but more importantly the Expo bundler may silently crash with blank white screen if the type mismatch is severe enough.

**Current type union (AppContext.tsx):**
```typescript
type: "command" | "output" | "error" | "info" | "success" | "agent" | "thought"
```

**"agent"** — purple/violet, used for autonomous agent loop headers/footers
**"thought"** — orange/amber, used for AI reasoning steps between commands

**How to apply:** Any time a new line display category is added to TerminalScreen's TermLine component, add it to the AppContext TerminalLine type union first.
