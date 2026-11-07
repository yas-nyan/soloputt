// 開発用に模擬ショットデータを生成するスクリプト
import { CSV_FIELDS, shotToCSV } from "../site/assets/js/shot-csv.mjs";
import { evaluatePutt, randomTarget } from "../site/assets/js/putting.mjs";

const count = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 42);
if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
  console.error("Usage: node scripts/generate-shots.mjs [count > 0] [seed 0..4294967295]");
  process.exit(1);
}

let state = seed;
function random() {
  state = (Math.imul(1664525, state) + 1013904223) >>> 0;
  return state / 2 ** 32;
}

function normal() {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

const round = (number) => Number(number.toFixed(2));
const speeds = [214, 244, 275, 305, 336];
const fixedTargets = [1, 1.5, 2, 2.5, 3, 4, 5, 6];
const start = Date.UTC(2025, 0, 1) + (seed % 365) * 86_400_000;

console.log(CSV_FIELDS.join(","));
for (let i = 0; i < count; i++) {
  const scenario = i % 3 ? "fixed" : "random";
  const target = scenario === "fixed" ? fixedTargets[Math.floor(i / 12) % fixedTargets.length] : randomTarget(8, 0, random);
  const greenSpeed = speeds[Math.floor(i / 40) % speeds.length];
  const direction = scenario === "fixed" ? -0.35 : 0.55;
  const angle = i % 97 === 0 ? 10 : round(Math.max(-9.9, Math.min(9.9, direction + normal() * 0.8)));
  const distance = round(Math.max(0.05, target + normal() * (0.2 + 0.14 * target)));
  const rollSpeed = round(1.83 * Math.sqrt(distance / (greenSpeed / 100)));
  const speed = round(rollSpeed * 1.04);
  const result = evaluatePutt({ distance, angle }, target, greenSpeed);
  console.log(shotToCSV({
    time: start + i * 120_000, target, scenario, greenSpeed, distance, rollSpeed, angle,
    remaining: 0, speed, outcome: result.outcome, leave: result.remaining ?? null, model: 1,
  }));
}
