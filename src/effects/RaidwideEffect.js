import { MechanicObject } from '../core/MechanicObject.js';

const DEFAULT_RAIDWIDE_STYLE = {
  fill: 'rgba(239, 68, 68, 0.22)',
  stroke: 'rgba(248, 113, 113, 0.9)',
  shadow: 'rgba(248, 113, 113, 0.7)'
};

export class RaidwideEffect {
  constructor({
    id,
    label = 'Raidwide',
    damage = 0,
    createdAt = 0,
    fireDuration = 1,
    style = {},
    data = {}
  }) {
    this.id = id;
    this.label = label;
    this.damage = damage;
    this.createdAt = createdAt;
    this.fireDuration = fireDuration;
    this.style = { ...DEFAULT_RAIDWIDE_STYLE, ...style };
    this.data = data;
    this.firingEvent = null;
  }

  get endTime() {
    if (!this.firingEvent) {
      return null;
    }

    return this.firingEvent.startTime + this.fireDuration;
  }

  fire({ players = [], elapsedSeconds }) {
    const hitRoleIds = players.map((player) => player.roleId);

    players.forEach((player) => player.takeDamage(this.damage));

    this.firingEvent = {
      startTime: elapsedSeconds,
      endTime: elapsedSeconds + this.fireDuration,
      hitRoleIds,
      damage: this.damage
    };

    return this.firingEvent;
  }

  toMechanicObject({ sourceActionId = null } = {}) {
    return new MechanicObject({
      id: `${this.id}-firing`,
      type: 'raidwide-effect',
      x: 0.5,
      y: 0.5,
      radius: 1,
      label: this.label,
      sourceActionId,
      data: {
        label: this.label,
        effectId: this.id,
        startTime: this.firingEvent?.startTime ?? this.createdAt,
        endTime: this.endTime ?? this.createdAt,
        hitRoleIds: this.firingEvent?.hitRoleIds ?? [],
        damage: this.damage,
        style: this.style,
        ...this.data
      }
    });
  }
}
