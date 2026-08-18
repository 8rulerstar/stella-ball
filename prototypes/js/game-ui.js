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
  /* 전투에 들어가면 하늘의 도는 애니메이션을 재운다. 소품을 «숨기는»
     F2가 일반 렉을 없앴는데, 숨기는 대신 도는 것만 멈추는 쪽이 화풍을
     지키면서 같은 일을 던다(stella-ball-dawn.js의 setSkyQuiet).
     새 소품이 전투 도중에 생기면 그것은 다음 화면 전환까지 돈다 — 잠깐
     지나가는 것들이라 그대로 둔다. */
  if (window.StellaDawnSky && window.StellaDawnSky.quiet)
    window.StellaDawnSky.quiet(scene === "game");
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
