export const CENTRE_ANGLE = 0.25;
export const ANGLE_BANDS = [
  { maximum: 0.5, label: "0.25–0.5°" },
  { maximum: 1, label: "0.5–1°" },
  { maximum: 2, label: "1–2°" },
  { maximum: Infinity, label: "2°超" },
];

export const PACE_BANDS = [
  { maximum: 0.25, label: "0.10–0.25 m" },
  { maximum: 0.5, label: "0.25–0.50 m" },
  { maximum: 1, label: "0.50–1.00 m" },
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
    centre: 0,
    left: ANGLE_BANDS.map(() => 0),
    right: ANGLE_BANDS.map(() => 0),
    pace: { centre: 0, left: PACE_BANDS.map(() => 0), right: PACE_BANDS.map(() => 0) },
  };
}

function countShot(totals, shot) {
  totals.total++;
  if (shot.outcome === "holed") totals.holed++;
  if (shot.outcome === "concede") totals.conceded++;
  if (shot.outcome === "miss") totals.missed++;
  if (shot.outcome === "concede" || shot.outcome === "miss") totals.leave += shot.leave;
}

function angleSide(angle) {
  if (!Number.isFinite(angle) || angle === 10) return null;
  if (Math.abs(angle) <= CENTRE_ANGLE) return "centre";
  return angle < 0 ? "left" : "right";
}

function paceDifference(shot) {
  if (!Number.isFinite(shot.distance) || shot.distance < 0) return null;
  const difference = shot.distance - shot.target;
  return Math.sign(difference) * Math.round(Math.abs(difference) * 100) / 100;
}

function paceSide(difference) {
  if (difference === null) return null;
  if (Math.abs(difference) <= 0.1) return "centre";
  return difference < 0 ? "left" : "right";
}

function countBand(stats, side, magnitude, bands) {
  if (!side) return;
  if (side === "centre") {
    stats.centre++;
    return;
  }
  stats[side][bands.findIndex(({ maximum }) => magnitude <= maximum)]++;
}

export function addShot(stats, shot) {
  countShot(stats, shot);
  const band = Math.floor(shot.target * 2);
  stats.distances[band] ??= counts();
  countShot(stats.distances[band], shot);

  countBand(stats, angleSide(shot.angle), Math.abs(shot.angle), ANGLE_BANDS);
  const difference = paceDifference(shot);
  countBand(stats.pace, paceSide(difference), Math.abs(difference), PACE_BANDS);
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
