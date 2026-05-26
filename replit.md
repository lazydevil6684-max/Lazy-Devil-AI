# Lazy Devil Terminal

A mobile pen testing terminal for Android & iOS. Matrix rain background, black/red branding, AI-powered hacking assistant, file system explorer, and simulated Kali Linux security tools.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/lazy-devil run dev` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm install` — install all workspace dependencies

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Replit OpenAI integration
- Mobile: Expo (React Native) with expo-router
- AI: Replit-managed OpenAI proxy (free, no key needed) + Groq/OpenRouter support
- File system: expo-file-system

## Where things live

- `artifacts/lazy-devil/` — Expo mobile app
- `artifacts/lazy-devil/components/` — Terminal, AI, Files, Tools, MatrixRain, NavBar
- `artifacts/lazy-devil/context/AppContext.tsx` — app-wide state (screen, terminal history, AI messages, model selection)
- `artifacts/api-server/src/routes/ai.ts` — AI chat proxy endpoint
- `lib/integrations-openai-ai-server/` — Replit OpenAI integration package

## Architecture decisions

- No tabs/header: single `app/index.tsx` with internal navigation state for full UI control
- Matrix rain renders behind a semi-transparent content overlay (rgba black)
- "LazyDevil AI" model uses backend proxy (no user API key needed); Groq/OpenRouter models call external APIs directly from the device
- All AI history, model selection, and API keys persist in AsyncStorage
- Security tools (nmap, hydra, sqlmap, etc.) produce realistic simulated output for educational/CTF use

## Product

- Terminal with Matrix rain background, root@lazy-devil prompt, 15+ built-in commands
- AI Chat with 6 model options including a built-in free model powered by Replit
- File system explorer with real device file access, search, and file viewer
- 8 Kali-style security tools (nmap, hydra, sqlmap, hashcat, metasploit, aircrack, nikto, gobuster)
- Black/red "Lazy Devil" brand throughout

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- expo-file-system version warning on launch — safe to ignore, app functions correctly
- AI route on backend uses `zod` from api-server's peer deps; avoid importing `zod/v4` directly in api-server routes
- Matrix rain uses interval-based state updates — don't increase tick rate below 70ms (performance)
