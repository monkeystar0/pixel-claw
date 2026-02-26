# pixel-claw

Visualize OpenClaw agent sessions as interactive pixel art characters in a multi-room virtual office. Walk around, watch agents work in real time, and interact with them to view status, chat, or control sessions.

## Features

- **Real-time agent visualization** — OpenClaw sessions appear as pixel art characters that type, read, walk, and idle based on actual agent activity
- **Multi-room world** — Main Hall, Slack Room, Discord Room with doorway transitions
- **Player character** — Walk around with WASD, interact with agents via proximity
- **Interaction panel** — Status tab (session details), Chat tab (prompt/response), Actions tab (abort)
- **Wardrobe** — Customize player appearance with palette and hue shift
- **Matrix effects** — Spawn/despawn animations for agents joining and leaving
- **Canvas 2D rendering** — Pixel-perfect sprite rendering with z-sorting, camera following, and zoom
- **WebSocket real-time sync** — Backend watches OpenClaw session files and pushes updates to browser
- **Docker support** — Multi-stage build for production deployment

## Quick Start

### Prerequisites

- Node.js 22+
- OpenClaw installed with active sessions (`~/.openclaw`)

### Development

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Start backend dev server
npm run dev

# In a separate terminal, start frontend dev server
cd client && npm run dev
```

The frontend dev server proxies WebSocket connections to the backend at `localhost:3000`.

### Docker

```bash
docker-compose up --build
```

Visit `http://localhost:3000`.

## Configuration

All configuration via environment variables. See `.env.example` for defaults.

| Variable | Default | Description |
|---|---|---|
| `OPENCLAW_DIR` | `~/.openclaw` | Path to OpenClaw data directory |
| `OPENCLAW_AGENT` | `main` | Agent name to monitor |
| `OPENCLAW_GATEWAY_URL` | `ws://localhost:3578` | OpenClaw Gateway WebSocket URL |
| `PORT` | `3000` | Server port |
| `POLL_INTERVAL` | `500` | Session metadata poll interval (ms) |

## Controls

| Key | Action |
|---|---|
| WASD / Arrow Keys | Move player character |
| E / Space | Interact with nearby agent or furniture |
| Escape | Close interaction panel |
| ? | Show help overlay |

## Architecture

```
pixel-claw/
├── src/                    # Backend (Node.js + Fastify)
│   ├── main.ts             # Entry point, wires all services
│   ├── config.ts           # Environment variable configuration
│   ├── openclaw/           # OpenClaw integration
│   │   ├── sessionParser.ts    # JSONL transcript parser
│   │   ├── sessionWatcher.ts   # File watcher with chokidar
│   │   ├── channelRegistry.ts  # Channel config reader
│   │   └── gatewayClient.ts    # Gateway WebSocket client
│   └── services/
│       └── sessionManager.ts   # Orchestrates backend components
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx             # Main app with game loop
│   │   ├── hooks/              # React hooks
│   │   │   ├── useWebSocket.ts     # Backend communication
│   │   │   ├── useWorld.ts         # WorldState bridge
│   │   │   └── useGameInput.ts     # Keyboard input
│   │   ├── world/              # Rendering engine (from pixel-agents)
│   │   │   ├── engine/             # Game loop, characters, renderer
│   │   │   ├── sprites/            # Sprite data, cache, loader
│   │   │   ├── layout/             # Tile map, pathfinding, furniture
│   │   │   └── editor/             # Layout editor state + actions
│   │   ├── interaction/        # Agent interaction UI
│   │   │   ├── InteractionPanel.tsx
│   │   │   ├── StatusTab.tsx
│   │   │   ├── ChatTab.tsx
│   │   │   ├── ActionsTab.tsx
│   │   │   └── WardrobePanel.tsx
│   │   ├── components/         # Shared UI components
│   │   └── ui/                 # Chrome overlays
│   └── public/sprites/     # Character and wall PNG assets
├── tests/                  # Test suite (Vitest)
├── Dockerfile              # Multi-stage production build
└── docker-compose.yml      # Docker Compose config
```

### Data Flow

1. Backend watches `~/.openclaw/agents/main/sessions/` for JSONL file changes
2. Session parser extracts status, tools, labels from transcripts
3. SessionManager enriches data and maps sessions to rooms based on channel origin
4. Fastify WebSocket broadcasts real-time updates to connected browsers
5. Frontend `useWebSocket` receives events and updates React state
6. `useWorld` bridges session data to `WorldState` (spawns/removes characters)
7. Game loop updates character animations and renders via Canvas 2D

## Testing

```bash
npm test          # Watch mode
npm run test:run  # Single run (107 tests)
```

## License

ISC
