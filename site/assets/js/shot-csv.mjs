import { recordStroke } from "./finish-round.mjs";
import { OUTCOME_LABELS } from "./putting.mjs";

const ORIGINAL_FIELDS = [
  "time", "target", "scenario", "greenSpeed", "distance", "rollSpeed",
  "angle", "remaining", "speed", "outcome", "leave", "model",
];

const ROUND_FIELDS = ["roundId", "roundStart", "roundStroke", "roundScore"];
const PRIOR_FIELDS = [...ORIGINAL_FIELDS, ...ROUND_FIELDS];
const SESSION_FIELDS = ["sessionId", "sessionTheme", "sessionPutter", "sessionMat"];
const TEXT_FIELDS = new Set(SESSION_FIELDS.slice(1));
const SESSION_SCHEMA = [...PRIOR_FIELDS, ...SESSION_FIELDS];
const SCORING_FIELDS = ["okRadius", "roundFirstLeave", "testHole"];
export const CSV_FIELDS = [...SESSION_SCHEMA, ...SCORING_FIELDS];
const OPTIONAL_NUMBERS = new Set(["greenSpeed", "leave", "model", "roundStart", "roundStroke", "roundScore", ...SCORING_FIELDS]);
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function shotIdentity(shot) {
  return JSON.stringify(CSV_FIELDS.map((field) => (TEXT_FIELDS.has(field) ? shot[field] || null : shot[field] ?? null)));
}

export function shotToCSV(shot) {
  return CSV_FIELDS.map((field) => {
    const value = field === "time" ? new Date(shot.time).toISOString() : String(shot[field] ?? "");
    // Prevent spreadsheets from interpreting free-text metadata as formulas.
    const safe = TEXT_FIELDS.has(field) && /^['=+@-]/.test(value) ? "'" + value : value;
    return /[",]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe;
  }).join(",");
}

function readRow(line) {
  const cells = [];
  const cell = /\s*(?:"((?:[^"]|"")*)"|([^",]*))\s*(,|$)/gy;
  while (true) {
    const match = cell.exec(line);
    if (!match) throw new Error("引用符で囲まれた列の形式が不正です");
    cells.push((match[1]?.replaceAll('""', '"') ?? match[2]).trim());
    if (!match[3]) return cells;
  }
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
    if (!["fixed", "random", "finish"].includes(value)) throw new Error("scenario の値が不正です");
    return value;
  }
  if (TEXT_FIELDS.has(field)) {
    const text = /^'['=+@-]/.test(value) ? value.slice(1) : value;
    if (text.length > 60) throw new Error(`${field} は60文字以内で指定してください`);
    return text;
  }
  if (field === "roundId" || field === "sessionId") {
    if (!value) return null;
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error(`${field} の形式が不正です`);
    return value;
  }
  if (field === "outcome") {
    if (!Object.hasOwn(OUTCOME_LABELS, value)) throw new Error("outcome の値が不正です");
    return value;
  }
  if (!value && OPTIONAL_NUMBERS.has(field)) return null;
  const number = Number(value);
  if (!DECIMAL.test(value) || !Number.isFinite(number)) throw new Error(`${field} は数値で指定してください`);

  if (field === "okRadius" && ![0, 0.3, 0.5].includes(number)) throw new Error("okRadius は0・0.3・0.5のいずれかです");
  if (field === "testHole" && (!Number.isInteger(number) || number < 1 || number > 20)) throw new Error("testHole は1〜20の整数です");
  if ((field === "leave" || field === "roundFirstLeave") && number < 0) throw new Error("leave は 0 以上で指定してください");
  if (field === "model" && (!Number.isSafeInteger(number) || number < 1)) throw new Error("model は正の整数で指定してください");
  if ((field === "roundStroke" || field === "roundScore") && (!Number.isSafeInteger(number) || number < 1)) {
    throw new Error(`${field} は正の整数で指定してください`);
  }
  return number;
}

function validateRound(shot) {
  if (shot.target <= 0 || (shot.scenario !== "finish" && (shot.target < 0.5 || shot.target > 20))) throw new Error("target が範囲外です");
  if (shot.scenario !== "finish" || shot.outcome === "unjudged") {
    if (ROUND_FIELDS.some((field) => shot[field] != null)) throw new Error("ホールアウトの打数は判定済みのホールアウトショットにだけ指定できます");
    return;
  }
  const { roundId, roundStart, roundStroke, roundScore } = shot;
  if (!roundId || !(roundStart >= 0.5 && roundStart <= 20) || !roundStroke) throw new Error("ホールアウトの識別子・開始距離・打数が必要です");
  if ((roundScore ?? null) !== recordStroke(roundStroke - 1, shot.outcome).score) throw new Error("roundScore がショットの結果と一致しません");
}

export function parseShotCSV(text) {
  const [first, ...lines] = text.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  const columns = readRow(first);
  const matches = (fields) => columns.length === fields.length && fields.every((field) => columns.includes(field));
  if (!matches(ORIGINAL_FIELDS) && !matches(PRIOR_FIELDS) && !matches(SESSION_SCHEMA) && !matches(CSV_FIELDS)) {
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
      validateRound(shot);
      if (!shot.sessionId && [...TEXT_FIELDS].some((field) => shot[field])) throw new Error("テーマや用具には sessionId が必要です");
      for (const field of SESSION_FIELDS) {
        if (!shot[field]) delete shot[field];
      }
      for (const field of [...ROUND_FIELDS, ...SCORING_FIELDS]) {
        if (shot[field] == null) delete shot[field];
      }
      shots.push(shot);
    } catch (error) {
      throw new Error(`${index + 2}行目　${error.message}`);
    }
  }
  return shots;
}
