import assert from "node:assert/strict";
import test from "node:test";

let storedState = JSON.stringify({
  notes: [
    { id: "sample-note-1", isDemo: true },
    { id: "user-note-1", title: "Keep this note" },
  ],
  documents: [{ id: "sample-document-1", isDemo: true }],
  sessions: [
    { id: "sess-1", device: "Sample browser" },
    { id: "user-session-1", device: "My browser" },
  ],
  notifications: [
    { id: "notif-1", title: "Sample notification" },
    { id: "user-notif-1", title: "Keep this notification" },
  ],
  userProfile: {
    name: "Quản trị viên NOTE",
    email: "admin@note.workspace",
    theme: "dark",
  },
});

globalThis.localStorage = {
  getItem: (key) => (key === "note_workspace_v1" ? storedState : null),
  setItem: (key, value) => {
    if (key === "note_workspace_v1") storedState = value;
  },
};

const { getState } = await import("../src/js/modules/note/store.js");

test("removes old demo data and preserves user workspace data", () => {
  const state = getState();

  assert.deepEqual(state.notes, [
    { id: "user-note-1", title: "Keep this note" },
  ]);
  assert.deepEqual(state.documents, []);
  assert.deepEqual(state.sessions, [
    { id: "user-session-1", device: "My browser" },
  ]);
  assert.deepEqual(state.notifications, [
    { id: "user-notif-1", title: "Keep this notification" },
  ]);
  assert.equal(state.userProfile.name, "Người dùng");
  assert.equal(state.userProfile.email, "");
  assert.deepEqual(JSON.parse(storedState).notes, state.notes);
});
