export const SERVICE = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
export const NOTIFY = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
export const WRITE = "beb5483e-36e1-4688-b7f5-ea07361b26fa";

export const SCREEN_GREEN_SPEEDS = new Map([
  ["214", "遅い (7.0 ft)"],
  ["244", "普通 (8.0 ft)"],
  ["275", "少し速い (9.0 ft)"],
  ["305", "速い (10.0 ft)"],
  ["336", "とても速い (11.0 ft)"],
]);

const greenModeSpeeds = ["214", "229", "244", "260", "275", "290", "305", "321", "336", "351", "366", "381", "397"];

export function parseSettings(line) {
  const fields = line.split(",");
  if (fields.length !== 12 || fields[0] !== "3") return null;
  if (!fields.every((field, index) => index === 5 ? /^[\x20-\x7e]*$/.test(field) : /^-?\d+$/.test(field))) {
    return null;
  }
  const [, , unit, greenSpeed, puttDistance, , command, greenMode, , , animation] = fields;
  const greenModeStep = greenModeSpeeds.indexOf(greenSpeed);
  const greenSpeedLabel = greenMode === "0" ? SCREEN_GREEN_SPEEDS.get(greenSpeed)
    : greenMode === "1" && greenModeStep >= 0 ? `${(7 + greenModeStep * .5).toFixed(1)} ft` : null;
  return { fields, unit, greenSpeed, greenSpeedLabel, puttDistance, command, greenMode, animation };
}

export function screenGreenSpeedWrite(settings, speed) {
  if (settings.greenMode !== "0" || !SCREEN_GREEN_SPEEDS.has(settings.greenSpeed) || !SCREEN_GREEN_SPEEDS.has(speed)) {
    throw new Error("スクリーンモードの対応する速度だけ変更できます");
  }
  const fields = settings.fields.slice(1, 11);
  fields[2] = speed;
  const payload = fields.join(",");
  let checksum = 29604;
  for (const char of payload) checksum += char.charCodeAt(0);
  return `${checksum},${payload}`;
}

export function lineReader() {
  let line = "";
  let discard = false;
  return (view) => {
    const lines = [];
    for (let offset = 0; offset < view.byteLength; offset++) {
      const byte = view.getUint8(offset);
      if (byte === 10) {
        const complete = line.replace(/\r$/, "");
        if (!discard && complete) lines.push(complete);
        line = "";
        discard = false;
      } else if (!discard) {
        if (line.length >= 512 || (byte !== 13 && (byte < 32 || byte > 126))) {
          discard = true;
        } else {
          line += String.fromCharCode(byte);
        }
      }
    }
    return lines;
  };
}

export function parseShot(line) {
  const [type, ...fields] = line.split(",");
  if (type !== "0" || fields.length !== 5) return null;
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!fields.every((field) => decimal.test(field))) return null;
  const [distance, rollSpeed, angle, remaining, speed] = fields.map(Number);
  if (![distance, rollSpeed, angle, remaining, speed].every(Number.isFinite)) return null;
  return { distance, rollSpeed, angle, remaining, speed };
}
