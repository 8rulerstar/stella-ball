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
