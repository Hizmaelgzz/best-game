// Staged scenes for screenshots: ?shot=start|play|end (with &seed=N) paints one
// fixed scene instead of running the loop. Every scene is the game's own
// world and renderer, driven to a set state — a real render, never a mock.
import { ENEMIES, PLAYER, VIEW } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function placeEnemy(world, kind, x, y, hpFrac) {
  const def = ENEMIES[kind];
  world.state.enemies.push({
    kind, x, y, vx: 0, vy: 0,
    hp: def.hp * hpFrac, maxHp: def.hp, radius: def.radius,
    fireTimer: 1.5, burstTimer: 2, seed: 0.3,
  });
}

function placePickup(world, kind, x, y) {
  world.state.pickups.push({ kind, x, y, vx: 0, vy: 0, life: 12 });
}

export function stageShot(name, world) {
  const s = world.state;
  if (name === 'start') {
    // Title screen over a calm drifting field.
    s.player.x = VIEW.W / 2;
    s.player.y = VIEW.H * 0.62;
    s.player.angle = -Math.PI / 2;
    placeEnemy(world, 'mite', VIEW.W * 0.2, VIEW.H * 0.3, 1);
    placeEnemy(world, 'stinger', VIEW.W * 0.78, VIEW.H * 0.26, 1);
    placeEnemy(world, 'splitter', VIEW.W * 0.62, VIEW.H * 0.78, 1);
    placePickup(world, 'shard', VIEW.W * 0.35, VIEW.H * 0.55);
    placePickup(world, 'shard', VIEW.W * 0.68, VIEW.H * 0.45);
    return { screen: SCREEN_TITLE, best: 1240 };
  }
  if (name === 'play') {
    // Mid-wave fight: the drone firing, hull chipped, combo running.
    world.reset();
    s.score = 2480;
    s.wave = 3;
    s.combo = 6;
    s.comboTimer = 2.4;
    s.spawnQueue = [];
    s.waveBanner = 0;
    s.player.x = VIEW.W * 0.42;
    s.player.y = VIEW.H * 0.55;
    s.player.angle = 0.5;
    s.player.hull = 72;
    s.player.overdriveTimer = 5;
    placeEnemy(world, 'mite', VIEW.W * 0.66, VIEW.H * 0.4, 0.6);
    placeEnemy(world, 'mite', VIEW.W * 0.72, VIEW.H * 0.62, 1);
    placeEnemy(world, 'stinger', VIEW.W * 0.82, VIEW.H * 0.3, 0.8);
    placeEnemy(world, 'splitter', VIEW.W * 0.58, VIEW.H * 0.82, 0.5);
    placePickup(world, 'shard', VIEW.W * 0.5, VIEW.H * 0.4);
    placePickup(world, 'shard', VIEW.W * 0.55, VIEW.H * 0.68);
    placePickup(world, 'repair', VIEW.W * 0.3, VIEW.H * 0.3);
    s.bullets.push(
      { x: VIEW.W * 0.48, y: VIEW.H * 0.54, vx: 640, vy: 0, life: 0.9, damage: PLAYER.BULLET_DAMAGE },
      { x: VIEW.W * 0.52, y: VIEW.H * 0.56, vx: 640, vy: 0, life: 0.9, damage: PLAYER.BULLET_DAMAGE },
    );
    s.particles.push(
      { x: VIEW.W * 0.66, y: VIEW.H * 0.4, vx: 60, vy: -40, life: 0.6, maxLife: 0.8, size: 3, color: '#fde68a' },
      { x: VIEW.W * 0.66, y: VIEW.H * 0.4, vx: -50, vy: 70, life: 0.5, maxLife: 0.8, size: 2.5, color: '#ff4d6d' },
    );
    return { screen: SCREEN_PLAY, best: 2480 };
  }
  // end: the run is over — score, wave and kills on the game-over screen,
  // with the void still drifting behind it.
  world.reset();
  s.score = 3120;
  s.wave = 4;
  s.kills = 57;
  s.player.hull = 0;
  s.spawnQueue = [];
  s.waveBanner = 0;
  placeEnemy(world, 'mite', VIEW.W * 0.2, VIEW.H * 0.28, 1);
  placeEnemy(world, 'stinger', VIEW.W * 0.82, VIEW.H * 0.3, 1);
  placeEnemy(world, 'splitter', VIEW.W * 0.7, VIEW.H * 0.78, 1);
  placePickup(world, 'shard', VIEW.W * 0.35, VIEW.H * 0.6);
  return { screen: SCREEN_OVER, best: 3120 };
}
