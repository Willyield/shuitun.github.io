import { loadTrips, sanitizeTrips, saveTrips, STORAGE_KEY } from "./travel";

function dateStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function exportTravelBackup() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const payload = raw ? JSON.parse(raw) : loadTrips();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shuitun-backup-${dateStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importTravelBackup(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("没有选择文件。"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const trips = Array.isArray(parsed) ? parsed : parsed?.trips;
        if (!Array.isArray(trips)) throw new Error("备份文件格式不正确。");
        saveTrips(sanitizeTrips(trips));
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error("备份文件读取失败。"));
      }
    };
    reader.onerror = () => reject(new Error("备份文件读取失败。"));
    reader.readAsText(file, "utf-8");
  });
}
