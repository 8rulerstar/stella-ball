/* Shared DOM presentation helpers. Gameplay code should never need these. */
function setPortrait(el, h, size = 56) {
  if (h.cuteSprite) {
    el.style.backgroundImage = 'url("' + h.cuteSprite + '")';
    el.style.backgroundSize = "100% 100%";
    el.style.backgroundPosition = "0 0";
    return;
  }
  el.style.backgroundImage = 'url("' + h.sprite + '")';
  if (h.portraitScale) {
    const portraitSize = size * h.portraitScale;
    el.style.backgroundSize = portraitSize + "px " + portraitSize + "px";
    el.style.backgroundPosition = "center";
    return;
  }
  if (h.atlas) {
    el.style.backgroundSize = size * 2 + "px " + size * 2 + "px";
    el.style.backgroundPosition =
      -h.atlas[0] * size + "px " + -h.atlas[1] * size + "px";
    return;
  }
  el.style.backgroundSize = h.frames * size + "px " + size + "px";
  el.style.backgroundPosition = "0 0";
}

function setScene(scene) {
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
    previousHtml = U.over.innerHTML;
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
    U.over.innerHTML = previousHtml;
  };
  document.querySelector("#confirmYes").focus({ preventScroll: true });
}
