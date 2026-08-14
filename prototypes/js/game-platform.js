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
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
});
/* 첫 실행으로 되돌릴 때 지워야 하는 모든 것. 하나라도 빠지면 「처음 켠 유저」가
   아니라 「기억을 반쯤 잃은 유저」가 되고, 프롤로그나 온보딩이 건너뛰어진다.
   새 저장 키를 추가하면 여기에도 넣는다. */
const FIRST_RUN_KEYS = Object.freeze([
  "prism-breakers.settings.v1",
  "prism-breakers.progress.v1",
  "prism-breakers.story-intro.v1",
  "stella-ball.onboarding.v1",
  "stella-ball.onboarding-clear.v1",
  "stella-ball.party-slots.v1",
  "stella-ball.mailbox.v1",
  "stella-ball.profile-icon",
  "stella-ball.attendance",
]);
// 인트로의 「이번 세션에 이미 봤다」 표식만 sessionStorage에 있다. 이것까지
// 지워야 전체 컷신이 약식이 아닌 원본 길이로 재생된다.
const FIRST_RUN_SESSION_KEYS = Object.freeze([
  "stella-ball.outer-observer.played",
]);
function resetToFirstRun() {
  for (const key of FIRST_RUN_KEYS) appStorage.remove(key);
  for (const key of FIRST_RUN_SESSION_KEYS)
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
  // 메모리에 남은 상태를 되살리는 것보다 다시 읽는 쪽이 확실하다. 저장을
  // 지운 직후 어떤 코드가 다시 쓰기 전에 즉시 떠난다.
  window.location.reload();
}

let runtimeScene = "title";
function setRuntimeScene(scene) {
  runtimeScene = scene;
}
function isRuntimeScene(scene) {
  return runtimeScene === scene;
}
