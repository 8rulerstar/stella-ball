/**
 * 도는 방벽이 down 만료 뒤 최대 내구도로 재점화하는지 확인한다.
 *
 * 이 프로브가 틀리는 법:
 * 1. 방벽이 없는 스테이지를 열면 복구 함수만 검사하고 실제 데이터를 놓친다.
 * 2. hp를 0으로 만들지 않으면 기존 내구도를 복구로 오인한다.
 */
import { launchProbe } from "./lib/probe-harness.mjs";

const probe = await launchProbe({ headless: true });
const { evaluate, waitFor, close, errors } = probe;

try {
  await waitFor("typeof advanceOrbitalRecovery === 'function'");
  const result = JSON.parse(
    await evaluate(`(() => {
      const index = stages.findIndex((stage) => stage.id === "6-3");
      stageIndex = index;
      deployed = selected = Object.keys(heroes).slice(0, 3);
      resetBuild();
      setupBattle();
      const orbit = orbitals[0];
      if (!orbit) return JSON.stringify({ error: "missing orbital" });
      orbit.hp = 0;
      orbit.down = 0.01;
      const recovering = advanceOrbitalRecovery(orbit, 0.02);
      return JSON.stringify({
        hp: orbit.hp,
        maxHp: orbit.maxHp,
        down: orbit.down,
        recovering,
        popup: popups.at(-1)?.text || "",
        toast: toastQueue.at(-1) || currentToastText || "",
      });
    })()`),
  );
  if (result.error) throw new Error(result.error);
  if (
    result.hp !== result.maxHp ||
    result.down !== 0 ||
    !result.recovering ||
    !result.popup.includes("재점화") ||
    !result.toast.includes("최대 내구도")
  )
    throw new Error(
      "orbital recovery contract failed: " + JSON.stringify(result),
    );
  console.log(JSON.stringify({ result: "passed", ...result }, null, 2));
  if (errors.length) throw new Error(errors.join(" | "));
} finally {
  close();
}
