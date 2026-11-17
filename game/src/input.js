// Keyboard and mouse state, in the game's logical 1280x720 coordinates.
// The canvas is scaled by CSS; mouse positions are converted back through
// the canvas's bounding box so aiming stays true at any window size.

import { VIEW_W, VIEW_H } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); // codes currently held down
    this.pressed = new Set(); // codes pressed since the last frame (edges)
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, clicked: false };
    this._onKeyDown = (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * VIEW_H;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this._onMouseMove(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = (e) => {
      if (e.button !== 0) return;
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement vector from WASD/arrows, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  // Call at the end of each frame: edges live for exactly one frame.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}

export function attachInput(canvas) {
  return new Input(canvas);
}
