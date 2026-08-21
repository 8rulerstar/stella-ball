/* Constellation trace capture, normalization, and recognition. */
// --- Constellation figure system ------------------------------------------
// Shared combat system, kept in its own file because it wraps
// `settleParty` and reads `applyBossHit`, `figureCentroid`'s neighbours and
// the runtime hook registry, all of which that file establishes first.
//
// --- Constellation figure system (all combat tables, 2026-08-13) -----------
// A successful Space parry on a meteor-to-starkeeper collision leaves one
// fixed starlight node at that contact.  The meteor and starkeeper keep their
// normal physics; the nodes, not their eventual resting positions, become the
// constellation vertices. Nodes last for one shot, then resolve together when
// the table settles. Every combat table uses this same parry rule.
//
// The recogniser is ported from RuneCast's gesture pipeline
// (~/Projects/RuneCast, 설계 문서 4.3-4.5): centroid-to-origin plus uniform
// scale, $P greedy cloud matching with uniform weights and four start points,
// bidirectional minimum, and score spread across a reject..perfect band.
const FIGURE = {
  // Re-measured for 5-point clouds; RuneCast's 0.13/0.035 were tuned for
  // 32-point stroke clouds.  0.19 is the loose read the training bench wants:
  // over 20000 synthetic trials each it takes ±18% jitter from 89% to 100% and
  // "대충 그린" ±30% from 35% to 82%, while the two shapes that must never pay
  // out hold — the free opening layout (four seats on a rectangle plus the
  // meteor) passes 11% instead of 0%, and random scatter 0.2%.  A 0.55-squashed
  // pentagon still reads 0%, because a flattened ring is not a pentagram.
  // All combat now shares this loose first-pass read; revisit after live data.
  reject: 0.19,
  perfect: 0.04,
  bonusPerPoint: 14, // damage per enclosed target, per figure vertex
  /* 발동까지 2.85초였다 — drawTime 1.4 + correctTime 0.8 + revealDelay 0.35
     + castDelay 0.3. 유성이 멈추고 나서 그만큼을 더 기다려야 능력이 나가니
     「도착했는데 아무 일도 안 일어난다」로 읽혔다. 궤적은 여전히 그려지는
     것이 보이되(0.7초), 그 뒤 단계는 바짝 붙여 1.12초에 발동한다.
     0.55/0.9/0.45로 한꺼번에 줄였던 예전 시도가 실패한 이유는 궤적까지 같이
     사라져서였으므로, 줄이는 것은 궤적 이후의 뜸들이는 구간이다. */
  drawTime: 0.7,
  // 2.6 was set when the whole sequence was 5s and a shot took ~7s to settle.
  // The correction and reveal steps added 1.6s on top, and the meteor now
  // settles in ~3s, so the hold was the one beat outlasting the shot itself.
  holdTime: 1.6,
  fadeTime: 1,
  // Sequence after the trace lands, all from the silhouette art delivery:
  // the crooked figure the player actually made is corrected into the real
  // constellation, the creature fades in over it, and only then does the
  // ability fire.  See FIGURE_ART_SPEC.md §2.
  correctTime: 0.28, // ease-in-out from drawn vertices to the fitted skeleton
  revealDelay: 0.08, // silhouette starts fading in this long after correction
  revealTime: 0.22,
  castDelay: 0.06, // ability fires this long after the silhouette appears
  // The delivery specified 0.13, matching the pentagram's inner wash.  On the
  // real table that is invisible: the arena floor is dark purple and the
  // silhouettes are pale, so at 0.13 the swan cannot be made out at all.  0.30
  // is the lowest value where it still reads as "faint" rather than "absent",
  // checked against the live canvas.  Revisit if the floor tone changes —
  // PROGRESS_REPORT.md already lists that purple as an open item.
  silhouetteAlpha: 0.3,
  // 6·7점 사다리(2026-08-21 결정 2): 상위 티어만 실루엣이 진하다.
  silhouetteAlphaHigh: 0.42,
};
const FIGURE_PARRY = {
  // A charge can be placed just before a collision, but the contact itself is
  // also remembered briefly so the player can react to what they saw.
  parryWindow: 0.4,
  contactMemory: 0.18,
  nearMissWindow: 0.14,
  falseStartCooldown: 0.3,
  missCooldown: 0.72,
  minNodes: 3,
  maxNodes: 7,
};
// Parry presentation only. Three outcomes have to differ in SHAPE, not in
// brightness: the old ring drew window/success/late through one path and only
// changed alpha, which is unreadable in a crowded corner. Colours stay inside
// the Dawn Observatory tokens; failures fall to the neutral --mist/--line pair.
// These effects carry their own clock (advanced in `afterFeedbackUpdate`) and
// deliberately do NOT live in `fieldFx`: that array only advances inside
// `simulatePhysics`, so anything queued after the meteor stops would freeze on
// screen until the next launch — and node loss can happen exactly there.
const PARRY_FX = {
  budget: 6, // separate from the 12-slot fieldFx budget
  hit: 0.5,
  miss: 0.42,
  scatter: 0.9,
  close: 0.5,
  nodeBorn: 0.3,
  core: "#cfdad7", // --moon: one fixed bright core for all eight unit colours
  fail: "#8ba39f", // --mist
  failLine: "#34494d", // --line
  window: "#ffd2a0", // --star
};
let parryFx = [];
// 패링 잔광도 마찬가지다. 수업이 넘어가면 이전 접점의 빛이 남지 않는다.
registerRuntimeHook("afterBattleSetup", () => {
  parryFx = [];
});
function pushParryFx(fx) {
  parryFx.push({ t: 0, ...fx });
  if (parryFx.length > PARRY_FX.budget)
    parryFx.splice(0, parryFx.length - PARRY_FX.budget);
}
let figureFx = null;
let figureShotBattle = null;
let figureShot = null;
function figureActive() {
  return Boolean(battle && run && !battleComplete);
}
function currentFigureShot() {
  if (figureShotBattle !== battle) {
    figureShotBattle = battle;
    parryFx.length = 0;
    figureShot = {
      nodes: [],
      parry: 0,
      cooldown: 0,
      flash: 0,
      contact: null,
      nearMiss: 0,
      guideStarClaimed: false,
    };
  }
  return figureShot;
}
function clearFigureShot() {
  const state = currentFigureShot();
  state.nodes = [];
  state.parry = 0;
  state.contact = null;
  state.nearMiss = 0;
  state.guideStarClaimed = false;
}
// Guide stars are deliberately not collision targets. Campaign charges turn a
// first successful parry into a readable three-point loop without changing the
// meteor path. Luna's tutorial showcase instead supplies four exact pentagram
// points around the same one genuine contact.
function addGuideStars(state, contact) {
  if (!battle?.guideStarCharges || state.guideStarClaimed) return false;
  const x = contact?.x ?? ball.x,
    y = contact?.y ?? ball.y,
    incoming = contact?.incoming ?? ball,
    speed =
      Math.hypot(incoming.x ?? incoming.vx, incoming.y ?? incoming.vy) || 1,
    ux = (incoming.x ?? incoming.vx) / speed,
    uy = (incoming.y ?? incoming.vy) / speed,
    px = -uy,
    py = ux,
    place = (side) => ({
      x: clamp(x - ux * 66 + px * 76 * side, 28, W - 28),
      y: clamp(y - uy * 66 + py * 76 * side, 28, H - 28),
      col: "#ffd27f",
      label: "안내별",
      guide: true,
      born: PARRY_FX.nodeBorn,
    });
  const showcase = battle.guideFigure === "pentagram",
    guides = showcase
      ? (() => {
          // Anchor the real parry contact on the lower-left point of an exact
          // pentagon. The other four points are presentation-only guide stars,
          // so the normal matcher is guaranteed to select its loudest 5-point
          // figure while the boss remains inside the reveal.
          const anchor = 3,
            radius = 170,
            model = PENTAGRAM_TEMPLATE,
            cx = x - model[anchor].x * radius,
            cy = y - model[anchor].y * radius;
          return model
            .map((point, index) =>
              index === anchor
                ? null
                : {
                    x: clamp(cx + point.x * radius, 28, W - 28),
                    y: clamp(cy + point.y * radius, 28, H - 28),
                    col: "#ffd27f",
                    label: "안내별",
                    guide: true,
                    born: PARRY_FX.nodeBorn,
                  },
            )
            .filter(Boolean);
        })()
      : [place(-1), place(1)];
  if (state.nodes.length + guides.length > FIGURE_PARRY.maxNodes) return false;
  state.nodes.push(...guides);
  /* 안내별은 별빛 조준점으로도 남는다. 그래서 안내별의 값이 「별자리 노드
     하나 더」에서 「다음 샷의 조준 선택지 하나 더」로 커진다 — 첫 발에는
     패링이 아직 없으므로 안내별이 유일한 조준점이기도 하다. */
  for (const guide of guides)
    dropAimStar?.(guide.x, guide.y, guide.col, guide.label);
  state.guideStarClaimed = true;
  pushParryFx({
    kind: "guide",
    x,
    y,
    nodes: state.nodes.slice(-guides.length),
    d: 0.62,
  });
  addPopup(
    x,
    y - 42,
    "루나의 별 · " + state.nodes.length + "/7",
    "#ffd27f",
    true,
    // 화자가 있는 말이다. 피해 숫자와 같은 서체를 쓰지 않는다.
    true,
  );
  /* 루나가 «말한다». 이 한 줄이 §5 말풍선·§8 등장 연출과 같은 화자 체계를
     쓰고, 그래서 「루나가 준 별」이 세 항목에서 한 어휘로 묶인다. */
  StellaRuntime.modules
    .optional("speech")
    ?.say(
      "luna",
      showcase
        ? "안내별 넷을 얹었어요. 오망성 항로가 완성됩니다."
        : "첫 패링에 별을 둘 얹어 뒀어요. 궤적을 이어 보세요.",
    );
  toast(
    showcase
      ? "루나의 안내별 넷 · 오망성 항로 완성"
      : "관측 잔광 · 안내별 둘이 첫 별자리를 돕습니다",
  );
  return true;
}
// Called by the combat collision pass. `mobilePair` has already left the
// ordinary bounce in place; this consumes only the additional powered contact.
/* 자동 공명(2026-08-18 실험). 켜면 Space 타이밍 테스트가 사라지고, 별지기와
   부딪히는 것 자체가 곧 공명이 된다 — 노드도 생기고 가속도 그대로 일어난다.

   근거: 실측으로 한 판이 주는 공명 기회는 중앙값 15회인데 별자리에 필요한
   노드는 3개다. 게다가 연속 접점 간격의 47%가 무장창(0.4초) 안에 들어와
   한 번 누르면 다음 것까지 덮인다. 즉 이것은 타이밍 시험이 아니라 「누르는
   것을 잊었는가」 시험이었다.
   대신 노드를 «어디에 쓸 것인가»가 결정이 된다 — 별자리로 태울 것인가,
   다음 샷의 조준점으로 남길 것인가.

   false로 되돌리면 예전 Space 공명이 그대로 돌아온다. */
const AUTO_PARRY = true;
/* 2026-08-21 결정 6: 수업 한정 우회를 걷었다 — 수업도 실전과 같은 규칙
   (자동 공명·별빛 경제)으로 돈다. 새 3실습 수업이 같은 커밋에 들어가고,
   E2E(scripts/test-onboarding-e2e.mjs)는 새 여정으로 교체한다. */
function onboardingRunning() {
  return Boolean(StellaRuntime.modules.optional("onboarding")?.isActive());
}
function autoParryOn() {
  return AUTO_PARRY;
}
function nodeEconomyOn() {
  return NODE_ECONOMY;
}
/* 별빛을 «자원»으로 만든다. 샷이 끝나도 별자리가 자동으로 터지지 않고,
   모인 별빛이 판에 남아 두 곳에서 경쟁한다 — 별자리(Space)와 조준(좌클릭).
   둘 다 값어치가 있고 공급은 유한하므로 매 샷 배분이 결정이 된다.
   false로 되돌리면 예전처럼 샷 끝에 자동으로 별자리가 발동한다. */
const NODE_ECONOMY = true;
function consumeTrainingParry(
  g,
  contact = null,
  remembered = false,
  forced = false,
) {
  if (!figureActive()) return false;
  const state = currentFigureShot(),
    onboardingAssist = runtimeHookHandled("consumeParryAssist", {
      gate: g,
      contact,
      remembered,
    });
  if (onboardingAssist) {
    // Luna's one guided lesson accepts Space anywhere along its locked route.
    // The assist is consumed here, on the real contact, and cannot leak into a
    // campaign shot or expose figure state to the story layer.
    state.cooldown = 0;
    state.nearMiss = 0;
    state.parry = Math.max(state.parry, FIGURE_PARRY.parryWindow);
  }
  if (
    !forced &&
    (state.cooldown > 0 ||
      (remembered
        ? !state.contact || state.contact !== contact || contact.t <= 0
        : state.parry <= 0))
  )
    return false;
  state.parry = 0;
  state.contact = null;
  state.nearMiss = 0;
  state.flash = 0.44;
  ball.runeBurst = Math.max(ball.runeBurst || 0, 0.92);
  const x = contact?.x ?? (ball.x + g.x) / 2,
    y = contact?.y ?? (ball.y + g.y) / 2;
  /* relay는 여기서 밀지 않는다. 패링이 성공하면 곧이어 resolveMeteorParryContact가
     같은 접점에 같은 type·같은 0.48초·같은 색으로 하나 더 밀고 있었다 — 한 번의
     패링에 fieldFx가 ['relay','assist','relay']로 쌓였다. 겹친 한 장이
     paintFeedbackAsset을 한 번 더 부르고, 그 한 번이 측정 +3.45ms였다.
     저쪽은 0.12초 접점 쿨다운까지 걸고 있어 연타에서도 겹치지 않는다. */
  // Success bursts outward from the contact and lands on the node it just
  // created, so the cause reads without any text.
  pushParryFx({ kind: "hit", x, y, col: g.col, d: PARRY_FX.hit });
  combatSfx?.("parry", 1);
  if (state.nodes.length < FIGURE_PARRY.maxNodes) {
    combatSfx?.("node", 0.7);
    state.nodes.push({
      x,
      y,
      col: g.col,
      label: g.s,
      born: PARRY_FX.nodeBorn,
    });
    /* 같은 접점이 별빛 «조준점»으로도 남는다. 별자리 노드는 샷 끝에
       정산되며 사라지지만(finishFigureShot), 조준점은 전투 내내 판에
       머무른다 — 그래서 패링이 곧 다음 샷의 조준권이 된다. */
    dropAimStar?.(x, y, g.col, g.s);
    addPopup(
      g.x,
      g.y - 52,
      "별빛 " + state.nodes.length + "/" + FIGURE_PARRY.maxNodes,
      g.col,
      true,
    );
    // The moment the chain becomes castable is announced by the figure
    // closing, now that the `별빛 n/7 · 3점부터 발동` label is gone.
    if (state.nodes.length === FIGURE_PARRY.minNodes)
      pushParryFx({
        kind: "close",
        ring: figureRing(state.nodes).map((n) => ({ x: n.x, y: n.y })),
        d: PARRY_FX.close,
      });
  }
  if (addGuideStars(state, contact))
    pushParryFx({
      kind: "close",
      ring: figureRing(state.nodes).map((n) => ({ x: n.x, y: n.y })),
      d: PARRY_FX.close,
    });
  return true;
}
// A real collision leaves a short, single-use echo. It stores the pre-bounce
// direction so a late input can apply the same powered release without ever
// rewinding the visible physics.
function rememberTrainingParryContact(g, contact) {
  if (!figureActive()) return;
  const state = currentFigureShot();
  if (state.parry > 0 || state.cooldown > 0) return;
  if (state.nearMiss > 0) {
    // Positions have to be copied before the shot is cleared: the scatter is
    // the only thing that shows WHERE the starlight was lost.
    const lost = state.nodes.map((n) => ({ x: n.x, y: n.y, col: n.col })),
      lostNodes = finishFigureShot({ missed: true });
    state.cooldown = FIGURE_PARRY.missCooldown;
    state.flash = 0.2;
    pushParryFx({ kind: "miss", x: contact.x, y: contact.y, d: PARRY_FX.miss });
    // The scatter overrides the miss rather than layering: losing the chain is
    // the louder fact, and two failure sounds at once read as one mess.
    if (lost.length) {
      pushParryFx({ kind: "scatter", nodes: lost, d: PARRY_FX.scatter });
      combatSfx?.("parryScatter", 1);
    } else combatSfx?.("parryMiss", 0.9);
    fieldFx.push({
      type: "relay",
      x: contact.x,
      y: contact.y,
      t: 0,
      d: 0.26,
      col: "#7e7b91",
    });
    addPopup(contact.x, contact.y - 32, "공명 놓침", "#c3bcd8", false);
    if (!lostNodes) toast("패링 지연 · 공명 재정비");
    return;
  }
  state.contact = {
    ...contact,
    g,
    t: FIGURE_PARRY.contactMemory,
  };
}
function requestTrainingParry() {
  // 자동 공명에서는 누를 것이 없다. 훅은 남겨 두어 수업이 여전히 「눌렀다」를
  // 관찰할 수 있게 하되, 실제 공명은 접촉이 만든다.
  if (autoParryOn()) return false;
  if (!figureActive() || !ball?.moving) return false;
  const state = currentFigureShot(),
    guided = runtimeHookHandled("assistParryRequest", { state, ball });
  const finishRequest = (requested) => {
    runRuntimeHooks("afterParryRequest", { requested, guided, state });
    return requested || guided;
  };
  if (state.cooldown > 0 || state.parry > 0 || state.nearMiss > 0)
    return finishRequest(false);
  // Pressing just after a real contact upgrades that collision. The combat
  // resolver uses the saved normal and incoming velocity, so no object jumps
  // backwards and the success still has exactly one physical source.
  if (state.contact?.t > 0) {
    const contact = state.contact;
    if (!consumeTrainingParry(contact.g, contact, true))
      return finishRequest(false);
    StellaRuntime.modules
      .require("combat")
      .resolveParryContact(contact.g, contact);
    return finishRequest(true);
  }
  state.parry = FIGURE_PARRY.parryWindow;
  ball.runeBurst = Math.max(ball.runeBurst || 0, 0.54);
  return finishRequest(true);
}
function finishFigureShot({ missed = false } = {}) {
  const state = currentFigureShot();
  const finish = (resolved) => {
    runRuntimeHooks("afterFigureShot", { missed, resolved, state });
    return resolved;
  };
  if (missed) {
    const lostNodes = state.nodes.length;
    clearFigureShot();
    if (lostNodes) toast("패링 실패 · 모은 별빛이 흩어졌습니다");
    return finish(Boolean(lostNodes));
  }
  if (!state.nodes.length) return finish(false);
  const nodes = state.nodes,
    spentGuideStars = state.guideStarClaimed;
  clearFigureShot();
  /* 노드 경제(2026-08-18 실험). 샷이 끝났다고 별자리가 저절로 터지지 않는다.
     모아 둔 별빛은 판에 남아(dropAimStar가 이미 넣었다) 두 가지로 쓰인다:
     Space로 태워 별자리를 그리거나, 다음 샷의 조준점으로 남기거나.
     여기서 자동으로 태워 버리면 그 선택 자체가 존재하지 않는다. */
  if (nodeEconomyOn()) return finish(false);
  if (nodes.length >= FIGURE_PARRY.minNodes) {
    if (spentGuideStars) battle.guideStarCharges -= 1;
    resolveFigure(nodes);
    return finish(true);
  }
  return finish(false);
}
function advanceFigureShot(d) {
  if (!figureActive()) return;
  const state = currentFigureShot();
  state.cooldown = Math.max(0, state.cooldown - d);
  state.flash = Math.max(0, state.flash - d);
  for (const node of state.nodes)
    if (node.born > 0) node.born = Math.max(0, node.born - d);
  if (state.contact) {
    state.contact.t = Math.max(0, state.contact.t - d);
    if (state.contact.t === 0) state.contact = null;
  }
  if (state.parry > 0) {
    state.parry = Math.max(0, state.parry - d);
    if (state.parry === 0) {
      // Do not erase a chain merely for arming in open space. A contact that
      // follows immediately still counts as a genuine late miss; otherwise
      // this settles into a short, harmless false-start cooldown.
      state.nearMiss = FIGURE_PARRY.nearMissWindow;
    }
  }
  if (state.nearMiss > 0) {
    state.nearMiss = Math.max(0, state.nearMiss - d);
    if (state.nearMiss === 0) {
      state.cooldown = Math.max(
        state.cooldown,
        FIGURE_PARRY.falseStartCooldown,
      );
      toast("공명 비움 · 다음 접점을 기다리세요");
    }
  }
}
addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat || !figureActive()) return;
  if (paused || isCombatInputLocked()) return;
  if (requestTrainingParry()) e.preventDefault();
});
function figureCentroid(points) {
  let cx = 0,
    cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}
// Angular order around the centroid gives the simple polygon; without it the
// vertices connect in awakening order and the figure self-crosses at random.
function figureRing(points) {
  const c = figureCentroid(points);
  return [...points].sort(
    (a, b) =>
      Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x),
  );
}
function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x,
      yi = ring[i].y,
      xj = ring[j].x,
      yj = ring[j].y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function distanceToSegment(px, py, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = dx * dx + dy * dy;
  const t = len
    ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len))
    : 0;
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}
/* --- point-cloud recogniser (RuneCast port) ----------------------------- */
function figureNormalize(points) {
  const c = figureCentroid(points),
    centred = points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
  // Uniform scale, never per-axis: a squashed pentagon must not normalise into
  // a regular one, because that difference is exactly what is being judged.
  let max = 0;
  for (const p of centred) max = Math.max(max, Math.hypot(p.x, p.y));
  return max > 0
    ? centred.map((p) => ({ x: p.x / max, y: p.y / max }))
    : centred;
}
function figureCloudDistance(a, b, start) {
  const n = a.length,
    matched = new Array(n).fill(false);
  let sum = 0,
    i = start;
  do {
    let best = Infinity,
      index = -1;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = Math.hypot(a[i].x - b[j].x, a[i].y - b[j].y);
      if (d < best) {
        best = d;
        index = j;
      }
    }
    if (index < 0) break;
    matched[index] = true;
    sum += best;
    i = (i + 1) % n;
  } while (i !== start);
  return sum / n;
}
// RuneCast deliberately skips rotation normalisation, because for handwriting
// the orientation carries the meaning and `>` must not match `<`.  A figure on
// the table has no up, so a tilted pentagram is still a pentagram: every
// rotation that puts one of our points on the template's first vertex is
// tried and the best wins.  Five points, five candidates.
function figureMatch(cloud, template) {
  const n = cloud.length,
    step = Math.max(1, Math.floor(n / 4)),
    anchor = Math.atan2(template[0].y, template[0].x);
  let best = Infinity;
  for (let k = 0; k < n; k++) {
    const turn = anchor - Math.atan2(cloud[k].y, cloud[k].x),
      cos = Math.cos(turn),
      sin = Math.sin(turn),
      turned = cloud.map((p) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos,
      }));
    for (let i = 0; i < n; i += step)
      best = Math.min(
        best,
        figureCloudDistance(turned, template, i),
        figureCloudDistance(template, turned, i),
      );
  }
  return best;
}
// `figureMatch` measures how close two clouds are, but the pairing it builds on
// the way — which drawn vertex sits on which template star — is thrown away
// with the running total.  Recovering that pairing is what lets the trace
// follow a constellation's own lines instead of a ring: the edge list is
// written in template-star numbers, and this turns those into table positions.
// Same rotation search as above, then one greedy pass per candidate.
function figureAlign(cloud, template) {
  const n = cloud.length,
    anchor = Math.atan2(template[0].y, template[0].x);
  let best = null;
  for (let k = 0; k < n; k++) {
    const turn = anchor - Math.atan2(cloud[k].y, cloud[k].x),
      cos = Math.cos(turn),
      sin = Math.sin(turn),
      turned = cloud.map((p) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos,
      }));
    const used = new Array(n).fill(false),
      pairs = new Array(n).fill(-1);
    let sum = 0;
    for (let star = 0; star < n; star++) {
      let pick = -1,
        near = Infinity;
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        const d = Math.hypot(
          turned[i].x - template[star].x,
          turned[i].y - template[star].y,
        );
        if (d < near) {
          near = d;
          pick = i;
        }
      }
      used[pick] = true;
      pairs[star] = pick;
      sum += near;
    }
    if (!best || sum < best.sum) best = { sum, pairs };
  }
  // pairs[templateStarIndex] = index of the drawn vertex standing on that star
  return best.pairs;
}
const PENTAGRAM_TEMPLATE = figureNormalize(
  Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: Math.cos(a), y: Math.sin(a) };
  }),
);
/* --- the constellation roster ------------------------------------------- */
// One entry per constellation the table can draw, grouped by how many vertices
// it needs.  A settle with three or more points ALWAYS lands on exactly one of
// them: the nearest template in its own tier wins and there is no reject gate.
//
// That is a deliberate choice, and the measurement behind it is in
// BOT_REPORT.md §2-3 — over 795 real shots the settled layout was statistically
// indistinguishable from uniform random scatter, so no threshold can separate
// "drawn well" from "landed there".  Gating it would only have hidden the
// outcome, never earned it.  What the player does control is the vertex count
// (how many starkeepers were woken), so the tier is the skill axis and which
// constellation inside the tier is the draw.
//
// `share` is the measured chance of this constellation winning its tier, from
// the same 795 shots.  Keep ability strength inversely proportional to it: the
// pentagram shows up 4% of the time and should pay like it.
// `edges` is the constellation's own figure, written as pairs of indices into
// `points`.  It is what makes the trace look like the thing it is named after,
// and it is fixed per constellation rather than derived: an angular ring around
// the centroid can only ever draw a convex loop, so a cross with a star in the
// middle — Cygnus — is impossible to reach that way.  Edges may be an open
// path, may revisit a hub, and need not enclose anything.
const FIGURE_SHAPES = {
  3: [
    {
      id: "aries",
      name: "양자리",
      share: 19,
      // Hamal, Sheratan, Mesarthim.  Skeleton coordinates come from the
      // silhouette delivery so the ram lines up with the bend at Sheratan;
      // they sit within a few hundredths of the projected J2000 positions.
      points: [
        [0.95, -0.18],
        [-0.35, -0.02],
        [-0.9, 0.42],
      ],
      edges: [
        [0, 1],
        [1, 2],
      ],
      art: "../assets/library/constellations/aries.png",
    },
  ],
  4: [
    {
      id: "sagitta",
      name: "화살자리",
      share: 11,
      // 촉, 왼 깃, 오른 깃, 자루 끝
      points: [
        [0, -1],
        [-0.55, -0.1],
        [0.55, -0.1],
        [0, 1],
      ],
      edges: [
        [3, 0],
        [0, 1],
        [0, 2],
      ],
      // The shaft, nock first.  `piercingShot` fires along it, so this is the
      // one constellation whose recognised orientation decides an outcome.
      axis: [3, 0],
      art: "../assets/library/constellations/sagitta.png",
    },
    {
      id: "corvus",
      name: "까마귀자리",
      share: 7,
      points: [
        [-0.85, -0.38],
        [0.82, -0.52],
        [0.55, 0.52],
        [-0.62, 0.42],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
      ],
      art: "../assets/library/constellations/corvus.png",
    },
  ],
  5: [
    // Real star positions, projected flat from J2000 RA/Dec and normalised.
    {
      id: "cassiopeia",
      name: "카시오페이아",
      share: 8,
      // 카프, 셰다르, 감마, 루크바, 세긴
      points: [
        [0.862, 0.121],
        [0.344, 0.468],
        [0.076, -0.087],
        [-0.405, -0.023],
        [-0.878, -0.478],
      ],
      // The W: an open zig-zag through the five in order, never closed.
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
      art: "../assets/library/constellations/cassiopeia.png",
    },
    {
      id: "cygnus",
      name: "백조자리",
      share: 5,
      // 데네브(꼬리), 사드르(가슴), 알비레오(부리), 델타(날개), 기에나(날개)
      points: [
        [-0.412, -0.504],
        [-0.133, -0.129],
        [0.618, 0.786],
        [0.409, -0.493],
        [-0.482, 0.339],
      ],
      // The Northern Cross: every line passes through Sadr, the hub at 1.
      edges: [
        [0, 1],
        [1, 2],
        [3, 1],
        [1, 4],
      ],
      art: "../assets/library/constellations/cygnus.png",
    },
    {
      id: "pentagram",
      name: "오망성",
      share: 2,
      points: null,
      // Same five points as a pentagon; stepping two at a time is the star.
      edges: [
        [0, 2],
        [2, 4],
        [4, 1],
        [1, 3],
        [3, 0],
      ],
      // No silhouette by design: the pentagram already owns the loudest
      // treatment on the table, so adding art would flatten the tiering.
      art: null,
    },
  ],
  // Six and seven are the top of the ladder.  Nothing below five was free to
  // take: normalising rotation and scale leaves a 3-point cloud defined by two
  // angles, so the shape space there is nearly full at two entries, and four
  // is worse — square, kite, trapezoid and rhombus all match each other under
  // 0.19.  Going up instead of sideways is the only room left.
  6: [
    {
      id: "orion",
      name: "오리온자리",
      // The seven-node cap makes this tier reachable. Its share remains unset
      // until live training data establishes a distribution worth documenting.
      share: null,
      // Betelgeuse and Bellatrix for the shoulders, the three belt stars, and
      // Rigel for the near foot.  Saiph is dropped to land on six: the far
      // foot is the one star the silhouette can lose and still read as Orion.
      points: [
        [-0.539, -0.717],
        [0.225, -0.61],
        [-0.173, 0.233],
        [-0.057, 0.158],
        [0.05, 0.066],
        [0.494, 0.87],
      ],
      // Shoulders, then the belt as its own short run, then a leg down to
      // Rigel.  The torso is deliberately open — closing it would draw a box
      // and lose the hourglass.
      edges: [
        [0, 1],
        [1, 4],
        [4, 3],
        [3, 2],
        [2, 0],
        [2, 5],
      ],
      // Silhouette not delivered yet — see FIGURE_ART_SPEC_6_7.md.  Left null
      // rather than pointing at the future path, because a missing file logs a
      // 404 on every load and console noise is how real errors get ignored.
      art: "../assets/library/constellations/orion.png",
    },
  ],
  7: [
    {
      id: "bigdipper",
      name: "북두칠성",
      share: null,
      // Dubhe, Merak, Phecda, Megrez, Alioth, Mizar, Alkaid.
      points: [
        [0.778, -0.445],
        [0.797, -0.058],
        [0.267, 0.136],
        [0.047, -0.105],
        [-0.346, -0.027],
        [-0.651, 0.047],
        [-0.892, 0.452],
      ],
      // Bowl closed, handle open: the ladle everyone already knows.
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [3, 4],
        [4, 5],
        [5, 6],
      ],
      // Silhouette not delivered yet — see FIGURE_ART_SPEC_6_7.md.
      art: "../assets/library/constellations/bigdipper.png",
    },
  ],
};
for (const tier of Object.values(FIGURE_SHAPES))
  for (const shape of tier) {
    // `raw` is the skeleton in the coordinate frame the silhouette was drawn
    // in, so it is what positions the art.  `cloud` is the same skeleton
    // centred and unit-scaled, which is all the matcher looks at.
    shape.raw = shape.points
      ? shape.points.map(([x, y]) => ({ x, y }))
      : PENTAGRAM_TEMPLATE.map((p) => ({ x: p.x, y: p.y }));
    shape.cloud = figureNormalize(shape.raw);
    if (shape.art) loadTexture(shape.art);
  }
// The silhouette sheets are 384px square, drawn on a 128 grid at ×3 with the
// skeleton origin dead centre and one skeleton unit spanning 46 grid cells.
// Both numbers come from the art delivery and are what tie a sheet to its
// skeleton; changing either without regenerating the art misaligns every one.
const FIGURE_ART_SIZE = 384,
  FIGURE_ART_UNIT = 46 * 3;
// Best-fit similarity transform from a shape's own skeleton onto the vertices
// actually on the table: the rotation, uniform scale and centre that line the
// two up.  This is what the correction step eases toward, and the same
// transform places the silhouette, so the art can never drift off the figure.
function figureFit(points, shape) {
  const order = figureAlign(figureNormalize(points), shape.cloud),
    n = points.length,
    // Table vertices reordered so index i is the one standing on skeleton star i
    table = order.map((index) => points[index]),
    model = shape.raw;
  let tx = 0,
    ty = 0,
    mx = 0,
    my = 0;
  for (let i = 0; i < n; i++) {
    tx += table[i].x;
    ty += table[i].y;
    mx += model[i].x;
    my += model[i].y;
  }
  tx /= n;
  ty /= n;
  mx /= n;
  my /= n;
  let dot = 0,
    cross = 0,
    norm = 0;
  for (let i = 0; i < n; i++) {
    const ax = model[i].x - mx,
      ay = model[i].y - my,
      bx = table[i].x - tx,
      by = table[i].y - ty;
    dot += ax * bx + ay * by;
    cross += ax * by - ay * bx;
    norm += ax * ax + ay * ay;
  }
  const rotation = Math.atan2(cross, dot),
    scale = norm > 0 ? Math.hypot(dot, cross) / norm : 1,
    cos = Math.cos(rotation),
    sin = Math.sin(rotation),
    place = (p) => ({
      x: tx + scale * ((p.x - mx) * cos - (p.y - my) * sin),
      y: ty + scale * ((p.x - mx) * sin + (p.y - my) * cos),
    });
  return {
    order,
    rotation,
    scale,
    // Where each drawn vertex ends up once the figure is corrected.  Indexed
    // like `points`, so the trace can ease straight from one to the other.
    ideal: (() => {
      const target = new Array(n);
      for (let star = 0; star < n; star++)
        target[order[star]] = place(model[star]);
      return target;
    })(),
    origin: place({ x: 0, y: 0 }),
  };
}
// Nearest template inside the tier. `score` is only a quality read for the
// ability to scale with — it never decides whether the constellation fires.
function classifyFigure(points) {
  const tier = FIGURE_SHAPES[points.length];
  if (!tier) return null;
  const cloud = figureNormalize(points);
  let best = null;
  for (const shape of tier) {
    const distance = figureMatch(cloud, shape.cloud);
    if (!best || distance < best.distance) best = { shape, distance };
  }
  return {
    ...best,
    score: Math.max(
      0,
      Math.min(
        1,
        (FIGURE.reject - best.distance) / (FIGURE.reject - FIGURE.perfect),
      ),
    ),
  };
}
