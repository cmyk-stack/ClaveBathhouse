import { WebSocketServer } from "ws";

const DEFAULT_ROOM_CONFIG = {
  mapId: "binary-ridge",
  maxPlayers: 4,
  winCondition: "time",
  timeLimit: 180,
  stockCount: 5,
  friendlyFire: true,
  seed: 1337
};

const wss = new WebSocketServer({ port: Number(process.env.PORT ?? 8787) });
const peers = new Map();
const rooms = new Map();

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

function buildRoomState(room) {
  return {
    type: "room-state",
    roomCode: room.code,
    peers: Array.from(room.peers.values()).map((peer) => ({
      id: peer.id,
      name: peer.name,
      ready: peer.ready,
      isHost: room.hostId === peer.id
    })),
    config: room.config,
    hostId: room.hostId,
    matchPhase: room.matchPhase
  };
}

function broadcast(room, message) {
  for (const peer of room.peers.values()) {
    send(peer.socket, message);
  }
}

function ensureRoom(code) {
  const roomCode = code && rooms.has(code) ? code : randomRoomCode();
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      code: roomCode,
      config: { ...DEFAULT_ROOM_CONFIG },
      peers: new Map(),
      hostId: "",
      matchPhase: "lobby"
    });
  }
  return rooms.get(roomCode);
}

function attachPeerToRoom(peer, room) {
  peer.roomCode = room.code;
  room.peers.set(peer.id, peer);
  if (!room.hostId) {
    room.hostId = peer.id;
  }
  broadcast(room, buildRoomState(room));
}

function detachPeer(peer) {
  if (!peer.roomCode) {
    return;
  }

  const room = rooms.get(peer.roomCode);
  if (!room) {
    return;
  }

  room.peers.delete(peer.id);
  broadcast(room, { type: "disconnect", peerId: peer.id, reason: "left-room" });

  if (room.hostId === peer.id) {
    const nextHost = room.peers.values().next().value;
    if (room.matchPhase === "playing") {
      broadcast(room, { type: "host-migrate", nextHostId: null, supported: false });
      room.matchPhase = "lobby";
    }
    room.hostId = nextHost?.id ?? "";
  }

  if (room.peers.size === 0) {
    rooms.delete(room.code);
    return;
  }

  broadcast(room, buildRoomState(room));
}

wss.on("connection", (socket) => {
  const peer = {
    id: randomId("peer"),
    name: "Pilot",
    socket,
    roomCode: null,
    ready: false
  };
  peers.set(peer.id, peer);

  send(socket, { type: "error", message: `connected:${peer.id}` });

  socket.on("message", (buffer) => {
    let message;
    try {
      message = JSON.parse(buffer.toString());
    } catch {
      send(socket, { type: "error", message: "Invalid JSON payload." });
      return;
    }

    if (message.type === "create-room") {
      const room = ensureRoom();
      room.config = { ...room.config, ...(message.config ?? {}) };
      peer.name = message.name;
      attachPeerToRoom(peer, room);
      return;
    }

    if (message.type === "join-room") {
      const room = rooms.get(message.roomCode);
      if (!room) {
        send(socket, { type: "error", message: `Room ${message.roomCode} not found.` });
        return;
      }
      if (room.matchPhase === "playing") {
        send(socket, { type: "error", message: "Match already in progress." });
        return;
      }
      peer.name = message.name;
      attachPeerToRoom(peer, room);
      return;
    }

    if (!peer.roomCode) {
      send(socket, { type: "error", message: "Join a room first." });
      return;
    }

    const room = rooms.get(peer.roomCode);
    if (!room) {
      send(socket, { type: "error", message: "Room not found." });
      return;
    }

    switch (message.type) {
      case "peer-ready":
        peer.ready = message.ready;
        broadcast(room, buildRoomState(room));
        break;
      case "start-match":
        if (room.hostId !== peer.id) {
          send(socket, { type: "error", message: "Only the host can start the match." });
          return;
        }
        room.matchPhase = "countdown";
        broadcast(room, buildRoomState(room));
        broadcast(room, { type: "start-match" });
        room.matchPhase = "playing";
        broadcast(room, buildRoomState(room));
        break;
      case "pause":
        room.matchPhase = message.paused ? "paused" : "playing";
        broadcast(room, message);
        broadcast(room, buildRoomState(room));
        break;
      case "rematch":
        room.matchPhase = "lobby";
        for (const roomPeer of room.peers.values()) {
          roomPeer.ready = false;
        }
        broadcast(room, buildRoomState(room));
        break;
      case "signal":
        if (room.peers.has(message.targetPeerId)) {
          send(room.peers.get(message.targetPeerId).socket, {
            type: "signal",
            fromPeerId: peer.id,
            targetPeerId: message.targetPeerId,
            payload: message.payload
          });
        }
        break;
      default:
        broadcast(room, message);
        break;
    }
  });

  socket.on("close", () => {
    detachPeer(peer);
    peers.delete(peer.id);
  });
});

console.log("Gravity signaling server running on ws://localhost:8787");
