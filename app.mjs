import { chooseDevice, ZeroPuttConnection } from "./bluetooth.mjs";

const connect = document.querySelector("#connect");
const disconnect = document.querySelector("#disconnect");
const status = document.querySelector("#status");
const logList = document.querySelector("#log");
const distance = document.querySelector("#distance");
const angle = document.querySelector("#angle");
const speed = document.querySelector("#speed");
const count = document.querySelector("#count");
const angleNote = document.querySelector("#angle-note");
let connection;
let shots = 0;

function setStatus(message, state = "idle") {
  status.textContent = message;
  status.dataset.state = state;
}

function log(message) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString("ja-JP")}  ${message}`;
  logList.prepend(item);
  if (logList.childElementCount > 30) logList.lastElementChild.remove();
}

function showShot(measurement) {
  count.textContent = `${++shots} 球目`;
  distance.textContent = measurement.distance.toFixed(2);
  angle.textContent = `${measurement.angle > 0 ? "+" : ""}${measurement.angle.toFixed(2)}`;
  speed.textContent = measurement.speed.toFixed(2);
  angleNote.hidden = measurement.angle !== 10;
}

function resetReadout() {
  shots = 0;
  count.textContent = "受信待ち";
  for (const field of [distance, angle, speed]) field.textContent = "–";
  angleNote.hidden = true;
  logList.replaceChildren();
}

connect.addEventListener("click", async () => {
  connect.disabled = true;
  resetReadout();
  setStatus("機器を選択してください", "working");
  let current;
  try {
    const device = await chooseDevice(navigator.bluetooth);
    current = new ZeroPuttConnection(device, {
      status(message) {
        if (message === "初期化中") disconnect.disabled = false;
        setStatus(message, message === "計測準備完了" ? "ready" : "working");
      },
      log,
      shot: showShot,
      closed(message) {
        if (connection !== current) return;
        connection = undefined;
        disconnect.disabled = true;
        connect.disabled = false;
        setStatus(message);
        log(message);
      },
    });
    connection = current;
    await current.open();
  } catch (error) {
    if (current && connection !== current) return;
    const message = error.name === "NotFoundError"
      ? "機器の選択が完了しませんでした"
      : `接続できませんでした: ${error.message}`;
    if (current) {
      current.close(message);
    } else {
      setStatus(message);
      log(message);
      connect.disabled = false;
    }
  }
});

disconnect.addEventListener("click", () => connection?.close());

if (!window.isSecureContext || typeof navigator.bluetooth?.requestDevice !== "function") {
  connect.disabled = true;
  setStatus("このページではBLE接続を利用できません");
  document.querySelector("#compatibility").hidden = false;
}
