export function recordStroke(previousStrokes, outcome) {
  if (outcome === "unjudged") return null;
  const stroke = previousStrokes + 1;
  const score = outcome === "holed" ? stroke : outcome === "concede" ? stroke + 1 : null;
  return { stroke, score };
}
