# pixel-claw

Visualize OpenClaw agent sessions as interactive pixel art characters in a multi-room virtual office. Walk around, watch agents work in real time, and interact with them to view status, chat, or control sessions.

## Features

- **Real-time agent visualization** — OpenClaw sessions appear as pixel art characters that type, read, walk, and idle based on actual agent activity
- **Multi-room world** — Main Hall, Slack Room, Discord Room with doorway transitions; agents auto-routed to rooms by channel origin
- **Player character** — Walk around with WASD, interact with agents via proximity
- **Interaction panel** — Status tab (session details), Chat tab (prompt/response), Actions tab (abort/reset)
- **Agent monitoring system** — Real-time dashboard (press M) showing gateway status, channel connectivity, session list with token usage, and live activity feed from `gateway.log`
- **Bubble animations** — Thinking/working bubbles on agents when active, done bubble on completion
- **Wardrobe** — Customize player appearance with palette and hue shift
- **Matrix effects** — Spawn/despawn animations for agents joining and leaving
- **Canvas 2D rendering** — Pixel-perfect sprite rendering with z-sorting, camera following, and zoom
- **WebSocket real-time sync** — Backend watches OpenClaw session files and pushes updates to browser
- **Gateway integration** — Connects to OpenClaw Gateway for sending prompts, aborting, and resetting sessions
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

# Copy and configure environment
cp .env.example .env

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
| `OPENCLAW_GATEWAY_URL` | `ws://localhost:18789` | OpenClaw Gateway WebSocket URL |
| `OPENCLAW_GATEWAY_TOKEN` | _(auto-read)_ | Gateway auth token; auto-read from `openclaw.json` if unset |
| `PORT` | `3000` | Server port |
| `POLL_INTERVAL` | `500` | Session metadata poll interval (ms) |

## Controls

| Key | Action |
|---|---|
| WASD / Arrow Keys | Move player character |
| E / Space | Interact with nearby agent |
| Escape | Close interaction panel |
| M | Toggle monitoring overlay |
| ? | Show help overlay |

## Architecture

```
pixel-claw/
├── src/                        # Backend (Node.js + Fastify)
│   ├── main.ts                 # Entry point, wires all services
│   ├── config.ts               # Environment variable configuration
│   ├── openclaw/               # OpenClaw integration
│   │   ├── sessionParser.ts        # JSONL transcript parser
│   │   ├── sessionWatcher.ts       # File watcher with chokidar
│   │   ├── channelRegistry.ts      # Channel config reader
│   │   ├── gatewayClient.ts        # Gateway WebSocket client
│   │   ├── gatewayLogReader.ts     # Gateway log file reader/tailer
│   │   └── types.ts                # Shared type definitions
│   ├── server/
│   │   ├── fastify.ts              # HTTP + WebSocket server
│   │   └── websocket.ts           # WebSocket message handler
│   └── services/
│       └── sessionManager.ts       # Orchestrates backend components
├── client/                     # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx                 # Main app with game loop
│   │   ├── hooks/                  # React hooks
│   │   │   ├── useWebSocket.ts         # Backend communication
│   │   │   ├── useWorld.ts             # WorldState bridge
│   │   │   └── useGameInput.ts         # Keyboard input
│   │   ├── world/                  # Rendering engine
│   │   │   ├── engine/                 # Game loop, characters, renderer
│   │   │   ├── sprites/                # Sprite data, cache, loader
│   │   │   └── layout/                 # Tile map, pathfinding, furniture
│   │   ├── interaction/            # Agent interaction UI
│   │   │   ├── InteractionPanel.tsx
│   │   │   ├── StatusTab.tsx
│   │   │   ├── ChatTab.tsx
│   │   │   └── ActionsTab.tsx
│   │   ├── ui/                     # Overlays and HUD
│   │   │   ├── MonitorOverlay.tsx      # Agent monitoring dashboard
│   │   │   ├── MonitorButton.tsx       # Toggle button for monitoring
│   │   │   ├── RoomIndicator.tsx       # Current room display
│   │   │   └── HelpOverlay.tsx         # Help screen
│   │   └── components/
│   │       └── RoomSelector.tsx        # Room navigation widget
│   └── public/sprites/         # Character and wall PNG assets
├── tests/                      # Test suite (Vitest)
│   ├── unit/                       # Unit tests
│   └── integration/                # WebSocket integration tests
├── Dockerfile                  # Multi-stage production build
└── docker-compose.yml          # Docker Compose config
```

### Data Flow

1. Backend watches `~/.openclaw/agents/main/sessions/` for JSONL file changes
2. Session parser extracts status, tools, labels from transcripts
3. SessionManager enriches data and maps sessions to rooms based on channel origin
4. GatewayClient connects to OpenClaw Gateway for prompt/abort/reset operations
5. GatewayLogReader tails `gateway.log` for real-time activity feed
6. Fastify WebSocket broadcasts real-time updates to connected browsers
7. Frontend `useWebSocket` receives events and updates React state
8. `useWorld` bridges session data to `WorldState` (spawns/removes characters)
9. Game loop updates character animations and renders via Canvas 2D

## Testing

```bash
npm test          # Watch mode
npm run test:run  # Single run (131 tests)
```

## Acknowledgements

The rendering engine and sprite system in `client/src/world/` is derived from [pixel-agents](https://github.com/pablodelucca/pixel-agents) by Pablo De Lucca (MIT License). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

## License

[MIT](LICENSE)
