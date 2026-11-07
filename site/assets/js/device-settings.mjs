import { SCREEN_GREEN_SPEEDS } from "./protocol.mjs";

export function setupDeviceSettings() {
  const panel = document.querySelector("#device-settings");
  const open = document.querySelector("#open-device-settings");
  const refresh = document.querySelector("#read-device-settings");
  const speed = document.querySelector("#screen-green-speed");
  const save = document.querySelector("#save-green-speed");
  const feedback = document.querySelector("#device-settings-status");
  const modeValue = document.querySelector("#device-green-mode");
  const speedValue = document.querySelector("#device-green-speed");
  const unitValue = document.querySelector("#device-unit");
  const animationValue = document.querySelector("#device-animation");
  const puttDistanceValue = document.querySelector("#device-putt-distance");
  const commandValue = document.querySelector("#device-command");
  const onOff = { "0": "オン", "1": "オフ" };
  const modes = { "0": "スクリーン（5段階）", "1": "グリーン（数値表示）" };
  const units = { "0": "Feet", "1": "Meter" };
  let connection;
  let settings;
  let busy = false;

  for (const [value, label] of SCREEN_GREEN_SPEEDS) speed.add(new Option(label, value));
  speed.value = "";

  function render() {
    const editable = settings?.greenMode === "0" && SCREEN_GREEN_SPEEDS.has(settings.greenSpeed);
    open.disabled = !connection || busy;
    refresh.disabled = !connection || busy;
    speed.disabled = busy || !editable;
    save.disabled = speed.disabled || !speed.value || speed.value === settings?.greenSpeed;
    modeValue.textContent = settings ? modes[settings.greenMode] ?? "未対応" : "–";
    speedValue.textContent = settings ? settings.greenSpeedLabel ?? `未対応（受信値 ${settings.greenSpeed}）` : "–";
    unitValue.textContent = settings ? units[settings.unit] ?? "未対応" : "–";
    animationValue.textContent = settings ? onOff[settings.animation] ?? "未対応" : "–";
    puttDistanceValue.textContent = settings?.puttDistance ?? "–";
    commandValue.textContent = settings ? onOff[settings.command] ?? "未対応" : "–";
  }

  async function request(operation, progress, success, failure) {
    const current = connection;
    if (!current || busy) return;
    busy = true;
    feedback.textContent = progress;
    render();
    try {
      const next = await operation(current);
      if (current !== connection) return;
      settings = next;
      speed.value = settings.greenMode === "0" && SCREEN_GREEN_SPEEDS.has(settings.greenSpeed)
        ? settings.greenSpeed : "";
      feedback.textContent = success || (speed.value ? "本体の設定を取得しました" : "このモード・速度は閲覧のみです");
    } catch (error) {
      if (current !== connection) return;
      settings = undefined;
      speed.value = "";
      feedback.textContent = `${failure}（${error.message}）。本体から読み直してください。`;
    } finally {
      if (current === connection) {
        busy = false;
        render();
      }
    }
  }

  function read() {
    return request((current) => current.readSettings(), "本体の設定を取得中…", "", "設定の取得に失敗しました");
  }

  open.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    open.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) read();
  });
  refresh.addEventListener("click", read);
  speed.addEventListener("change", () => {
    feedback.textContent = speed.value === settings?.greenSpeed ? "変更なし" : "未保存の変更あり";
    render();
  });
  save.addEventListener("click", () => {
    const value = speed.value;
    return request((current) => current.saveScreenGreenSpeed(value),
      "本体に保存して読み戻し中…", "本体から同じグリーン速度を読み戻しました", "保存を確認できませんでした");
  });

  return (next) => {
    connection = next;
    settings = undefined;
    busy = false;
    speed.value = "";
    panel.hidden = true;
    open.setAttribute("aria-expanded", "false");
    feedback.textContent = "";
    render();
  };
}
