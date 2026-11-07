import { setupPracticeSession } from "./practice-session.mjs";
import { recordStroke } from "./finish-round.mjs";
import { evaluatePutt, formatAngle, formatShotSummary, OUTCOME_LABELS, randomTarget, SHOT_MODEL_VERSION } from "./putting.mjs";
import { DEMO_GREEN_SPEED, demoShot } from "./practice-demo.mjs";
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
  const session = setupPracticeSession();
  const distance = field("target-range");
  const minimum = field("distance-min");
  const maximum = field("distance-max");
  const ball = field("ball");
  const trail = field("trail");
  const course = field("practice-course");
  const feedback = field("course-feedback");
  const demoControls = field("demo-controls");
  const demoButtons = demoControls.querySelectorAll("button[data-demo-outcome]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let scenario = "fixed";
  let distanceRange = { min: 3, max: 3 };
  let randomDistance = false;
  let target = 3;
  let greenSpeed = null;
  let ready = false;
  let shots = 0;
  let frame;
  let next;
  let saveFailures = 0;
  let round;
  let pendingRound;
  let demo = false;
  let demoShots = 0;
  let testSelected = false;
  let test;
  let draftMode = "practice";
  const rangeDrafts = { practice: [minimum.value, maximum.value], test: ["1.5", "8.0"] };

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

  function setDemoBusy(busy) {
    for (const button of demoButtons) {
      button.disabled = busy || test?.scores.length === 20;
    }
  }

  function showTestProgress() {
    const progress = field("test-progress");
    progress.hidden = !test;
    if (!test) return;
    const completed = test.scores.length;
    const total = test.scores.reduce((sum, score) => sum + score, 0);
    progress.textContent = completed === 20
      ? `20ホール完了 · 合計 ${total} 打 · 平均 ${(total / 20).toFixed(2)} 打 · 3パット以上 ${test.scores.filter((score) => score >= 3).length} 回`
      : `${completed + 1}/20 H · このホール${round.strokes}打 · 完了分${total}打`;
  }

  function showTarget() {
    hideFeedback();
    if (demo) setDemoBusy(false);
    field("distance-label").textContent = "目標距離";
    field("remaining").textContent = target.toFixed(2);
    field("shot-distance-progress").textContent = "—";
    const range = `${distanceRange.min.toFixed(1)}〜${distanceRange.max.toFixed(1)} m`;
    const roundLabel = test ? "20ホール" : "ホールアウト";
    field("scenario-label").textContent = round ? randomDistance ? `${roundLabel} · ${range}` : roundLabel
      : randomDistance ? `${range} ランダム` : "固定距離";
    field("round-progress").hidden = !round;
    if (round) field("round-progress").textContent = `開始 ${round.start.toFixed(1)} m · 次は ${round.strokes + 1} 打目`;
    const completed = test?.scores.length === 20;
    field("round-status").textContent = completed ? "テスト完了" : ready ? "準備完了" : "接続待ち";
    showTestProgress();
    if (completed) field("round-progress").hidden = true;
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

  function nextDistance(previous) {
    const { min, max } = distanceRange;
    return randomDistance ? randomTarget(min, max, previous) : min;
  }

  function startRound() {
    target = nextDistance(round?.start);
    round = { start: target, strokes: 0 };
  }

  function advanceRound() {
    if (!pendingRound) return;
    if (pendingRound.score === null) target = pendingRound.remaining;
    else {
      test?.scores.push(pendingRound.score);
      if (test?.scores.length !== 20) startRound();
    }
    pendingRound = undefined;
  }

  function usesRandomDistance(selection) {
    const mode = selection.get("scenario");
    return mode === "random" || mode === "test" || (mode === "finish" && selection.get("finish-distance") === "random");
  }

  function updateDistanceFields() {
    const selection = new FormData(form);
    const mode = selection.get("scenario");
    const testing = mode === "test";
    const finish = mode === "finish" || testing;
    const random = usesRandomDistance(selection);
    const nextDraftMode = testing ? "test" : "practice";
    if (draftMode !== nextDraftMode) {
      rangeDrafts[draftMode] = [minimum.value, maximum.value];
      draftMode = nextDraftMode;
      [minimum.value, maximum.value] = rangeDrafts[draftMode];
    }
    field("finish-distance-options").hidden = !finish;
    field("finish-start-choice").hidden = testing;
    field("single-distance").hidden = random;
    field("random-range").hidden = !random;
    field("target-label").textContent = finish ? "開始距離" : "目標距離";
    field("apply-practice").textContent = testing ? "20ホールを開始" : "目標を適用";
    distance.disabled = random;
    minimum.disabled = !random;
    maximum.disabled = !random;
    maximum.setCustomValidity("");
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "scenario" || event.target.name === "finish-distance") updateDistanceFields();
  });
  form.addEventListener("input", () => maximum.setCustomValidity(""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selection = new FormData(form);
    const random = usesRandomDistance(selection);
    const min = random ? minimum.valueAsNumber : distance.valueAsNumber;
    const max = random ? maximum.valueAsNumber : min;
    if (min > max) {
      maximum.setCustomValidity("上限は下限以上にしてください。");
      maximum.reportValidity();
      return;
    }
    distanceRange = { min, max };
    randomDistance = random;
    const mode = selection.get("scenario");
    testSelected = mode === "test";
    scenario = testSelected ? "finish" : mode;
    resetTest();
    pendingRound = undefined;
    round = undefined;
    if (scenario === "finish") startRound();
    else target = nextDistance(target);
    field("round-notice").textContent = "";
    stopAnimation();
    showTarget();
  });

  function resetTest() {
    test = testSelected ? {
      scores: [], metadata: !demo && window.isSecureContext ? session.create("実戦テスト20ホール") : undefined,
    } : undefined;
  }

  function setReady(value) {
    ready = value;
    if (!ready) {
      stopAnimation();
      advanceRound();
      showTarget();
    } else {
      field("round-status").textContent = test?.scores.length === 20 ? "テスト完了" : "準備完了";
    }
  }

  function setGreen(settings) {
    greenSpeed = settings ? Number(settings.greenSpeed) : null;
    const feet = greenSpeed > 0 ? `${(greenSpeed / 30.48).toFixed(1)} ft` : "—";
    field("green-speed").textContent = settings?.greenSpeedLabel ?? feet;
  }

  function animate(shot, result, roundResult) {
    hideFeedback();
    field("distance-label").textContent = "残り距離";
    const scale = (BALL_Y - CUP_Y) / target;
    const capture = result.outcome === "holed";
    const fraction = shot.distance > 0 ? 1 - Math.sqrt(Math.max(0, 1 - result.travel / shot.distance)) : 0;
    const duration = Math.min(2400, Math.max(300, result.rollTime * fraction * 1000));

    function draw(progress) {
      const phase = progress * fraction;
      const distance = shot.distance * (2 * phase - phase ** 2);
      const distanceProgress = result.travel > 0 ? Math.min(1, distance / result.travel) : progress;
      field("shot-distance-progress").textContent = (shot.distance * distanceProgress).toFixed(2);
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
          target = nextDistance(target);
          showTarget();
        }, 1200);
      } else {
        next = setTimeout(showTarget, 1200);
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

  function receiveShot(shot, persist) {
    if (test?.scores.length === 20) return;
    if (pendingRound) {
      field("round-notice").textContent = "次の「準備完了」が出てから打ってください。";
      return;
    }
    stopAnimation();
    const result = evaluatePutt(shot, target, greenSpeed);
    const summary = field("green-shot-summary");
    summary.textContent = formatShotSummary(shot, target, result.remaining);
    summary.hidden = false;
    const stroke = round ? recordStroke(round.strokes, result.outcome) : null;
    if (stroke) {
      if (stroke.stroke === 1) {
        round.firstLeave = result.remaining;
        round.session = test?.metadata ?? session.current;
      }
      round.strokes = stroke.stroke;
      pendingRound = { score: stroke.score, remaining: result.remaining };
      if (test) showTestProgress();
    }
    const number = persist ? ++shots : ++demoShots;
    field("shot-count").textContent = `${number} 球`;
    field("shot-target").textContent = `目標 ${target.toFixed(round ? 2 : 1)} m`;
    field("shot-round").hidden = !stroke;
    if (stroke) {
      field("shot-round").textContent = stroke.score === null ? `${stroke.stroke} 打目 · 残り ${result.remaining.toFixed(2)} m`
        : `${stroke.score} 打で完了${result.outcome === "concede" ? "（OKの +1 打込み）" : ""}`;
    }
    field("shot-outcome").textContent = OUTCOME_LABELS[result.outcome];
    field("shot-outcome").dataset.outcome = result.outcome;
    const reason = result.reason === "line" && shot.distance < target ? "short" : result.reason;
    field("shot-reason").textContent = REASONS[reason] ?? "カップに収まりました";
    field("shot-distance").textContent = shot.distance.toFixed(2);
    const angle = shot.angle === 10 ? "エラー" : formatAngle(shot.angle);
    field("shot-angle").textContent = angle;
    field("green-angle").textContent = shot.angle === 10 ? angle : `${angle}°`;
    field("angle-unit").hidden = shot.angle === 10;
    field("shot-speed").textContent = shot.speed.toFixed(2);
    field("shot-remaining").textContent = result.remaining?.toFixed(2) ?? "—";

    if (result.outcome === "unjudged") {
      showTarget();
      field("round-status").textContent = "判定対象外";
    } else {
      animate(shot, result, stroke);
    }

    if (!persist) return;
    saveShot({
      time: Date.now(), target, scenario, greenSpeed, ...shot, ...(stroke ? round.session : test?.metadata ?? session.current),
      outcome: result.outcome, leave: result.remaining ?? null, model: SHOT_MODEL_VERSION,
      ...(stroke ? {
        roundId: (round.id ??= crypto.randomUUID()), roundStart: round.start, roundStroke: stroke.stroke,
        roundScore: stroke.score, roundFirstLeave: round.firstLeave, ...(test ? { testHole: test.scores.length + 1 } : {}),
      } : {}),
    }).catch(() => {
      field("save-status").textContent = `${++saveFailures} 球を履歴に保存できませんでした`;
    });
  }

  function setDemo(enabled) {
    stopAnimation();
    demo = enabled;
    session.setDemo(enabled);
    resetTest();
    ready = enabled;
    pendingRound = undefined;
    round = undefined;
    if (scenario === "finish") startRound();
    else target = nextDistance(target);
    setGreen(enabled ? { greenSpeed: DEMO_GREEN_SPEED } : null);
    demoControls.hidden = !enabled;
    field("save-status").hidden = enabled;
    demoShots = 0;
    field("shot-count").textContent = `${enabled ? demoShots : shots} 球`;
    field("shot-target").textContent = "目標 —";
    field("green-shot-summary").hidden = true;
    field("green-shot-summary").textContent = "";
    field("shot-outcome").textContent = "受信待ち";
    delete field("shot-outcome").dataset.outcome;
    field("shot-reason").textContent = enabled ? "結果ボタンからパットを再生できます。" : "打つとここに結果を表示します。";
    field("shot-round").hidden = true;
    field("angle-unit").hidden = false;
    field("round-notice").textContent = "";
    for (const id of ["shot-distance", "shot-angle", "shot-speed", "shot-remaining", "green-angle"]) field(id).textContent = "—";
    showTarget();
  }

  for (const button of demoButtons) {
    button.addEventListener("click", () => {
      if (!demo || button.disabled) return;
      setDemoBusy(true);
      receiveShot(demoShot(button.dataset.demoOutcome, target), false);
    });
  }

  updateDistanceFields();
  showTarget();
  return { setReady, setGreen, setDemo, showShot: (shot) => { if (!demo) receiveShot(shot, true); } };
}
