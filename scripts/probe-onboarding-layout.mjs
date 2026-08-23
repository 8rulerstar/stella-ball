/**
 * Eight-card onboarding and battle-guidance layout probe.
 *
 * Renders every card without skipping its production markup, then checks the
 * long awakening/final-order copy at desktop and narrow widths. It also proves
 * that Luna's dialogue occupies the reserved lane between the boss banner and
 * the board instead of returning to the bottom overlay.
 *
 *   node scripts/probe-onboarding-layout.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchProbe } from "./lib/probe-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = resolve(root, "artifacts", "onboarding-layout");
mkdirSync(artifactDir, { recursive: true });

const sizes = ["1280,900", "390,844"];
const report = [];

for (const size of sizes) {
  const probe = await launchProbe({ headless: true, windowSize: size });
  try {
    await probe.evaluate("showOnboardingTutorial(true); true");
    const cards = [];
    let cardScreenshot = null;
    const states = [
      "setOnboardingPhase(0); onboarding.dialogue=0",
      "setOnboardingPhase(0); onboarding.bossHit=true; onboarding.dialogue=1",
      "setOnboardingPhase(1); onboarding.dialogue=0",
      "setOnboardingPhase(1); onboarding.dialogue=1",
      "setOnboardingPhase(1); onboarding.aimed=true; onboarding.awakenedHero='gaon'; onboarding.dialogue=2",
      "setOnboardingPhase(2); onboarding.dialogue=0",
      "setOnboardingPhase(2); onboarding.figureResolved=true; onboarding.figureId='bigdipper'; onboarding.dialogue=1",
      "setOnboardingPhase(2); onboarding.figureResolved=true; onboarding.figureId='bigdipper'; onboarding.dialogue=2",
    ];
    for (let index = 0; index < states.length; index += 1) {
      const card = await probe.evaluate(`(() => {
        ${states[index]};
        renderOnboarding();
        const el = document.querySelector('.onboarding-card');
        const copy = el?.querySelector('.onboarding-copy');
        const button = el?.querySelector('button');
        const r = el?.getBoundingClientRect();
        const br = button?.getBoundingClientRect();
        return {
          number: el?.querySelector('.onboarding-kicker b')?.textContent.trim(),
          title: el?.querySelector('h3')?.textContent.trim(),
          viewport: [innerWidth, innerHeight],
          rect: r && [r.left, r.top, r.right, r.bottom],
          insideViewport: !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          horizontalOverflow: !!el && el.scrollWidth > el.clientWidth + 1,
          copyOverflow: !!copy && copy.scrollWidth > copy.clientWidth + 1,
          buttonInside: !!br && br.left >= r.left && br.right <= r.right && br.bottom <= r.bottom,
        };
      })()`);
      cards.push(card);
      if (index === 3) {
        await probe.evaluate(
          "new Promise((resolve) => setTimeout(resolve, 2200))",
        );
        card.buttonEnabledAfterReveal = await probe.evaluate(
          "document.querySelector('#onboardingContinue')?.disabled === false",
        );
        const shot = await probe.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
        });
        cardScreenshot = resolve(
          artifactDir,
          `awakening-card-${size.replace(",", "x")}.png`,
        );
        writeFileSync(cardScreenshot, Buffer.from(shot.data, "base64"));
      }
    }

    const guidance = await probe.evaluate(`(() => {
      setOnboardingPhase(3);
      msg = '별빛 세 곳을 고르고 Space로 발사하세요. 별지기와 부딪히면 각성을 준비합니다.';
      sync();
      StellaRuntime.modules.require('speech').say(
        'luna',
        '별지기와 부딪히면 공명과 각성을 준비합니다. 모두 멈추면 고유 공격이 시작돼요.',
        { d: 30 }
      );
      const lane = document.querySelector('#battleGuidance').getBoundingClientRect();
      const boss = document.querySelector('.boss-banner').getBoundingClientRect();
      const stage = document.querySelector('.stage').getBoundingClientRect();
      const speech = document.querySelector('#lunaSpeech').getBoundingClientRect();
      return {
        lane: [lane.left, lane.top, lane.right, lane.bottom],
        bossBottom: boss.bottom,
        stageTop: stage.top,
        speech: [speech.left, speech.top, speech.right, speech.bottom],
        betweenBossAndBoard: lane.top >= boss.bottom - 1 && lane.bottom <= stage.top + 1,
        speechInsideLane: speech.left >= lane.left && speech.top >= lane.top && speech.right <= lane.right && speech.bottom <= lane.bottom,
        fixedHeight: lane.height,
      };
    })()`);

    const shot = await probe.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    const screenshot = resolve(
      artifactDir,
      `guidance-${size.replace(",", "x")}.png`,
    );
    writeFileSync(screenshot, Buffer.from(shot.data, "base64"));

    report.push({
      size,
      cards,
      guidance,
      cardScreenshot,
      screenshot,
      errors: probe.errors,
    });
  } finally {
    probe.close();
  }
}

const failures = report.flatMap((run) => [
  ...run.cards.flatMap((card) =>
    card.insideViewport &&
    !card.horizontalOverflow &&
    !card.copyOverflow &&
    card.buttonInside &&
    card.buttonEnabledAfterReveal !== false
      ? []
      : [`${run.size} card ${card.number} overflow`],
  ),
  ...(run.guidance.betweenBossAndBoard &&
  run.guidance.speechInsideLane &&
  run.errors.length === 0
    ? []
    : [`${run.size} guidance lane`]),
]);

console.log(
  JSON.stringify(
    { result: failures.length ? "failed" : "passed", failures, report },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
