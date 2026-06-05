import { ValidationResult } from './ValidationResult.js';
import { normalizeStrategyMovementItem } from './StrategyMovement.js';

export class BaseStrategy {
  constructor({ id, label, mechanicId, waymarkers = [], movementPlan = [], conditionSets = {}, raidplanUrl = null }) {
    this.id = id;
    this.label = label;
    this.mechanicId = mechanicId;
    this.waymarkers = waymarkers;
    this.movementPlan = movementPlan.map((item) => normalizeStrategyMovementItem(item));
    this.conditionSets = conditionSets;
    this.raidplanUrl = raidplanUrl;
  }

  resolveAction(_action, _state, _encounter) {
    return {
      assignments: {},
      expectedPositions: []
    };
  }

  validateAction(_action, _state, _encounter) {
    return ValidationResult.pending(['No validation rules have been defined for this action yet.']);
  }

  getResolveNote(action, _state, _encounter) {
    return action?.detail ?? 'No strategy resolve note has been defined for this step yet.';
  }

  getReadyMovementItems(context) {
    return this.movementPlan.filter((item) => item.isReady({
      ...context,
      strategy: this
    }));
  }

  resolveMovementItem(item, context) {
    return item.resolvePositions({
      ...context,
      strategy: this
    });
  }
}
