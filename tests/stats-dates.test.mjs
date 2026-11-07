import assert from "node:assert/strict";
import test from "node:test";
import { dateInputValue, localDay, statsDateRange } from "../site/assets/js/stats-dates.mjs";

test("uses local calendar boundaries for today, yesterday and recent days", () => {
  const time = (day, hour = 0) => new Date(2026, 2, day, hour).getTime();
  const now = time(8, 14);
  assert.equal(localDay(now), time(8));
  assert.deepEqual(statsDateRange("today", "", "", now), { start: time(8), end: time(9) });
  assert.deepEqual(statsDateRange("yesterday", "", "", now), { start: time(7), end: time(8) });
  assert.deepEqual(statsDateRange("week", "", "", now), { start: time(2), end: time(9) });
  assert.deepEqual(statsDateRange("month", "", "", now), { start: time(-21), end: time(9) });
});

test("includes the whole end day and rejects reversed date filters", () => {
  const first = new Date(2026, 10, 6);
  const next = new Date(2026, 10, 8);
  assert.equal(dateInputValue(first), "2026-11-06");
  assert.deepEqual(statsDateRange("custom", "2026-11-06", "2026-11-07"), { start: +first, end: +next });
  assert.throws(() => statsDateRange("custom", "2026-11-07", "2026-11-06"));
  assert.throws(() => statsDateRange("custom", "", "2026-11-06"));
});
