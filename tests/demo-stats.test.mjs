import assert from "node:assert/strict";
import test from "node:test";
import { createDemoReader } from "../site/assets/js/demo-stats.mjs";
import { statsDateRange } from "../site/assets/js/stats-dates.mjs";

test("demo offers 1000 shots with the same filters and pagination as actual statistics", () => {
  const now = new Date(2026, 10, 7, 14).getTime();
  const read = createDemoReader(now);
  const initial = read("all", { includeStats: true });
  assert.equal(initial.summaries[0].total, 1000);
  assert.equal(initial.entries.length, 50);
  assert.equal(initial.hasOlder, true);
  assert.equal(initial.summaries[0].finish.completed, 30);
  const next = read("all", { boundary: initial.entries.at(-1).key });
  assert.ok(next.entries[0].key.time < initial.entries.at(-1).key.time);
  assert.deepEqual(read("all", { newer: true, boundary: next.entries[0].key }).entries, initial.entries);
  const today = statsDateRange("today", "", "", now);
  const filtered = read("finish", { dateRange: today, includeStats: true });
  assert.ok(filtered.entries.length);
  assert.ok(filtered.entries.every(({ shot }) => shot.scenario === "finish" && shot.time >= today.start && shot.time < today.end));
});
