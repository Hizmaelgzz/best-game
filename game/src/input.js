// Keyboard and mouse, read once a frame. Movement is WASD or arrows; the mouse
// aims; holding the left button fires; Shift or Space dashes. Every action
// (confirm, pause, mute) is an edge: takeActions returns what went down
// since the last read and clears it.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;

const CONFIRM_KEYS = new Set(['Enter', ' ']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const MUTE_KEYS = new Set(['KeyM']);
const DASH_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = false;

  function onKeyDown(e) {
    if (CONFIRM_KEYS.has(e.code)) {
      actions |= ACTION_CONFIRM;
      if (e.code === ' ') e.preventDefault();
    }
    if (PAUSE_KEYS.has(e.code)) actions |= ACTION_PAUSE;
    if (MUTE_KEYS.has(e.code)) actions |= ACTION_MUTE;
    if (DASH_KEYS.has(e.code)) actions |= ACTION_DASH;
    keys.add(e.code);
    if (MOVE_KEYS[e.code]) e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      clicked = true;
      onMouseMove(e);
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // Unit movement vector from the held keys, or [0, 0].
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      if (x === 0 && y === 0) return [0, 0];
      const len = Math.hypot(x, y);
      return [x / len, y / len];
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    // True once when the player clicks, then cleared.
    takeClick() {
      const c = clicked;
      clicked = false;
      return c;
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}
