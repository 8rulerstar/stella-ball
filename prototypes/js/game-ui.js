/* Shared DOM presentation helpers. Gameplay code should never need these. */
// Every roster sheet is a uniform 192x192 six-frame strip now, so the old
// per-hero portraitScale and atlas escapes have no callers left.
function setPortrait(el, h, size = 56) {
  el.style.backgroundImage = 'url("' + h.sprite + '")';
  el.style.backgroundSize = h.frames * size + "px " + size + "px";
  el.style.backgroundPosition = "0 0";
}

/* Deferred UI callbacks (a claim burst finishing 620ms after the button was
   pressed) compare against this to see whether the screen they meant to
   refresh is still on display. Every screen transition passes through here. */
let sceneSequence = 0;
function setScene(scene) {
  /* 화면이 바뀌는 자리는 여기 하나뿐이다 — 타이틀·허브·메뉴·전투가 전부
     이 함수를 지난다. 그래서 화면 전환음도 여기 한 번만 둔다. 화면마다
     따로 넣으면 새 화면이 생길 때마다 조용한 화면이 하나씩 늘어난다.
     같은 화면으로 다시 부르는 경우가 있어 실제로 «바뀔 때»만 낸다. */
  if (!isRuntimeScene(scene) && typeof playSfx === "function")
    playSfx("screen");
  // A toast belongs to the battle that emitted it. Victory, direct screen
  // calls and debug navigation can leave the game without using pause-exit;
  // carrying that queue into meta screens made old combat messages reappear
  // on the next table.
  if (scene !== "game" && typeof clearToastQueue === "function")
    clearToastQueue();
  /* 입장 컷신 상자도 전장의 것이다. 걷어내는 곳이 프레임 훅과 건너뛰기
     둘뿐이라, 연출이 도는 6초 안에 R이나 「관측소로 나가기」로 판을 떠나면
     inset:0 짜리 베일과 레터박스가 편성·허브·상점 위에 그대로 남았다 —
     그 상태로 같은 스테이지에 다시 들어가면 이미 본 판정이라 상자를
     새로 만들지 않아 세션 내내 사라지지 않았고, 다른 스테이지에 들어가면
     비트 클래스가 다 붙은 상자를 재사용해 그 컷신이 통째로 재생되지
     않았다. 화면이 바뀌는 유일한 지점에서 함께 치운다. */
  if (scene !== "game" && typeof clearBattleCinematic === "function")
    clearBattleCinematic();
  sceneSequence += 1;
  setRuntimeScene(scene);
  document.body.classList.toggle("title-mode", scene === "title");
  document.body.classList.toggle("meta-mode", scene === "meta");
  document.body.classList.toggle("menu-mode", scene === "menu");
  document.body.classList.toggle("game-mode", scene === "game");
}

// Long names scroll rather than being clipped.  Called after a screen renders;
// only elements whose content actually overflows get the animation, and the
// duration scales with the distance so every name reads at the same speed.
/* 읽기-쓰기를 분리해 보았다가 되돌렸다(2026-08-21). 한 루프 안에서
   scrollWidth를 읽고 곧바로 클래스를 쓰면 동기 리플로우를 강제한다는
   것은 맞지만, 이 화면의 마퀴는 7개뿐이라 실측에서 이득이 없었다 —
   40회 반복에 교차 0.4ms 대 분리 0.5ms로, 배열을 하나 더 만드는 쪽이
   오히려 근소하게 느렸다. 이 저장소의 규칙대로(PROJECT_CONTEXT 성능 절)
   측정이 이득을 보이지 않는 최적화는 넣지 않는다. 마퀴가 수십 개로
   늘어나면 그때 다시 재고 바꾼다. */
function applyMarquees(root = document) {
  for (const el of root.querySelectorAll(".marquee")) {
    const inner = el.firstElementChild;
    if (!inner) continue;
    const shift = inner.scrollWidth - el.clientWidth;
    if (shift > 4) {
      el.classList.add("scrolling");
      el.style.setProperty("--marquee-shift", shift + 42 + "px");
      el.style.setProperty(
        "--marquee-duration",
        Math.max(6, (shift + 42) / 26).toFixed(1) + "s",
      );
    } else {
      el.classList.remove("scrolling");
      el.style.removeProperty("--marquee-shift");
      el.style.removeProperty("--marquee-duration");
    }
  }
}
// Destructive or context-losing navigation asks first.
function showConfirm({
  kicker,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}) {
  const previousClass = U.over.className,
    previousChildren = [...U.over.childNodes],
    previousOnClick = U.over.onclick;
  U.over.onclick = null;
  U.over.className = "overlay confirm-scene";
  U.over.innerHTML =
    '<section class="confirm-card" role="dialog" aria-modal="true"><small>' +
    kicker +
    "</small><h2>" +
    title +
    "</h2><p>" +
    body +
    '</p><div class="confirm-actions"><button class="confirm-yes" id="confirmYes">' +
    confirmLabel +
    '</button><button id="confirmNo">돌아가기</button></div></section>';
  U.over.classList.remove("hide");
  document.querySelector("#confirmYes").onclick = () => {
    playSfx?.("confirm");
    onConfirm?.();
  };
  document.querySelector("#confirmNo").onclick = () => {
    playSfx?.();
    if (onCancel) return onCancel();
    U.over.className = previousClass;
    U.over.replaceChildren(...previousChildren);
    U.over.onclick = previousOnClick;
  };
  document.querySelector("#confirmYes").focus({ preventScroll: true });
}
