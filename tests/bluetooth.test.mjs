import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { chooseDevice, ZeroPuttConnection } from "../site/assets/js/bluetooth.mjs";
import { lineReader, NOTIFY, parseSettings, parseShot, screenGreenSpeedWrite, SERVICE, WRITE } from "../site/assets/js/protocol.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fixture = "0,3.20,2.10,-1.25,0.00,2.30";
const settingsFixture = "3,17,1,244,4,Fixture,0,0,21,455,1,999";
const speedWrite = "31502,17,1,305,4,Fixture,0,0,21,455,1";
const expectedShot = {
  distance: 3.2, rollSpeed: 2.1, angle: -1.25, remaining: 0, speed: 2.3,
};

function packet(text) {
  const bytes = encoder.encode(`x${text}x`);
  return new DataView(bytes.buffer, 1, bytes.length - 2);
}

test("frames split and combined notifications and resynchronizes after bad lines", () => {
  const feed = lineReader();
  assert.deepEqual(feed(packet(fixture.slice(0, 10))), []);
  assert.deepEqual(feed(packet(`${fixture.slice(10)}\r\nB\n`)), [fixture, "B"]);
  assert.deepEqual(feed(packet(`${"x".repeat(513)}\nB\n`)), ["B"]);
  assert.deepEqual(feed(packet("\u0001B\nB\n")), ["B"]);
  assert.deepEqual(parseShot(fixture), expectedShot);
  assert.equal(parseShot("0,,2.10,-1.25,0.00,2.30"), null);
});

test("device picker can find Zeroputt by name and grants access to its custom service", async () => {
  await chooseDevice({
    requestDevice(options) {
      assert.ok(options.filters.some((filter) => filter.namePrefix === "Zeroputt"));
      assert.deepEqual(options.optionalServices, [SERVICE]);
    },
  });
});

test("unfiltered device picker still grants access to the custom service", async () => {
  await chooseDevice({
    requestDevice(options) {
      assert.deepEqual(options, { acceptAllDevices: true, optionalServices: [SERVICE] });
    },
  }, true);
});

test("settings map speed and preserve the fields outside the requested change", () => {
  const settings = parseSettings(settingsFixture);
  assert.equal(settings.greenSpeedLabel, "普通 (8.0 ft)");
  assert.equal(settings.unit, "1");
  assert.equal(settings.command, "0");
  assert.equal(settings.animation, "1");
  assert.equal(screenGreenSpeedWrite(settings, "305"), speedWrite);
  assert.equal(settings.fields.join(","), settingsFixture);
  assert.equal(parseSettings("3,fixture"), null);
  const green = parseSettings("3,17,0,397,4,Fixture,0,1,21,455,1,999");
  assert.equal(green.greenSpeedLabel, "13.0 ft");
  assert.throws(() => screenGreenSpeedWrite(green, "305"), /スクリーンモード/);
  assert.throws(() => screenGreenSpeedWrite(settings, "397"), /スクリーンモード/);
});

for (const method of ["writeValueWithResponse", "writeValue"]) {
  test(`initializes and acknowledges measurements and heartbeat via ${method}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const sent = [];
    const statuses = [];
    const shots = [];
    const notify = new EventTarget();
    let subscribed = false;
    let deviceSettings = settingsFixture;
    let acceptSettingsWrite = true;
    let revertOnCommit = false;
    notify.startNotifications = async () => { subscribed = true; };

    function emit(text) {
      notify.value = packet(text);
      notify.dispatchEvent(new Event("characteristicvaluechanged"));
    }

    const write = {
      async [method](value) {
        assert.ok(subscribed);
        const command = decoder.decode(value);
        sent.push(command);
        if (command === "6\n") emit("6,1,2\n");
        if (command === "2\n") emit(`${deviceSettings}\n`);
        if (command === `${speedWrite}\n` && acceptSettingsWrite) {
          deviceSettings = settingsFixture.replace(",244,", ",305,");
        }
        if (command === "c,1\n" && revertOnCommit) deviceSettings = settingsFixture;
      },
    };
    const device = new EventTarget();
    device.gatt = {
      connected: false,
      async connect() { this.connected = true; return this; },
      disconnect() { this.connected = false; },
      async getPrimaryService(uuid) {
        assert.equal(uuid, SERVICE);
        return {
          async getCharacteristic(characteristic) {
            if (characteristic === NOTIFY) return notify;
            assert.equal(characteristic, WRITE);
            return write;
          },
        };
      },
    };

    const session = new ZeroPuttConnection(device, {
      status: (status) => statuses.push(status),
      log: () => {},
      shot: (shot) => shots.push(shot),
      closed: (status) => statuses.push(status),
    });

    const opening = session.open();
    await setImmediate();
    assert.deepEqual(sent, ["6\n"]);
    t.mock.timers.tick(999);
    await setImmediate();
    assert.deepEqual(sent, ["6\n"]);
    t.mock.timers.tick(1);
    await opening;
    assert.equal(statuses.at(-1), "計測準備完了");

    emit(fixture.slice(0, 10));
    emit(`${fixture.slice(10)}\nB\n`);
    await setImmediate();
    assert.deepEqual(sent, ["6\n", "2\n", "9\n", "B\n"]);
    assert.deepEqual(shots, [expectedShot]);

    async function advance(ms) {
      t.mock.timers.tick(ms);
      await setImmediate();
    }

    assert.equal((await session.readSettings()).greenSpeed, "244");
    const saving = session.saveScreenGreenSpeed("305");
    await assert.rejects(session.readSettings(), /処理中/);
    await setImmediate();
    await advance(999);
    assert.deepEqual(sent.slice(4), ["2\n", "2\n"]);
    await advance(1);
    assert.deepEqual(sent.slice(4), ["2\n", "2\n", `${speedWrite}\n`]);
    await advance(350);
    assert.equal(sent.at(-1), "2\n");
    await advance(149);
    assert.equal(sent.includes("c,1\n"), false);
    await advance(1);
    assert.equal(sent.at(-1), "c,1\n");
    await advance(500);
    assert.equal((await saving).greenSpeed, "305");
    assert.deepEqual(sent.slice(-2), ["c,1\n", "2\n"]);

    deviceSettings = settingsFixture;
    acceptSettingsWrite = false;
    const failedStart = sent.length;
    const mismatch = assert.rejects(session.saveScreenGreenSpeed("305"), /保存指示は未送信/);
    await setImmediate();
    await advance(1000);
    await advance(350);
    await mismatch;
    assert.deepEqual(sent.slice(failedStart), ["2\n", `${speedWrite}\n`, "2\n"]);

    acceptSettingsWrite = true;
    revertOnCommit = true;
    const commitMismatch = assert.rejects(session.saveScreenGreenSpeed("305"), /保存指示の後.*一致しません/);
    await setImmediate();
    await advance(1000);
    await advance(350);
    await advance(150);
    await advance(500);
    await commitMismatch;
    assert.equal((await session.readSettings()).greenSpeed, "244");

    session.close();
    emit(`${fixture}\n`);
    assert.deepEqual(shots, [expectedShot]);
    assert.equal(device.gatt.connected, false);
  });
}
