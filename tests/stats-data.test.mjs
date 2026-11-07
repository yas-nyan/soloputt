import assert from "node:assert/strict";
import test from "node:test";
import { addDailyShot, addShot, combineStats, createDailyStats, createStats } from "../site/assets/js/stats-data.mjs";

test("groups targets in half-metre ranges and combines scenario totals", () => {
  const fixed = createStats();
  const random = createStats();
  addShot(fixed, { target: 3, angle: -1.2, outcome: "holed", leave: 0 });
  addShot(random, { target: 3.4, angle: 1.2, outcome: "concede", leave: 0.7 });
  addShot(random, { target: 3.5, angle: 10, outcome: "unjudged", leave: null });

  const summary = combineStats([fixed, random]);
  assert.equal(summary.total, 3);
  assert.deepEqual(summary.distances[6], { total: 2, holed: 1, conceded: 1, missed: 0, leave: 0.7 });
  assert.equal(summary.distances[7].total, 1);
  assert.deepEqual(summary.left, [0, 0, 1, 0]);
  assert.deepEqual(summary.right, [0, 0, 1, 0]);
  assert.equal(summary.centre, 0);
});

test("keeps centred, left and right angles separate at band boundaries", () => {
  const summary = createStats();
  for (const angle of [-0.25, 0.25, -0.5, -0.51, 1, 1.01, 2, 2.01, 10]) {
    addShot(summary, { target: 3, angle, outcome: "unjudged" });
  }
  assert.equal(summary.centre, 2);
  assert.deepEqual(summary.left, [1, 1, 0, 0]);
  assert.deepEqual(summary.right, [0, 1, 2, 1]);
});

test("counts short and long leaves using measured roll distance, independently of angle and outcome", () => {
  const stats = createStats();
  const daily = createDailyStats();
  for (const shot of [
    { target: 3, distance: 2.75, angle: 10, outcome: "unjudged" },
    { target: 3, distance: 3.1, angle: -0.25, outcome: "holed" },
    { target: 3, distance: 3.6, angle: 1, outcome: "concede", leave: 0.6 },
    { target: 3, distance: -1, angle: -0.3, outcome: "unjudged" },
  ]) {
    addShot(stats, shot);
    addDailyShot(daily, shot);
  }
  assert.deepEqual(combineStats([stats]).pace, { centre: 1, left: [1, 0, 0, 0], right: [0, 0, 1, 0] });
  assert.deepEqual([daily.short, daily.onPace, daily.over], [1, 1, 1]);
  assert.deepEqual([daily.left, daily.centre, daily.right], [1, 1, 1]);
});
