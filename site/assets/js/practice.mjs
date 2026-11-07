import { evaluatePutt, formatAngle, OUTCOME_LABELS, randomTarget } from "./putting.mjs";
import { saveShot } from "./shot-store.mjs";

const BALL_X = 260;
const BALL_Y = 230;
const CUP_Y = 64;
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

  function showTarget() {
    field("target").textContent = target.toFixed(1);
    field("remaining").textContent = target.toFixed(2);
    field("scenario-label").textContent = scenario === "random" ? `${limit.toFixed(1)} m以内ランダム` : "固定距離";
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selection = new FormData(form);
    limit = range.valueAsNumber;
    scenario = selection.get("scenario");
    target = scenario === "random" ? randomTarget(limit, target) : limit;
    stopAnimation();
    showTarget();
  });

  function setReady(value) {
    ready = value;
    if (!ready) {
      stopAnimation();
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

  function animate(shot, result) {
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
      if (scenario === "random") {
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
    stopAnimation();
    const result = evaluatePutt(shot, target, greenSpeed);
    const number = ++shots;
    field("shot-count").textContent = `${number} 球`;
    field("shot-target").textContent = `目標 ${target.toFixed(1)} m`;
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
      animate(shot, result);
    }

    saveShot({
      time: Date.now(), target, scenario, greenSpeed, ...shot,
      outcome: result.outcome, leave: result.remaining ?? null, model: 1,
    }).catch(() => {
      field("save-status").textContent = `${++saveFailures} 球を履歴に保存できませんでした`;
    });
  }

  showTarget();
  return { setReady, setGreen, showShot };
}
