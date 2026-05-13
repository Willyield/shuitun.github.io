import { getRecordById, loadTrips, sanitizeTrip, saveTrips } from "./travel.js";

export const COLLAB_KEY = "travel_collab";
export const SELF_NICKNAME_KEY = "travel_self_nickname";
export const COLLAB_ONLINE_WINDOW_MS = 15000;
export const COLLAB_POLL_INTERVAL_MS = 5000;

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_HOST_NICKNAME = "行程发起人";

export function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

function normalizeNickname(name) {
  return String(name || "").trim().slice(0, 16);
}

function channelName(roomCode) {
  return `travel_collab_${normalizeRoomCode(roomCode)}`;
}

export function generateRoomCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function getSelfNickname() {
  return localStorage.getItem(SELF_NICKNAME_KEY) || "";
}

export function setSelfNickname(name) {
  const nickname = normalizeNickname(name);
  if (nickname) localStorage.setItem(SELF_NICKNAME_KEY, nickname);
  return nickname;
}

export function loadCollabRooms() {
  try {
    const raw = localStorage.getItem(COLLAB_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCollabRooms(rooms) {
  localStorage.setItem(COLLAB_KEY, JSON.stringify(rooms && typeof rooms === "object" ? rooms : {}));
}

export function getCollabRoom(roomCode) {
  return loadCollabRooms()[normalizeRoomCode(roomCode)] || null;
}

export function findRoomCodeByTripId(tripId) {
  const rooms = loadCollabRooms();
  for (const [code, room] of Object.entries(rooms)) {
    if (String(room?.tripId) === String(tripId)) return code;
  }
  return null;
}

export function createCollabRoom(trip, hostNickname) {
  const cleanTrip = sanitizeTrip(trip);
  const rooms = loadCollabRooms();
  let roomCode = generateRoomCode();
  while (rooms[roomCode]) roomCode = generateRoomCode();

  const now = new Date().toISOString();
  const nickname = setSelfNickname(hostNickname) || DEFAULT_HOST_NICKNAME;
  rooms[roomCode] = {
    tripId: cleanTrip.id,
    hostNickname: nickname,
    createdAt: now,
    members: [{ nickname, joinedAt: now, lastSeen: now, isHost: true }],
    version: 1,
    data: cleanTrip
  };
  saveCollabRooms(rooms);
  return roomCode;
}

function upsertLocalTrip(trip) {
  const cleanTrip = sanitizeTrip(trip);
  const trips = loadTrips();
  const index = trips.findIndex((item) => String(item.id) === String(cleanTrip.id));
  if (index >= 0) {
    trips[index] = cleanTrip;
  } else {
    trips.unshift(cleanTrip);
  }
  saveTrips(trips);
  return cleanTrip;
}

export function joinCollabRoom(roomCode, nickname) {
  const code = normalizeRoomCode(roomCode);
  const name = setSelfNickname(nickname);
  const rooms = loadCollabRooms();
  const room = rooms[code];
  if (!room || !name) return null;

  const now = new Date().toISOString();
  room.members = Array.isArray(room.members) ? room.members : [];
  const existing = room.members.find((member) => member.nickname === name);

  if (existing) {
    existing.lastSeen = now;
  } else {
    room.members.push({ nickname: name, joinedAt: now, lastSeen: now, isHost: false });
  }

  if (room.data) {
    const cleanTrip = upsertLocalTrip(room.data);
    room.tripId = cleanTrip.id;
  }
  rooms[code] = room;
  saveCollabRooms(rooms);
  return room;
}

export function heartbeatCollabRoom(roomCode, nickname) {
  const code = normalizeRoomCode(roomCode);
  const name = normalizeNickname(nickname);
  if (!code || !name) return null;

  const rooms = loadCollabRooms();
  const room = rooms[code];
  if (!room) return null;

  const now = new Date().toISOString();
  room.members = Array.isArray(room.members) ? room.members : [];
  const member = room.members.find((item) => item.nickname === name);
  if (member) {
    member.lastSeen = now;
  } else {
    room.members.push({ nickname: name, joinedAt: now, lastSeen: now, isHost: false });
  }
  rooms[code] = room;
  saveCollabRooms(rooms);
  return room;
}

export function getOnlineMembers(roomCode) {
  const room = getCollabRoom(roomCode);
  if (!room) return [];
  const threshold = Date.now() - COLLAB_ONLINE_WINDOW_MS;
  return (Array.isArray(room.members) ? room.members : [])
    .filter((member) => {
      const lastSeen = member.lastSeen ? new Date(member.lastSeen).getTime() : 0;
      return Number.isFinite(lastSeen) && lastSeen >= threshold;
    })
    .sort((left, right) => Number(Boolean(right.isHost)) - Number(Boolean(left.isHost)));
}

export function syncLocalTripFromRoom(roomCode) {
  const room = getCollabRoom(roomCode);
  if (!room?.data) return null;
  return upsertLocalTrip(room.data);
}

export function pushTripToCollabRoom(roomCode, trip) {
  const code = normalizeRoomCode(roomCode);
  const rooms = loadCollabRooms();
  const room = rooms[code];
  if (!room || !trip) return null;

  room.data = sanitizeTrip(trip);
  room.tripId = room.data.id;
  room.version = (Number(room.version) || 0) + 1;
  rooms[code] = room;
  saveCollabRooms(rooms);
  notifyCollabRoomUpdate(code, room.version);
  return room;
}

export function syncTripToExistingCollabRoom(tripId) {
  const roomCode = findRoomCodeByTripId(tripId);
  if (!roomCode) return null;
  const trip = getRecordById(tripId);
  return trip ? pushTripToCollabRoom(roomCode, trip) : null;
}

export function createCollabChannel(roomCode, onUpdate) {
  const code = normalizeRoomCode(roomCode);
  if (!code || typeof BroadcastChannel === "undefined") return null;
  try {
    const channel = new BroadcastChannel(channelName(code));
    channel.onmessage = (event) => {
      if (event.data?.type === "trip_update" && normalizeRoomCode(event.data.roomCode) === code) {
        onUpdate?.(event.data);
      }
    };
    return channel;
  } catch {
    return null;
  }
}

export function notifyCollabRoomUpdate(roomCode, version) {
  const code = normalizeRoomCode(roomCode);
  if (!code || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(channelName(code));
    channel.postMessage({ type: "trip_update", roomCode: code, version });
    channel.close();
  } catch {
    // BroadcastChannel is an optimization; polling still keeps tabs in sync.
  }
}

export const localCollabProvider = {
  normalizeRoomCode,
  generateRoomCode,
  getSelfNickname,
  setSelfNickname,
  loadRooms: loadCollabRooms,
  saveRooms: saveCollabRooms,
  getRoom: getCollabRoom,
  findRoomCodeByTripId,
  createRoom: createCollabRoom,
  joinRoom: joinCollabRoom,
  heartbeat: heartbeatCollabRoom,
  getOnlineMembers,
  syncLocalTripFromRoom,
  pushTripToRoom: pushTripToCollabRoom,
  syncTripToExistingRoom: syncTripToExistingCollabRoom,
  createChannel: createCollabChannel,
  notifyRoomUpdate: notifyCollabRoomUpdate
};
