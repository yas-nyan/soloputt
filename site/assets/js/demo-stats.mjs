import { recordStroke } from "./finish-round.mjs";
import { evaluatePutt } from "./putting.mjs";
import { generateSampleShots } from "./sample-shots.mjs";
import { addDailyShot, addShot, createDailyStats, createStats } from "./stats-data.mjs";
import { localDay } from "./stats-dates.mjs";

function* finishExamples(now) {
  for (let i = 0; i < 30; i++) {
    const roundId = `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    const roundStart = 4 + i % 5;
    const time = now - (i + 1) * 4 * 60 * 60 * 1000;
    const greenSpeed = 244;
    let target = roundStart;
    let strokes = 0;
    while (true) {
      const gap = strokes === 0 ? [0, 0.45, 1.35, 1.6, 2.1][i % 5] : i % 5 === 4 ? 0.45 : 0;
      const distance = target - gap;
      const angle = 0;
      const result = evaluatePutt({ distance, angle }, target, greenSpeed);
      const stroke = recordStroke(strokes, result.outcome);
      yield {
        time: time + strokes * 15000, target, scenario: "finish", greenSpeed, distance, angle,
        speed: 1.83 * Math.sqrt(distance / (greenSpeed / 100)),
        leave: result.remaining, outcome: result.outcome, roundId, roundStart,
        roundStroke: stroke.stroke, roundScore: stroke.score,
      };
      if (stroke.score !== null) break;
      target = result.remaining;
      strokes = stroke.stroke;
    }
  }
}

export function createDemoReader(now = Date.now()) {
  const finish = [...finishExamples(now)];
  const count = 1000 - finish.length;
  const span = 6 * 86400000;
  const samples = [...generateSampleShots(count, 42, {
    start: now - span, interval: Math.floor(span / count), varyByDay: true,
  }), ...finish];
  const records = samples.map((shot, id) => ({ shot, key: { time: shot.time, id } }))
    .sort((a, b) => b.key.time - a.key.time || b.key.id - a.key.id);

  return (scenario, { dateRange, boundary, newer, includeStats, pageSize = 50 }) => {
    const matches = records.filter(({ shot }) =>
      (scenario === "all" || shot.scenario === scenario) &&
      (!dateRange || (shot.time >= dateRange.start && shot.time < dateRange.end)));
    const anchor = boundary ? matches.findIndex(({ key }) => key.id === boundary.id) : -1;
    const start = newer ? Math.max(0, anchor - pageSize) : anchor + 1;
    const end = newer ? anchor : start + pageSize;
    const page = {
      entries: matches.slice(start, end), hasOlder: end < matches.length, hasNewer: start > 0,
    };
    if (!includeStats) return page;

    const summary = createStats();
    const daily = new Map();
    for (const { shot } of matches) {
      addShot(summary, shot);
      const day = localDay(shot.time);
      if (!daily.has(day)) {
        if (!dateRange && daily.size === 7) continue;
        daily.set(day, createDailyStats());
      }
      addDailyShot(daily.get(day), shot);
    }
    return { ...page, summaries: [summary], daily };
  };
}
