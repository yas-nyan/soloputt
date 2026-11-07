import { addComparisonShot, createAnalysis, wilsonInterval } from "./analysis-data.mjs";
import { forEachShot } from "./shot-store.mjs";
import { statsDateRange } from "./stats-dates.mjs";

const dateTime = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("ja-JP", { dateStyle: "short" });
const field = (id) => document.getElementById(id);
const percent = (p) => `${Math.round(p * 100)}%`;
const rate = (count, total) => total ? percent(count / total) : "—";
const mean = (sum, count, unit) => count ? `${(sum / count).toFixed(2)}${unit}` : "—";
const signed = (value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
const bandLabel = (lower) => `${lower.toFixed(1)}–${(lower + 0.5).toFixed(1)} m`;

function rows(id, values) {
  const fragment = document.createDocumentFragment();
  for (const row of values) {
    const tr = document.createElement("tr");
    for (const value of row) {
      const td = document.createElement("td");
      td.append(value);
      tr.append(td);
    }
    fragment.append(tr);
  }
  field(id).replaceChildren(fragment);
}

function svgElement(type, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", type);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text) element.textContent = text;
  return element;
}

function drawScatter(points, count) {
  const svg = field("analysis-scatter");
  svg.toggleAttribute("hidden", !count);
  field("analysis-scatter-caption").textContent = count
    ? `直近 ${points.length} / ${count} 球。横は右・左、縦はオーバー・ショート。緑の点がカップです。カップインと角度エラーは除きます。`
    : "表示できる推定停止位置がありません。";
  if (!count) {
    svg.replaceChildren();
    return;
  }
  const xMax = Math.max(0.15, ...points.map(({ x }) => Math.abs(x))) * 1.07;
  const yMax = Math.max(0.35, ...points.map(({ y }) => Math.abs(y))) * 1.07;
  svg.replaceChildren(
    svgElement("line", { x1: 35, x2: 465, y1: 150, y2: 150 }),
    svgElement("line", { x1: 250, x2: 250, y1: 28, y2: 272 }),
    svgElement("text", { x: 38, y: 142 }, `左 ${xMax.toFixed(2)} m`),
    svgElement("text", { x: 462, y: 142, "text-anchor": "end" }, `右 ${xMax.toFixed(2)} m`),
    svgElement("text", { x: 250, y: 19, "text-anchor": "middle" }, `オーバー ${yMax.toFixed(2)} m`),
    svgElement("text", { x: 250, y: 289, "text-anchor": "middle" }, `ショート ${yMax.toFixed(2)} m`),
    ...points.map(({ x, y, outcome }) => svgElement("circle", {
      cx: 250 + 215 * x / xMax, cy: 150 - 122 * y / yMax, r: 3, "data-outcome": outcome,
    })),
    svgElement("circle", { cx: 250, cy: 150, r: 4, class: "cup-point" }),
  );
}

function renderBlocks(blocks) {
  field("analysis-blocks-wrap").hidden = !blocks.length;
  const max = blocks.reduce((maximum, block) => Math.max(maximum, block.angles ? block.angleTotal / block.angles : 0), 0.01);
  rows("analysis-blocks", blocks.map((block, i) => {
    const angle = document.createElement("span");
    angle.textContent = mean(block.angleTotal, block.angles, "°");
    if (block.angles) {
      const bar = document.createElement("span");
      bar.className = "angle-trend";
      bar.style.inlineSize = percent(block.angleTotal / block.angles / max);
      angle.append(bar);
    }
    return [`${i * 10 + 1}–${i * 10 + block.shots}`, angle,
      block.distances ? `${signed(block.errorTotal / block.distances)} m` : "—"];
  }));
}

function renderRounds(result) {
  rows("analysis-rounds", [...result.rounds].sort(([a], [b]) => a - b).map(([lower, total]) => [
    bandLabel(lower), total.completed, mean(total.strokes, total.completed, "打"),
    rate(total.one, total.completed), rate(total.two, total.completed), rate(total.three, total.completed),
    total.knownFirst ? `${mean(total.firstLeave, total.knownFirst, " m")}（${total.knownFirst}回）` : "—",
  ]));
  const gimme = [...result.okDistances].sort((a, b) => (a ?? 2) - (b ?? 2)).map((value) =>
    value === null ? "不明" : value === 0 ? "なし" : value === 1 ? "旧1 m" : `${value * 100} cm`).join("・");
  field("analysis-gimme").textContent = result.rounds.size
    ? `記録時の打数を集計します。OKは実打に1打加算。対象のOK距離は ${gimme} です。`
    : "完了したホールアウトの記録がありません。";
  field("analysis-tests-wrap").hidden = !result.tests.size;
  rows("analysis-tests", [...result.tests].reverse().map(([id, scores]) => {
    const values = [...scores.values()];
    const sum = values.reduce((total, score) => total + score, 0);
    const three = values.filter((score) => score >= 3).length;
    return [dateTime.format(result.sessions.get(id).time), `${scores.size}/20`, `${sum}打`,
      mean(sum, scores.size, "打"), `${rate(three, scores.size)}（${three}回）`];
  }));
}

function render(result, selected, rejudge) {
  const { totals, displayed, recorded } = result;
  field("analysis-count").textContent = totals.shots;
  field("analysis-angle").textContent = mean(totals.angleTotal, totals.angles, "°");
  field("analysis-distance").textContent = totals.distances ? `${signed(totals.errorTotal / totals.distances)} m` : "—";
  field("analysis-rate").textContent = `${rate(displayed.holed, displayed.judged)}（${displayed.holed}/${displayed.judged}）`;
  const session = result.sessions.get(selected);
  const green = [...result.selectedSpeeds].sort((a, b) => a - b).map((speed) => `${(speed / 30.48).toFixed(1)} ft`).join("・");
  field("analysis-environment").textContent = session
    ? [session.theme, session.putter && `パター ${session.putter}`, session.mat && `マット ${session.mat}`, green && `グリーン ${green}`].filter(Boolean).join(" · ") : "";
  const versions = [...result.versions].map(([version, n]) => `${version}（${n}球）`).join("・") || "—";
  field("analysis-model").textContent = rejudge
    ? `記録時は ${rate(recorded.holed, recorded.judged)}、再計算で ${result.changed} 球の判定が変わりました。OK ${recorded.concede}→${displayed.concede} 球、ミス ${recorded.miss}→${displayed.miss} 球。記録時のモデル ${versions}。`
    : `記録時のモデル ${versions}。再計算は記録したOK距離を使い、設定の記録がない球は50 cmとします。`;
  renderBlocks(result.blocks);
  renderRounds(result);
  drawScatter(result.points, result.pointCount);
  const [[kind, n], [, next]] = Object.entries(result.bias).sort((a, b) => b[1] - a[1]);
  const tips = { left: "左へのずれ", right: "右へのずれ", short: "ショート", over: "オーバー" };
  field("analysis-hint").textContent = result.pointCount >= 10 && n > next && n / result.pointCount >= 0.4
    ? `${tips[kind]}が目立ちます（${n}/${result.pointCount}球）。${["left", "right"].includes(kind) ? "固定距離で打ち出しを揃える練習" : "固定距離でタッチを揃える練習"}の目安になります。` : "";
}

function compareCell(totals) {
  if (!totals) return "—";
  const [low, high] = wilsonInterval(totals.holed, totals.judged);
  return `${rate(totals.holed, totals.judged)}（${totals.holed}/${totals.judged}、95%区間 ${percent(low)}–${percent(high)}）`;
}

export function setupAnalysis() {
  const details = field("advanced-analysis");
  const sessions = field("analysis-session");
  const judgment = field("analysis-judgment");
  const content = field("analysis-content");
  const status = field("analysis-status");
  const compareStatus = field("compare-status");
  let scope;
  let revision = 0;
  let compareRevision = 0;

  async function load() {
    if (!details.open || !scope) return;
    const id = ++revision;
    compareRevision++;
    field("compare-wrap").hidden = true;
    compareStatus.textContent = "";
    const rejudge = judgment.value === "current";
    const selected = sessions.value;
    const analysis = createAnalysis({ sessionId: selected, rejudge });
    status.textContent = "分析を読み込み中…";
    try {
      await scope.visit(analysis.add, scope);
      if (id !== revision) return;
      const result = analysis.result;
      sessions.replaceChildren(new Option("すべて", ""), ...[...result.sessions.values()].reverse().map((item) =>
        new Option(`${dateTime.format(item.time)} · ${item.isTest ? "実戦テスト · " : ""}${item.theme || "テーマなし"} · ${item.shots}球`, item.id)));
      if (selected && !result.sessions.has(selected)) {
        load();
        return;
      }
      sessions.value = selected;
      const speedSelect = field("compare-speed");
      const previousSpeed = speedSelect.value;
      const speeds = new Set([214, 244, 275, 305, 336, ...result.speeds]);
      speedSelect.replaceChildren(...[...speeds].sort((a, b) => a - b)
        .map((speed) => new Option(`${(speed / 30.48).toFixed(1)} ft`, speed)));
      speedSelect.value = speeds.has(Number(previousSpeed)) ? previousSpeed : "244";
      render(result, selected, rejudge);
      content.hidden = !result.totals.shots;
      status.textContent = result.totals.shots ? "" : "この条件に該当するショットがありません。";
    } catch {
      if (id !== revision) return;
      content.hidden = true;
      status.textContent = "分析を読み込めませんでした。";
    }
  }

  field("analysis-compare").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!scope) return;
    const id = ++compareRevision;
    const current = scope;
    const a = field("compare-a").value;
    const b = field("compare-b").value;
    const green = Number(field("compare-speed").value);
    const rejudge = judgment.value === "current";
    field("compare-wrap").hidden = true;
    compareStatus.textContent = "比較を読み込み中…";
    try {
      if (a === b) throw new Error("別々の日付を指定してください。");
      const bands = await Promise.all([a, b].map(async (day) => {
        const result = new Map();
        const dateRange = statsDateRange("custom", day, day);
        await current.visit((shot) => addComparisonShot(result, shot, green, rejudge), { scenario: current.scenario, dateRange });
        return result;
      }));
      if (id !== compareRevision) return;
      const [left, right] = bands;
      const keys = [...left.keys()].filter((key) => right.has(key)).sort((x, y) => x - y);
      field("compare-wrap").hidden = !keys.length;
      if (!keys.length) {
        compareStatus.textContent = "この速度で両日に共通する距離帯がありません。";
        return;
      }
      rows("compare-rows", keys.map((key) => [bandLabel(key), compareCell(left.get(key)), compareCell(right.get(key))]));
      const standardized = (day) => percent(keys.reduce((sum, key) => {
        const value = day.get(key);
        return sum + value.holed / value.judged;
      }, 0) / keys.length);
      compareStatus.textContent = `${date.format(statsDateRange("custom", a, a).start)} と ${date.format(statsDateRange("custom", b, b).start)}。共通距離帯を等しく重み付けした率は A ${standardized(left)}、B ${standardized(right)} です。`;
    } catch (error) {
      if (id === compareRevision) compareStatus.textContent = error.message || "比較できませんでした。";
    }
  });

  details.addEventListener("toggle", load);
  sessions.addEventListener("change", load);
  judgment.addEventListener("change", load);
  return (next) => {
    if (!next) {
      scope = undefined;
      revision++;
      compareRevision++;
      content.hidden = true;
      status.textContent = "";
      return;
    }
    scope = { ...next, visit: next.visit ?? forEachShot };
    load();
  };
}
