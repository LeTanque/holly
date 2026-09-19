# Holly

Local ACT therapy companion — Cursor-style chat UI with long-term memory across sessions.

## Setup

```bash
cp .env.example .env
# Add LLM_API_KEY (OpenAI or any OpenAI-compatible API)
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs on port 3001.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite + API |
| `npm run build` | Production client build |
| `npm run lint` | ESLint |
| `npm run server` | API only |

See [AGENTS.md](AGENTS.md) for architecture and Holly’s ACT prompt.
