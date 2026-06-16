import { MechanicObject } from '../core/MechanicObject.js';

const DEFAULT_FIRING_HOLD_SECONDS = 1;

const DEFAULT_EFFECT_STYLE = {
  pendingFill: 'rgba(234, 88, 12, 0.1)',
  pendingStroke: 'rgba(251, 146, 60, 0.95)',
  pendingShadow: 'rgba(249, 115, 22, 0.55)',
  firingFill: 'rgba(239, 68, 68, 0.4)',
  firingStroke: 'rgba(248, 113, 113, 0.98)',
  firingShadow: 'rgba(248, 113, 113, 0.78)',
  fill: 'rgba(234, 88, 12, 0.2)',
  stroke: 'rgba(251, 146, 60, 0.95)',
  shadow: 'rgba(249, 115, 22, 0.7)'
};

export class BaseMarkerEffect {
  constructor({
    id,
    markerType,
    sourceRoleId,
    x,
    y,
    startTime = 0,
    createdAt = startTime,
    timerSeconds = 0,
    firesAt = timerSeconds > 0 ? createdAt + timerSeconds : null,
    pendingDuration = 0,
    duration = 1,
    fireDuration = duration,
    firingHoldSeconds = DEFAULT_FIRING_HOLD_SECONDS,
    style = {},
    data = {}
  }) {
    this.id = id;
    this.markerType = markerType;
    this.sourceRoleId = sourceRoleId;
    this.x = x;
    this.y = y;
    this.createdAt = createdAt;
    this.firesAt = firesAt;
    this.pendingDuration = pendingDuration;
    this.fireDuration = fireDuration;
    this.firingHoldSeconds = firingHoldSeconds;
    this.style = { ...DEFAULT_EFFECT_STYLE, ...style };
    this.data = data;
    this.firingEvent = null;
  }

  get pendingStartTime() {
    if (typeof this.firesAt !== 'number') {
      return null;
    }

    return Math.max(this.createdAt, this.firesAt - this.pendingDuration);
  }

  get firingStartTime() {
    return this.firingEvent?.startTime ?? null;
  }

  get endTime() {
    if (typeof this.firingStartTime !== 'number') {
      return null;
    }

    return this.firingStartTime + this.firingHoldSeconds + this.fireDuration;
  }

  get fired() {
    return Boolean(this.firingEvent);
  }

  shouldAutoFire(elapsedSeconds) {
    return !this.fired && typeof this.firesAt === 'number' && elapsedSeconds >= this.firesAt;
  }

  getPhaseAt(elapsedSeconds) {
    if (this.fired) {
      return elapsedSeconds < this.endTime ? 'firing' : 'expired';
    }

    if (
      typeof this.firesAt === 'number'
      && elapsedSeconds >= this.pendingStartTime
      && elapsedSeconds < this.firesAt
    ) {
      return 'pending';
    }

    return 'idle';
  }

  fire({ players = [], elapsedSeconds, x = this.x, y = this.y, data = {} }) {
    this.x = x;
    this.y = y;
    this.firingEvent = {
      startTime: elapsedSeconds,
      endTime: elapsedSeconds + this.firingHoldSeconds + this.fireDuration,
      x,
      y,
      hitRoleIds: players
        .filter((player) => this.containsPlayer(player))
        .map((player) => player.roleId),
      data
    };

    return this.firingEvent;
  }

  containsPlayer(player) {
    return this.containsPoint(player.x, player.y);
  }

  containsPoint() {
    return false;
  }

  toMechanicObject({ sourceActionId = null, phase = 'firing', elapsedSeconds = this.firingStartTime } = {}) {
    const style = this.getStyleForPhase(phase);
    const startTime = phase === 'pending' ? this.pendingStartTime : this.firingStartTime;
    const endTime = phase === 'pending' ? this.firesAt : this.endTime;

    return new MechanicObject({
      id: `${this.id}-${phase}`,
      type: 'marker-effect',
      x: this.x,
      y: this.y,
      radius: this.radius,
      label: this.markerType,
      sourceActionId,
      data: {
        markerType: this.markerType,
        sourceRoleId: this.sourceRoleId,
        effectId: this.id,
        phase,
        createdAt: this.createdAt,
        startTime: startTime ?? elapsedSeconds,
        endTime: endTime ?? elapsedSeconds,
        fireDuration: this.fireDuration,
        firingHoldSeconds: this.firingHoldSeconds,
        pendingDuration: this.pendingDuration,
        hitRoleIds: this.firingEvent?.hitRoleIds ?? [],
        style,
        ...this.firingEvent?.data,
        ...this.data
      }
    });
  }

  toPendingMechanicObject(options = {}) {
    return this.toMechanicObject({ ...options, phase: 'pending' });
  }

  toFiringMechanicObject(options = {}) {
    return this.toMechanicObject({ ...options, phase: 'firing' });
  }

  getStyleForPhase(phase) {
    if (phase === 'firing') {
      return {
        fill: this.style.firingFill,
        stroke: null,
        lineWidth: 0,
        shadow: 'rgba(248, 113, 113, 0)'
      };
    }

    return {
      fill: this.style.pendingFill,
      stroke: this.style.pendingStroke,
      shadow: this.style.pendingShadow
    };
  }
}

export class CircleMarkerEffect extends BaseMarkerEffect {
  constructor({ radius, shape = 'circle', ...options }) {
    super(options);
    this.radius = radius;
    this.shape = shape;
  }

  containsPoint(x, y) {
    return Math.hypot(this.x - x, this.y - y) <= this.radius;
  }

  toMechanicObject(options = {}) {
    const object = super.toMechanicObject(options);
    object.data.shape = this.shape;
    object.data.radius = this.radius;
    return object;
  }
}

export class ConeMarkerEffect extends BaseMarkerEffect {
  constructor({ length, angleDegrees, facingDegrees, ...options }) {
    super(options);
    this.radius = length;
    this.length = length;
    this.angleDegrees = angleDegrees;
    this.facingDegrees = facingDegrees;
  }

  fire({ facingDegrees = this.facingDegrees, ...options }) {
    this.facingDegrees = facingDegrees;
    return super.fire(options);
  }

  containsPoint(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > this.length) {
      return false;
    }

    if (distance <= 0.000001) {
      return false;
    }

    const pointDegrees = Math.atan2(dy, dx) * (180 / Math.PI);
    return getAngleDeltaDegrees(pointDegrees, this.facingDegrees) <= this.angleDegrees / 2;
  }

  toMechanicObject(options = {}) {
    const object = super.toMechanicObject(options);
    object.data.shape = 'cone';
    object.data.length = this.length;
    object.data.angleDegrees = this.angleDegrees;
    object.data.facingDegrees = this.facingDegrees;
    return object;
  }
}

export function createMarkerEffect(markerType, options) {
  if (markerType === 'cone') {
    return new ConeMarkerEffect({
      markerType,
      length: options.coneLength,
      angleDegrees: options.coneDegrees,
      facingDegrees: options.coneFacingDegrees,
      ...options
    });
  }

  return new CircleMarkerEffect({
    markerType,
    shape: markerType,
    radius: markerType === 'stack' ? options.stackRadius : options.aoeRadius,
    ...options
  });
}

export function syncMarkerEffectLifecycle({
  effects,
  state,
  players,
  elapsedSeconds,
  sourceActionId = 'marker-effect'
}) {
  state.clearMechanicObjects((object) => (
    object.type === 'marker-effect'
    && object.data?.managedMarkerEffect
    && object.data.endTime <= elapsedSeconds
  ));

  effects.forEach((effect) => {
    if (effect.shouldAutoFire(elapsedSeconds)) {
      effect.fire({
        players,
        elapsedSeconds: effect.firesAt
      });
    }

    const phase = effect.getPhaseAt(elapsedSeconds);

    if (phase !== 'pending' && phase !== 'firing') {
      return;
    }

    const objectId = `${effect.id}-${phase}`;

    if (state.getMechanicObjectById(objectId)) {
      return;
    }

    state.clearMechanicObjects((object) => (
      object.type === 'marker-effect' && object.data?.effectId === effect.id
    ));

    const object = effect.toMechanicObject({
      phase,
      elapsedSeconds,
      sourceActionId
    });

    object.data.managedMarkerEffect = true;
    state.addMechanicObject(object);
  });
}

function getAngleDeltaDegrees(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}
