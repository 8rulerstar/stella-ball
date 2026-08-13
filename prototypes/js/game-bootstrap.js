resetBuild();
boss = {
  x: W / 2,
  y: 196,
  hp: RULES.coreHp,
  maxHp: RULES.coreHp,
  a: 0,
  hitCooldown: 0,
};
ball = { x: W / 2, y: LAUNCH_Y, r: 13, trail: [], launchPower: 0.35 };
initializeAchievementNotifications();
sync();
showTitle();
requestAnimationFrame(loop);
