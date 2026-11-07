import { classifyLeave } from "./putting.mjs";
import { addShot, createStats } from "./stats-data.mjs";

const SHOTS = "shots";
const STATS = "stats";
const SCENARIO = "scenario";
let database;

function upgrade(request, oldVersion) {
  const db = request.result;
  const shots = oldVersion === 0 ? db.createObjectStore(SHOTS, { autoIncrement: true })
    : request.transaction.objectStore(SHOTS);
  shots.createIndex(SCENARIO, SCENARIO);
  const stats = db.createObjectStore(STATS);
  if (oldVersion === 0) return;

  const summaries = new Map();
  const scan = shots.openCursor();
  scan.onsuccess = () => {
    const cursor = scan.result;
    if (!cursor) {
      for (const [scenario, summary] of summaries) stats.put(summary, scenario);
      return;
    }
    const shot = cursor.value;
    if (oldVersion === 1 && shot.outcome === "miss" && classifyLeave(shot.leave) === "concede") {
      shot.outcome = "concede";
      cursor.update(shot);
    }
    if (!summaries.has(shot.scenario)) summaries.set(shot.scenario, createStats());
    addShot(summaries.get(shot.scenario), shot);
    cursor.continue();
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("soloputt", 3);
    request.onupgradeneeded = (event) => upgrade(request, event.oldVersion);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  });
}

async function access(mode, operate) {
  database ??= openDatabase().catch((error) => {
    database = undefined;
    throw error;
  });
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SHOTS, STATS], mode);
    transaction.onabort = () => reject(transaction.error ?? new Error("保存領域にアクセスできません"));
    try {
      const result = operate(transaction);
      transaction.oncomplete = () => resolve(result());
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

export function saveShot(shot) {
  return access("readwrite", (transaction) => {
    const stats = transaction.objectStore(STATS);
    const summaryRequest = stats.get(shot.scenario);
    summaryRequest.onsuccess = () => {
      const summary = summaryRequest.result ?? createStats();
      addShot(summary, shot);
      stats.put(summary, shot.scenario);
    };
    const saved = transaction.objectStore(SHOTS).add(shot);
    return () => saved.result;
  });
}

function readHistory(shots, scenario, boundary, newer, pageSize) {
  const filtered = scenario !== "all";
  const direction = newer ? "next" : "prev";
  const source = filtered ? shots.index(SCENARIO) : shots;
  const range = filtered ? IDBKeyRange.only(scenario) : boundary === null ? null
    : newer ? IDBKeyRange.lowerBound(boundary, true) : IDBKeyRange.upperBound(boundary, true);
  const entries = [];
  let more = false;
  const request = source.openCursor(range, direction);
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const key = cursor.primaryKey;
    // A filtered cursor is ordered by primary key within the chosen scenario.
    if (filtered && boundary !== null && (newer ? key < boundary : key > boundary)) {
      cursor.continuePrimaryKey(scenario, boundary);
      return;
    }
    if (filtered && key === boundary) {
      cursor.continue();
      return;
    }
    if (entries.length === pageSize) {
      more = true;
      return;
    }
    entries.push({ key, shot: cursor.value });
    cursor.continue();
  };
  return () => ({
    entries: newer ? entries.reverse() : entries,
    hasNewer: newer ? more : boundary !== null,
    hasOlder: newer ? boundary !== null : more,
  });
}

export function readStatsPage(scenario, { boundary = null, newer = false, pageSize = 50 } = {}) {
  return access("readonly", (transaction) => {
    const stats = transaction.objectStore(STATS);
    const summaries = scenario === "all" ? stats.getAll() : stats.getAll(scenario);
    const history = readHistory(transaction.objectStore(SHOTS), scenario, boundary, newer, pageSize);
    return () => ({ summaries: summaries.result, ...history() });
  });
}
