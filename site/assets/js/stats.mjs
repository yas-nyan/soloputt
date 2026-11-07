import { setupCSVTools } from "./csv-tools.mjs";
import { formatAngle, OUTCOME_LABELS } from "./putting.mjs";
import { readStatsPage } from "./shot-store.mjs";
import { dateInputValue, statsDateRange } from "./stats-dates.mjs";
import { ANGLE_BANDS, PACE_BANDS, combineStats } from "./stats-data.mjs";

const field = (id) => document.getElementById(id);
const status = field("stats-status");
const filter = field("scenario-filter");
const period = field("period-filter");
const from = field("stats-from");
const to = field("stats-to");
const content = field("stats-content");
const newer = field("history-newer");
const older = field("history-older");
const dateTime = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" });
let page;
let selectedRange;
let selectedTotal;
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

function metric(text, tone) {
  const label = document.createElement("span");
  label.className = "metric";
  label.dataset.tone = tone;
  label.textContent = text;
  return label;
}

function renderDistribution(prefix, stats, bands) {
  const left = stats.left.reduce((total, count) => total + count, 0);
  const right = stats.right.reduce((total, count) => total + count, 0);
  const total = left + stats.centre + right;
  const counts = [left, stats.centre, right];
  ["left", "centre", "right"].forEach((side, index) => {
    const count = counts[index];
    const detail = document.createElement("span");
    detail.className = "direction-count";
    if (total) detail.textContent = `${count}球`;
    field(`${prefix}-${side}`).replaceChildren(rate(count, total), detail);
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

  renderRows(`${prefix}-stats`, bands.map(({ label }, index) => [
    bar(stats.left[index], "left"), label, bar(stats.right[index], "right"),
  ]));
  field(`${prefix}-chart`).hidden = !total;
  field(`${prefix}-empty`).hidden = total > 0;
}

function rateWithCount(count, total) {
  return total ? `${rate(count, total)}（${count}球）` : "—";
}

function renderDaily(daily, dateRange) {
  field("daily-scope").textContent = dateRange ? "選んだ期間の練習日" : "直近7練習日";
  renderRows("daily-stats", [...daily].map(([day, stats]) => {
    const angleTotal = stats.left + stats.centre + stats.right;
    const paceTotal = stats.short + stats.onPace + stats.over;
    const judged = stats.holed + stats.conceded + stats.missed;
    return [
      date.format(day), stats.total, metric(rateWithCount(stats.left, angleTotal), "left"),
      metric(rateWithCount(stats.centre, angleTotal), "neutral"), metric(rateWithCount(stats.right, angleTotal), "right"),
      metric(rateWithCount(stats.short, paceTotal), "short"), metric(rateWithCount(stats.holed, judged), "holed"),
      metric(rateWithCount(stats.over, paceTotal), "over"),
    ];
  }));
}

function renderStats(stats, daily, dateRange) {
  const judged = stats.holed + stats.conceded + stats.missed;
  selectedTotal = stats.total;
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
      count ? metric(`${rate(totals.holed, count)}（${totals.holed}/${count}）`, "holed") : "—",
      count ? metric(`${rate(totals.conceded, count)}（${totals.conceded}/${count}）`, "concede") : "—", averageLeave(totals),
    ];
  }));
  renderDistribution("direction", stats, ANGLE_BANDS);
  renderDistribution("pace", stats.pace, PACE_BANDS);
  renderDaily(daily, dateRange);

  content.hidden = stats.total === 0;
  status.hidden = stats.total > 0;
  status.textContent = dateRange || filter.value !== "all" ? "この条件に該当する記録はありません。"
    : "記録はまだありません。練習ページで打つと、ここに結果が並びます。";
}

function renderHistory(history) {
  field("history-count").textContent = `このページ ${history.entries.length} / 全 ${selectedTotal} 球`;
  renderRows("history", history.entries.map(({ shot }) => [
    dateTime.format(shot.time), shot.scenario === "random" ? "ランダム" : "固定",
    `${shot.target.toFixed(1)} m`, metric(OUTCOME_LABELS[shot.outcome], shot.outcome), `${shot.distance.toFixed(2)} m`,
    shot.angle === 10 ? "エラー" : `${formatAngle(shot.angle)}°`,
    `${shot.speed.toFixed(2)} m/s`, shot.leave === null ? "—" : `${shot.leave.toFixed(2)} m`,
  ]));
  newer.disabled = !history.hasNewer;
  older.disabled = !history.hasOlder;
}

async function load(options) {
  const id = ++requestId;
  const scenario = filter.value;
  newer.disabled = true;
  older.disabled = true;
  if (content.hidden) status.textContent = "履歴を読み込み中…";
  let dateRange;
  try {
    dateRange = options ? selectedRange : statsDateRange(period.value, from.value, to.value);
  } catch (error) {
    content.hidden = true;
    status.hidden = false;
    status.textContent = error.message;
    return;
  }

  try {
    const result = await readStatsPage(scenario, { ...options, dateRange, includeStats: !options });
    if (id !== requestId) return;
    page = result;
    selectedRange = dateRange;
    if (!options) renderStats(combineStats(result.summaries), result.daily, dateRange);
    renderHistory(result);
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
function updatePeriod() {
  const custom = period.value === "custom";
  field("custom-range").hidden = !custom;
  if (custom) {
    const range = statsDateRange("week");
    if (!from.value) from.value = dateInputValue(range.start);
    if (!to.value) to.value = dateInputValue(range.end - 1);
  }
  load();
}

filter.addEventListener("change", () => load());
period.addEventListener("change", updatePeriod);
from.addEventListener("change", () => load());
to.addEventListener("change", () => load());
window.addEventListener("pageshow", updatePeriod);

setupCSVTools(() => load());
