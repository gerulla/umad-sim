const DEFAULT_SPAWN = {
  centerX: 0.5,
  centerY: 0.5,
  radius: 0.28,
  startAngle: -Math.PI / 2
};

export class PlayerBot {
  constructor({ id, role, x, y, controlled = false, maxHp = 1000, hitboxRadius = 0.004 }) {
    this.id = id;
    this.role = role;
    this.roleId = role.id;
    this.x = x;
    this.y = y;
    this.controlled = controlled;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.hitboxRadius = hitboxRadius;
    this.marker = null;
    this.debuffs = [];
    this.movementTarget = null;
  }

  get label() {
    return this.role.label;
  }

  get color() {
    return this.role.color;
  }

  get icon() {
    return this.role.icon;
  }

  get entityType() {
    return this.controlled ? 'player' : 'bot';
  }

  get hpPercent() {
    if (this.maxHp <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
  }

  moveTo(x, y) {
    this.x = clamp01(x);
    this.y = clamp01(y);
    return this;
  }

  setMovementTarget(x, y, options = {}) {
    this.movementTarget = {
      x: clamp01(x),
      y: clamp01(y),
      sourceId: options.sourceId ?? null,
      label: options.label ?? '',
      speed: Number.isFinite(options.speed) ? options.speed : null
    };

    return this;
  }

  clearMovementTarget() {
    this.movementTarget = null;
    return this;
  }

  updateMovement(deltaSeconds, speed) {
    const movementSpeed = this.movementTarget?.speed ?? speed;

    if (!this.movementTarget || movementSpeed <= 0 || deltaSeconds <= 0) {
      return this;
    }

    const dx = this.movementTarget.x - this.x;
    const dy = this.movementTarget.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 0.0005) {
      this.moveTo(this.movementTarget.x, this.movementTarget.y);
      this.clearMovementTarget();
      return this;
    }

    const step = movementSpeed * deltaSeconds;

    if (step >= distance) {
      this.moveTo(this.movementTarget.x, this.movementTarget.y);
      this.clearMovementTarget();
      return this;
    }

    this.moveTo(
      this.x + (dx / distance) * step,
      this.y + (dy / distance) * step
    );

    return this;
  }

  setControlled(controlled) {
    this.controlled = Boolean(controlled);

    if (this.controlled) {
      this.clearMovementTarget();
    }

    return this;
  }

  setMarker(marker) {
    this.showMarker(marker);
    return this;
  }

  showMarker(marker, fadeout = 0, options = {}) {
    this.marker = {
      ...marker,
      alpha: marker.alpha ?? 1,
      shownAt: options.startTime ?? marker.startTime ?? 0,
      holdSeconds: options.holdSeconds ?? marker.holdSeconds ?? 0,
      fadeoutSeconds: fadeout
    };

    return this;
  }

  updateMarker(elapsedSeconds) {
    if (!this.marker) {
      return this;
    }

    if (this.marker.fadeoutSeconds <= 0) {
      this.marker.alpha = 1;
      return this;
    }

    const fadeStart = this.marker.shownAt + this.marker.holdSeconds;

    if (elapsedSeconds < fadeStart) {
      this.marker.alpha = 1;
      return this;
    }

    const fadeProgress = (elapsedSeconds - fadeStart) / this.marker.fadeoutSeconds;

    if (fadeProgress >= 1) {
      this.clearMarker();
      return this;
    }

    this.marker.alpha = Math.max(0, 1 - fadeProgress);
    return this;
  }

  clearMarker() {
    this.marker = null;
    return this;
  }

  applyDebuff(debuff) {
    const nextDebuff = typeof debuff.clone === 'function' ? debuff.clone() : debuff;
    const existingIndex = this.debuffs.findIndex((activeDebuff) => activeDebuff.id === nextDebuff.id);

    if (existingIndex >= 0) {
      this.debuffs.splice(existingIndex, 1, nextDebuff);
    } else {
      this.debuffs.push(nextDebuff);
    }

    return nextDebuff;
  }

  removeDebuff(debuffId) {
    const debuffIndex = this.debuffs.findIndex((debuff) => debuff.id === debuffId);

    if (debuffIndex >= 0) {
      this.debuffs.splice(debuffIndex, 1);
    }

    return this;
  }

  clearDebuffs() {
    this.debuffs.splice(0, this.debuffs.length);
    return this;
  }

  decrementDebuff(debuffId, amount = 1) {
    const debuff = this.debuffs.find((activeDebuff) => activeDebuff.id === debuffId);

    if (!debuff) {
      return null;
    }

    debuff.decrement(amount);

    if (debuff.stacks <= 0) {
      this.removeDebuff(debuffId);
      return null;
    }

    return debuff;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  healToFull({ includeDefeated = false } = {}) {
    if (!includeDefeated && this.hp <= 0) {
      return this.hp;
    }

    this.hp = this.maxHp;
    return this.hp;
  }

  resetHealth() {
    this.hp = this.maxHp;
    return this;
  }
}

export function getCircleSpawnPoint(index, count, options = {}) {
  const config = { ...DEFAULT_SPAWN, ...options };
  const angle = config.startAngle + (Math.PI * 2 * index) / count;

  return {
    x: config.centerX + Math.cos(angle) * config.radius,
    y: config.centerY + Math.sin(angle) * config.radius
  };
}

export function spawnBotsForRoles(roles, options = {}) {
  return roles.map((role, index) => {
    const point = getCircleSpawnPoint(index, roles.length, options);

    return new PlayerBot({
      id: `bot-${role.id}`,
      role,
      x: point.x,
      y: point.y,
      controlled: Boolean(options.controlledRoleId) && role.id === options.controlledRoleId
    });
  });
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
