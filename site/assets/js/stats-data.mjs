export const CENTRE_ANGLE = 0.25;
export const ANGLE_BANDS = [
  { maximum: 0.5, label: "0.25–0.5°" },
  { maximum: 1, label: "0.5–1°" },
  { maximum: 2, label: "1–2°" },
  { maximum: Infinity, label: "2°超" },
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
  };
}

function countShot(totals, shot) {
  totals.total++;
  if (shot.outcome === "holed") totals.holed++;
  if (shot.outcome === "concede") totals.conceded++;
  if (shot.outcome === "miss") totals.missed++;
  if (shot.outcome === "concede" || shot.outcome === "miss") totals.leave += shot.leave;
}

export function addShot(stats, shot) {
  countShot(stats, shot);
  const band = Math.floor(shot.target * 2);
  stats.distances[band] ??= counts();
  countShot(stats.distances[band], shot);

  if (!Number.isFinite(shot.angle) || shot.angle === 10) return;
  const angle = Math.abs(shot.angle);
  if (angle <= CENTRE_ANGLE) {
    stats.centre++;
    return;
  }
  const index = ANGLE_BANDS.findIndex(({ maximum }) => angle <= maximum);
  const side = shot.angle < 0 ? stats.left : stats.right;
  side[index]++;
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
    for (let i = 0; i < ANGLE_BANDS.length; i++) {
      result.left[i] += summary.left[i];
      result.right[i] += summary.right[i];
    }
  }
  return result;
}
