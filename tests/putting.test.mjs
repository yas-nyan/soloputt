import assert from "node:assert/strict";
import test from "node:test";
import { classifyLeave, evaluatePutt, formatAngle, formatShotSummary, randomTarget } from "../site/assets/js/putting.mjs";

test("uses cup entry rather than requiring the ball to reach the centre", () => {
  const hit = evaluatePutt({ distance: 2.95, angle: 0 }, 3, 244);
  assert.equal(hit.outcome, "holed");
  assert.equal(hit.remaining, 0);
  assert.ok(Math.abs(hit.travel - 2.946) < 1e-9);
  assert.equal(evaluatePutt({ distance: 2.94, angle: 0 }, 3, 244).reason, "short");
});

test("uses green speed and lateral offset for the capture limit", () => {
  const shot = { distance: 3.36, angle: 0.8 };
  assert.equal(evaluatePutt(shot, 3, 214).reason, "pace");
  assert.equal(evaluatePutt(shot, 3, 336).outcome, "holed");
  assert.equal(evaluatePutt({ ...shot, angle: -0.8 }, 3, 336).outcome, "holed");
  assert.equal(evaluatePutt({ ...shot, angle: 2 }, 3, 336).reason, "line");
  assert.equal(evaluatePutt({ distance: 10, angle: 0 }, 3, 244).reason, "pace");
});

test("records an uncaptured putt within fifty centimetres as a separate outcome", () => {
  assert.equal(classifyLeave(0.5), "concede");
  assert.equal(classifyLeave(0.5001), "miss");
  assert.equal(evaluatePutt({ distance: 2.5, angle: 0 }, 3, 244).outcome, "concede");
  assert.equal(evaluatePutt({ distance: 2.49, angle: 0 }, 3, 244).outcome, "miss");
  assert.equal(evaluatePutt({ distance: 3.45, angle: 1.5 }, 3, 244).outcome, "concede");
  assert.equal(evaluatePutt({ distance: 3.51, angle: 1.5 }, 3, 244).outcome, "miss");
  assert.equal(evaluatePutt({ distance: 4, angle: 2 }, 3, 244).outcome, "miss");
  assert.equal(evaluatePutt({ distance: 2, angle: 0 }, 3, 244).outcome, "miss");
  assert.equal(evaluatePutt({ distance: 3, angle: 2 }, 3, 244).outcome, "concede");
});

test("keeps error markers and unavailable settings out of the cup-in rate", () => {
  assert.equal(evaluatePutt({ distance: 3.36, angle: 10 }, 3, 244).outcome, "unjudged");
  assert.equal(evaluatePutt({ distance: 3.36, angle: 0 }, 3, null).outcome, "unjudged");
  assert.equal(evaluatePutt({ distance: 3.36, angle: 180 }, 3, 244).reason, "line");
});

test("random practice covers the inclusive range without repeating when possible", () => {
  assert.equal(randomTarget(0.5, 3, 2, () => 0), 0.5);
  assert.equal(randomTarget(4, 6, 3, () => 0), 4);
  assert.equal(randomTarget(4, 6, 3, () => 0.999), 6);
  assert.equal(randomTarget(0.5, 3, 2, () => 0.999), 3);
  assert.equal(randomTarget(0.5, 0.6, 0.5, () => 0), 0.6);
  assert.equal(randomTarget(0.5, 0.6, 0.6, () => 0.999), 0.5);
  assert.equal(randomTarget(0.5, 0.5, 0.5, () => 0.999), 0.5);
});

test("prefixes signed angles with the direction letter", () => {
  assert.equal(formatAngle(0.5), "R0.50");
  assert.equal(formatAngle(-0.5), "L0.50");
  assert.equal(formatAngle(0), "0.00");
});

test("supports hole-out with a smaller gimme or a putt from inside fifty centimetres", () => {
  assert.equal(evaluatePutt({ distance: 2.7, angle: 0 }, 3, 244, 0).outcome, "miss");
  assert.equal(evaluatePutt({ distance: 2.71, angle: 0 }, 3, 244, 0.3).outcome, "concede");
  assert.equal(evaluatePutt({ distance: 2.69, angle: 0 }, 3, 244, 0.3).outcome, "miss");
  assert.equal(evaluatePutt({ distance: 0.2, angle: 0 }, 0.2, 244, 0).outcome, "holed");
  assert.equal(evaluatePutt({ distance: 0.03, angle: 0 }, 0.03, 244, 0).outcome, "holed");
});

test("reports distance, direction and leave from the shot that was played", () => {
  assert.equal(formatShotSummary({ distance: 1.62, angle: -2 }, 1.9, 0.29),
    "28 cmショート ／ 左に打ち出し ／ 残り29 cm");
  assert.equal(formatShotSummary({ distance: 2.1, angle: 0.5 }, 1.9, 0),
    "20 cmオーバー ／ 右に打ち出し ／ 残り0 cm");
  assert.equal(formatShotSummary({ distance: 1.9, angle: 10 }, 1.9, undefined),
    "目標どおり ／ 方向不明 ／ 残り—");
});
