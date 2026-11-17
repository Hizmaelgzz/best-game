// VOID SALVAGE — tuning constants. One place for every number the game
// balances on, so a tweak never means hunting through the world code.
export const VIEW = { W: 1280, H: 720 };

export const PLAYER = {
  RADIUS: 14,
  ACCEL: 2600,
  MAX_SPEED: 340,
  FRICTION: 4.2,
  HULL: 100,
  FIRE_INTERVAL: 0.16,
  BULLET_SPEED: 640,
  BULLET_DAMAGE: 34,
  DASH_SPEED: 900,
  DASH_TIME: 0.16,
  DASH_COOLDOWN: 1.4,
  IFRAMES_AFTER_HIT: 1.0,
};

export const ENEMIES = {
  mite:    { radius: 13, hp: 30,  speed: 150, damage: 12, score: 50,  color: '#ff4d6d' },
  stinger: { radius: 15, hp: 45,  speed: 105, damage: 10, score: 90,  color: '#c084fc' },
  splitter:{ radius: 24, hp: 90,  speed: 62,  damage: 18, score: 140, color: '#fb923c' },
  warden:  { radius: 46, hp: 900, speed: 46,  damage: 25, score: 1500, color: '#f43f5e' },
};

// Wave N fields this many "points" of enemies: a mite costs 1, a stinger 2,
// a splitter 3, a warden 12 (wardens only on waves divisible by 5).
export const WAVE_BUDGET = (n) => 4 + n * 3;
export const ENEMY_COST = { mite: 1, stinger: 2, splitter: 3, warden: 12 };

export const PICKUPS = {
  SHARD_SCORE: 25,
  REPAIR: 25,
  OVERDRIVE_TIME: 8,
  SHIELD_TIME: 6,
};

export const COMBO_WINDOW = 3.0;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 4;

export const BEST_KEY = 'void-salvage-best';
export const STEP = 1 / 60;
