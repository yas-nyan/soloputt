const STORE = "shots";
let database;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("soloputt", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { autoIncrement: true });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  });
}

async function access(mode, operate) {
  database ??= openDatabase().catch((error) => {
    database = undefined;
    throw error;
  });
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = operate(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error("保存領域にアクセスできません"));
  });
}

export function saveShot(shot) {
  return access("readwrite", (store) => store.add(shot));
}

export function readShots() {
  return access("readonly", (store) => store.getAll());
}
