export class GameLoop {
  constructor({ tickRate = 30, update, render }) {
    this.tickMs = 1000 / tickRate;
    this.update = update;
    this.render = render;
    this.running = false;
    this.frameId = null;
    this.accumulatorMs = 0;
    this.lastFrameMs = 0;
    this.maxFrameDeltaMs = 250;
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.accumulatorMs = 0;
    this.lastFrameMs = performance.now();
    this.frameId = requestAnimationFrame((nowMs) => this.renderFrame(nowMs));
  }

  stop() {
    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  dispose() {
    this.stop();
  }

  renderFrame(nowMs = performance.now()) {
    if (!this.running) {
      return;
    }

    const frameDeltaMs = Math.min(nowMs - this.lastFrameMs, this.maxFrameDeltaMs);
    this.lastFrameMs = nowMs;
    this.accumulatorMs += frameDeltaMs;

    while (this.accumulatorMs >= this.tickMs) {
      this.update?.(this.tickMs / 1000);
      this.accumulatorMs -= this.tickMs;
    }

    this.render?.();
    this.frameId = requestAnimationFrame((nextNowMs) => this.renderFrame(nextNowMs));
  }
}
