export function setupPracticeSession() {
  const form = document.getElementById("session-form");
  const start = document.getElementById("session-start");
  const end = document.getElementById("session-end");
  const status = document.getElementById("session-status");
  const inputs = [...form.querySelectorAll("input")];
  let current;
  let demo = false;

  function render() {
    start.disabled = demo || Boolean(current);
    end.disabled = demo || !current;
    for (const input of inputs) input.disabled = demo || Boolean(current);
    status.textContent = demo ? "デモの球はセッションに含まれません。"
      : current ? `記録中 · ${current.sessionTheme || "テーマなし"}` : "セッションを開始すると、続けて打った球をひとまとめにできます。";
  }

  function startSession() {
    if (demo) return;
    const [sessionTheme, sessionPutter, sessionMat] = inputs.map((input) => input.value.trim());
    current = { sessionId: crypto.randomUUID(), sessionTheme, sessionPutter, sessionMat };
    render();
  }

  function stopSession() {
    current = undefined;
    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!current && !demo) startSession();
  });
  end.addEventListener("click", stopSession);
  render();
  return {
    start: startSession,
    stop: stopSession,
    get current() { return current; },
    setDemo(value) { demo = value; render(); },
  };
}
