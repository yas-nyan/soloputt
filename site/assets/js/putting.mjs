const CUP_RADIUS = 0.054;
const STIMP_RELEASE_SPEED = 1.83;
const CENTRE_CAPTURE_SPEED = 1.63;

const MIN_TARGET = 0.5;

export function randomTarget(maximum, previous, random = Math.random) {
  const first = Math.round(MIN_TARGET * 10);
  const last = Math.round(maximum * 10);
  const prior = Math.round(previous * 10);
  const omit = prior >= first && prior <= last && first < last;
  const draw = first + Math.floor(random() * (last - first + (omit ? 0 : 1)));
  return (omit && draw >= prior ? draw + 1 : draw) / 10;
}

export function evaluatePutt(shot, target, greenSpeed) {
  if (shot.angle === 10) return { outcome: "unjudged", reason: "angle" };
  if (!(shot.distance >= 0) || !Number.isFinite(shot.distance) ||
      !Number.isFinite(shot.angle) || !Number.isFinite(target) || target < MIN_TARGET) {
    return { outcome: "unjudged", reason: "measurement" };
  }

  const angle = shot.angle * Math.PI / 180;
  const lateral = Math.sin(angle);
  const forward = Math.cos(angle);
  const deceleration = STIMP_RELEASE_SPEED ** 2 / (2 * (greenSpeed / 100));
  const rollTime = Math.sqrt(2 * shot.distance / deceleration);
  const remaining = Math.hypot(shot.distance * lateral, target - shot.distance * forward);
  const motion = { lateral, forward, rollTime, travel: shot.distance, remaining };
  if (!(deceleration > 0) || !Number.isFinite(deceleration) || !Number.isFinite(rollTime)) {
    return { outcome: "unjudged", reason: "green" };
  }

  // Penner (2002), Eq. 23, evaluated at the first intersection with the cup circle.
  const offset = Math.abs(target * lateral);
  if (offset >= CUP_RADIUS || forward <= 0) return { ...motion, outcome: "miss", reason: "line" };
  const entry = target * forward - Math.sqrt(CUP_RADIUS ** 2 - offset ** 2);
  const speedSquared = 2 * deceleration * (shot.distance - entry);
  if (speedSquared <= 0) return { ...motion, outcome: "miss", reason: "short" };

  const limit = CENTRE_CAPTURE_SPEED * (1 - (offset / CUP_RADIUS) ** 2);
  if (Math.sqrt(speedSquared) >= limit) return { ...motion, outcome: "miss", reason: "pace" };
  return { ...motion, outcome: "holed", travel: entry, remaining: 0 };
}

export const OUTCOME_LABELS = { holed: "カップイン", miss: "ミス", unjudged: "判定対象外" };

export function formatAngle(angle) {
  if (angle === 0) return "0.00";
  return `${angle < 0 ? "L" : "R"} ${Math.abs(angle).toFixed(2)}`;
}
