import assert from "node:assert/strict";
import test from "node:test";
import { setupScreenWakeLock } from "../site/assets/js/screen-wake-lock.mjs";

class TestDocument extends EventTarget {
  visibilityState = "visible";

  setVisibility(state) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

class TestWakeLock {
  requests = 0;
  sentinels = [];

  async request() {
    this.requests++;
    const sentinel = new EventTarget();
    sentinel.released = false;
    sentinel.release = async () => {
      sentinel.released = true;
      sentinel.dispatchEvent(new Event("release"));
    };
    this.sentinels.push(sentinel);
    return sentinel;
  }
}

test("acquires while active and reacquires when the page becomes visible", async () => {
  const document = new TestDocument();
  const wakeLock = new TestWakeLock();
  const screenWakeLock = setupScreenWakeLock({ wakeLock, document });

  screenWakeLock.setActive(true);
  await Promise.resolve();
  assert.equal(wakeLock.requests, 1);

  document.setVisibility("hidden");
  assert.equal(wakeLock.sentinels[0].released, true);
  document.setVisibility("visible");
  await Promise.resolve();
  assert.equal(wakeLock.requests, 2);

  screenWakeLock.setActive(false);
  assert.equal(wakeLock.sentinels[1].released, true);
});

test("reports when screen wake lock is unavailable", () => {
  const states = [];
  const screenWakeLock = setupScreenWakeLock({
    wakeLock: undefined,
    document: new TestDocument(),
    onStatus: (state) => states.push(state),
  });

  screenWakeLock.setActive(true);
  assert.deepEqual(states, ["pending", "unavailable"]);
});