export const DEMO_GREEN_SPEED = 244;

export function demoShot(outcome, target) {
  let distance = target;
  let angle = 0;
  if (outcome === "concede") distance -= Math.min(0.45, target * 0.55);
  if (outcome === "miss") {
    if (target >= 2.1) {
      distance -= 1.35;
    } else {
      distance += 1.45;
      angle = -8;
    }
  }
  const speed = 1.83 * Math.sqrt(distance / (DEMO_GREEN_SPEED / 100));
  return { distance, rollSpeed: speed, angle, remaining: 0, speed };
}
