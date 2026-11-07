import { formatAngle, OUTCOME_LABELS } from "./putting.mjs";
import { readShots } from "./shot-store.mjs";

const field = (id) => document.getElementById(id);
const status = field("stats-status");
const filter = field("scenario-filter");
const content = field("stats-content");
const dateTime = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" });
let records = [];

function summarize(shots) {
  let holed = 0;
  let missed = 0;
  let leave = 0;
  for (const shot of shots) {
    if (shot.outcome === "holed") holed++;
    if (shot.outcome === "miss") {
      missed++;
      leave += shot.leave;
    }
  }
  const judged = holed + missed;
  return {
    holed,
    judged,
    rate: judged ? `${Math.round(100 * holed / judged)}%` : "—",
    average: missed ? `${(leave / missed).toFixed(2)} m` : "—",
  };
}

function renderRows(id, rows) {
  const fragment = document.createDocumentFragment();
  for (const values of rows) {
    const row = document.createElement("tr");
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }
  field(id).replaceChildren(fragment);
}

function render() {
  const shots = filter.value === "all" ? records : records.filter((shot) => shot.scenario === filter.value);
  const summary = summarize(shots);
  const groups = new Map();
  for (const shot of shots) {
    if (!groups.has(shot.target)) groups.set(shot.target, []);
    groups.get(shot.target).push(shot);
  }
  field("total").textContent = shots.length;
  field("judged").textContent = `判定対象 ${summary.judged} 球`;
  field("rate").textContent = summary.rate;
  field("cup-count").textContent = `${summary.holed} 球カップイン`;
  field("average-leave").textContent = summary.average;

  renderRows("distance-stats", [...groups].sort(([a], [b]) => a - b).map(([target, group]) => {
    const { rate, holed, judged, average } = summarize(group);
    return [`${target.toFixed(1)} m`, group.length, judged ? `${rate}（${holed}/${judged}）` : "—", average];
  }));

  const history = shots.slice(-50).reverse();
  field("history-count").textContent = `直近 ${history.length} / ${shots.length} 球`;
  renderRows("history", history.map((shot) => [
    dateTime.format(shot.time), shot.scenario === "random" ? "ランダム" : "固定",
    `${shot.target.toFixed(1)} m`, OUTCOME_LABELS[shot.outcome], `${shot.distance.toFixed(2)} m`,
    shot.angle === 10 ? "エラー" : `${formatAngle(shot.angle)}°`,
    `${shot.speed.toFixed(2)} m/s`, shot.leave === null ? "—" : `${shot.leave.toFixed(2)} m`,
  ]));

  content.hidden = shots.length === 0;
  status.hidden = shots.length > 0;
  status.textContent = records.length ? "この練習メニューの記録はまだありません。" : "記録はまだありません。練習ページで打つと、ここに結果が並びます。";
}

async function load() {
  try {
    records = await readShots();
    render();
  } catch {
    content.hidden = true;
    status.hidden = false;
    status.textContent = "このブラウザの保存領域から履歴を読み込めませんでした。";
  }
}

filter.addEventListener("change", render);
window.addEventListener("pageshow", load);
