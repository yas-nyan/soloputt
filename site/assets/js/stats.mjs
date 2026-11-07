import { formatAngle, OUTCOME_LABELS } from "./putting.mjs";
import { readStatsPage } from "./shot-store.mjs";
import { ANGLE_BANDS, combineStats } from "./stats-data.mjs";

const field = (id) => document.getElementById(id);
const status = field("stats-status");
const filter = field("scenario-filter");
const content = field("stats-content");
const newer = field("history-newer");
const older = field("history-older");
const dateTime = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" });
let page;
let requestId = 0;

function rate(count, total) {
  return total ? `${Math.round(100 * count / total)}%` : "—";
}

function averageLeave(totals) {
  const outside = totals.conceded + totals.missed;
  return outside ? `${(totals.leave / outside).toFixed(2)} m` : "—";
}

function renderRows(id, rows) {
  const fragment = document.createDocumentFragment();
  for (const values of rows) {
    const row = document.createElement("tr");
    for (const value of values) {
      const cell = document.createElement("td");
      cell.append(value);
      row.append(cell);
    }
    fragment.append(row);
  }
  field(id).replaceChildren(fragment);
}

function renderDirection(stats) {
  const left = stats.left.reduce((total, count) => total + count, 0);
  const right = stats.right.reduce((total, count) => total + count, 0);
  const total = left + stats.centre + right;
  const counts = [left, stats.centre, right];
  ["left", "centre", "right"].forEach((side, index) => {
    const count = counts[index];
    field(`direction-${side}`).textContent = total ? `${rate(count, total)}（${count}球）` : "—";
  });
  const maximum = Math.max(1, ...stats.left, ...stats.right);
  function bar(count, side) {
    const wrapper = document.createElement("span");
    wrapper.className = `direction-bar ${side}`;
    const value = document.createElement("span");
    value.textContent = count;
    const track = document.createElement("span");
    track.className = "direction-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.inlineSize = `${100 * count / maximum}%`;
    track.append(fill);
    wrapper.append(value, track);
    return wrapper;
  }

  renderRows("direction-stats", ANGLE_BANDS.map(({ label }, index) => [
    bar(stats.left[index], "left"), label, bar(stats.right[index], "right"),
  ]));
  field("direction-chart").hidden = !total;
  field("direction-empty").hidden = total > 0;
}

function render(stats, history) {
  const judged = stats.holed + stats.conceded + stats.missed;
  field("total").textContent = stats.total;
  field("judged").textContent = `判定対象 ${judged} 球`;
  field("rate").textContent = rate(stats.holed, judged);
  field("cup-count").textContent = `${stats.holed} 球カップイン`;
  field("concede-rate").textContent = rate(stats.conceded, judged);
  field("concede-count").textContent = `${stats.conceded} 球がOK圏内`;
  field("average-leave").textContent = averageLeave(stats);

  renderRows("distance-stats", Object.entries(stats.distances).map(([band, totals]) => {
    const lower = Number(band) / 2;
    const count = totals.holed + totals.conceded + totals.missed;
    return [
      `${lower.toFixed(1)}–${(lower + 0.5).toFixed(1)} m`, totals.total,
      count ? `${rate(totals.holed, count)}（${totals.holed}/${count}）` : "—",
      count ? `${rate(totals.conceded, count)}（${totals.conceded}/${count}）` : "—", averageLeave(totals),
    ];
  }));
  renderDirection(stats);

  field("history-count").textContent = `このページ ${history.entries.length} / 全 ${stats.total} 球`;
  renderRows("history", history.entries.map(({ shot }) => [
    dateTime.format(shot.time), shot.scenario === "random" ? "ランダム" : "固定",
    `${shot.target.toFixed(1)} m`, OUTCOME_LABELS[shot.outcome], `${shot.distance.toFixed(2)} m`,
    shot.angle === 10 ? "エラー" : `${formatAngle(shot.angle)}°`,
    `${shot.speed.toFixed(2)} m/s`, shot.leave === null ? "—" : `${shot.leave.toFixed(2)} m`,
  ]));
  newer.disabled = !history.hasNewer;
  older.disabled = !history.hasOlder;
  content.hidden = stats.total === 0;
  status.hidden = stats.total > 0;
  status.textContent = filter.value === "all" ? "記録はまだありません。練習ページで打つと、ここに結果が並びます。"
    : "この練習メニューの記録はまだありません。";
}

async function load(options) {
  const id = ++requestId;
  const scenario = filter.value;
  newer.disabled = true;
  older.disabled = true;
  if (content.hidden) status.textContent = "履歴を読み込み中…";
  try {
    const result = await readStatsPage(scenario, options);
    if (id !== requestId) return;
    page = result;
    render(combineStats(result.summaries), result);
    if (options) {
      const heading = field("history-heading");
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "start" });
    }
  } catch {
    if (id !== requestId) return;
    content.hidden = true;
    status.hidden = false;
    status.textContent = "このブラウザの保存領域から履歴を読み込めませんでした。";
  }
}

newer.addEventListener("click", () => load({ boundary: page.entries[0].key, newer: true }));
older.addEventListener("click", () => load({ boundary: page.entries.at(-1).key }));
filter.addEventListener("change", () => load());
window.addEventListener("pageshow", () => load());
