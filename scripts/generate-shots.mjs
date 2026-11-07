// 開発用に模擬ショットデータを生成するスクリプト
import { CSV_FIELDS, shotToCSV } from "../site/assets/js/shot-csv.mjs";
import { generateSampleShots } from "../site/assets/js/sample-shots.mjs";

const count = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 42);
if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
  console.error("Usage: node scripts/generate-shots.mjs [count > 0] [seed 0..4294967295]");
  process.exit(1);
}

console.log(CSV_FIELDS.join(","));
for (const shot of generateSampleShots(count, seed)) console.log(shotToCSV(shot));
