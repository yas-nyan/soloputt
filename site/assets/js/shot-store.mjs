import { classifyLeave } from "./putting.mjs";
import { shotIdentity } from "./shot-csv.mjs";
import { localDay } from "./stats-dates.mjs";
import { addDailyShot, addShot, createDailyStats, createStats } from "./stats-data.mjs";

const SHOTS = "shots";
const STATS = "stats";
const TIME = "time";
const SCENARIO_TIME = "scenario-time";
const MAX_TIME = 8_640_000_000_000_000;
let database;

function upgrade(request, oldVersion) {
  const db = request.result;
  const shots = oldVersion === 0 ? db.createObjectStore(SHOTS, { autoIncrement: true })
    : request.transaction.objectStore(SHOTS);
  if (oldVersion < 4) {
    if (shots.indexNames.contains("scenario")) shots.deleteIndex("scenario");
    shots.createIndex(TIME, TIME);
    shots.createIndex(SCENARIO_TIME, ["scenario", TIME]);
  }
  const stats = oldVersion < 3 ? db.createObjectStore(STATS) : request.transaction.objectStore(STATS);
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
    const request = indexedDB.open("soloputt", 7);
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

function addShots(transaction, shots) {
  const stats = transaction.objectStore(STATS);
  const byScenario = new Map();
  for (const shot of shots) {
    if (!byScenario.has(shot.scenario)) byScenario.set(shot.scenario, []);
    byScenario.get(shot.scenario).push(shot);
  }
  for (const [scenario, records] of byScenario) {
    const summaryRequest = stats.get(scenario);
    summaryRequest.onsuccess = () => {
      const summary = summaryRequest.result ?? createStats();
      for (const shot of records) addShot(summary, shot);
      stats.put(summary, scenario);
    };
  }
  const store = transaction.objectStore(SHOTS);
  return shots.map((shot) => store.add(shot));
}

export function saveShot(shot) {
  return access("readwrite", (transaction) => {
    const [saved] = addShots(transaction, [shot]);
    return () => saved.result;
  });
}

export function importShots(shots) {
  return access("readwrite", (transaction) => {
    const byTime = new Map();
    for (const shot of shots) {
      if (!byTime.has(shot.time)) byTime.set(shot.time, []);
      byTime.get(shot.time).push(shot);
    }

    const index = transaction.objectStore(SHOTS).index(TIME);
    const added = [];
    let pending = byTime.size;
    for (const [time, records] of byTime) {
      const lookup = index.getAll(time);
      lookup.onsuccess = () => {
        const seen = new Set(lookup.result.map(shotIdentity));
        for (const shot of records) {
          const identity = shotIdentity(shot);
          if (seen.has(identity)) continue;
          seen.add(identity);
          added.push(shot);
        }
        if (--pending === 0) addShots(transaction, added);
      };
    }
    return () => ({ added: added.length, skipped: shots.length - added.length });
  });
}

export function forEachShot(visit) {
  return access("readonly", (transaction) => {
    const request = transaction.objectStore(SHOTS).index(TIME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      visit(cursor.value);
      cursor.continue();
    };
    return () => undefined;
  });
}

function shotCursor(shots, scenario, lower, upper, direction) {
  const filtered = scenario !== "all";
  const index = shots.index(filtered ? SCENARIO_TIME : TIME);
  const key = (time) => filtered ? [scenario, time] : time;
  return index.openCursor(IDBKeyRange.bound(key(lower), key(upper)), direction);
}

function readHistory(shots, scenario, dateRange, boundary, newer, pageSize) {
  const start = dateRange?.start ?? -MAX_TIME;
  const last = dateRange ? dateRange.end - 1 : MAX_TIME;
  const lower = newer && boundary ? boundary.time : start;
  const upper = !newer && boundary ? boundary.time : last;
  const entries = [];
  let more = false;
  const request = shotCursor(shots, scenario, lower, upper, newer ? "next" : "prev");
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const time = scenario === "all" ? cursor.key : cursor.key[1];
    const id = cursor.primaryKey;
    // Timestamps may tie. Use the primary key to resume within that group.
    if (boundary && time === boundary.time) {
      if (newer ? id < boundary.id : id > boundary.id) {
        cursor.continuePrimaryKey(cursor.key, boundary.id);
        return;
      }
      if (id === boundary.id) {
        cursor.continue();
        return;
      }
    }
    if (entries.length === pageSize) {
      more = true;
      return;
    }
    entries.push({ key: { time, id }, shot: cursor.value });
    cursor.continue();
  };
  return () => ({
    entries: newer ? entries.reverse() : entries,
    hasNewer: newer ? more : boundary !== null,
    hasOlder: newer ? boundary !== null : more,
  });
}

function readPeriodStats(transaction, scenario, dateRange) {
  const daily = new Map();
  const summary = dateRange ? createStats() : null;
  const stats = transaction.objectStore(STATS);
  const stored = dateRange ? null : scenario === "all" ? stats.getAll() : stats.getAll(scenario);
  const shots = transaction.objectStore(SHOTS);
  const request = shotCursor(shots, scenario, dateRange?.start ?? -MAX_TIME,
    dateRange ? dateRange.end - 1 : MAX_TIME, "prev");

  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const shot = cursor.value;
    const day = localDay(shot.time);
    if (!daily.has(day)) {
      if (!dateRange && daily.size === 7) return;
      daily.set(day, createDailyStats());
    }
    if (summary) addShot(summary, shot);
    addDailyShot(daily.get(day), shot);
    cursor.continue();
  };

  return () => ({ summaries: summary ? [summary] : stored.result, daily });
}

export function readStatsPage(scenario, {
  dateRange = null, boundary = null, newer = false, pageSize = 50, includeStats = true,
} = {}) {
  return access("readonly", (transaction) => {
    const stats = includeStats ? readPeriodStats(transaction, scenario, dateRange) : () => ({});
    const history = readHistory(transaction.objectStore(SHOTS), scenario, dateRange, boundary, newer, pageSize);
    return () => ({ ...stats(), ...history() });
  });
}
