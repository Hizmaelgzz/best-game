// VOID SALVAGE — everything the player sees. The renderer paints `state` and
// nothing else: it never moves the world, so a screenshot of a staged scene
// is the same code as the game itself. All drawing is Canvas 2D, no images.
import { COMBO_MAX, COMBO_STEP, ENEMIES, PLAYER, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const BG_TOP = '#070b1d';
const BG_BOTTOM = '#0d1230';
const NEON = '#67e8f9';
const AMBER = '#ffd166';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, state) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.H);
  g.addColorStop(0, BG_TOP);
  g.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  // A slow nebula wash, two soft radial blobs.
  for (const [x, y, r, color] of [
    [VIEW.W * 0.22, VIEW.H * 0.3, 340, 'rgba(124, 58, 237, 0.10)'],
    [VIEW.W * 0.8, VIEW.H * 0.72, 380, 'rgba(8, 145, 178, 0.10)'],
  ]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const s of state.stars) {
    const a = 0.35 + 0.55 * Math.abs(Math.sin(s.tw));
    ctx.globalAlpha = a * (0.5 + s.layer * 0.2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0) ctx.globalAlpha = 0.35;
  if (p.shieldTimer > 0) {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.RADIUS + 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(p.angle);
  // Hull: a swept dart with a glowing core.
  ctx.fillStyle = '#0e7490';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#a5f3fc';
  ctx.beginPath();
  ctx.arc(3, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  // Dash cooldown arc under the ship.
  if (p.dashCooldown > 0) {
    ctx.rotate(-p.angle);
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.RADIUS + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (1 - p.dashCooldown / 1.4)));
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx, e) {
  const def = ENEMIES[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = 2;
  if (e.kind === 'mite') {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.beginPath();
    ctx.moveTo(e.radius, 0);
    ctx.lineTo(-e.radius * 0.7, -e.radius * 0.7);
    ctx.lineTo(-e.radius * 0.7, e.radius * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'stinger') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'splitter') {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#431407';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Warden: a big ringed hull with a pulsing core.
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff1f2';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.28 * (1 + 0.15 * Math.sin(e.seed * 40)), 0, Math.PI * 2);
    ctx.fill();
  }
  // Health bar above anything hurt.
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(-w / 2, -e.radius - 10, w, 4);
    ctx.fillStyle = def.color;
    ctx.fillRect(-w / 2, -e.radius - 10, w * (e.hp / e.maxHp), 4);
  }
  ctx.restore();
}

function drawPickups(ctx, state) {
  for (const pk of state.pickups) {
    ctx.save();
    ctx.translate(pk.x, pk.y);
    const pulse = 1 + 0.15 * Math.sin(state.time * 6);
    if (pk.kind === 'shard') {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = AMBER;
      const s = 6 * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2);
    } else if (pk.kind === 'repair') {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.fillRect(-2.5, -7, 5, 14);
    } else if (pk.kind === 'overdrive') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 2);
      ctx.lineTo(1, 2);
      ctx.lineTo(4, 9);
      ctx.lineTo(-6, -1);
      ctx.lineTo(-1, -1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = NEON;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = NEON;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawHud(ctx, state, best, muted) {
  const p = state.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${state.score}`, 20, 42);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(best, state.score)}`, 20, 66);
  // Wave, top centre.
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, VIEW.W / 2, 40);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillText(`${state.enemies.length + state.spawnQueue.length} HOSTILES LEFT`, VIEW.W / 2, 62);
  // Hull bar, top right, with the number beside it inside the viewport.
  const bw = 180;
  const bx = VIEW.W - bw - 48;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HULL', bx, 28);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  rr(ctx, bx, 34, bw, 14, 7);
  ctx.fill();
  const hullFrac = Math.max(0, p.hull / PLAYER.HULL);
  ctx.fillStyle = hullFrac > 0.5 ? '#4ade80' : hullFrac > 0.25 ? '#facc15' : '#f87171';
  if (hullFrac > 0) {
    rr(ctx, bx, 34, bw * hullFrac, 14, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hull)}`, bx + bw + 8, 46);
  // Combo, under the score.
  if (state.combo >= 2) {
    const mult = Math.min(1 + Math.min(state.combo, 12) * COMBO_STEP, COMBO_MAX);
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`COMBO x${mult.toFixed(2)}  (${state.combo})`, 20, 96);
  }
  // Active timers, bottom left.
  let ty = VIEW.H - 24;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  if (p.overdriveTimer > 0) {
    ctx.fillStyle = '#facc15';
    ctx.fillText(`OVERDRIVE ${Math.ceil(p.overdriveTimer)}s`, 20, ty);
    ty -= 22;
  }
  if (p.shieldTimer > 0) {
    ctx.fillStyle = NEON;
    ctx.fillText(`SHIELD ${Math.ceil(p.shieldTimer)}s`, 20, ty);
    ty -= 22;
  }
  // Controls + mute, bottom right.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · mouse aim · hold click fire · Shift dash · P pause · M mute', VIEW.W - 20, VIEW.H - 20);
  if (muted) ctx.fillText('MUTED', VIEW.W - 20, VIEW.H - 42);
  // Wave banner.
  if (state.waveBanner > 0) {
    ctx.globalAlpha = Math.min(1, state.waveBanner);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave}`, VIEW.W / 2, VIEW.H / 2 - 60);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(state.wave % 5 === 0 ? 'The Warden is coming' : 'Salvage what you can', VIEW.W / 2, VIEW.H / 2 - 26);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawScreen(ctx, title, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText(title, VIEW.W / 2, VIEW.H / 2 - 70);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '400 21px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW.W / 2, VIEW.H / 2 - 10 + i * 34);
  });
  ctx.restore();
}

export function createRenderer(canvas) {
  canvas.width = VIEW.W;
  canvas.height = VIEW.H;
  const ctx = canvas.getContext('2d');

  function draw(state, screen, best, muted) {
    ctx.save();
    if (state.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawBackground(ctx, state);
    for (const b of state.bullets) {
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.enemyBullets) {
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240, 171, 252, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawPickups(ctx, state);
    for (const e of state.enemies) drawEnemy(ctx, e);
    if (state.player && screen !== SCREEN_OVER) drawPlayer(ctx, state.player);
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(ctx, state, best, muted);
    if (screen === SCREEN_TITLE) {
      drawScreen(ctx, 'VOID SALVAGE', [
        'Pilot the salvage drone. Harvest shards, dodge the void.',
        'WASD / arrows to move · mouse to aim · hold click to fire',
        'Shift to dash · P to pause · M to mute',
        '',
        `BEST ${best}`,
        'Press Enter or click to launch',
      ], NEON);
    } else if (screen === SCREEN_PAUSED) {
      drawScreen(ctx, 'PAUSED', ['Press P or Enter to keep salvaging'], '#e2e8f0');
    } else if (screen === SCREEN_OVER) {
      drawScreen(ctx, 'DRONE LOST', [
        `Score ${state.score} · Best ${Math.max(best, state.score)} · Wave ${state.wave} · ${state.kills} kills`,
        '',
        'Press Enter or click to salvage again',
      ], '#ff4d6d');
    }
    ctx.restore();
  }

  return { draw };
}
