import { lineReader, NOTIFY, parseShot, SERVICE, WRITE } from "./protocol.mjs";

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
    status("計測準備完了");
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

  #onDisconnect = () => this.close("接続が切れました");

  #onValue = (event) => {
    if (this.#closed || !event.target.value) return;
    const { log, shot } = this.#callbacks;
    for (const line of this.#receive(event.target.value)) {
      const type = line.split(",", 1)[0];
      log(`RX ${["0", "3", "6", "B"].includes(type) ? type : "不明な通知"}`);
      if (this.#pending && line.startsWith(this.#pending.prefix)) {
        this.#pending.resolve();
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

  #send(command) {
    const write = this.#writes.then(async () => {
      this.#assertOpen();
      const value = encoder.encode(`${command}\n`);
      if (typeof this.#write.writeValueWithResponse === "function") {
        await this.#write.writeValueWithResponse(value);
      } else {
        await this.#write.writeValue(value);
      }
      if (!this.#closed) this.#callbacks.log(`TX ${command}`);
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
      await Promise.all([response, this.#send(command)]);
    } finally {
      clearTimeout(timer);
      this.#pending = null;
    }
  }
}
