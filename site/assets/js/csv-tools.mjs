import { CSV_FIELDS, parseShotCSV, shotToCSV } from "./shot-csv.mjs";
import { forEachShot, importShots } from "./shot-store.mjs";

export function setupCSVTools(reload) {
  const input = document.getElementById("csv-file");
  const upload = document.getElementById("csv-import");
  const download = document.getElementById("csv-export");
  const status = document.getElementById("csv-status");

  async function run(progress, operation) {
    upload.disabled = true;
    download.disabled = true;
    status.dataset.error = "false";
    status.textContent = progress;
    try {
      status.textContent = await operation();
    } catch (error) {
      status.dataset.error = "true";
      status.textContent = error.message || "CSVを処理できませんでした。";
    } finally {
      upload.disabled = false;
      download.disabled = false;
    }
  }

  upload.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    run("CSVを取り込み中…", async () => {
      const shots = parseShotCSV(await file.text());
      const { added, skipped } = await importShots(shots);
      await reload();
      return `${added.toLocaleString("ja-JP")} 球を追加し、重複 ${skipped.toLocaleString("ja-JP")} 球をスキップしました。`;
    });
  });

  download.addEventListener("click", () => {
    run("CSVを準備中…", async () => {
      const rows = [CSV_FIELDS.join(",")];
      await forEachShot((shot) => rows.push(shotToCSV(shot)));
      const url = URL.createObjectURL(new Blob([rows.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `soloputt-shots-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return `${(rows.length - 1).toLocaleString("ja-JP")} 球のCSVを作成しました。`;
    });
  });
}
