export class StrategyMovementItem {
  constructor({ id, label = '', trigger, positions = {}, once = true, visibility = null }) {
    this.id = id;
    this.label = label;
    this.trigger = trigger;
    this.positions = positions;
    this.once = once;
    this.visibility = visibility;
  }

  isReady(context) {
    if (this.trigger.type === 'time') {
      return context.encounter.elapsedSeconds >= this.trigger.at;
    }

    if (this.trigger.type === 'condition') {
      const condition = this.trigger.condition
        ?? context.strategy.conditionSets[this.trigger.conditionSetId];

      return typeof condition === 'function' && condition(context);
    }

    return false;
  }

  resolvePositions(context) {
    const positions = typeof this.positions === 'function'
      ? this.positions(context)
      : this.positions;

    if (Array.isArray(positions)) {
      return positions.map((position) => ({
        roleId: position.roleId,
        ...normalizePoint(position)
      }));
    }

    return Object.entries(positions).map(([roleId, position]) => ({
      roleId,
      ...resolveStrategyPosition(position, context)
    }));
  }

  resolveVisibility(context, positions = []) {
    if (!this.visibility) {
      return null;
    }

    const visibility = typeof this.visibility === 'function'
      ? this.visibility({ ...context, positions })
      : this.visibility;

    if (!visibility) {
      return null;
    }

    const revealAt = typeof visibility.revealAt === 'function'
      ? visibility.revealAt({ ...context, positions })
      : visibility.revealAt;
    const resolveAt = typeof visibility.resolveAt === 'function'
      ? visibility.resolveAt({ ...context, positions })
      : visibility.resolveAt;

    if (!Number.isFinite(revealAt)) {
      return null;
    }

    return {
      label: visibility.label ?? this.label,
      revealAt,
      resolveAt: Number.isFinite(resolveAt) ? resolveAt : null,
      roleIds: Array.isArray(visibility.roleIds)
        ? visibility.roleIds
        : positions.map((position) => position.roleId)
    };
  }
}

export function timeBasedMovement({ id, label, at, positions, once = true, visibility = null }) {
  return new StrategyMovementItem({
    id,
    label,
    trigger: {
      type: 'time',
      at
    },
    positions,
    once,
    visibility
  });
}

export function conditionBasedMovement({
  id,
  label,
  conditionSetId,
  condition,
  positions,
  once = true,
  visibility = null
}) {
  return new StrategyMovementItem({
    id,
    label,
    trigger: {
      type: 'condition',
      conditionSetId,
      condition
    },
    positions,
    once,
    visibility
  });
}

export function absolutePosition({ x, y }) {
  return {
    type: 'absolute',
    x,
    y
  };
}

export function normalizeStrategyMovementItem(item) {
  return item instanceof StrategyMovementItem ? item : new StrategyMovementItem(item);
}

function resolveStrategyPosition(position, context) {
  if (typeof position === 'function') {
    return normalizePoint(position(context));
  }

  if (position && typeof position.resolve === 'function') {
    return normalizePoint(position.resolve(context));
  }

  if (position?.type === 'absolute' || hasPointShape(position)) {
    return normalizePoint(position);
  }

  throw new Error(`Unable to resolve strategy position "${JSON.stringify(position)}".`);
}

function normalizePoint(point) {
  if (!hasPointShape(point)) {
    throw new Error(`Strategy position must resolve to x/y coordinates, got "${JSON.stringify(point)}".`);
  }

  return {
    x: clamp01(point.x),
    y: clamp01(point.y)
  };
}

function hasPointShape(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
