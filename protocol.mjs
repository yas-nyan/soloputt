export const SERVICE = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
export const NOTIFY = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
export const WRITE = "beb5483e-36e1-4688-b7f5-ea07361b26fa";

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
