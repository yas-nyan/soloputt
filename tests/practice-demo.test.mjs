import assert from "node:assert/strict";
import test from "node:test";
import { demoShot, DEMO_GREEN_SPEED } from "../site/assets/js/practice-demo.mjs";
import { evaluatePutt } from "../site/assets/js/putting.mjs";

test("replays each result across the supported practice distances", () => {
  for (let tenths = 5; tenths <= 200; tenths++) {
    const target = tenths / 10;
    for (const outcome of ["holed", "concede", "miss"]) {
      const result = evaluatePutt(demoShot(outcome, target), target, DEMO_GREEN_SPEED);
      assert.equal(result.outcome, outcome, `target ${target} m`);
      if (outcome === "miss") assert.ok(result.remaining >= 1);
    }
  }
});
