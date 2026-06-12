import { Encounter } from '../core/Encounter.js';
import { ForsakenMechanic } from '../mechanics/forsaken/ForsakenMechanic.js';
import { KroxyRinnon341Strategy } from '../strategies/kroxy-rinnon/KroxyRinnon341Strategy.js';
import { LPDUFinalTwoStrategy, LPDUStrategy } from '../strategies/lpdu/LPDUStrategy.js';

const MECHANIC_FACTORIES = {
  forsaken: () => new ForsakenMechanic()
};

const STRATEGY_FACTORIES = {
  lpdu: () => new LPDUStrategy(),
  'lpdu-final-2': () => new LPDUFinalTwoStrategy(),
  'kroxy-rinnon-341': () => new KroxyRinnon341Strategy()
};

export function getMechanicOptions() {
  return Object.entries(MECHANIC_FACTORIES).map(([id, factory]) => {
    const mechanic = factory();
    return { id, label: mechanic.label };
  });
}

export function getStrategyOptionsForMechanic(mechanicId) {
  return Object.entries(STRATEGY_FACTORIES)
    .map(([id, factory]) => {
      const strategy = factory();
      return {
        id,
        label: strategy.label,
        mechanicId: strategy.mechanicId,
        raidplanUrl: strategy.raidplanUrl
      };
    })
    .filter((strategy) => strategy.mechanicId === mechanicId);
}

export function createStrategyById(strategyId) {
  const factory = STRATEGY_FACTORIES[strategyId];

  if (!factory) {
    throw new Error(`Unknown strategy "${strategyId}".`);
  }

  return factory();
}

export function createMechanicById(mechanicId) {
  const factory = MECHANIC_FACTORIES[mechanicId];

  if (!factory) {
    throw new Error(`Unknown mechanic "${mechanicId}".`);
  }

  return factory();
}

export function createEncounterByIds({ mechanicId, strategyId, roles, controlledRoleId }) {
  return new Encounter({
    mechanic: createMechanicById(mechanicId),
    strategy: createStrategyById(strategyId),
    roles,
    controlledRoleId
  });
}
