// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the field. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_OVER, EVENT_WAVE } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function playSounds() {
    for (const name of world.state.sounds) {
      if (name === 'shoot') audio.shoot();
      else if (name === 'hit') audio.hit();
      else if (name === 'explode') audio.explode();
      else if (name === 'pickup') audio.pickup();
      else if (name === 'repair') audio.repair();
      else if (name === 'dash') audio.dash();
      else if (name === 'wave') audio.wave();
      else if (name === 'gameover') audio.gameOver();
    }
    world.state.sounds = [];
  }

  function startGame() {
    audio.unlock();
    audio.startMusic();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Harvest shards, dodge the void.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.stopMusic();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
    }
    if ((actions & ACTION_CONFIRM || clicked) && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, [0, 0], { x: 0, y: 0, down: false }, false, true);
      return;
    }
    const events = world.step(STEP, input.direction(), input.mouse(), Boolean(actions & ACTION_DASH), false);
    playSounds();
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) {
      announce(world.state.player.hull <= 25 ? 'Hull critical.' : `Hit. Hull ${Math.ceil(world.state.player.hull)}.`);
    } else if (events & EVENT_WAVE) {
      announce(`Wave ${world.state.wave}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting it run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Void Salvage. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
