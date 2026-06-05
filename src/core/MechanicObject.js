export class MechanicObject {
  constructor({ id, type, x, y, radius = 0.05, label = '', sourceActionId = null, active = true, data = {} }) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.label = label;
    this.sourceActionId = sourceActionId;
    this.active = active;
    this.data = data;
  }

  containsPoint(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.hypot(dx, dy) <= this.radius;
  }

  moveTo(x, y) {
    this.x = clamp01(x);
    this.y = clamp01(y);
    return this;
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
