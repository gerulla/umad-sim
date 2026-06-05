import { createRandomSeed, RandomSource } from './RandomSource.js';

const CONTROLLED_PLAYER_MOVEMENT_SPEED_MULTIPLIER = 1.5;

export class Encounter {
  constructor({ mechanic, strategy, roles, controlledRoleId }) {
    this.strategyMovementSpeed = 0.45;
    this.randomResetCount = 0;
    this.randomSeed = 0;
    this.randomSource = null;
    this.load({ mechanic, strategy, roles, controlledRoleId });
  }

  load({ mechanic, strategy, roles, controlledRoleId }) {
    if (strategy.mechanicId !== mechanic.id) {
      throw new Error(`Strategy "${strategy.id}" cannot solve mechanic "${mechanic.id}".`);
    }

    this.reseedRandomness();
    this.mechanic = mechanic;
    this.strategy = strategy;
    this.state = mechanic.createInitialState({ roles, controlledRoleId });
    this.elapsedSeconds = 0;
    this.currentActionIndex = 0;
    this.status = 'idle';
    this.lastResolution = null;
    this.lastValidation = null;
    this.appliedStrategyMovementIds = new Set();
    this.lastStrategyMovement = null;

    this.mechanic.initializeState(this.state, this);
    this.state.currentActionId = this.mechanic.start.id;
    this.state.clearMechanicObjects();
    this.state.clearCast();
    this.state.clearScreenFlash();
    this.state.clearPlayerMarkers();
    return this;
  }

  get timelineActions() {
    return this.mechanic.actions;
  }

  get currentAction() {
    return this.mechanic.getActionByIndex(this.currentActionIndex);
  }

  get currentTimelineItem() {
    if (this.status === 'idle') {
      return this.mechanic.start;
    }

    if (this.status === 'complete') {
      return this.mechanic.end;
    }

    return this.currentAction;
  }

  get controlledBot() {
    return this.state.getControlledBot();
  }

  get activeCast() {
    return this.state.activeCast;
  }

  get activeScreenFlash() {
    return this.state.activeScreenFlash;
  }

  get castProgress() {
    if (!this.activeCast) {
      return 0;
    }

    return clamp(
      (this.elapsedSeconds - this.activeCast.startTime) / this.activeCast.duration,
      0,
      1
    );
  }

  get castRemainingSeconds() {
    if (!this.activeCast) {
      return 0;
    }

    return Math.max(0, this.activeCast.endTime - this.elapsedSeconds);
  }

  setStrategy(strategy) {
    if (strategy.mechanicId !== this.mechanic.id) {
      throw new Error(`Strategy "${strategy.id}" cannot solve mechanic "${this.mechanic.id}".`);
    }

    this.strategy = strategy;
    this.appliedStrategyMovementIds.clear();
    this.lastStrategyMovement = null;
    this.resolveCurrentAction();
    return this;
  }

  setControlledRole(roleId) {
    this.state.setControlledRole(roleId);
    return this;
  }

  setStrategyMovementSpeed(speed) {
    this.strategyMovementSpeed = Math.max(0, Number(speed) || 0);
    return this;
  }

  reseedRandomness() {
    this.randomResetCount += 1;
    this.randomSeed = createRandomSeed(this.randomSeed, this.randomResetCount);
    this.randomSource = new RandomSource(this.randomSeed);
    return this.randomSource;
  }

  start() {
    if (this.status === 'idle') {
      this.setActionIndex(0);
    } else {
      this.status = 'running';
    }

    return this;
  }

  complete() {
    this.status = 'complete';
    this.elapsedSeconds = this.mechanic.end.time;
    this.state.currentActionId = this.mechanic.end.id;
    this.state.clearCast();
    this.state.clearScreenFlash();
    this.state.clearPlayerMarkers();
    return this;
  }

  resetToIdle() {
    this.status = 'idle';
    this.elapsedSeconds = this.mechanic.start.time;
    this.currentActionIndex = 0;
    this.state.currentActionId = this.mechanic.start.id;
    this.state.clearMechanicObjects();
    this.state.clearCast();
    this.state.clearScreenFlash();
    this.state.clearPlayerMarkers();
    this.reseedRandomness();
    this.mechanic.initializeState(this.state, this);
    this.lastResolution = null;
    this.lastValidation = null;
    this.appliedStrategyMovementIds.clear();
    this.lastStrategyMovement = null;
    return this;
  }

  setActionIndex(index) {
    const nextIndex = Math.max(0, Math.min(index, this.timelineActions.length - 1));
    this.status = 'running';
    this.currentActionIndex = nextIndex;
    this.elapsedSeconds = this.currentAction.time;
    this.mechanic.enterAction(this.currentAction, this.state, this);
    this.resolveCurrentAction();
    this.syncTimeState(0);
    return this;
  }

  setElapsedSeconds(seconds, deltaSeconds = 0) {
    this.elapsedSeconds = clamp(seconds, this.mechanic.start.time, this.mechanic.end.time);
    this.status = 'running';
    const nextIndex = this.mechanic.getActionIndexAtTime(this.elapsedSeconds);

    if (nextIndex !== this.currentActionIndex) {
      this.currentActionIndex = nextIndex;
      this.mechanic.enterAction(this.currentAction, this.state, this);
      this.resolveCurrentAction();
    }

    this.syncTimeState(deltaSeconds);
    return this;
  }

  update(deltaSeconds) {
    if (this.status !== 'running') {
      return this;
    }

    this.setElapsedSeconds(this.elapsedSeconds + deltaSeconds, deltaSeconds);

    if (this.elapsedSeconds >= this.mechanic.end.time) {
      this.complete();
    }

    return this;
  }

  syncTimeState(deltaSeconds) {
    this.updateStrategyMovement(deltaSeconds);
    this.mechanic.update(deltaSeconds, this.state, this);
    this.applyStrategyMovements();
  }

  moveControlledBot(x, y) {
    return this.state.moveControlledBot(x, y);
  }

  hasControlledMovementTarget() {
    return Boolean(this.state.getControlledBot()?.movementTarget);
  }

  updateControlledPlayerMovement(deltaSeconds) {
    this.state.getControlledBot()?.updateMovement(
      deltaSeconds,
      this.strategyMovementSpeed * CONTROLLED_PLAYER_MOVEMENT_SPEED_MULTIPLIER
    );
  }

  resetPlayerSpawns() {
    this.state.resetPlayerSpawns();
    return this;
  }

  resolveCurrentAction() {
    this.lastResolution = this.strategy.resolveAction(this.currentAction, this.state, this);
    return this.lastResolution;
  }

  validateCurrentAction() {
    this.lastValidation = this.strategy.validateAction(this.currentAction, this.state, this);
    return this.lastValidation;
  }

  applyStrategyMovements() {
    const context = this.createStrategyContext();
    const readyItems = this.strategy.getReadyMovementItems(context);

    readyItems.forEach((item) => {
      if (item.once && this.appliedStrategyMovementIds.has(item.id)) {
        return;
      }

      const positions = this.strategy.resolveMovementItem(item, context);
      const targets = [];

      positions.forEach((position) => {
        const bot = this.state.getBotByRole(position.roleId);

        if (!bot || bot.controlled) {
          return;
        }

        bot.setMovementTarget(position.x, position.y, {
          sourceId: item.id,
          label: item.label
        });
        targets.push(position);
      });

      if (item.once) {
        this.appliedStrategyMovementIds.add(item.id);
      }

      this.lastStrategyMovement = {
        itemId: item.id,
        label: item.label,
        targets
      };
    });
  }

  updateStrategyMovement(deltaSeconds) {
    this.state.players.forEach((player) => {
      const speed = player.controlled
        ? this.strategyMovementSpeed * CONTROLLED_PLAYER_MOVEMENT_SPEED_MULTIPLIER
        : this.strategyMovementSpeed;

      player.updateMovement(deltaSeconds, speed);
    });
  }

  createStrategyContext() {
    return {
      encounter: this,
      mechanic: this.mechanic,
      strategy: this.strategy,
      state: this.state
    };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
