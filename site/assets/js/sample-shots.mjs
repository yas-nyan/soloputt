import { evaluatePutt, randomTarget } from "./putting.mjs";

export function* generateSampleShots(count, seed, {
  start = Date.UTC(2025, 0, 1) + (seed % 365) * 86_400_000,
  interval = 120_000,
  varyByDay = false,
} = {}) {
  let state = seed;
  function random() {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  }

  function normal() {
    return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  }

  const round = (number) => Number(number.toFixed(2));
  const speeds = [214, 244, 275, 305, 336];
  const fixedTargets = [1, 1.5, 2, 2.5, 3, 4, 5, 6];
  for (let i = 0; i < count; i++) {
    const time = start + i * interval;
    const scenario = i % 3 ? "fixed" : "random";
    const target = scenario === "fixed" ? fixedTargets[Math.floor(i / 12) % fixedTargets.length] : randomTarget(8, 0, random);
    const greenSpeed = speeds[Math.floor(i / 40) % speeds.length];
    const shift = varyByDay ? (new Date(time).getDate() % 2 ? 0.45 : -0.45) : 0;
    const direction = (scenario === "fixed" ? -0.35 : 0.55) + shift;
    const angle = i % 97 === 0 ? 10 : round(Math.max(-9.9, Math.min(9.9, direction + normal() * 0.8)));
    const distance = round(Math.max(0.05, target + normal() * (0.2 + 0.14 * target)));
    const rollSpeed = round(1.83 * Math.sqrt(distance / (greenSpeed / 100)));
    const speed = round(rollSpeed * 1.04);
    const result = evaluatePutt({ distance, angle }, target, greenSpeed);
    yield {
      time, target, scenario, greenSpeed, distance, rollSpeed, angle,
      remaining: 0, speed, outcome: result.outcome, leave: result.remaining ?? null, model: 1,
    };
  }
}
