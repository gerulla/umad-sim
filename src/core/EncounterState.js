import { getCircleSpawnPoint, spawnBotsForRoles } from '../entities/PlayerBot.js';

export class EncounterState {
  constructor({ roles, controlledRoleId, mechanicId }) {
    this.mechanicId = mechanicId;
    this.players = spawnBotsForRoles(roles, { controlledRoleId });
    this.mechanicObjects = [];
    this.activeCast = null;
    this.activeScreenFlash = null;
    this.assignments = {};
    this.data = {};
    this.currentActionId = null;
  }

  getBotByRole(roleId) {
    return this.players.find((player) => player.roleId === roleId) || null;
  }

  setControlledRole(roleId) {
    this.players.forEach((player) => {
      player.setControlled(Boolean(roleId) && player.roleId === roleId);
    });
  }

  getControlledBot() {
    return this.players.find((player) => player.controlled) || null;
  }

  moveControlledBot(x, y) {
    const bot = this.getControlledBot();
    bot?.setMovementTarget(x, y, {
      sourceId: 'player-click',
      label: 'Player movement'
    });
    return bot;
  }

  resetPlayerSpawns(options = {}) {
    this.players.forEach((player, index) => {
      const point = getCircleSpawnPoint(index, this.players.length, options);
      player.clearMovementTarget().moveTo(point.x, point.y);
    });
  }

  addMechanicObject(object) {
    this.mechanicObjects.push(object);
    return object;
  }

  getMechanicObjectById(id) {
    return this.mechanicObjects.find((object) => object.id === id) || null;
  }

  clearMechanicObjects(predicate = null) {
    if (!predicate) {
      this.mechanicObjects.splice(0, this.mechanicObjects.length);
      return;
    }

    for (let index = this.mechanicObjects.length - 1; index >= 0; index -= 1) {
      if (predicate(this.mechanicObjects[index])) {
        this.mechanicObjects.splice(index, 1);
      }
    }
  }

  startCast({ id, label, startTime, duration, sourceActionId = null }) {
    if (this.activeCast?.id === id && this.activeCast.startTime === startTime) {
      return this.activeCast;
    }

    this.activeCast = {
      id,
      label,
      startTime,
      duration,
      endTime: startTime + duration,
      sourceActionId
    };

    return this.activeCast;
  }

  clearCast(id = null) {
    if (!id || this.activeCast?.id === id) {
      this.activeCast = null;
    }
  }

  startScreenFlash({ id, startTime, duration, color = '#ffffff', alpha = 1, sourceActionId = null }) {
    if (this.activeScreenFlash?.id === id && this.activeScreenFlash.startTime === startTime) {
      this.activeScreenFlash.alpha = alpha;
      return this.activeScreenFlash;
    }

    this.activeScreenFlash = {
      id,
      startTime,
      duration,
      endTime: startTime + duration,
      color,
      alpha,
      sourceActionId
    };

    return this.activeScreenFlash;
  }

  clearScreenFlash(id = null) {
    if (!id || this.activeScreenFlash?.id === id) {
      this.activeScreenFlash = null;
    }
  }

  setPlayerMarker(roleId, marker) {
    this.getBotByRole(roleId)?.setMarker(marker);
  }

  showPlayerMarker(roleId, marker, fadeout = 0, options = {}) {
    this.getBotByRole(roleId)?.showMarker(marker, fadeout, options);
  }

  updatePlayerMarkers(elapsedSeconds) {
    this.players.forEach((player) => player.updateMarker(elapsedSeconds));
  }

  clearPlayerMarkers() {
    this.players.forEach((player) => player.clearMarker());
  }

  clearPlayerDebuffs() {
    this.players.forEach((player) => player.clearDebuffs());
  }

  resetPlayerVitals() {
    this.players.forEach((player) => player.resetHealth());
  }

  healLivingPlayersToFull() {
    this.players.forEach((player) => player.healToFull());
  }

  setAssignment(scope, key, value) {
    this.assignments[scope] ??= {};
    this.assignments[scope][key] = value;
  }

  getAssignment(scope, key) {
    return this.assignments[scope]?.[key] ?? null;
  }

  setMechanicData(key, value) {
    this.data[key] = value;
  }

  getMechanicData(key) {
    return this.data[key];
  }
}
