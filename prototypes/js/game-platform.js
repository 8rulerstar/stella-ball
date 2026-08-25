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
  /* 성공 여부를 «돌려준다»(2026-08-23). 예전에는 catch 가 비어 있어 저장이
     막힌 브라우저 설정(사이트 데이터 차단 등)에서 아무 일도 없는 것처럼
     보였다 — 실측: 화면의 골드 5000, 디스크 100, 경고 한 줄 없음. 플레이어는
     계속 벌고 새로고침 한 번에 전부 잃는다.
     이 파일은 체인의 첫 스크립트라 toast() 가 아직 없다(파일 머리 규약:
     dependency-free). 그래서 여기서는 «알리지 않고» 실패만 알려 준다. */
  writeRecord(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
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
      return true;
    } catch {
      return false;
    }
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
  "stella-ball.onboarding-clear.v1",
  "stella-ball.party-slots.v1",
  "stella-ball.mailbox.v1",
  "stella-ball.profile-icon",
  "stella-ball.attendance",
  // 8-1 클리어 표식. 빠져 있어서, 초기화한 «새» 플레이어가 최종 스테이지에
  // 도달하면 첫 클리어 문구 대신 재관측 문구를 만났다.
  "stella-ball.campaign-clear.v1",
]);
/* 인트로의 「이미 봤다」 표식. 이것까지 지워야 전체 컷신이 약식이 아닌
   원본 길이로 재생된다.

   2026-08-23 수정 — 이 주석은 「sessionStorage에만 있다」고 말했고 코드도
   거기서만 지웠는데, 정작 outer-observer.js 의 markPlayed 는 localStorage 에
   «먼저» 쓰고 그것이 막힐 때만 sessionStorage 로 떨어진다. 그래서 초기화한
   사람에게 localStorage 사본이 그대로 남아, 확인 창이 약속한 전체 인트로
   대신 약식이 재생됐다(실측: 초기화 후 local "1" / session null).
   두 곳에서 다 지운다. */
const FIRST_RUN_SESSION_KEYS = Object.freeze([
  "stella-ball.outer-observer.played",
]);
function resetToFirstRun() {
  for (const key of FIRST_RUN_KEYS) appStorage.remove(key);
  for (const key of FIRST_RUN_SESSION_KEYS) {
    appStorage.remove(key);
    try {
      window.sessionStorage.removeItem(key);
    } catch {}
  }
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
