export function localDay(time) {
  const date = new Date(time);
  return date.setHours(0, 0, 0, 0);
}

function shiftDay(time, days) {
  const date = new Date(time);
  return localDay(date.setDate(date.getDate() + days));
}

export function dateInputValue(time) {
  const date = new Date(time);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, "0")).join("-");
}

export function statsDateRange(period, from = "", to = "", now = Date.now()) {
  if (period === "all") return null;
  const today = localDay(now);
  if (period === "yesterday") return { start: shiftDay(today, -1), end: today };
  if (period === "custom") {
    const start = localDay(`${from}T00:00:00`);
    const last = localDay(`${to}T00:00:00`);
    if (!Number.isFinite(start) || !Number.isFinite(last) || start > last) {
      throw new Error("開始日と終了日を、古い日付から順に指定してください。");
    }
    return { start, end: shiftDay(last, 1) };
  }
  const days = { today: 1, week: 7, month: 30 }[period];
  return { start: shiftDay(today, 1 - days), end: shiftDay(today, 1) };
}
