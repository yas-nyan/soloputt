import assert from "node:assert/strict";
import test from "node:test";
import { demoShot, DEMO_GREEN_SPEED } from "../site/assets/js/practice-demo.mjs";
import { evaluatePutt } from "../site/assets/js/putting.mjs";

test("varies both distance and angle without changing the selected result", () => {
  for (let tenths = 5; tenths <= 200; tenths++) {
    const target = tenths / 10;
    for (const outcome of ["holed", "concede", "miss"]) {
      const left = demoShot(outcome, target, () => 0);
      const right = demoShot(outcome, target, () => 0.999);
      assert.ok(left.angle < 0 && right.angle > 0);
      assert.notEqual(Math.abs(left.angle), Math.abs(right.angle));
      assert.notEqual(left.distance, right.distance);
      for (const shot of [left, right]) {
        const result = evaluatePutt(shot, target, DEMO_GREEN_SPEED);
        assert.equal(result.outcome, outcome, `target ${target} m`);
      }
    }
  }
});

test("keeps demo outcomes valid around the fixed OK distance", () => {
  for (const target of [0.31, 0.4, 0.5, 1, 3, 8, 20]) {
    const result = evaluatePutt(demoShot("concede", target, () => 0.99), target, DEMO_GREEN_SPEED);
    assert.equal(result.outcome, "concede");
  }
  for (const target of [0.02, 0.1, 0.25]) {
    for (const outcome of ["holed", "miss"]) {
      assert.equal(evaluatePutt(demoShot(outcome, target, () => 0.9), target, DEMO_GREEN_SPEED).outcome, outcome);
    }
  }
});
