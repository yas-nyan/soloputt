export function setupScreenWakeLock({ wakeLock, document, onStatus = () => {} }) {
  let active = false;
  let requesting = false;
  let sentinel;

  function isVisible() {
    return document.visibilityState === "visible";
  }

  async function acquire() {
    if (!active || !isVisible() || sentinel || requesting) return;
    if (typeof wakeLock?.request !== "function") {
      onStatus("unavailable");
      return;
    }

    requesting = true;
    try {
      const lock = await wakeLock.request("screen");
      if (!active || !isVisible()) {
        await lock.release();
        return;
      }
      sentinel = lock;
      onStatus("active");
      lock.addEventListener("release", () => {
        if (sentinel !== lock) return;
        sentinel = undefined;
        if (active && isVisible()) void acquire();
      });
    } catch {
      if (active) onStatus("unavailable");
    } finally {
      requesting = false;
    }
  }

  function update() {
    if (active && isVisible()) {
      void acquire();
      return;
    }
    if (!sentinel) return;
    const lock = sentinel;
    sentinel = undefined;
    void lock.release().catch(() => {});
  }

  function onVisibilityChange() {
    update();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  return {
    setActive(value) {
      active = value;
      onStatus(value ? "pending" : "inactive");
      update();
    },
  };
}