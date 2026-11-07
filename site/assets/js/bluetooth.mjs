import { lineReader, NOTIFY, parseSettings, parseShot, screenGreenSpeedWrite, SERVICE, WRITE } from "./protocol.mjs";

const encoder = new TextEncoder();

export function chooseDevice(bluetooth, showAll = false) {
  const discovery = showAll
    ? { acceptAllDevices: true }
    : { filters: [{ namePrefix: "Zeroputt" }, { services: [SERVICE] }] };
  return bluetooth.requestDevice({ ...discovery, optionalServices: [SERVICE] });
}

export class ZeroPuttConnection {
  #device;
  #callbacks;
  #notify;
  #write;
  #closed = false;
  #ready = false;
  #saving = false;
  #receive = lineReader();
  #pending = null;
  #writes = Promise.resolve();

  constructor(device, callbacks) {
    this.#device = device;
    this.#callbacks = callbacks;
  }

  async open() {
    const { status } = this.#callbacks;
    this.#device.addEventListener("gattserverdisconnected", this.#onDisconnect);
    status("接続中");
    const server = await this.#device.gatt.connect();
    if (this.#closed) {
      server.disconnect();
      return;
    }
    const service = await server.getPrimaryService(SERVICE);
    this.#assertOpen();
    this.#notify = await service.getCharacteristic(NOTIFY);
    this.#assertOpen();
    this.#write = await service.getCharacteristic(WRITE);
    this.#assertOpen();
    this.#notify.addEventListener("characteristicvaluechanged", this.#onValue);
    await this.#notify.startNotifications();
    this.#assertOpen();

    status("初期化中");
    await this.#exchange("6", "6,");
    await new Promise((resolve) => setTimeout(resolve, 7000));
    this.#assertOpen();
    await this.#exchange("2", "3,");
    this.#assertOpen();
    this.#ready = true;
    status("計測準備完了");
  }

  async readSettings() {
    this.#assertSettingsAvailable();
    return this.#readSettings();
  }

  async saveScreenGreenSpeed(speed) {
    this.#assertSettingsAvailable();
    this.#saving = true;
    try {
      const current = await this.#readSettings();
      const command = screenGreenSpeedWrite(current, speed);
      if (speed === current.greenSpeed) return current;
      await this.#send(command, "設定データ");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await this.#send("c,1");
      const verified = await this.#readSettings();
      if (verified.greenMode !== current.greenMode || verified.greenSpeed !== speed) {
        throw new Error("読み戻した値が設定したグリーン速度と一致しません");
      }
      return verified;
    } finally {
      this.#saving = false;
    }
  }

  close(message = "未接続") {
    if (this.#closed) return;
    this.#closed = true;
    this.#pending?.reject(new Error("接続が終了しました"));
    this.#device.removeEventListener("gattserverdisconnected", this.#onDisconnect);
    this.#notify?.removeEventListener("characteristicvaluechanged", this.#onValue);
    if (this.#device.gatt.connected) this.#device.gatt.disconnect();
    this.#callbacks.closed(message);
  }

  #assertOpen() {
    if (this.#closed) throw new Error("接続が終了しました");
  }

  #assertSettingsAvailable() {
    this.#assertOpen();
    if (!this.#ready) throw new Error("機器の初期化が完了していません");
    if (this.#saving || this.#pending) throw new Error("機器設定を処理中です");
  }

  async #readSettings() {
    const response = await this.#exchange("2", "3,");
    const settings = parseSettings(response);
    if (!settings) throw new Error("本体の設定応答の形式を確認できませんでした");
    return settings;
  }

  #onDisconnect = () => this.close("接続が切れました");

  #onValue = (event) => {
    if (this.#closed || !event.target.value) return;
    const { log, shot } = this.#callbacks;
    for (const line of this.#receive(event.target.value)) {
      const type = line.split(",", 1)[0];
      log(`RX ${["0", "3", "6", "B"].includes(type) ? type : "不明な通知"}`);
      if (this.#pending && line.startsWith(this.#pending.prefix)) {
        this.#pending.resolve(line);
      }
      if (line === "B") {
        this.#sendReply("B");
      } else if (type === "0") {
        const measurement = parseShot(line);
        if (measurement) {
          this.#sendReply("9");
          shot(measurement);
        } else {
          log("計測値の形式を確認できませんでした");
        }
      }
    }
  };

  #send(command, logLabel = command) {
    const write = this.#writes.then(async () => {
      this.#assertOpen();
      const value = encoder.encode(`${command}\n`);
      if (typeof this.#write.writeValueWithResponse === "function") {
        await this.#write.writeValueWithResponse(value);
      } else {
        await this.#write.writeValue(value);
      }
      if (!this.#closed) this.#callbacks.log(`TX ${logLabel}`);
    });
    this.#writes = write.catch(() => {});
    return write;
  }

  #sendReply(command) {
    this.#send(command).catch((error) => {
      if (!this.#closed) this.close(`${command} の送信に失敗しました: ${error.message}`);
    });
  }

  async #exchange(command, prefix) {
    let timer;
    const response = new Promise((resolve, reject) => {
      this.#pending = { prefix, resolve, reject };
      timer = setTimeout(() => reject(new Error(`${command} の応答を受信できませんでした`)), 8000);
    });
    try {
      const [line] = await Promise.all([response, this.#send(command)]);
      return line;
    } finally {
      clearTimeout(timer);
      this.#pending = null;
    }
  }
}
