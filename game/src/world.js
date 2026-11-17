// VOID SALVAGE — the simulation. The player is a salvage drone in a debris
// field: it moves, aims with the mouse, shoots, dashes, and survives waves of
// void creatures while collecting the shards they drop. Everything here is
// plain data in `state`, advanced in fixed 1/60 s steps; the renderer only
// paints it, and sounds leave through `state.sounds`, one name per event.
import {
  COMBO_MAX, COMBO_STEP, COMBO_WINDOW, ENEMIES, ENEMY_COST, PICKUPS,
  PLAYER, VIEW, WAVE_BUDGET,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    best: 0,
    wave: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    shake: 0,
    waveBanner: 0,
    betweenWaves: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: null,
    bullets: [],
    enemies: [],
    enemyBullets: [],
    pickups: [],
    particles: [],
    floaters: [],
    stars: [],
    sounds: [],
  };

  function makeStars() {
    state.stars = [];
    for (let i = 0; i < 130; i += 1) {
      state.stars.push({
        x: random.range(0, VIEW.W),
        y: random.range(0, VIEW.H),
        layer: random.int(1, 3),
        size: random.range(0.6, 2.2),
        tw: random.range(0, TAU),
      });
    }
  }

  function resetPlayer() {
    state.player = {
      x: VIEW.W / 2,
      y: VIEW.H / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hull: PLAYER.HULL,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      iframes: 0,
      overdriveTimer: 0,
      shieldTimer: 0,
    };
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.angle();
      const s = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: random.range(0.3, 0.8),
        maxLife: 0.8,
        size: random.range(1.5, 4),
        color,
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, life: 1.0, color });
  }

  function addScore(base, x, y) {
    const mult = 1 + Math.min(state.combo, 12) * COMBO_STEP;
    const capped = Math.min(mult, COMBO_MAX);
    const gained = Math.round(base * capped);
    state.score += gained;
    if (x !== undefined) floater(x, y, `+${gained}`, '#ffd166');
    return gained;
  }

  function registerKill() {
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
  }

  function dropPickup(x, y, kind, forced) {
    state.pickups.push({
      kind,
      x, y,
      vx: random.range(-30, 30),
      vy: random.range(-30, 30),
      life: 12,
    });
    if (forced) state.pickups[state.pickups.length - 1].life = 12;
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    const edge = random.int(0, 3);
    let x;
    let y;
    if (edge === 0) { x = random.range(0, VIEW.W); y = -30; }
    else if (edge === 1) { x = VIEW.W + 30; y = random.range(0, VIEW.H); }
    else if (edge === 2) { x = random.range(0, VIEW.W); y = VIEW.H + 30; }
    else { x = -30; y = random.range(0, VIEW.H); }
    state.enemies.push({
      kind, x, y, vx: 0, vy: 0,
      hp: def.hp, maxHp: def.hp, radius: def.radius,
      fireTimer: random.range(1.2, 2.4),
      burstTimer: 2.5,
      seed: random.next(),
    });
  }

  function startWave(n) {
    state.wave = n;
    state.waveBanner = 2.5;
    state.spawnQueue = [];
    let budget = WAVE_BUDGET(n);
    if (n % 5 === 0) {
      state.spawnQueue.push('warden');
      budget -= ENEMY_COST.warden;
    }
    while (budget > 0) {
      const roll = random.next();
      if (budget >= 3 && roll < 0.22) {
        state.spawnQueue.push('splitter');
        budget -= 3;
      } else if (budget >= 2 && roll < 0.5) {
        state.spawnQueue.push('stinger');
        budget -= 2;
      } else {
        state.spawnQueue.push('mite');
        budget -= 1;
      }
    }
    state.spawnTimer = 0.4;
    state.sounds.push('wave');
  }

  function damagePlayer(amount, fromX, fromY) {
    const p = state.player;
    if (!p || p.iframes > 0 || p.dashTimer > 0 || p.shieldTimer > 0) return false;
    p.hull -= amount;
    p.iframes = PLAYER.IFRAMES_AFTER_HIT;
    state.shake = Math.min(14, state.shake + 7);
    state.combo = 0;
    state.comboTimer = 0;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    p.vx += (dx / len) * 320;
    p.vy += (dy / len) * 320;
    burst(p.x, p.y, '#ff4d6d', 10, 220);
    state.sounds.push('hit');
    return true;
  }

  function killEnemy(e, index) {
    const def = ENEMIES[e.kind];
    registerKill();
    addScore(def.score, e.x, e.y);
    burst(e.x, e.y, def.color, e.kind === 'warden' ? 40 : 16, 260);
    state.sounds.push('explode');
    // Shards always; a repair, overdrive or shield now and then.
    const shards = e.kind === 'warden' ? 6 : e.kind === 'splitter' ? 3 : 1;
    for (let i = 0; i < shards; i += 1) dropPickup(e.x + random.range(-14, 14), e.y + random.range(-14, 14), 'shard');
    const roll = random.next();
    if (roll < 0.12) dropPickup(e.x, e.y, 'repair');
    else if (roll < 0.2) dropPickup(e.x, e.y, 'overdrive');
    else if (roll < 0.26) dropPickup(e.x, e.y, 'shield');
    if (e.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        state.enemies.push({
          kind: 'mite', x: e.x + random.range(-18, 18), y: e.y + random.range(-18, 18),
          vx: 0, vy: 0, hp: ENEMIES.mite.hp, maxHp: ENEMIES.mite.hp,
          radius: ENEMIES.mite.radius, fireTimer: 1, burstTimer: 0, seed: random.next(),
        });
      }
    }
    state.enemies.splice(index, 1);
  }

  function stepPlayer(dt, dir, mouse, wantDash) {
    const p = state.player;
    if (!p) return;
    p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    p.fireTimer -= dt;
    p.dashCooldown -= dt;
    p.iframes -= dt;
    p.overdriveTimer -= dt;
    p.shieldTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    if (wantDash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      const mx = dir[0] !== 0 || dir[1] !== 0 ? dir : [Math.cos(p.angle), Math.sin(p.angle)];
      const len = Math.hypot(mx[0], mx[1]) || 1;
      p.vx = (mx[0] / len) * PLAYER.DASH_SPEED;
      p.vy = (mx[1] / len) * PLAYER.DASH_SPEED;
      p.dashTimer = PLAYER.DASH_TIME;
      p.dashCooldown = PLAYER.DASH_COOLDOWN;
      p.iframes = Math.max(p.iframes, PLAYER.DASH_TIME + 0.05);
      burst(p.x, p.y, '#67e8f9', 8, 180);
      state.sounds.push('dash');
    }

    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
    } else {
      p.vx += dir[0] * PLAYER.ACCEL * dt;
      p.vy += dir[1] * PLAYER.ACCEL * dt;
      const damp = Math.exp(-PLAYER.FRICTION * dt);
      p.vx *= damp;
      p.vy *= damp;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > PLAYER.MAX_SPEED) {
        p.vx = (p.vx / speed) * PLAYER.MAX_SPEED;
        p.vy = (p.vy / speed) * PLAYER.MAX_SPEED;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(PLAYER.RADIUS, Math.min(VIEW.W - PLAYER.RADIUS, p.x));
    p.y = Math.max(PLAYER.RADIUS, Math.min(VIEW.H - PLAYER.RADIUS, p.y));

    const interval = p.overdriveTimer > 0 ? PLAYER.FIRE_INTERVAL / 2.2 : PLAYER.FIRE_INTERVAL;
    if (mouse.down && p.fireTimer <= 0) {
      p.fireTimer = interval;
      state.bullets.push({
        x: p.x + Math.cos(p.angle) * (PLAYER.RADIUS + 6),
        y: p.y + Math.sin(p.angle) * (PLAYER.RADIUS + 6),
        vx: Math.cos(p.angle) * PLAYER.BULLET_SPEED,
        vy: Math.sin(p.angle) * PLAYER.BULLET_SPEED,
        life: 0.9,
        damage: PLAYER.BULLET_DAMAGE,
      });
      state.sounds.push('shoot');
    }
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      const def = ENEMIES[e.kind];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === 'mite') {
        e.vx += (dx / d) * def.speed * 2.4 * dt;
        e.vy += (dy / d) * def.speed * 2.4 * dt;
      } else if (e.kind === 'stinger') {
        const want = 260;
        const toward = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
        e.vx += (dx / d) * toward * def.speed * 1.6 * dt;
        e.vy += (dy / d) * toward * def.speed * 1.6 * dt;
        e.vx += (-dy / d) * Math.sin(state.time * 1.3 + e.seed * 9) * 40 * dt;
        e.vy += (dx / d) * Math.sin(state.time * 1.3 + e.seed * 9) * 40 * dt;
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < 520) {
          e.fireTimer = 2.2;
          state.enemyBullets.push({
            x: e.x, y: e.y,
            vx: (dx / d) * 230, vy: (dy / d) * 230,
            life: 4,
          });
        }
      } else if (e.kind === 'splitter') {
        e.vx += (dx / d) * def.speed * 1.8 * dt;
        e.vy += (dy / d) * def.speed * 1.8 * dt;
      } else if (e.kind === 'warden') {
        e.vx += (dx / d) * def.speed * 1.6 * dt;
        e.vy += (dy / d) * def.speed * 1.6 * dt;
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 3.0;
          for (let i = 0; i < 10; i += 1) {
            const a = (i / 10) * TAU + e.seed;
            state.enemyBullets.push({
              x: e.x, y: e.y,
              vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
              life: 5,
            });
          }
          state.sounds.push('wave');
        }
      }
      const damp = Math.exp(-1.6 * dt);
      e.vx *= damp;
      e.vy *= damp;
      const speed = Math.hypot(e.vx, e.vy);
      if (speed > def.speed) {
        e.vx = (e.vx / speed) * def.speed;
        e.vy = (e.vy / speed) * def.speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > VIEW.W + 20 || b.y < -20 || b.y > VIEW.H + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = e.radius + 5;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          e.hp -= b.damage;
          burst(b.x, b.y, '#fde68a', 3, 120);
          state.bullets.splice(i, 1);
          if (e.hp <= 0) killEnemy(e, j);
          break;
        }
      }
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > VIEW.W + 20 || b.y < -20 || b.y > VIEW.H + 20) {
        state.enemyBullets.splice(i, 1);
      }
    }
  }

  function stepCollisions() {
    const p = state.player;
    if (!p) return 0;
    let events = 0;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      const rr = e.radius + PLAYER.RADIUS - 2;
      if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
        if (damagePlayer(ENEMIES[e.kind].damage, e.x, e.y)) events |= EVENT_HIT;
        // The enemy bounces off instead of sticking to the player.
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        e.vx = (dx / len) * 200;
        e.vy = (dy / len) * 200;
      }
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      const rr = PLAYER.RADIUS + 6;
      if (dist2(p.x, p.y, b.x, b.y) < rr * rr) {
        if (damagePlayer(10, b.x - b.vx * 0.1, b.y - b.vy * 0.1)) events |= EVENT_HIT;
        state.enemyBullets.splice(i, 1);
      }
    }
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      const rr = PLAYER.RADIUS + 14;
      if (dist2(p.x, p.y, pk.x, pk.y) < rr * rr) {
        if (pk.kind === 'shard') {
          addScore(PICKUPS.SHARD_SCORE, pk.x, pk.y);
          state.sounds.push('pickup');
        } else if (pk.kind === 'repair') {
          p.hull = Math.min(PLAYER.HULL, p.hull + PICKUPS.REPAIR);
          floater(p.x, p.y - 24, `+${PICKUPS.REPAIR} HULL`, '#4ade80');
          state.sounds.push('repair');
        } else if (pk.kind === 'overdrive') {
          p.overdriveTimer = PICKUPS.OVERDRIVE_TIME;
          floater(p.x, p.y - 24, 'OVERDRIVE', '#facc15');
          state.sounds.push('pickup');
        } else if (pk.kind === 'shield') {
          p.shieldTimer = PICKUPS.SHIELD_TIME;
          floater(p.x, p.y - 24, 'SHIELD', '#67e8f9');
          state.sounds.push('pickup');
        }
        state.pickups.splice(i, 1);
      }
    }
    return events;
  }

  function stepPickups(dt) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      if (pk.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      if (p && pk.kind === 'shard') {
        const d = Math.hypot(p.x - pk.x, p.y - pk.y);
        if (d < 150 && d > 1) {
          pk.vx += ((p.x - pk.x) / d) * 900 * dt;
          pk.vy += ((p.y - pk.y) / d) * 900 * dt;
        }
      }
      const damp = Math.exp(-2 * dt);
      pk.vx *= damp;
      pk.vy *= damp;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
    }
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-2.5 * dt);
      pt.vy *= Math.exp(-2.5 * dt);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt * 0.9;
      f.y -= 34 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - 30 * dt);
    for (const s of state.stars) s.tw += dt * 1.5;
  }

  function step(dt, dir, mouse, wantDash, attract) {
    state.time += dt;
    state.sounds = [];
    let events = 0;
    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (attract) {
      // Title screen: the field drifts, nothing hunts the player.
      stepParticles(dt);
      return events;
    }
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = 0.45;
      }
    } else if (state.enemies.length === 0 && state.betweenWaves <= 0) {
      state.betweenWaves = 3;
    }
    if (state.betweenWaves > 0) {
      state.betweenWaves -= dt;
      if (state.betweenWaves <= 0 && state.player && state.player.hull > 0) {
        startWave(state.wave + 1);
        events |= EVENT_WAVE;
      }
    }
    stepPlayer(dt, dir, mouse, wantDash);
    stepEnemies(dt);
    stepBullets(dt);
    events |= stepCollisions();
    stepPickups(dt);
    stepParticles(dt);
    if (state.player && state.player.hull <= 0) {
      burst(state.player.x, state.player.y, '#67e8f9', 46, 320);
      state.sounds.push('gameover');
      return events | EVENT_OVER;
    }
    return events;
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.wave = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 0;
    state.waveBanner = 0;
    state.betweenWaves = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.bullets = [];
    state.enemies = [];
    state.enemyBullets = [];
    state.pickups = [];
    state.particles = [];
    state.floaters = [];
    state.sounds = [];
    resetPlayer();
    makeStars();
    startWave(1);
  }

  makeStars();
  resetPlayer();

  return { state, step, reset, startWave };
}
