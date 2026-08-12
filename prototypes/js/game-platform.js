/*
 * Browser-only platform services shared by every classic runtime script.
 * Keep this file dependency-free: it loads before game data and therefore
 * remains safe for direct file launches as well as the local HTTP server.
 */
const appStorage = Object.freeze({
  readRecord(key, fallback) {
    try {
      const value = JSON.parse(window.localStorage.getItem(key));
      return value && typeof value === "object" && !Array.isArray(value)
        ? { ...fallback, ...value }
        : { ...fallback };
    } catch {
      return { ...fallback };
    }
  },
  writeRecord(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  readText(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  writeText(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {}
  },
});

let runtimeScene = "title";
function setRuntimeScene(scene) {
  runtimeScene = scene;
}
function isRuntimeScene(scene) {
  return runtimeScene === scene;
}
