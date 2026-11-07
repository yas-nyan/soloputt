import { chooseDevice, ZeroPuttConnection } from "./bluetooth.mjs";
import { setupDeviceSettings } from "./device-settings.mjs";
import { setupPractice } from "./practice.mjs";

const connect = document.querySelector("#connect");
const scanAll = document.querySelector("#scan-all");
const disconnect = document.querySelector("#disconnect");
const status = document.querySelector("#status");
const logList = document.querySelector("#log");
const setSettingsConnection = setupDeviceSettings();
const practice = setupPractice();
let connection;

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

function setDiscoveryDisabled(disabled) {
  connect.disabled = disabled;
  scanAll.disabled = disabled;
}

async function connectDevice(showAll) {
  setDiscoveryDisabled(true);
  logList.replaceChildren();
  setStatus("機器を選択してください", "working");
  let current;
  try {
    const device = await chooseDevice(navigator.bluetooth, showAll);
    current = new ZeroPuttConnection(device, {
      status(message) {
        if (message === "初期化中") disconnect.disabled = false;
        if (message === "計測準備完了") {
          setSettingsConnection(current);
          practice.setReady(true);
        }
        setStatus(message, message === "計測準備完了" ? "ready" : "working");
      },
      log,
      shot: practice.showShot,
      settings: practice.setGreen,
      closed(message) {
        if (connection !== current) return;
        connection = undefined;
        setSettingsConnection(undefined);
        practice.setReady(false);
        practice.setGreen(null);
        disconnect.disabled = true;
        setDiscoveryDisabled(false);
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
      setDiscoveryDisabled(false);
    }
  }
}

connect.addEventListener("click", () => connectDevice(false));
scanAll.addEventListener("click", () => connectDevice(true));
disconnect.addEventListener("click", () => connection?.close());
window.addEventListener("pagehide", () => connection?.close());

if (!window.isSecureContext || typeof navigator.bluetooth?.requestDevice !== "function") {
  setDiscoveryDisabled(true);
  setStatus("このページではBLE接続を利用できません");
  document.querySelector("#compatibility").hidden = false;
}
