import assert from "node:assert/strict";
import test from "node:test";
import { addComparisonShot, createAnalysis, stoppingOffset, wilsonInterval } from "../site/assets/js/analysis-data.mjs";

const base = { time: 1, target: 3, distance: 3, greenSpeed: 244, angle: 0, outcome: "holed", model: 2 };

test("groups a selected session in ten-shot blocks and keeps its measurement metadata", () => {
  const analysis = createAnalysis({ sessionId: "one" });
  for (let i = 0; i < 12; i++) analysis.add({ ...base, sessionId: "one", sessionTheme: "方向性", angle: i < 10 ? -0.5 : 1 });
  analysis.add({ ...base, sessionId: "two" });
  const { blocks, sessions, totals } = analysis.result;
  assert.equal(totals.shots, 12);
  assert.deepEqual(blocks.map(({ shots, angleTotal }) => [shots, angleTotal]), [[10, 5], [2, 2]]);
  assert.equal(sessions.get("one").theme, "方向性");
  assert.equal(sessions.get("two").shots, 1);
});

test("projects stops with right and over positive and ignores angle error markers", () => {
  const point = stoppingOffset({ ...base, angle: 1, distance: 3.5 });
  assert.ok(point.x > 0.06 && point.x < 0.062);
  assert.ok(point.y > 0.49 && point.y < 0.5);
  assert.equal(stoppingOffset({ ...base, angle: 10 }), null);
});

test("round analysis uses the first leave and recorded score, even during rejudging", () => {
  const analysis = createAnalysis({ rejudge: true });
  analysis.add({ ...base, outcome: "concede", distance: 2.2, model: 1, roundScore: 2, roundStart: 4,
    roundFirstLeave: 0.8, roundStroke: 1, testHole: 1, sessionId: "test" });
  assert.equal(analysis.result.changed, 1);
  assert.equal(analysis.result.rounds.get(4).firstLeave, 0.8);
  assert.equal(analysis.result.rounds.get(4).strokes, 2);
  assert.equal(analysis.result.tests.get("test").get(1), 2);
  assert.deepEqual([...analysis.result.okDistances], [1]);
});

test("compares only matching green speeds and shows a nonzero interval for a small perfect sample", () => {
  const bands = new Map();
  addComparisonShot(bands, { ...base, greenSpeed: 305 }, 244, false);
  addComparisonShot(bands, { ...base, target: 3.2 }, 244, false);
  assert.deepEqual([...bands], [[3, { judged: 1, holed: 1 }]]);
  const [low, high] = wilsonInterval(1, 1);
  assert.ok(low > 0.2 && low < 0.21);
  assert.ok(Math.abs(high - 1) < 1e-12);
});
