import assert from "node:assert/strict";
import test from "node:test";
import { recordStroke } from "../site/assets/js/finish-round.mjs";
import { addShot, combineStats, createStats } from "../site/assets/js/stats-data.mjs";

test("scores completed rounds from actual strokes and adds one for an OK", () => {
  assert.equal(recordStroke(0, "unjudged"), null);
  assert.deepEqual(recordStroke(0, "miss"), { stroke: 1, score: null });
  assert.deepEqual(recordStroke(1, "holed"), { stroke: 2, score: 2 });
  assert.deepEqual(recordStroke(1, "concede"), { stroke: 2, score: 3 });
});

test("only the completing shot contributes to round statistics", () => {
  const stats = createStats();
  const shot = { scenario: "finish", target: 3, distance: 4, angle: 1, outcome: "miss", leave: 1 };
  addShot(stats, { ...shot, roundStroke: 1, roundScore: null });
  addShot(stats, { ...shot, outcome: "holed", roundStroke: 2, roundScore: 2 });
  addShot(stats, { ...shot, outcome: "concede", leave: 0.3, roundStroke: 2, roundScore: 3 });
  assert.deepEqual(combineStats([stats]).finish,
    { completed: 2, strokes: 5, one: 0, two: 1, threePlus: 1, conceded: 1 });
});
