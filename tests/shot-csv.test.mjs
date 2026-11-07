import assert from "node:assert/strict";
import test from "node:test";
import { CSV_FIELDS, parseShotCSV, shotIdentity, shotToCSV } from "../site/assets/js/shot-csv.mjs";

const shot = {
  time: Date.UTC(2026, 10, 7), target: 3, scenario: "fixed", greenSpeed: 244,
  distance: 3.25, rollSpeed: 2.19, angle: -0.71, remaining: 0, speed: 2.2, outcome: "concede",
  leave: 0.26, model: 1,
};
const header = CSV_FIELDS.join(",");

test("CSV round-trips recorded values and nullable fields", () => {
  const unjudged = { ...shot, greenSpeed: null, angle: 10, outcome: "unjudged", leave: null, model: null };
  assert.deepEqual(parseShotCSV(`\uFEFF${header}\r\n${shotToCSV(shot)}\r\n${shotToCSV(unjudged)}\r\n`), [shot, unjudged]);
  assert.equal(shotIdentity(unjudged), shotIdentity({ ...unjudged, model: undefined }));
  assert.deepEqual(parseShotCSV(header), []);
});

test("CSV accepts quoted scalar cells and reordered columns", () => {
  const fields = [...CSV_FIELDS].reverse();
  const values = shotToCSV(shot).split(",").reverse().map((value) => `"${value}"`);
  assert.deepEqual(parseShotCSV(`${fields.join(",")}\n${values.join(",")}`), [shot]);
});

test("CSV rejects invalid data with the row number before import", () => {
  const row = shotToCSV(shot);
  assert.throws(() => parseShotCSV(`${header}\n${row}\n${row.replace(",3,", ",21,")}`), /3行目.*target/);
  assert.throws(() => parseShotCSV(`${header}\n${row.replace(",0.26,", ",,")}`), /2行目.*leave/);
  assert.throws(() => parseShotCSV(`${header}\n${row.replace(",concede,", ",toString,")}`), /2行目.*outcome/);
  assert.throws(() => parseShotCSV("time,angle"), /列名/);
});
