export class PlayerInput {
  keys = new Set<string>();
  pressed = new Set<string>();
  fire = false;
  firePressed = false;
  ads = false;
  dx = 0;
  dy = 0;
  wheel = 0;
  locked = false;
  onLockChange: (locked: boolean) => void = () => {};
  onError: () => void = () => {};
  constructor(public canvas: HTMLCanvasElement) {
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.clear();
      this.onLockChange(this.locked);
    });
    document.addEventListener("pointerlockerror", () => this.onError());
    document.addEventListener("mousemove", (e) => {
      if (this.locked) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    document.addEventListener("keydown", (e) => {
      if (this.locked) {
        if (
          [
            "Space",
            "Tab",
            "AltLeft",
            "AltRight",
            "ControlLeft",
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
          ].includes(e.code)
        )
          e.preventDefault();
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
      }
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    canvas.addEventListener("mousedown", (e) => {
      if (this.locked) {
        if (e.button === 0) {
          this.fire = true;
          this.firePressed = true;
        }
        if (e.button === 2) this.ads = true;
      }
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.ads = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.locked) {
          e.preventDefault();
          this.wheel = Math.sign(e.deltaY);
        }
      },
      { passive: false },
    );
    window.addEventListener("blur", () => {
      this.clear();
      if (this.locked) document.exitPointerLock();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.locked) document.exitPointerLock();
    });
  }
  request(): void {
    try {
      const p = this.canvas.requestPointerLock();
      if (p) p.catch(() => this.onError());
    } catch {
      this.onError();
    }
  }
  down(code: string): boolean {
    return this.keys.has(code);
  }
  consume(code: string): boolean {
    const x = this.pressed.has(code);
    this.pressed.delete(code);
    return x;
  }
  endFrame(): void {
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.firePressed = false;
    this.pressed.clear();
  }
  clear(): void {
    this.keys.clear();
    this.pressed.clear();
    this.fire = false;
    this.firePressed = false;
    this.ads = false;
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}
