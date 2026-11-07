export const DEMO_GREEN_SPEED = 244;

function angleForOffset(offset, target) {
  return Math.asin(offset / target) * 180 / Math.PI;
}

export function demoShot(outcome, target, random = Math.random, okDistance = 0.5) {
  const side = random() < 0.5 ? -1 : 1;
  let distance;
  let angle;

  if (outcome === "holed") {
    // Keep both the lateral offset and the entry speed inside the capture limit.
    const offset = Math.min(target * 0.68, 0.005 + random() * 0.032);
    angle = angleForOffset(offset, target);
    distance = target + random() * 0.3;
  } else if (target < 0.5) {
    angle = 2 + random() * 5;
    distance = outcome === "concede" ? target - (0.12 + random() * 0.05) : target + 2.3 + random() * 0.5;
  } else {
    // Aim outside the lip so that an overhit demo ball cannot be captured.
    const minimumAngle = angleForOffset(0.06, target);
    const isOK = outcome === "concede";
    const maximumAngle = isOK ? angleForOffset(Math.min(0.16, target * 0.16), target) : 8.8;
    angle = minimumAngle + random() * (maximumAngle - minimumAngle);
    const gap = isOK ? okDistance * (0.39 + random() * 0.29) : 0.65 + random() * 1.05;
    const short = target - gap >= 0.1 && random() < 0.5;
    distance = target + (short ? -gap : gap);
  }

  const speed = 1.83 * Math.sqrt(distance / (DEMO_GREEN_SPEED / 100));
  return { distance, rollSpeed: speed, angle: side * angle, remaining: 0, speed };
}
