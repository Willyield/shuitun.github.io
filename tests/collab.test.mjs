import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  COLLAB_KEY,
  COLLAB_ONLINE_WINDOW_MS,
  SELF_NICKNAME_KEY,
  createCollabChannel,
  createCollabRoom,
  findRoomCodeByTripId,
  generateRoomCode,
  getCollabRoom,
  getOnlineMembers,
  heartbeatCollabRoom,
  joinCollabRoom,
  localCollabProvider,
  normalizeRoomCode,
  pushTripToCollabRoom,
  saveCollabRooms,
  syncLocalTripFromRoom,
  syncTripToExistingCollabRoom
} from "../src/lib/collab.js";
import { STORAGE_KEY, loadTrips, saveTrips } from "../src/lib/travel.js";

const originalBroadcastChannel = globalThis.BroadcastChannel;

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

class FakeBroadcastChannel {
  static messages = [];

  constructor(name) {
    this.name = name;
    this.closed = false;
    this.onmessage = null;
  }

  postMessage(message) {
    FakeBroadcastChannel.messages.push({ name: this.name, message });
  }

  close() {
    this.closed = true;
  }
}

function makeTrip(overrides = {}) {
  return {
    id: "trip-1",
    tripName: "周末露营",
    mode: "shared",
    people: ["阿水", "阿豚"],
    manager: "",
    per: 100,
    totalBudget: 200,
    expenses: [],
    createdAt: "2026-05-13T10:00:00.000Z",
    ...overrides
  };
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.BroadcastChannel = undefined;
  FakeBroadcastChannel.messages = [];
});

afterEach(() => {
  globalThis.BroadcastChannel = originalBroadcastChannel;
  delete globalThis.localStorage;
});

test("generates normalized 6-character room codes", () => {
  for (let index = 0; index < 50; index += 1) {
    assert.match(generateRoomCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  }

  assert.equal(normalizeRoomCode(" ab3k7z "), "AB3K7Z");
});

test("creates a room and binds it to the trip and host", () => {
  const trip = makeTrip();
  const roomCode = createCollabRoom(trip, " 主持人 ");
  const room = getCollabRoom(roomCode);

  assert.match(roomCode, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(room.tripId, trip.id);
  assert.equal(room.hostNickname, "主持人");
  assert.equal(room.members.length, 1);
  assert.equal(room.members[0].isHost, true);
  assert.equal(room.data.tripName, trip.tripName);
  assert.equal(findRoomCodeByTripId(trip.id), roomCode);
  assert.equal(localStorage.getItem(SELF_NICKNAME_KEY), "主持人");
});

test("joins a room, persists the trip locally, and avoids duplicate members", () => {
  const roomCode = createCollabRoom(makeTrip(), "主持人");

  const firstJoin = joinCollabRoom(roomCode.toLowerCase(), "同行者");
  const secondJoin = joinCollabRoom(roomCode, "同行者");
  const room = getCollabRoom(roomCode);

  assert.equal(firstJoin.tripId, "trip-1");
  assert.equal(secondJoin.tripId, "trip-1");
  assert.deepEqual(room.members.map((member) => member.nickname), ["主持人", "同行者"]);
  assert.equal(loadTrips().length, 1);
  assert.equal(loadTrips()[0].id, "trip-1");
  assert.equal(localStorage.getItem(SELF_NICKNAME_KEY), "同行者");
});

test("heartbeat refreshes members and online list only includes recent members", () => {
  const roomCode = createCollabRoom(makeTrip(), "主持人");
  const staleTime = new Date(Date.now() - COLLAB_ONLINE_WINDOW_MS - 1000).toISOString();
  const freshTime = new Date().toISOString();

  saveCollabRooms({
    [roomCode]: {
      ...getCollabRoom(roomCode),
      members: [
        { nickname: "过期成员", joinedAt: staleTime, lastSeen: staleTime, isHost: false },
        { nickname: "在线成员", joinedAt: freshTime, lastSeen: freshTime, isHost: false }
      ]
    }
  });

  heartbeatCollabRoom(roomCode, "新成员");
  const onlineNames = getOnlineMembers(roomCode).map((member) => member.nickname);

  assert.deepEqual(onlineNames.sort(), ["在线成员", "新成员"].sort());
});

test("pushes trip updates to the room and notifies the current room channel", () => {
  globalThis.BroadcastChannel = FakeBroadcastChannel;
  const roomCode = createCollabRoom(makeTrip(), "主持人");
  const updatedTrip = makeTrip({
    expenses: [{
      id: "expense-1",
      amount: 88,
      payer: "阿水",
      participants: ["阿水", "阿豚"],
      note: "午餐",
      time: "2026-05-13T12:00"
    }]
  });

  const updatedRoom = pushTripToCollabRoom(roomCode, updatedTrip);

  assert.equal(updatedRoom.version, 2);
  assert.equal(updatedRoom.data.expenses.length, 1);
  assert.equal(FakeBroadcastChannel.messages.length, 1);
  assert.equal(FakeBroadcastChannel.messages[0].name, `travel_collab_${roomCode}`);
  assert.deepEqual(FakeBroadcastChannel.messages[0].message, {
    type: "trip_update",
    roomCode,
    version: 2
  });
});

test("syncs local trip from a room and pushes local trip changes back to an existing room", () => {
  const roomCode = createCollabRoom(makeTrip(), "主持人");
  localStorage.removeItem(STORAGE_KEY);

  const syncedTrip = syncLocalTripFromRoom(roomCode);
  assert.equal(syncedTrip.id, "trip-1");
  assert.equal(loadTrips().length, 1);

  const changedTrip = makeTrip({ tripName: "改名后的行程" });
  saveTrips([changedTrip]);
  const pushedRoom = syncTripToExistingCollabRoom("trip-1");

  assert.equal(pushedRoom.version, 2);
  assert.equal(getCollabRoom(roomCode).data.tripName, "改名后的行程");
});

test("exposes a local provider surface for a future remote provider", () => {
  assert.equal(typeof localCollabProvider.createRoom, "function");
  assert.equal(typeof localCollabProvider.joinRoom, "function");
  assert.equal(typeof localCollabProvider.pushTripToRoom, "function");
  assert.equal(localCollabProvider.normalizeRoomCode(" myxl5d "), "MYXL5D");
});

test("ignores malformed room storage instead of crashing", () => {
  localStorage.setItem(COLLAB_KEY, "{bad json");

  assert.equal(getCollabRoom("MYXL5D"), null);
  assert.equal(findRoomCodeByTripId("trip-1"), null);
});

test("creates a filtered channel listener for the current room", () => {
  globalThis.BroadcastChannel = FakeBroadcastChannel;
  const updates = [];
  const channel = createCollabChannel("myxl5d", (message) => updates.push(message));

  channel.onmessage({ data: { type: "trip_update", roomCode: "OTHER1", version: 1 } });
  channel.onmessage({ data: { type: "trip_update", roomCode: "MYXL5D", version: 2 } });

  assert.equal(channel.name, "travel_collab_MYXL5D");
  assert.deepEqual(updates, [{ type: "trip_update", roomCode: "MYXL5D", version: 2 }]);
});
