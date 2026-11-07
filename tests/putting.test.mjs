import assert from "node:assert/strict";
import test from "node:test";
import { classifyLeave, evaluatePutt, randomTarget } from "../site/assets/js/putting.mjs";

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
