# Gravity Rift Arena

Gravity Rift Arena is a browser-first multiplayer gravity combat prototype inspired by classic gravity dueling games. This workspace is structured as a small monorepo with a React + PixiJS client, a Node/WebSocket signaling server, and a shared deterministic simulation package.

## Packages

- `packages/client`: desktop web client, lobby UI, input handling, WebRTC/WebSocket networking glue, and PixiJS rendering
- `packages/shared`: deterministic simulation, level schema, maps, and protocol types
- `packages/signal-server`: room signaling service for lobby creation, join, and matchmaking metadata

## Intended commands

```bash
npm install
npm run dev:server
npm run dev
npm test
```

## Current limitations

- Host-authoritative simulation runs in the host browser; dedicated server play is intentionally deferred.
- WebRTC signaling is scaffolded behind a stable message protocol, but the client currently falls back to direct WebSocket room sync unless peer channels are wired into deployment ICE config.
- Audio, bots, persistence, and host migration are left as future milestones.
