import { recordStroke } from "./finish-round.mjs";
import { evaluatePutt, formatAngle, OUTCOME_LABELS, randomTarget } from "./putting.mjs";
import { saveShot } from "./shot-store.mjs";

const BALL_X = 260;
const BALL_Y = 230;
const CUP_Y = 64;
const FEEDBACK_MARKS = { holed: "✓", concede: "OK", miss: "↻" };
const REASONS = {
  angle: "打ち出し方向を読み取れませんでした",
  measurement: "計測値を確認できませんでした",
  green: "グリーン速度を取得できませんでした",
  line: "カップの横を通過するライン",
  short: "カップの手前で停止",
  pace: "カップに届く速度が速すぎました",
};

export function setupPractice() {
  const field = (id) => document.getElementById(id);
  const form = field("practice-form");
  const range = field("target-range");
  const ball = field("ball");
  const trail = field("trail");
  const course = field("practice-course");
  const feedback = field("course-feedback");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let scenario = "fixed";
  let limit = 3;
  let target = 3;
  let greenSpeed = null;
  let ready = false;
  let shots = 0;
  let frame;
  let next;
  let saveFailures = 0;
  let round;
  let pendingRound;

  function hideFeedback() {
    feedback.hidden = true;
    delete course.dataset.feedback;
  }

  function showFeedback(result, detail) {
    course.dataset.feedback = result.outcome;
    feedback.dataset.tone = result.outcome;
    field("feedback-mark").textContent = FEEDBACK_MARKS[result.outcome];
    field("feedback-title").textContent = OUTCOME_LABELS[result.outcome];
    field("feedback-detail").textContent = detail;
    feedback.hidden = false;
  }

  function showTarget() {
    hideFeedback();
    field("target").textContent = target.toFixed(round?.strokes ? 2 : 1);
    field("remaining").textContent = target.toFixed(2);
    field("scenario-label").textContent = scenario === "random" ? `${limit.toFixed(1)} m以内ランダム`
      : round ? "打ち切り" : "固定距離";
    field("round-progress").hidden = !round;
    if (round) field("round-progress").textContent = `開始 ${limit.toFixed(1)} m · 次は ${round.strokes + 1} 打目`;
    field("round-status").textContent = ready ? "準備完了" : "接続待ち";
    ball.setAttribute("cx", BALL_X);
    ball.setAttribute("cy", BALL_Y);
    ball.setAttribute("r", 5);
    trail.setAttribute("x2", BALL_X);
    trail.setAttribute("y2", BALL_Y);
  }

  function stopAnimation() {
    cancelAnimationFrame(frame);
    clearTimeout(next);
  }

  function startRound() {
    target = limit;
    round = { id: crypto.randomUUID(), strokes: 0 };
  }

  function advanceRound() {
    if (!pendingRound) return;
    if (pendingRound.score === null) target = pendingRound.remaining;
    else startRound();
    pendingRound = undefined;
  }

  form.addEventListener("change", (event) => {
    if (event.target.name !== "scenario") return;
    const labels = { fixed: "目標距離", random: "ランダムの上限", finish: "打ち切りの開始距離" };
    field("target-label").textContent = labels[event.target.value];
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selection = new FormData(form);
    limit = range.valueAsNumber;
    scenario = selection.get("scenario");
    pendingRound = undefined;
    round = undefined;
    if (scenario === "finish") startRound();
    else target = scenario === "random" ? randomTarget(limit, target) : limit;
    field("round-notice").textContent = "";
    stopAnimation();
    showTarget();
  });

  function setReady(value) {
    ready = value;
    if (!ready) {
      stopAnimation();
      advanceRound();
      showTarget();
    } else {
      field("round-status").textContent = "準備完了";
    }
  }

  function setGreen(settings) {
    greenSpeed = settings ? Number(settings.greenSpeed) : null;
    const feet = greenSpeed > 0 ? `${(greenSpeed / 30.48).toFixed(1)} ft` : "—";
    field("green-speed").textContent = settings?.greenSpeedLabel ?? feet;
  }

  function animate(shot, result, roundResult) {
    hideFeedback();
    const scale = (BALL_Y - CUP_Y) / target;
    const capture = result.outcome === "holed";
    const fraction = shot.distance > 0 ? 1 - Math.sqrt(Math.max(0, 1 - result.travel / shot.distance)) : 0;
    const duration = Math.min(2400, Math.max(300, result.rollTime * fraction * 1000));

    function draw(progress) {
      const phase = progress * fraction;
      const distance = shot.distance * (2 * phase - phase ** 2);
      const caught = progress === 1 && capture;
      const x = caught ? BALL_X : BALL_X + result.lateral * distance * scale;
      const y = caught ? CUP_Y : BALL_Y - result.forward * distance * scale;
      ball.setAttribute("cx", x);
      ball.setAttribute("cy", y);
      ball.setAttribute("r", caught ? 2 : 5);
      trail.setAttribute("x2", x);
      trail.setAttribute("y2", y);
      const remaining = progress === 1 ? result.remaining
        : Math.hypot(result.lateral * distance, target - result.forward * distance);
      field("remaining").textContent = remaining.toFixed(2);
    }

    function finish() {
      field("round-status").textContent = OUTCOME_LABELS[result.outcome];
      const detail = roundResult?.score != null
        ? `${roundResult.score} 打で完了${capture ? "" : "（OKの +1 打込み）"}`
        : capture ? "ナイスパット！" : `カップまで ${result.remaining.toFixed(2)} m`;
      showFeedback(result, detail);
      if (roundResult) {
        next = setTimeout(() => {
          advanceRound();
          field("round-notice").textContent = "";
          showTarget();
        }, roundResult.score === null ? 900 : 1800);
      } else if (scenario === "random") {
        next = setTimeout(() => {
          target = randomTarget(limit, target);
          showTarget();
        }, 1200);
      }
    }

    if (reducedMotion.matches || result.travel === 0) {
      draw(1);
      finish();
      return;
    }

    field("round-status").textContent = "転がり中";
    const start = performance.now();
    function step(now) {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      draw(progress);
      if (progress < 1) frame = requestAnimationFrame(step);
      else finish();
    }
    frame = requestAnimationFrame(step);
  }

  function showShot(shot) {
    if (pendingRound) {
      field("round-notice").textContent = "次の「準備完了」が出てから打ってください。";
      return;
    }
    stopAnimation();
    const result = evaluatePutt(shot, target, greenSpeed);
    const stroke = round ? recordStroke(round.strokes, result.outcome) : null;
    if (stroke) {
      round.strokes = stroke.stroke;
      pendingRound = { score: stroke.score, remaining: result.remaining };
    }
    const number = ++shots;
    field("shot-count").textContent = `${number} 球`;
    field("shot-target").textContent = `目標 ${target.toFixed(round ? 2 : 1)} m`;
    field("shot-round").hidden = !stroke;
    if (stroke) {
      field("shot-round").textContent = stroke.score === null ? `${stroke.stroke} 打目 · 残り ${result.remaining.toFixed(2)} m`
        : `${stroke.score} 打で完了${result.outcome === "concede" ? "（OKの +1 打込み）" : ""}`;
    }
    field("shot-outcome").textContent = OUTCOME_LABELS[result.outcome];
    field("shot-outcome").dataset.outcome = result.outcome;
    field("shot-reason").textContent = REASONS[result.reason] ?? "カップに収まりました";
    field("shot-distance").textContent = shot.distance.toFixed(2);
    field("shot-angle").textContent = shot.angle === 10 ? "エラー" : formatAngle(shot.angle);
    field("angle-unit").hidden = shot.angle === 10;
    field("shot-speed").textContent = shot.speed.toFixed(2);
    field("shot-remaining").textContent = result.remaining?.toFixed(2) ?? "—";

    if (result.outcome === "unjudged") {
      showTarget();
      field("round-status").textContent = "判定対象外";
    } else {
      animate(shot, result, stroke);
    }

    saveShot({
      time: Date.now(), target, scenario, greenSpeed, ...shot,
      outcome: result.outcome, leave: result.remaining ?? null, model: 1,
      ...(stroke ? { roundId: round.id, roundStart: limit, roundStroke: stroke.stroke, roundScore: stroke.score } : {}),
    }).catch(() => {
      field("save-status").textContent = `${++saveFailures} 球を履歴に保存できませんでした`;
    });
  }

  showTarget();
  return { setReady, setGreen, showShot };
}
