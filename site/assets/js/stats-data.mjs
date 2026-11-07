export const CENTRE_ANGLE = 0.25;
export const ANGLE_BANDS = [
  { maximum: 0.5, label: "0.25–0.5°" },
  { maximum: 1, label: "0.5–1°" },
  { maximum: 2, label: "1–2°" },
  { maximum: Infinity, label: "2°超" },
];

export const PACE_BANDS = [
  { maximum: 0.3, label: "0–0.30 m" },
  { maximum: 0.6, label: "0.30–0.60 m" },
  { maximum: 1, label: "0.60–1.00 m" },
  { maximum: Infinity, label: "1 m超" },
];

const COUNTERS = ["total", "holed", "conceded", "missed", "leave"];

function counts() {
  return { total: 0, holed: 0, conceded: 0, missed: 0, leave: 0 };
}

export function createStats() {
  return {
    ...counts(),
    distances: {},
    finish: { completed: 0, strokes: 0, one: 0, two: 0, threePlus: 0, conceded: 0 },
    centre: 0,
    left: ANGLE_BANDS.map(() => 0),
    right: ANGLE_BANDS.map(() => 0),
    pace: { centre: 0, left: PACE_BANDS.map(() => 0), right: PACE_BANDS.map(() => 0) },
  };
}

function countShot(totals, shot, delta = 1) {
  totals.total += delta;
  if (shot.outcome === "holed") totals.holed += delta;
  if (shot.outcome === "concede") totals.conceded += delta;
  if (shot.outcome === "miss") totals.missed += delta;
  if (shot.outcome === "concede" || shot.outcome === "miss") {
    totals.leave = totals.conceded || totals.missed ? totals.leave + shot.leave * delta : 0;
  }
}

function angleSide(angle) {
  if (!Number.isFinite(angle) || angle === 10) return null;
  if (Math.abs(angle) <= CENTRE_ANGLE) return "centre";
  return angle < 0 ? "left" : "right";
}

function paceDifference(shot) {
  if (shot.outcome === "holed" || !Number.isFinite(shot.distance) || shot.distance < 0) return null;
  const difference = shot.distance - shot.target;
  return Math.sign(difference) * Math.round(Math.abs(difference) * 100) / 100;
}

function paceSide(difference) {
  if (difference === null) return null;
  if (difference < 0) return "left";
  return difference <= 0.3 ? "centre" : "right";
}

function countBand(stats, side, magnitude, bands, delta) {
  if (!side) return;
  if (side === "centre") {
    stats.centre += delta;
    return;
  }
  stats[side][bands.findIndex(({ maximum }) => magnitude <= maximum)] += delta;
}

function adjustShot(stats, shot, delta) {
  countShot(stats, shot, delta);
  if (shot.scenario === "finish" && shot.roundScore != null) {
    stats.finish.completed += delta;
    stats.finish.strokes += shot.roundScore * delta;
    const band = shot.roundScore === 1 ? "one" : shot.roundScore === 2 ? "two" : "threePlus";
    stats.finish[band] += delta;
    if (shot.outcome === "concede") stats.finish.conceded += delta;
  }
  const band = Math.floor(shot.target * 2);
  stats.distances[band] ??= counts();
  countShot(stats.distances[band], shot, delta);
  if (!stats.distances[band].total) delete stats.distances[band];

  countBand(stats, angleSide(shot.angle), Math.abs(shot.angle), ANGLE_BANDS, delta);
  const difference = paceDifference(shot);
  countBand(stats.pace, paceSide(difference), Math.abs(difference), PACE_BANDS, delta);
}

export function addShot(stats, shot) {
  adjustShot(stats, shot, 1);
}

export function removeShot(stats, shot) {
  adjustShot(stats, shot, -1);
}

export function createDailyStats() {
  return { ...counts(), left: 0, centre: 0, right: 0, short: 0, onPace: 0, over: 0 };
}

export function addDailyShot(day, shot) {
  countShot(day, shot);
  const side = angleSide(shot.angle);
  if (side) day[side]++;
  const pace = paceSide(paceDifference(shot));
  if (pace) day[{ left: "short", centre: "onPace", right: "over" }[pace]]++;
}

function addCounts(target, source) {
  for (const key of COUNTERS) target[key] += source[key];
}

export function combineStats(summaries) {
  const result = createStats();
  for (const summary of summaries) {
    addCounts(result, summary);
    for (const [band, totals] of Object.entries(summary.distances)) {
      result.distances[band] ??= counts();
      addCounts(result.distances[band], totals);
    }
    for (const key of Object.keys(result.finish)) result.finish[key] += summary.finish[key];
    result.centre += summary.centre;
    result.pace.centre += summary.pace.centre;
    for (let i = 0; i < ANGLE_BANDS.length; i++) {
      result.left[i] += summary.left[i];
      result.right[i] += summary.right[i];
    }
    for (let i = 0; i < PACE_BANDS.length; i++) {
      result.pace.left[i] += summary.pace.left[i];
      result.pace.right[i] += summary.pace.right[i];
    }
  }
  return result;
}
