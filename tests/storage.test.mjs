import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadRecords,
  saveRecord,
  importRecords,
  validateRecords,
  STORAGE_KEY,
} from "../lib/storage.mjs";
const demo = JSON.parse(
  readFileSync(new URL("../src/demo.json", import.meta.url)),
);
const store = () => {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
};
test("edits survive reload and archived records remain recoverable", () => {
  const s = store();
  const item = loadRecords(s, demo)[0];
  const saved = saveRecord(
    s,
    { ...item, archived: true, assessmentDeadline: "2027-01-10" },
    demo,
  );
  assert.equal(loadRecords(s, demo)[0].assessmentDeadline, "2027-01-10");
  assert.equal(loadRecords(s, demo)[0].archived, true);
  saveRecord(s, { ...saved, archived: false }, demo);
  assert.equal(loadRecords(s, demo)[0].archived, false);
});
test("stale detail edits cannot overwrite newer records", () => {
  const s = store();
  const item = loadRecords(s, demo)[0];
  saveRecord(s, { ...item, personalNotes: "Newer note" }, demo);
  assert.throws(() => saveRecord(s, item, demo), /another tab/);
});
test("JSON imports merge by ID and preserve unrelated records", () => {
  const s = store();
  const before = loadRecords(s, demo);
  const after = importRecords(
    s,
    JSON.stringify([{ ...before[0], personalNotes: "Restored" }]),
    demo,
  );
  assert.equal(after.length, before.length);
  assert.equal(after[0].personalNotes, "Restored");
});
test("invalid imports leave saved data unchanged", () => {
  const s = store();
  saveRecord(s, demo[0], demo);
  const original = s.getItem(STORAGE_KEY);
  assert.throws(
    () =>
      importRecords(
        s,
        JSON.stringify([{ ...demo[0], source: "javascript:alert(1)" }]),
        demo,
      ),
    /Source URLs/,
  );
  assert.equal(s.getItem(STORAGE_KEY), original);
  assert.throws(
    () => validateRecords([{ ...demo[0], deadline: "2027-02-31" }], demo[0]),
    /Invalid date/,
  );
  assert.throws(
    () => validateRecords([demo[0], demo[0]], demo[0]),
    /duplicate/,
  );
});
test("corrupt storage is reported instead of overwritten by demo", () => {
  const s = store();
  s.setItem(STORAGE_KEY, "broken");
  assert.throws(() => loadRecords(s, demo));
  assert.equal(s.getItem(STORAGE_KEY), "broken");
});
