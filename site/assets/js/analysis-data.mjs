import { evaluatePutt } from "./putting.mjs";

const MAX_POINTS = 400;

function measurements() {
  return { shots: 0, angleTotal: 0, angles: 0, errorTotal: 0, distances: 0 };
}

function validAngle(shot) {
  return Number.isFinite(shot.angle) && shot.angle !== 10;
}

function validDistance(shot) {
  return Number.isFinite(shot.distance) && shot.distance >= 0;
}

function measure(totals, shot) {
  totals.shots++;
  if (validAngle(shot)) {
    totals.angleTotal += Math.abs(shot.angle);
    totals.angles++;
  }
  if (validDistance(shot)) {
    totals.errorTotal += shot.distance - shot.target;
    totals.distances++;
  }
}

export function stoppingOffset(shot) {
  if (!validAngle(shot) || !validDistance(shot)) return null;
  const angle = shot.angle * Math.PI / 180;
  return { x: shot.distance * Math.sin(angle), y: shot.distance * Math.cos(angle) - shot.target };
}

export function distanceBand(target) {
  return Math.floor(target * 2) / 2;
}

function createRoundTotals() {
  return { completed: 0, strokes: 0, one: 0, two: 0, three: 0, firstLeave: 0, knownFirst: 0 };
}

function countRound(totals, shot, leave) {
  totals.completed++;
  totals.strokes += shot.roundScore;
  if (shot.roundScore === 1) totals.one++;
  else if (shot.roundScore === 2) totals.two++;
  else totals.three++;
  if (Number.isFinite(leave)) {
    totals.firstLeave += leave;
    totals.knownFirst++;
  }
}

export function createAnalysis({ sessionId = "", rejudge = false } = {}) {
  const result = {
    sessions: new Map(), rounds: new Map(), tests: new Map(),
    totals: measurements(), blocks: [], points: [], pointCount: 0,
    recorded: { judged: 0, holed: 0, concede: 0, miss: 0, unjudged: 0 },
    displayed: { judged: 0, holed: 0, concede: 0, miss: 0, unjudged: 0 }, changed: 0,
    versions: new Map(), speeds: new Set(), selectedSpeeds: new Set(), bias: { left: 0, right: 0, short: 0, over: 0 },
  };
  const firstLeaves = new Map();

  function add(shot) {
    if (shot.sessionId) {
      if (!result.sessions.has(shot.sessionId)) result.sessions.set(shot.sessionId, {
        id: shot.sessionId, time: shot.time, theme: shot.sessionTheme, putter: shot.sessionPutter, mat: shot.sessionMat, shots: 0, isTest: false,
      });
      const session = result.sessions.get(shot.sessionId);
      session.shots++;
      if (shot.testHole) session.isTest = true;
    }
    if (Number.isFinite(shot.greenSpeed) && shot.greenSpeed > 0) result.speeds.add(shot.greenSpeed);
    if (sessionId && shot.sessionId !== sessionId) return;

    if (Number.isFinite(shot.greenSpeed) && shot.greenSpeed > 0) result.selectedSpeeds.add(shot.greenSpeed);
    const version = shot.model ?? "不明";
    result.versions.set(version, (result.versions.get(version) ?? 0) + 1);
    const blockIndex = Math.floor(result.totals.shots / 10);
    measure(result.totals, shot);
    if (sessionId) {
      result.blocks[blockIndex] ??= measurements();
      measure(result.blocks[blockIndex], shot);
    }

    const outcome = rejudge ? evaluatePutt(shot, shot.target, shot.greenSpeed).outcome : shot.outcome;
    result.recorded[shot.outcome]++;
    result.displayed[outcome]++;
    if (shot.outcome !== "unjudged") result.recorded.judged++;
    if (outcome !== "unjudged") result.displayed.judged++;
    if (outcome !== shot.outcome) result.changed++;

    const point = outcome === "holed" ? null : stoppingOffset(shot);
    if (point) {
      result.points[result.pointCount % MAX_POINTS] = { ...point, outcome };
      result.pointCount++;
      if (point.x < -0.05) result.bias.left++;
      if (point.x > 0.05) result.bias.right++;
      if (point.y < -0.3) result.bias.short++;
      if (point.y > 0.3) result.bias.over++;
    }

    if (shot.roundStroke === 1 && shot.roundId && shot.roundFirstLeave == null) firstLeaves.set(shot.roundId, shot.leave);
    if (shot.roundScore == null) return;
    const band = distanceBand(shot.roundStart ?? shot.target);
    const firstLeave = shot.roundFirstLeave ?? firstLeaves.get(shot.roundId);
    firstLeaves.delete(shot.roundId);
    if (!result.rounds.has(band)) result.rounds.set(band, createRoundTotals());
    countRound(result.rounds.get(band), shot, firstLeave);
    if (shot.testHole && shot.sessionId) {
      if (!result.tests.has(shot.sessionId)) result.tests.set(shot.sessionId, new Map());
      result.tests.get(shot.sessionId).set(shot.testHole, shot.roundScore);
    }
  }

  return { add, result };
}

export function addComparisonShot(bands, shot, greenSpeed, rejudge) {
  if (shot.greenSpeed !== greenSpeed) return;
  const outcome = rejudge ? evaluatePutt(shot, shot.target, shot.greenSpeed).outcome : shot.outcome;
  if (outcome === "unjudged") return;
  const band = distanceBand(shot.target);
  if (!bands.has(band)) bands.set(band, { judged: 0, holed: 0 });
  const totals = bands.get(band);
  totals.judged++;
  if (outcome === "holed") totals.holed++;
}

export function wilsonInterval(holed, total) {
  if (!total) return null;
  const z = 1.96;
  const p = holed / total;
  const denominator = 1 + z ** 2 / total;
  const centre = p + z ** 2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * total)) / total);
  return [Math.max(0, (centre - margin) / denominator), Math.min(1, (centre + margin) / denominator)];
}
