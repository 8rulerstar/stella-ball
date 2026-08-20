/*
 * Classic-script compatible module boundary.
 *
 * The game must still run from a local file on Windows, so native ESM imports
 * are not used here. Modules publish a small frozen API through this registry,
 * while cross-cutting reactions use named hooks instead of reassigning another
 * file's global function.
 */
const StellaRuntime = (() => {
  const hookNames = new Set([
    "afterArenaDraw",
    "afterAssistsDraw",
    "afterBattleSetup",
    "afterBattleWin",
    "afterBlazeEarned",
    "afterDirectBossDamage",
    "afterBossHitRegistered",
    "afterDraw",
    "afterFeedbackUpdate",
    "afterFigureShot",
    "afterFieldFxDraw",
    "afterFigureResolve",
    "afterMeteorLaunch",
    "afterMeteorSteer",
    "afterMobilePairCollision",
    "afterParryContact",
    "afterParryRequest",
    "afterPartySettle",
    "afterRosterShown",
    "afterShotEnd",
    "afterShotStart",
    "afterSpecialDraw",
    "afterTableWall",
    "afterUnitAssistQueued",
    "assistParryRequest",
    "beforeBattleWin",
    "beforePartySettle",
    "beforeShotResolution",
    "beforeShotStart",
    "consumeParryAssist",
    "resolveBilliardAim",
  ]);
  const hookEntries = new Map(
    [...hookNames].map((name) => [name, Object.freeze([])]),
  );
  const moduleEntries = new Map();
  let hookSerial = 0;

  function hooksFor(name) {
    const entries = hookEntries.get(name);
    if (!entries) throw new Error(`Unknown runtime hook: ${name}`);
    return entries;
  }

  const hooks = Object.freeze({
    on(name, callback, { priority = 0 } = {}) {
      if (typeof callback !== "function")
        throw new TypeError(`Runtime hook ${name} must be a function.`);
      const entries = hooksFor(name);
      if (entries.some((entry) => entry.callback === callback)) return () => {};
      const entry = { callback, priority, serial: hookSerial++ };
      const nextEntries = [...entries, entry].sort(
        (left, right) =>
          right.priority - left.priority || left.serial - right.serial,
      );
      hookEntries.set(name, Object.freeze(nextEntries));
      return () => {
        const currentEntries = hooksFor(name);
        if (!currentEntries.includes(entry)) return;
        hookEntries.set(
          name,
          Object.freeze(
            currentEntries.filter((candidate) => candidate !== entry),
          ),
        );
      };
    },
    emit(name, ...args) {
      for (const { callback } of hooksFor(name)) callback(...args);
    },
    query(name, ...args) {
      for (const { callback } of hooksFor(name)) {
        const result = callback(...args);
        if (result !== undefined) return result;
      }
      return undefined;
    },
    handled(name, ...args) {
      for (const { callback } of hooksFor(name))
        if (callback(...args) === true) return true;
      return false;
    },
  });

  const modules = Object.freeze({
    register(name, api) {
      if (!name || typeof name !== "string")
        throw new TypeError("Runtime module name must be a non-empty string.");
      if (!api || typeof api !== "object")
        throw new TypeError(
          `Runtime module ${name} must expose an API object.`,
        );
      if (moduleEntries.has(name))
        throw new Error(`Runtime module already registered: ${name}`);
      const publicApi = Object.freeze({ ...api });
      moduleEntries.set(name, publicApi);
      return publicApi;
    },
    optional(name) {
      return moduleEntries.get(name) ?? null;
    },
    require(name) {
      const api = moduleEntries.get(name);
      if (!api) throw new Error(`Runtime module is not registered: ${name}`);
      return api;
    },
    list() {
      return [...moduleEntries.keys()];
    },
  });

  return Object.freeze({ version: 1, hooks, modules });
})();

// Compatibility names keep existing render extensions small while their
// storage and validation now belong to the runtime module above.
function registerRuntimeHook(name, callback, options) {
  return StellaRuntime.hooks.on(name, callback, options);
}
function runRuntimeHooks(name, ...args) {
  StellaRuntime.hooks.emit(name, ...args);
}
function queryRuntimeHook(name, ...args) {
  return StellaRuntime.hooks.query(name, ...args);
}
function runtimeHookHandled(name, ...args) {
  return StellaRuntime.hooks.handled(name, ...args);
}
