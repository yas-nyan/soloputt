import { OUTCOME_LABELS } from "./putting.mjs";

export const CSV_FIELDS = [
  "time", "target", "scenario", "greenSpeed", "distance", "rollSpeed",
  "angle", "remaining", "speed", "outcome", "leave", "model",
];

const OPTIONAL_NUMBERS = new Set(["greenSpeed", "leave", "model"]);
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function shotIdentity(shot) {
  return JSON.stringify(CSV_FIELDS.map((field) => shot[field] ?? null));
}

export function shotToCSV(shot) {
  return CSV_FIELDS.map((field) => field === "time" ? new Date(shot.time).toISOString() : shot[field] ?? "").join(",");
}

function readRow(line) {
  // All supported cells are scalars without commas, quotes or newlines.
  return line.split(",").map((cell) => {
    const value = cell.trim();
    if (!value.includes('"')) return value;
    if (/^"[^"]*"$/.test(value)) return value.slice(1, -1).trim();
    throw new Error("引用符で囲まれた列の形式が不正です");
  });
}

function readValue(field, value) {
  if (field === "time") {
    const time = Date.parse(value);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
      throw new Error("time はミリ秒付きのUTC日時（例 2026-11-07T00:00:00.000Z）で指定してください");
    }
    return time;
  }
  if (field === "scenario") {
    if (value !== "fixed" && value !== "random") throw new Error("scenario は fixed または random です");
    return value;
  }
  if (field === "outcome") {
    if (!Object.hasOwn(OUTCOME_LABELS, value)) throw new Error("outcome の値が不正です");
    return value;
  }
  if (!value && OPTIONAL_NUMBERS.has(field)) return null;
  const number = Number(value);
  if (!DECIMAL.test(value) || !Number.isFinite(number)) throw new Error(`${field} は数値で指定してください`);
  if (field === "target" && (number < 0.5 || number > 20)) throw new Error("target は 0.5〜20 m で指定してください");
  if (field === "leave" && number < 0) throw new Error("leave は 0 以上で指定してください");
  if (field === "model" && (!Number.isSafeInteger(number) || number < 1)) throw new Error("model は正の整数で指定してください");
  return number;
}

export function parseShotCSV(text) {
  const [first, ...lines] = text.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  const columns = readRow(first);
  if (columns.length !== CSV_FIELDS.length || !CSV_FIELDS.every((field) => columns.includes(field))) {
    throw new Error("CSVの列名が一致しません。SoloPuttが書き出したCSVをひな形にしてください");
  }

  const shots = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      const cells = readRow(line);
      if (cells.length !== columns.length) throw new Error("列数が一致しません");
      const shot = Object.fromEntries(columns.map((field, column) => [field, readValue(field, cells[column])]));
      if ((shot.outcome === "concede" || shot.outcome === "miss") && shot.leave === null) {
        throw new Error("OK圏内またはミスの球には leave が必要です");
      }
      shots.push(shot);
    } catch (error) {
      throw new Error(`${index + 2}行目　${error.message}`);
    }
  }
  return shots;
}
