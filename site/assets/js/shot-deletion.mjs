import { deleteShots } from "./shot-store.mjs";
import { statsDateRange } from "./stats-dates.mjs";

export function setupShotDeletion(reload) {
  const form = document.getElementById("delete-range");
  const from = document.getElementById("delete-from");
  const to = document.getElementById("delete-to");
  const status = document.getElementById("delete-status");
  let busy = false;

  function setBusy(value) {
    busy = value;
    for (const button of document.querySelectorAll("[data-delete-shot]")) button.disabled = busy;
  }

  async function remove(selection, prompt, stayOnPage = false) {
    if (busy || !window.confirm(`${prompt}\n削除した記録は元に戻せません。`)) return;
    setBusy(true);
    status.dataset.error = "false";
    status.textContent = "履歴を削除中…";
    try {
      const removed = await deleteShots(selection);
      await reload(stayOnPage);
      status.textContent = removed ? `${removed.toLocaleString("ja-JP")} 球の記録を削除しました。`
        : "指定した範囲に削除できる記録がありません。";
    } catch {
      status.dataset.error = "true";
      status.textContent = "履歴を削除できませんでした。";
    } finally {
      setBusy(false);
    }
  }

  from.addEventListener("change", () => {
    if (!to.value) to.value = from.value;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    let dateRange;
    try {
      dateRange = statsDateRange("custom", from.value, to.value);
    } catch (error) {
      status.dataset.error = "true";
      status.textContent = error.message;
      return;
    }
    remove({ dateRange }, `${from.value} から ${to.value} までの記録を削除してもよいですか？`);
  });

  document.getElementById("delete-all").addEventListener("click", () => {
    remove({ all: true }, "このブラウザの全ショット履歴を削除してもよいですか？");
  });

  return (id, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary danger-button";
    button.textContent = "削除";
    button.dataset.deleteShot = "";
    button.setAttribute("aria-label", `${label}のショットを削除`);
    button.disabled = busy;
    button.addEventListener("click", () => {
      remove({ id }, `${label}のショットを削除してもよいですか？`, true);
    });
    return button;
  };
}
