/* 실제 노래 트랙 BGM (2026-08-23, 오너 지시 — «브금 넣자»).

   이 저장소는 여태 파일 없는 합성 앰비언트(startObservatoryScore)만 배경음으로
   썼다. 여기에 실제 곡을 얹는다. 씬에 배정된 곡이 흐르는 동안은 합성 앰비언트를
   눌러(bgmSynthDuck) 곡이 주인공이 되게 하고, 곡이 없는 씬에서는 앰비언트가
   그대로 돌아온다. 볼륨은 기존 settings.master·settings.bgm 슬라이더가 쥔다 —
   새 슬라이더를 만들지 않는다.

   브라우저 자동재생 정책상 첫 사용자 제스처 전에는 어떤 소리도 못 낸다. 그래서
   첫 포인터·키·터치에서 잠금을 풀고 «그때의 씬»에 맞는 곡을 시작한다. 곡은
   HTMLAudioElement로 틀고 loop를 준다 — 캔버스 물리·봇과 무관한 표현 레이어다. */
(function () {
  const TRACKS = {
    // ambient(title-ambient.mp3)는 이제 씬에 배정되지 않는다 — 아래 bgmToScene
    // 의 마지막 보루(fallback)로만 남는다.
    ambient: "../assets/audio/bgm/title-ambient.mp3",
    title: "../assets/audio/bgm/title.ogg",
    hub: "../assets/audio/bgm/hub.ogg",
    battle: "../assets/audio/bgm/battle.ogg",
  };
  // 씬 → 곡. 타이틀은 title 곡, 관측소(허브·소환·상점 등 메뉴)는 hub 곡,
  // 전투(game)는 전투곡이다. meta·menu 를 같은 곡으로 두어 허브에서 소환·상점을
  // 오갈 때 음악이 끊기지 않는다(둘은 서로 다른 씬이라 따로 두면 크로스페이드가
  // 걸린다). — 2026-08-24, 오너 지시 «허브 브금 bgm_boss1, 타이틀 브금 bgm_wave7».
  const SCENE_TRACK = {
    title: "title",
    meta: "hub",
    menu: "hub",
    game: "battle",
  };
  const FADE_MS = 900;
  const SYNTH_DUCK = 0.12;

  const els = {};
  const fades = new Map();
  let current = null;
  let desiredScene = "title";
  let unlocked = false;

  function vol() {
    const s = typeof settings === "object" && settings ? settings : {};
    const m = typeof s.master === "number" ? s.master : 0.7;
    const b = typeof s.bgm === "number" ? s.bgm : 0.28;
    return Math.max(0, Math.min(1, m * b));
  }
  function el(name) {
    if (els[name]) return els[name];
    const a = new Audio(TRACKS[name]);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0;
    els[name] = a;
    return a;
  }
  function clearFade(a) {
    const id = fades.get(a);
    if (id) {
      clearInterval(id);
      fades.delete(a);
    }
  }
  function fadeTo(a, target, done) {
    clearFade(a);
    const start = a.volume;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      a.volume = start + (target - start) * k;
      if (k >= 1) {
        clearFade(a);
        if (done) done();
      }
    }, 40);
    fades.set(a, id);
  }
  function playTrack(name) {
    if (current === name) {
      fadeTo(el(name), vol());
      return;
    }
    if (current) {
      const old = el(current);
      fadeTo(old, 0, () => {
        try {
          old.pause();
        } catch (e) {
          /* 무시 */
        }
      });
    }
    current = name;
    const a = el(name);
    a.volume = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {}); // 제스처 전에는 거부될 수 있다
    fadeTo(a, vol());
    if (typeof syncAudio === "function") syncAudio(); // 신스 누르기 반영
  }

  // setScene 이 부른다. 잠금 전에는 «원하는 씬»만 기억해 두고, 잠금 순간 재생한다.
  window.bgmToScene = function (scene) {
    desiredScene = scene;
    if (!unlocked) return;
    playTrack(SCENE_TRACK[scene] || "ambient");
  };
  // syncAudio 가 부른다. 곡이 실제로 소리 내는 중이면 합성 앰비언트를 눌러 둔다.
  window.bgmSynthDuck = function () {
    if (unlocked && current) {
      const a = els[current];
      if (a && !a.paused) return SYNTH_DUCK;
    }
    return 1;
  };
  // 볼륨 슬라이더가 syncAudio 를 지날 때 곡 볼륨도 같이 따라오게 한다.
  window.bgmRefreshVolume = function () {
    if (current) {
      const a = els[current];
      if (a && !fades.get(a)) a.volume = vol();
    }
  };

  // 진단용: 현재 곡·잠금 상태와 각 트랙의 재생 상태를 들여다본다.
  window.bgmDebug = function () {
    const t = {};
    for (const [k, a] of Object.entries(els))
      t[k] = {
        paused: a.paused,
        t: +a.currentTime.toFixed(2),
        vol: +a.volume.toFixed(2),
      };
    return { current, unlocked, duck: window.bgmSynthDuck(), tracks: t };
  };

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (typeof ensureAudio === "function") ensureAudio();
    window.bgmToScene(desiredScene);
  }
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
})();
