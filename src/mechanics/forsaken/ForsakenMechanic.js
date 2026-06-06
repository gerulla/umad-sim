import { BaseMechanic } from '../../core/BaseMechanic.js';
import { MechanicObject } from '../../core/MechanicObject.js';
import { Debuff } from '../../entities/Debuff.js';
import { createMarkerEffect } from '../../effects/MarkerEffects.js';
import { RaidwideEffect } from '../../effects/RaidwideEffect.js';

const ROLE_GROUPS = {
  supports: ['MT', 'OT', 'H1', 'H2'],
  dps: ['M1', 'M2', 'R1', 'R2']
};
const FORSAKEN_MARKER_PAIR_GROUPS = [
  ['MT', 'H1'],
  ['OT', 'H2'],
  ['M1', 'R1'],
  ['M2', 'R2']
];

const FORSAKEN_CAST_ACTION = ForsakenCast();
const SCREEN_FLASH_ACTION = ScreenFlash(FORSAKEN_CAST_ACTION);
const MARKER_SPAWN_ACTION = MarkerSpawn(SCREEN_FLASH_ACTION);
const DEFAULT_TOWER_RADIUS = 0.055;
const FORSAKEN_TOWER_RADIUS = 0.085;
const FORSAKEN_TOWER_STYLE = {
  fill: 'rgba(14, 165, 233, 0)',
  stroke: 'rgba(125, 211, 252, 0.98)',
  shadow: 'rgba(56, 189, 248, 0.82)'
};
export const FORSAKEN_TOWER_ROLE_STYLES = {
  aoe: FORSAKEN_TOWER_STYLE,
  cone: FORSAKEN_TOWER_STYLE
};
const FORSAKEN_TOWER_RESOLVE_STYLE = {
  fill: 'rgba(239, 68, 68, 0)',
  stroke: 'rgba(248, 113, 113, 0.98)',
  shadow: 'rgba(248, 113, 113, 0.82)'
};
const SPELLS_TROUBLE_DEBUFF = new Debuff({
  id: 'spells-trouble',
  label: "Spells' Trouble",
  stacks: 4,
  icon: '/debuffs/spells-trouble.png',
  iconType: 'spells-trouble'
});
const TOWER_WAVE_START_TIME = MARKER_SPAWN_ACTION.payload.markers.startTime;
const TOWER_WAVE_COUNT = 8;
const TOWER_ACTIVE_DURATION = 10;
const TOWER_RESOLVE_DURATION = 1;
const TOWER_FINAL_RESOLVE_TIME = TOWER_WAVE_START_TIME + TOWER_WAVE_COUNT * TOWER_ACTIVE_DURATION;
const TOWER_SEQUENCE_END_TIME = TOWER_FINAL_RESOLVE_TIME + TOWER_RESOLVE_DURATION;
const EVEN_TOWER_WAVES = [2, 4, 6, 8];
const EMPTY_TOWER_DAMAGE = 500;
const PLAYER_CONE_DAMAGE = 500;
const PLAYER_AOE_DAMAGE = 300;
const PLAYER_STACK_DAMAGE = 300;
const PLAYER_STACK_FAILED_DAMAGE = 900;
const FORSAKEN_PLAYER_STACK_REQUIRED_COUNT = 3;
const FORSAKEN_MARKER_VISIBILITY = {
  holdSeconds: 5,
  fadeoutSeconds: 1
};
const DEFAULT_MARKER_EFFECT_CONFIG = {
  aoeRadius: 0.105,
  stackRadius: 0.105,
  coneLength: 0.5,
  coneDegrees: 70,
  coneFacingDegrees: -90,
  pendingDuration: 0,
  fireDuration: 1,
  displayDuration: 1
};
const BAIT_CAST_OPTIONS = ["Future's End", "Past's End"];
const BAIT_CAST_LEAD_TIME = 8;
const BAIT_CAST_DURATION = 7;
const CLONE_SPAWN_DELAY = 1;
const CLONE_COUNT = 4;
const CLONE_SPAWN_HIT_RADIUS = 0.085;
const CLONE_SPAWN_HIT_DAMAGE = 250;
const ALL_THINGS_START_DELAY = 7;
const ALL_THINGS_CAST_DURATION = 4;
const ALL_THINGS_CLEAVE_LENGTH = 0.5;
const ALL_THINGS_CLEAVE_DEGREES = 180;
const ALL_THINGS_CLEAVE_DAMAGE = 1000;
const ALL_THINGS_VISUAL_DURATION = 1;
const LAST_EVEN_TOWER_WAVE = EVEN_TOWER_WAVES[EVEN_TOWER_WAVES.length - 1];
const LIGHT_OF_JUDGEMENT_DELAY = 4;
const LIGHT_OF_JUDGEMENT_TIME = getEvenTowerTiming(LAST_EVEN_TOWER_WAVE).cleaveTime + LIGHT_OF_JUDGEMENT_DELAY;
const LIGHT_OF_JUDGEMENT_DAMAGE = 700;
const FORSAKEN_END_TIME = LIGHT_OF_JUDGEMENT_TIME + 2;

const FORSAKEN_TOWER_RULES = [
  {
    id: 'empty-tower-raid-damage',
    apply({ snapshot, state }) {
      if (snapshot.occupants.length > 0) {
        return;
      }

      state.players.forEach((player) => player.takeDamage(EMPTY_TOWER_DAMAGE));
      snapshot.events.push({
        type: 'empty-tower-damage',
        damage: EMPTY_TOWER_DAMAGE,
        targets: state.players.map((player) => player.roleId)
      });
    }
  },
  {
    id: 'stored-marker-resolve',
    apply({ snapshot, state, mechanic, elapsedSeconds }) {
      snapshot.occupants.forEach((player) => {
        mechanic.resolveStoredMarker(player, snapshot, state, elapsedSeconds);
      });
    }
  },
  {
    id: 'spells-trouble-decrement',
    apply({ snapshot }) {
      snapshot.occupants.forEach((player) => {
        player.decrementDebuff(SPELLS_TROUBLE_DEBUFF.id, 1);
        snapshot.events.push({
          type: 'debuff-decrement',
          roleId: player.roleId,
          debuffId: SPELLS_TROUBLE_DEBUFF.id
        });
      });
    }
  }
];

const FORSAKEN_WAVE_RULES = [
  {
    id: 'next-stored-marker-assignment',
    apply({ towerSnapshots, wave, state, mechanic, elapsedSeconds }) {
      mechanic.assignNextStoredMarkers(towerSnapshots, wave, state, elapsedSeconds);
    }
  }
];
const DEFAULT_RANDOM_SOURCE = {
  random: () => Math.random(),
  int(max) {
    return Math.floor(this.random() * max);
  },
  bool(chance = 0.5) {
    return this.random() < chance;
  },
  choice(values) {
    return values[this.int(values.length)];
  }
};

export const POSSIBLE_TOWER_POSITIONS = [
  {
    marker: 'A',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.615, y: 0.358 },
      { label: 'T2', x: 0.385, y: 0.358 }
    ]
  },
  {
    marker: '2',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.682, y: 0.481 },
      { label: 'T2', x: 0.519, y: 0.318 }
    ]
  },
  {
    marker: 'B',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.642, y: 0.615 },
      { label: 'T2', x: 0.642, y: 0.385 }
    ]
  },
  {
    marker: '3',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.519, y: 0.682 },
      { label: 'T2', x: 0.682, y: 0.519 }
    ]
  },
  {
    marker: 'C',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.385, y: 0.642 },
      { label: 'T2', x: 0.615, y: 0.642 }
    ]
  },
  {
    marker: '4',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.318, y: 0.519 },
      { label: 'T2', x: 0.481, y: 0.682 }
    ]
  },
  {
    marker: 'D',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.358, y: 0.385 },
      { label: 'T2', x: 0.358, y: 0.615 }
    ]
  },
  {
    marker: '1',
    radius: FORSAKEN_TOWER_RADIUS,
    style: FORSAKEN_TOWER_STYLE,
    showLabel: false,
    towers: [
      { label: 'T1', x: 0.481, y: 0.318 },
      { label: 'T2', x: 0.318, y: 0.481 }
    ]
  }
];

const FORSAKEN_ACTIONS = [
  {
    id: 'conga',
    type: 'setup',
    time: 0,
    title: 'Opening lineup',
    callout: 'Identify your role, marker type, and conga priority.',
    detail: 'Start from the assigned conga. Supports and DPS split by the plan once cone, stack, and chariot markers appear.'
  },
  FORSAKEN_CAST_ACTION,
  SCREEN_FLASH_ACTION,
  MARKER_SPAWN_ACTION,
  ...createTowerWaveActions(),
  ...createEvenTowerTimelineActions(),
  FinalTowerResolve(),
  {
    id: 'post',
    type: 'cleanup',
    time: TOWER_SEQUENCE_END_TIME,
    title: 'Post-towers',
    callout: 'Stack for the final bait and prepare for the raidwide.',
    detail: 'Finish the last All Things Ending movement, then stabilize north for the end of Forsaken.'
  },
  {
    id: 'loj',
    type: 'raidwide',
    time: LIGHT_OF_JUDGEMENT_TIME,
    title: 'Light of Judgement',
    callout: "Heavy raidwide. Any remaining Spells' Trouble debuff kills.",
    detail: "Four seconds after the final All Things Ending cleaves, Light of Judgement hits the arena for 700 damage and kills anyone who still has Spells' Trouble."
  }
];

export class ForsakenMechanic extends BaseMechanic {
  constructor() {
    super({
      id: 'forsaken',
      label: 'Forsaken',
      arena: {
        backgroundImage: '/umad_bg.jpeg'
      },
      start: {
        id: 'forsaken-start',
        time: 0,
        title: 'Forsaken Start',
        callout: 'Forsaken sequence begins.',
        detail: 'Initialize player state, markers, towers, and strategy resolution.'
      },
      end: {
        id: 'forsaken-end',
        time: FORSAKEN_END_TIME,
        title: 'Forsaken End',
        callout: 'Forsaken sequence ends.',
        detail: 'All tower and marker checks should be complete.'
      },
      actions: FORSAKEN_ACTIONS
    });
    this.towerRules = FORSAKEN_TOWER_RULES;
    this.waveRules = FORSAKEN_WAVE_RULES;
  }

  initializeState(state, encounter) {
    const randomSource = getRunRandomSource(encounter);
    const previousTowerSignature = getTowerSequenceSignature(state.getMechanicData('towerSequence'));
    const previousOpeningMarkerSignature = getOpeningMarkerSignature(state.getMechanicData('openingMarkerAssignments'));
    const towerSequence = createTowerSequence(randomSource, previousTowerSignature, {
      fixedMarker: encounter?.mechanicSettings?.fixedTowerMarker
    });
    const evenTowerEvents = createEvenTowerEvents(randomSource);

    state.resetPlayerVitals();
    state.setMechanicData('randomSeed', encounter?.randomSeed ?? null);
    state.setMechanicData('randomSource', randomSource);
    state.setMechanicData('previousOpeningMarkerSignature', previousOpeningMarkerSignature);
    state.setMechanicData('openingMarkerRngOptions', {
      forcedGroup: encounter?.mechanicSettings?.forcedOpeningMarkerGroup ?? null,
      forcedRoleId: encounter?.mechanicSettings?.forcedOpeningMarkerRoleId ?? null
    });
    state.setMechanicData('towerSoakCounts', {});
    state.setMechanicData('markerAssignments', {});
    state.setMechanicData('openingMarkerAssignments', null);
    state.setMechanicData('storedMarkers', {});
    state.setMechanicData('resolvedTowerWaves', new Set());
    state.setMechanicData('towerSnapshots', []);
    state.setMechanicData('markerResolves', []);
    state.setMechanicData('nextMarkerAssignments', []);
    state.setMechanicData('evenTowerEvents', evenTowerEvents);
    state.setMechanicData('resolvedCloneSpawns', new Set());
    state.setMechanicData('lockedAllThingsCasts', new Set());
    state.setMechanicData('resolvedAllThingsCleaves', new Set());
    state.setMechanicData('resolvedLightOfJudgement', false);
    state.setMechanicData('lightOfJudgementResult', null);
    state.setMechanicData('towerSequence', towerSequence);
    state.setMechanicData('towerDirection', towerSequence.direction);
    state.setMechanicData('towerStartPosition', towerSequence.startMarker);
    state.setMechanicData('currentSet', 0);
    state.setMechanicData('currentTowerWave', 0);
    state.setMechanicData('activeTowerSignature', '');
    state.clearPlayerMarkers();
    state.clearPlayerDebuffs();
    state.players.forEach((player) => player.applyDebuff(SPELLS_TROUBLE_DEBUFF));
    state.clearScreenFlash();
  }

  enterAction(action, state) {
    super.enterAction(action, state);
    state.setMechanicData('currentTowerWave', action.payload?.wave ?? state.getMechanicData('currentTowerWave'));
  }

  update(_deltaSeconds, state, encounter) {
    this.syncBossSpawn(state, encounter.elapsedSeconds);
    this.ForsakenCast(state, encounter.elapsedSeconds);
    this.ScreenFlash(state, encounter.elapsedSeconds);
    this.MarkerSpawn(state, encounter.elapsedSeconds);
    this.syncTowerWaves(state, encounter.elapsedSeconds);
    this.syncEvenTowerEvents(state, encounter.elapsedSeconds);
    this.syncLightOfJudgement(state, encounter.elapsedSeconds);
    this.syncMarkerEffects(state, encounter.elapsedSeconds);
    state.updatePlayerMarkers(encounter.elapsedSeconds);
  }

  syncBossSpawn(state, elapsedSeconds) {
    if (elapsedSeconds >= 0) {
      this.ensureBossSpawned(state);
    }
  }

  ForsakenCast(state, elapsedSeconds) {
    const cast = FORSAKEN_CAST_ACTION.payload.cast;
    const castEndTime = cast.startTime + cast.duration;

    if (elapsedSeconds >= cast.startTime && elapsedSeconds < castEndTime) {
      state.startCast({
        ...cast,
        sourceActionId: 'forsaken-start'
      });
      return;
    }

    state.clearCast(cast.id);
  }

  ScreenFlash(state, elapsedSeconds) {
    const flash = SCREEN_FLASH_ACTION.payload.flash;
    const flashEndTime = flash.startTime + flash.duration;

    if (elapsedSeconds >= flash.startTime && elapsedSeconds < flashEndTime) {
      state.startScreenFlash({
        ...flash,
        alpha: 1 - (elapsedSeconds - flash.startTime) / flash.duration,
        sourceActionId: SCREEN_FLASH_ACTION.id
      });
      return;
    }

    state.clearScreenFlash(flash.id);
  }

  MarkerSpawn(state, elapsedSeconds) {
    const markerEvent = MARKER_SPAWN_ACTION.payload.markers;

    if (elapsedSeconds < markerEvent.startTime) {
      return;
    }

    let assignments = state.getMechanicData('openingMarkerAssignments');

    if (!assignments) {
      assignments = createOpeningMarkerAssignments(
        state.players,
        getRandomSource(state),
        state.getMechanicData('previousOpeningMarkerSignature'),
        state.getMechanicData('openingMarkerRngOptions')
      );
      state.setMechanicData('openingMarkerAssignments', assignments);
      applyStoredMarkerAssignments({
        state,
        assignments: assignments.markers,
        shownAt: markerEvent.startTime,
        holdSeconds: markerEvent.visibleDuration,
        fadeoutSeconds: markerEvent.fadeDuration
      });
    }
  }

  syncTowerWaves(state, elapsedSeconds) {
    const sequence = getOrCreateTowerSequence(state);
    const activeWaves = [];
    let currentTowerWave = 0;

    sequence.waves.forEach((wave) => {
      const phase = getTowerWavePhase(wave, elapsedSeconds);

      if (!phase) {
        return;
      }

      if (phase === 'resolving') {
        this.resolveTowerWaveOnce(wave, state, wave.resolveStartTime);
      }

      currentTowerWave = Math.max(currentTowerWave, wave.wave);
      activeWaves.push({ wave, phase });
    });

    const activeTowerSignature = activeWaves
      .map(({ wave, phase }) => `${wave.wave}:${phase}`)
      .join('|');

    if (activeTowerSignature !== state.getMechanicData('activeTowerSignature')) {
      state.clearMechanicObjects((object) => object.sourceActionId?.startsWith('forsaken-tower-wave'));
      activeWaves.forEach(({ wave, phase }) => this.spawnTowerWave(wave, state, phase));
      state.setMechanicData('activeTowerSignature', activeTowerSignature);
    }

    state.setMechanicData('currentTowerWave', currentTowerWave);
  }

  spawnTowerWave(wave, state, phase) {
    const towerRoles = getForsakenTowerRoles(wave.position);

    wave.position.towers.forEach((tower, index) => {
      const towerRole = towerRoles.get(tower) ?? null;
      const towerStyle = phase === 'resolving'
        ? FORSAKEN_TOWER_RESOLVE_STYLE
        : FORSAKEN_TOWER_ROLE_STYLES[towerRole] ?? wave.position.style;

      state.addMechanicObject(new MechanicObject({
        id: `forsaken-tower-wave-${wave.wave}-${phase}-${index + 1}`,
        type: 'tower',
        x: tower.x,
        y: tower.y,
        radius: tower.radius ?? wave.position.radius ?? DEFAULT_TOWER_RADIUS,
        label: tower.label,
        sourceActionId: `forsaken-tower-wave-${wave.wave}`,
        data: {
          wave: wave.wave,
          marker: wave.position.marker,
          phase,
          direction: wave.direction,
          towerRole,
          style: towerStyle,
          showLabel: tower.showLabel ?? wave.position.showLabel
        }
      }));
    });
  }

  syncEvenTowerEvents(state, elapsedSeconds) {
    const events = getEvenTowerEvents(state);

    events.forEach((event) => {
      this.syncBaitCast(event, state, elapsedSeconds);
      this.spawnClonesOnce(event, state, elapsedSeconds);
      this.syncCloneFacing(event, state, elapsedSeconds);
      this.lockAllThingsFacingOnce(event, state, elapsedSeconds);
      this.syncAllThingsCast(event, state, elapsedSeconds);
      this.resolveAllThingsCleavesOnce(event, state, elapsedSeconds);
      this.cleanupClones(event, state, elapsedSeconds);
    });
  }

  syncBaitCast(event, state, elapsedSeconds) {
    if (elapsedSeconds >= event.baitCastStartTime && elapsedSeconds < event.baitCastEndTime) {
      state.startCast({
        id: event.baitCastId,
        label: event.baitCastName,
        startTime: event.baitCastStartTime,
        duration: BAIT_CAST_DURATION,
        sourceActionId: event.baitCastId
      });
      return;
    }

    state.clearCast(event.baitCastId);
  }

  spawnClonesOnce(event, state, elapsedSeconds) {
    const resolvedCloneSpawns = getMechanicSet(state, 'resolvedCloneSpawns');

    if (elapsedSeconds < event.cloneSpawnTime || resolvedCloneSpawns.has(event.wave)) {
      return;
    }

    const closestPlayers = getClosestPlayersToPoint(state.players, 0.5, 0.5).slice(0, CLONE_COUNT);

    closestPlayers.forEach((player, index) => {
      const effect = createMarkerEffect('aoe', {
        id: `forsaken-clone-spawn-hit-wave-${event.wave}-${player.roleId}-${index + 1}`,
        sourceRoleId: `clone-spawn-${event.wave}`,
        x: player.x,
        y: player.y,
        createdAt: elapsedSeconds,
        timerSeconds: 0,
        aoeRadius: CLONE_SPAWN_HIT_RADIUS,
        stackRadius: CLONE_SPAWN_HIT_RADIUS,
        coneLength: CLONE_SPAWN_HIT_RADIUS,
        coneDegrees: 360,
        coneFacingDegrees: 0,
        fireDuration: ALL_THINGS_VISUAL_DURATION,
        data: {
          wave: event.wave,
          cloneSpawnHit: true
        }
      });
      const firingEvent = effect.fire({
        players: state.players,
        elapsedSeconds
      });

      applyDamageToRoles(state, firingEvent.hitRoleIds, CLONE_SPAWN_HIT_DAMAGE);
      state.addMechanicObject(effect.toFiringMechanicObject({
        sourceActionId: event.cloneSpawnId
      }));
    });

    this.spawnCloneObjects(event, state);
    resolvedCloneSpawns.add(event.wave);
  }

  spawnCloneObjects(event, state) {
    const clonePositions = getCloneSpawnPositions();

    clonePositions.forEach((position, index) => {
      const target = pickRandomPlayer(state.players, getRandomSource(state));
      const clone = new MechanicObject({
        id: `forsaken-clone-wave-${event.wave}-${index + 1}`,
        type: 'boss-clone',
        x: position.x,
        y: position.y,
        radius: 0.074,
        label: `Clone ${index + 1}`,
        sourceActionId: event.cloneSpawnId,
        data: {
          icon: '/boss-target.svg',
          wave: event.wave,
          targetRoleId: target.roleId,
          rotationDegrees: getFacingDegrees(position, target),
          lockedRotation: false,
          cleaveTime: event.cleaveTime,
          endTime: event.cleaveTime + ALL_THINGS_VISUAL_DURATION
        }
      });

      state.addMechanicObject(clone);
    });

    const boss = state.getMechanicObjectById('forsaken-boss');
    const bossTarget = pickRandomPlayer(state.players, getRandomSource(state));

    if (boss && bossTarget) {
      boss.data.allThingsWave = event.wave;
      boss.data.targetRoleId = bossTarget.roleId;
      boss.data.rotationDegrees = getFacingDegrees(boss, bossTarget);
      boss.data.lockedRotation = false;
      boss.data.cleaveTime = event.cleaveTime;
    }
  }

  syncCloneFacing(event, state, elapsedSeconds) {
    if (elapsedSeconds < event.cloneSpawnTime || elapsedSeconds >= event.allThingsStartTime) {
      return;
    }

    getAllThingsSources(event, state).forEach((source) => {
      if (source.data?.lockedRotation) {
        return;
      }

      const target = state.getBotByRole(source.data?.targetRoleId);

      if (target) {
        source.data.rotationDegrees = getFacingDegrees(source, target);
      }
    });
  }

  lockAllThingsFacingOnce(event, state, elapsedSeconds) {
    const lockedWaves = getMechanicSet(state, 'lockedAllThingsCasts');

    if (elapsedSeconds < event.allThingsStartTime || lockedWaves.has(event.wave)) {
      return;
    }

    getAllThingsSources(event, state).forEach((source) => {
      const target = state.getBotByRole(source.data?.targetRoleId);

      if (target) {
        source.data.rotationDegrees = getFacingDegrees(source, target);
      }

      source.data.lockedRotation = true;
    });

    lockedWaves.add(event.wave);
  }

  syncAllThingsCast(event, state, elapsedSeconds) {
    if (elapsedSeconds >= event.allThingsStartTime && elapsedSeconds < event.cleaveTime) {
      state.startCast({
        id: event.allThingsCastId,
        label: 'All Things Ending',
        startTime: event.allThingsStartTime,
        duration: ALL_THINGS_CAST_DURATION,
        sourceActionId: event.allThingsCastId
      });
      return;
    }

    state.clearCast(event.allThingsCastId);
  }

  resolveAllThingsCleavesOnce(event, state, elapsedSeconds) {
    const resolvedCleaves = getMechanicSet(state, 'resolvedAllThingsCleaves');

    if (elapsedSeconds < event.cleaveTime || resolvedCleaves.has(event.wave)) {
      return;
    }

    getAllThingsSources(event, state).forEach((source) => {
      const cleaveFacingDegrees = getAllThingsCleaveFacingDegrees(event, source);
      const effect = createMarkerEffect('cone', {
        id: `forsaken-all-things-cleave-wave-${event.wave}-${source.id}`,
        sourceRoleId: source.id,
        x: source.x,
        y: source.y,
        createdAt: elapsedSeconds,
        timerSeconds: 0,
        aoeRadius: ALL_THINGS_CLEAVE_LENGTH,
        stackRadius: ALL_THINGS_CLEAVE_LENGTH,
        coneLength: ALL_THINGS_CLEAVE_LENGTH,
        coneDegrees: ALL_THINGS_CLEAVE_DEGREES,
        coneFacingDegrees: cleaveFacingDegrees,
        fireDuration: ALL_THINGS_VISUAL_DURATION,
        data: {
          wave: event.wave,
          allThingsEnding: true,
          baitCastName: event.baitCastName
        }
      });
      const firingEvent = effect.fire({
        players: state.players,
        elapsedSeconds,
        facingDegrees: cleaveFacingDegrees,
        data: {
          targetRoleId: source.data?.targetRoleId,
          baitCastName: event.baitCastName,
          cleaveFacingDegrees
        }
      });

      applyDamageToRoles(state, firingEvent.hitRoleIds, ALL_THINGS_CLEAVE_DAMAGE);
      state.addMechanicObject(effect.toFiringMechanicObject({
        sourceActionId: event.cleaveId
      }));
    });

    resolvedCleaves.add(event.wave);
  }

  cleanupClones(event, state, elapsedSeconds) {
    if (elapsedSeconds < event.cleaveTime + ALL_THINGS_VISUAL_DURATION) {
      return;
    }

    state.clearMechanicObjects((object) => (
      object.type === 'boss-clone'
      && object.data?.wave === event.wave
      && object.data?.endTime <= elapsedSeconds
    ));
  }

  syncLightOfJudgement(state, elapsedSeconds) {
    if (elapsedSeconds < LIGHT_OF_JUDGEMENT_TIME || state.getMechanicData('resolvedLightOfJudgement')) {
      return;
    }

    const raidwide = new RaidwideEffect({
      id: 'forsaken-light-of-judgement',
      label: 'Light of Judgement',
      damage: LIGHT_OF_JUDGEMENT_DAMAGE,
      createdAt: LIGHT_OF_JUDGEMENT_TIME,
      fireDuration: ALL_THINGS_VISUAL_DURATION,
      data: {
        lightOfJudgement: true
      }
    });
    const raidwideEvent = raidwide.fire({
      players: state.players,
      elapsedSeconds
    });
    const killedByDebuff = [];

    state.players.forEach((player) => {
      if (hasActiveDebuff(player, SPELLS_TROUBLE_DEBUFF.id)) {
        player.takeDamage(player.maxHp);
        killedByDebuff.push(player.roleId);
      }
    });

    state.addMechanicObject(raidwide.toMechanicObject({
      sourceActionId: 'loj'
    }));
    state.setMechanicData('resolvedLightOfJudgement', true);
    state.setMechanicData('lightOfJudgementResult', {
      resolvedAt: elapsedSeconds,
      damage: raidwideEvent.damage,
      hitRoleIds: raidwideEvent.hitRoleIds,
      killedByDebuff
    });
  }

  resolveTowerWaveOnce(wave, state, elapsedSeconds) {
    const resolvedWaves = getResolvedTowerWaves(state);

    if (resolvedWaves.has(wave.wave)) {
      return;
    }

    const towerSnapshots = wave.position.towers.map((tower, index) => {
      const radius = tower.radius ?? wave.position.radius ?? DEFAULT_TOWER_RADIUS;
      const occupants = state.players.filter((player) => (
        isPlayerInTower(player, tower, radius)
      ));

      return {
        wave: wave.wave,
        marker: wave.position.marker,
        towerIndex: index,
        towerLabel: tower.label,
        tower: { ...tower, radius },
        occupants,
        occupantRoleIds: occupants.map((player) => player.roleId),
        resolvedAt: elapsedSeconds,
        events: []
      };
    });

    towerSnapshots.forEach((snapshot) => {
      this.towerRules.forEach((rule) => {
        rule.apply({
          snapshot,
          towerSnapshots,
          wave,
          state,
          mechanic: this,
          elapsedSeconds
        });
      });
    });

    this.waveRules.forEach((rule) => {
      rule.apply({
        towerSnapshots,
        wave,
        state,
        mechanic: this,
        elapsedSeconds
      });
    });

    resolvedWaves.add(wave.wave);
    state.getMechanicData('towerSnapshots').push(...towerSnapshots);
  }

  resolveStoredMarker(player, snapshot, state, elapsedSeconds) {
    const storedMarkers = getStoredMarkerMap(state);
    const markerType = storedMarkers[player.roleId];

    if (!markerType) {
      snapshot.events.push({
        type: 'stored-marker-missing',
        roleId: player.roleId
      });
      return;
    }

    const effectConfig = getMarkerEffectConfig(state);
    const effect = createMarkerEffect(markerType, {
      id: `forsaken-${markerType}-wave-${snapshot.wave}-${player.roleId}`,
      sourceRoleId: player.roleId,
      x: player.x,
      y: player.y,
      createdAt: elapsedSeconds,
      timerSeconds: 0,
      pendingDuration: effectConfig.pendingDuration,
      fireDuration: effectConfig.fireDuration ?? effectConfig.displayDuration,
      ...effectConfig,
      data: {
        wave: snapshot.wave,
        towerIndex: snapshot.towerIndex,
        towerLabel: snapshot.towerLabel
      }
    });
    const fireOptions = this.getMarkerFireOptions({
      markerType,
      sourcePlayer: player,
      state
    });
    const firingEvent = effect.fire({
      players: state.players,
      elapsedSeconds,
      ...fireOptions
    });
    const hitRoleIds = firingEvent.hitRoleIds;
    const damageResult = applyForsakenStoredMarkerDamage({
      state,
      markerType,
      hitRoleIds
    });

    delete storedMarkers[player.roleId];

    state.addMechanicObject(effect.toFiringMechanicObject({
      sourceActionId: `forsaken-marker-effect-wave-${snapshot.wave}`
    }));
    state.getMechanicData('markerResolves').push({
      wave: snapshot.wave,
      towerLabel: snapshot.towerLabel,
      roleId: player.roleId,
      markerType,
      hitRoleIds,
      damage: damageResult.damage,
      stackRequirement: damageResult.stackRequirement,
      stackRequirementMet: damageResult.stackRequirementMet,
      resolvedAt: elapsedSeconds
    });
    snapshot.events.push({
      type: 'stored-marker-resolve',
      roleId: player.roleId,
      markerType,
      hitRoleIds,
      damage: damageResult.damage,
      stackRequirement: damageResult.stackRequirement,
      stackRequirementMet: damageResult.stackRequirementMet
    });
  }

  getMarkerFireOptions({ markerType, sourcePlayer, state }) {
    if (markerType !== 'cone') {
      return {};
    }

    const nearestPlayer = findNearestOtherPlayer(sourcePlayer, state.players);

    if (!nearestPlayer) {
      return {};
    }

    return {
      facingDegrees: getFacingDegrees(sourcePlayer, nearestPlayer),
      data: {
        facingTargetRoleId: nearestPlayer.roleId
      }
    };
  }

  assignNextStoredMarkers(towerSnapshots, wave, state, elapsedSeconds) {
    if (wave.wave >= TOWER_WAVE_COUNT - 1) {
      return;
    }

    const randomSource = getRandomSource(state);
    const markerOrder = randomSource.bool() ? ['cone', 'aoe'] : ['aoe', 'cone'];
    const assignments = [];

    towerSnapshots.forEach((snapshot, index) => {
      if (snapshot.occupants.length === 0) {
        return;
      }

      if (wave.wave % 2 === 1) {
        snapshot.occupants.forEach((player) => {
          assignments.push(assignStoredMarker({
            state,
            player,
            markerType: markerOrder[index],
            shownAt: elapsedSeconds
          }));
        });
        return;
      }

      const stackPlayer = pickRandomPlayer(snapshot.occupants, randomSource);

      snapshot.occupants.forEach((player) => {
        assignments.push(assignStoredMarker({
          state,
          player,
          markerType: player === stackPlayer ? 'stack' : markerOrder[index],
          shownAt: elapsedSeconds
        }));
      });
    });

    state.getMechanicData('nextMarkerAssignments').push({
      wave: wave.wave,
      assignedAt: elapsedSeconds,
      assignments
    });
  }

  syncMarkerEffects(state, elapsedSeconds) {
    state.clearMechanicObjects((object) => (
      (object.type === 'marker-effect' || object.type === 'raidwide-effect')
      && object.data.endTime <= elapsedSeconds
    ));
  }

  ensureBossSpawned(state) {
    if (state.getMechanicObjectById('forsaken-boss')) {
      return;
    }

    state.addMechanicObject(new MechanicObject({
      id: 'forsaken-boss',
      type: 'boss-target',
      x: 0.5,
      y: 0.5,
      radius: 0.128,
      label: 'Boss',
      sourceActionId: 'forsaken-start',
      data: {
        icon: '/boss-target.svg'
      }
    }));
  }
}

function createTowerWaveActions() {
  return Array.from({ length: TOWER_WAVE_COUNT - 1 }, (_, index) => {
    const wave = index + 2;
    const time = TOWER_WAVE_START_TIME + (wave - 1) * TOWER_ACTIVE_DURATION;

    return {
      id: `tower-wave-${wave}`,
      type: 'tower-wave',
      time,
      title: `Tower wave ${wave}`,
      callout: 'Previous towers resolve red as the next tower pair spawns.',
      detail: 'Forsaken uses the stored random start position and rotation direction to choose this wave.',
      payload: { wave }
    };
  });
}

function createEvenTowerTimelineActions() {
  return EVEN_TOWER_WAVES.flatMap((wave) => {
    const timing = getEvenTowerTiming(wave);

    return [
      {
        id: `bait-cast-wave-${wave}`,
        type: 'bait-cast',
        time: timing.baitCastStartTime,
        title: `Tower ${wave} - Future/Past`,
        callout: "Boss starts either Future's End or Past's End.",
        detail: 'The cast lasts 7 seconds. One second later, clones spawn and hit the four closest players with small AoEs.',
        payload: { wave }
      },
      {
        id: `clone-spawn-wave-${wave}`,
        type: 'clone-spawn',
        time: timing.cloneSpawnTime,
        title: `Tower ${wave} - Clone spawn`,
        callout: 'Four clones spawn in the middle and small AoEs hit the closest players.',
        detail: 'Each clone and the boss pick a random player to face. Their rotation continues updating until All Things Ending starts.',
        payload: { wave }
      },
      {
        id: `all-things-cast-wave-${wave}`,
        type: 'all-things-cast',
        time: timing.allThingsStartTime,
        title: `Tower ${wave} - All Things Ending`,
        callout: 'Boss and clones lock facing and begin casting All Things Ending.',
        detail: 'The cast lasts 4 seconds. When it finishes, each source fires a 180 degree cleave.',
        payload: { wave }
      },
      {
        id: `all-things-cleave-wave-${wave}`,
        type: 'all-things-cleave',
        time: timing.cleaveTime,
        title: `Tower ${wave} - Cleaves`,
        callout: 'Boss and clones fire locked 180 degree cleaves.',
        detail: "Each cleave is 50% arena length and deals lethal damage. Future's End cleaves forward; Past's End cleaves behind the source. Clones disappear after the cleave resolves.",
        payload: { wave }
      }
    ];
  });
}

function FinalTowerResolve() {
  return {
    id: 'tower-final-resolve',
    type: 'tower-resolve',
    time: TOWER_FINAL_RESOLVE_TIME,
    title: 'Final tower resolve',
    callout: 'The eighth tower pair turns red, then all towers clear.',
    detail: 'No new tower pair spawns after this final resolve window.',
    payload: { wave: TOWER_WAVE_COUNT }
  };
}

function createTowerSequence(randomSource = DEFAULT_RANDOM_SOURCE, avoidSignature = null, options = {}) {
  if (options.fixedMarker) {
    return createFixedTowerSequence(options.fixedMarker);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sequence = createTowerSequenceCandidate(randomSource);

    if (!avoidSignature || getTowerSequenceSignature(sequence) !== avoidSignature) {
      return sequence;
    }
  }

  return createTowerSequenceCandidate(randomSource);
}

function createFixedTowerSequence(marker) {
  const positionIndex = POSSIBLE_TOWER_POSITIONS.findIndex((position) => position.marker === marker);
  const fixedIndex = positionIndex >= 0 ? positionIndex : 0;
  const position = POSSIBLE_TOWER_POSITIONS[fixedIndex];
  const direction = 'fixed';
  const waves = Array.from({ length: TOWER_WAVE_COUNT }, (_, index) => {
    const startTime = TOWER_WAVE_START_TIME + index * TOWER_ACTIVE_DURATION;

    return {
      wave: index + 1,
      direction,
      positionIndex: fixedIndex,
      position,
      startTime,
      resolveStartTime: startTime + TOWER_ACTIVE_DURATION,
      endTime: startTime + TOWER_ACTIVE_DURATION + TOWER_RESOLVE_DURATION
    };
  });

  return {
    startIndex: fixedIndex,
    startMarker: position.marker,
    direction,
    fixedMarker: position.marker,
    waves
  };
}

function createTowerSequenceCandidate(randomSource) {
  const startIndex = randomSource.int(POSSIBLE_TOWER_POSITIONS.length);
  const direction = randomSource.bool() ? 'clockwise' : 'counterclockwise';
  const step = direction === 'clockwise' ? 1 : -1;
  const waves = Array.from({ length: TOWER_WAVE_COUNT }, (_, index) => {
    const positionIndex = modulo(startIndex + step * index, POSSIBLE_TOWER_POSITIONS.length);
    const position = POSSIBLE_TOWER_POSITIONS[positionIndex];
    const startTime = TOWER_WAVE_START_TIME + index * TOWER_ACTIVE_DURATION;

    return {
      wave: index + 1,
      direction,
      positionIndex,
      position,
      startTime,
      resolveStartTime: startTime + TOWER_ACTIVE_DURATION,
      endTime: startTime + TOWER_ACTIVE_DURATION + TOWER_RESOLVE_DURATION
    };
  });

  return {
    startIndex,
    startMarker: POSSIBLE_TOWER_POSITIONS[startIndex].marker,
    direction,
    waves
  };
}

function createEvenTowerEvents(randomSource = DEFAULT_RANDOM_SOURCE) {
  return EVEN_TOWER_WAVES.map((wave) => {
    const timing = getEvenTowerTiming(wave);
    const baitCastName = randomSource.choice(BAIT_CAST_OPTIONS);
    const eventSlug = baitCastName.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

    return {
      wave,
      baitCastName,
      baitCastId: `forsaken-${eventSlug}-wave-${wave}`,
      cloneSpawnId: `forsaken-clone-spawn-wave-${wave}`,
      allThingsCastId: `forsaken-all-things-ending-wave-${wave}`,
      cleaveId: `forsaken-all-things-cleave-wave-${wave}`,
      ...timing
    };
  });
}

function getEvenTowerTiming(wave) {
  const towerStartTime = TOWER_WAVE_START_TIME + (wave - 1) * TOWER_ACTIVE_DURATION;
  const towerResolveTime = towerStartTime + TOWER_ACTIVE_DURATION;
  const baitCastStartTime = towerResolveTime - BAIT_CAST_LEAD_TIME;
  const baitCastEndTime = baitCastStartTime + BAIT_CAST_DURATION;
  const cloneSpawnTime = baitCastEndTime + CLONE_SPAWN_DELAY;
  const allThingsStartTime = baitCastEndTime + ALL_THINGS_START_DELAY;
  const cleaveTime = allThingsStartTime + ALL_THINGS_CAST_DURATION;

  return {
    towerStartTime,
    towerResolveTime,
    baitCastStartTime,
    baitCastEndTime,
    cloneSpawnTime,
    allThingsStartTime,
    cleaveTime
  };
}

function getOrCreateTowerSequence(state) {
  let sequence = state.getMechanicData('towerSequence');

  if (!sequence) {
    sequence = createTowerSequence(getRandomSource(state));
    state.setMechanicData('towerSequence', sequence);
    state.setMechanicData('towerDirection', sequence.direction);
    state.setMechanicData('towerStartPosition', sequence.startMarker);
  }

  return sequence;
}

export function getForsakenTowerRoles(position) {
  const markerPoint = getTowerPairMarkerPoint(position);
  const direction = {
    x: markerPoint.x - 0.5,
    y: markerPoint.y - 0.5
  };
  const rankedTowers = position.towers
    .map((tower) => ({
      tower,
      side: cross2d(direction, {
        x: tower.x - 0.5,
        y: tower.y - 0.5
      })
    }))
    .sort((a, b) => a.side - b.side);

  return new Map([
    [rankedTowers[0]?.tower, 'aoe'],
    [rankedTowers[rankedTowers.length - 1]?.tower, 'cone']
  ]);
}

function getTowerPairMarkerPoint(position) {
  const sum = position.towers.reduce((total, tower) => ({
    x: total.x + tower.x,
    y: total.y + tower.y
  }), { x: 0, y: 0 });

  return {
    x: sum.x / position.towers.length,
    y: sum.y / position.towers.length
  };
}

function getEvenTowerEvents(state) {
  let events = state.getMechanicData('evenTowerEvents');

  if (!events) {
    events = createEvenTowerEvents(getRandomSource(state));
    state.setMechanicData('evenTowerEvents', events);
  }

  return events;
}

function getMechanicSet(state, key) {
  let set = state.getMechanicData(key);

  if (!set) {
    set = new Set();
    state.setMechanicData(key, set);
  }

  return set;
}

function getTowerWavePhase(wave, elapsedSeconds) {
  if (elapsedSeconds >= wave.startTime && elapsedSeconds < wave.resolveStartTime) {
    return 'active';
  }

  if (elapsedSeconds >= wave.resolveStartTime && elapsedSeconds < wave.endTime) {
    return 'resolving';
  }

  return null;
}

function getResolvedTowerWaves(state) {
  let resolvedWaves = state.getMechanicData('resolvedTowerWaves');

  if (!resolvedWaves) {
    resolvedWaves = new Set();
    state.setMechanicData('resolvedTowerWaves', resolvedWaves);
  }

  return resolvedWaves;
}

function getStoredMarkerMap(state) {
  let storedMarkers = state.getMechanicData('storedMarkers');

  if (!storedMarkers) {
    storedMarkers = {};
    state.setMechanicData('storedMarkers', storedMarkers);
  }

  return storedMarkers;
}

function getMarkerEffectConfig(state) {
  return {
    ...DEFAULT_MARKER_EFFECT_CONFIG,
    ...state.getMechanicData('markerEffectConfig')
  };
}

function applyStoredMarkerAssignments({ state, assignments, shownAt, holdSeconds, fadeoutSeconds }) {
  Object.entries(assignments).forEach(([roleId, markerType]) => {
    const player = state.getBotByRole(roleId);

    if (!player) {
      return;
    }

    assignStoredMarker({
      state,
      player,
      markerType,
      shownAt,
      holdSeconds,
      fadeoutSeconds
    });
  });
}

function assignStoredMarker({
  state,
  player,
  markerType,
  shownAt,
  holdSeconds = FORSAKEN_MARKER_VISIBILITY.holdSeconds,
  fadeoutSeconds = FORSAKEN_MARKER_VISIBILITY.fadeoutSeconds
}) {
  const storedMarkers = getStoredMarkerMap(state);

  storedMarkers[player.roleId] = markerType;
  state.showPlayerMarker(player.roleId, {
    type: markerType,
    startTime: shownAt
  }, fadeoutSeconds, {
    startTime: shownAt,
    holdSeconds
  });

  return {
    roleId: player.roleId,
    markerType
  };
}

function isPlayerInTower(player, tower, radius) {
  return Math.hypot(player.x - tower.x, player.y - tower.y) <= radius;
}

function getAllThingsSources(event, state) {
  const boss = state.getMechanicObjectById('forsaken-boss');
  const clones = state.mechanicObjects.filter((object) => (
    object.type === 'boss-clone' && object.data?.wave === event.wave
  ));

  return [
    ...(boss?.data?.allThingsWave === event.wave ? [boss] : []),
    ...clones
  ];
}

function getAllThingsCleaveFacingDegrees(event, source) {
  const lockedRotationDegrees = source.data?.rotationDegrees ?? 0;

  if (event.baitCastName === "Past's End") {
    return normalizeDegrees(lockedRotationDegrees + 180);
  }

  return normalizeDegrees(lockedRotationDegrees);
}

function getCloneSpawnPositions() {
  return Array.from({ length: CLONE_COUNT }, () => ({ x: 0.5, y: 0.5 }));
}

function getClosestPlayersToPoint(players, x, y) {
  return [...players].sort((a, b) => (
    Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)
  ));
}

function applyDamageToRoles(state, roleIds, amount) {
  unique(roleIds).forEach((roleId) => {
    state.getBotByRole(roleId)?.takeDamage(amount);
  });
}

function applyForsakenStoredMarkerDamage({ state, markerType, hitRoleIds }) {
  const uniqueHitRoleIds = unique(hitRoleIds);
  let damage = 0;
  let stackRequirement = null;
  let stackRequirementMet = null;

  if (markerType === 'cone') {
    damage = PLAYER_CONE_DAMAGE;
  } else if (markerType === 'aoe') {
    damage = PLAYER_AOE_DAMAGE;
  } else if (markerType === 'stack') {
    stackRequirement = FORSAKEN_PLAYER_STACK_REQUIRED_COUNT;
    stackRequirementMet = uniqueHitRoleIds.length >= stackRequirement;
    damage = stackRequirementMet ? PLAYER_STACK_DAMAGE : PLAYER_STACK_FAILED_DAMAGE;
  }

  if (damage > 0) {
    applyDamageToRoles(state, uniqueHitRoleIds, damage);
  }

  return {
    damage,
    hitRoleIds: uniqueHitRoleIds,
    stackRequirement,
    stackRequirementMet
  };
}

function hasActiveDebuff(player, debuffId) {
  return player.debuffs.some((debuff) => debuff.id === debuffId && debuff.stacks > 0);
}

function getRunRandomSource(encounter) {
  return encounter?.randomSource ?? DEFAULT_RANDOM_SOURCE;
}

function getRandomSource(state) {
  return state.getMechanicData('randomSource') ?? DEFAULT_RANDOM_SOURCE;
}

function getTowerSequenceSignature(sequence) {
  if (!sequence) {
    return null;
  }

  return `${sequence.startMarker}:${sequence.direction}`;
}

function getOpeningMarkerSignature(assignments) {
  if (!assignments?.markers) {
    return null;
  }

  return ['MT', 'OT', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2']
    .map((roleId) => `${roleId}:${assignments.markers[roleId] ?? '-'}`)
    .join('|');
}

function pickRandomPlayer(players, randomSource = DEFAULT_RANDOM_SOURCE) {
  return randomSource.choice(players);
}

function findNearestOtherPlayer(sourcePlayer, players) {
  return players
    .filter((player) => player.roleId !== sourcePlayer.roleId)
    .map((player) => ({
      player,
      distance: Math.hypot(player.x - sourcePlayer.x, player.y - sourcePlayer.y)
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.player ?? null;
}

function getFacingDegrees(sourcePlayer, targetPlayer) {
  return Math.atan2(targetPlayer.y - sourcePlayer.y, targetPlayer.x - sourcePlayer.x) * (180 / Math.PI);
}

function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function unique(values) {
  return [...new Set(values)];
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function cross2d(a, b) {
  return a.x * b.y - a.y * b.x;
}

function ForsakenCast() {
  return {
    id: 'forsaken-cast',
    type: 'cast',
    time: 2,
    title: 'Forsaken cast',
    callout: 'Boss starts casting Forsaken.',
    detail: 'The Forsaken cast lasts 7.5 seconds before the first visual tell sequence.',
    payload: {
      cast: {
        id: 'forsaken-cast',
        label: 'Forsaken',
        startTime: 2,
        duration: 7.5
      }
    }
  };
}

function ScreenFlash(castAction) {
  const cast = castAction.payload.cast;
  const startTime = cast.startTime + cast.duration + 1.5;

  return {
    id: 'screen-flash',
    type: 'screen-flash',
    time: startTime,
    title: 'Screen flash',
    callout: 'Arena flashes white after the cast delay.',
    detail: 'The flash lasts 1 second, then player markers appear above each bot.',
    payload: {
      flash: {
        id: 'forsaken-screen-flash',
        startTime,
        duration: 1,
        color: '#ffffff'
      }
    }
  };
}

function MarkerSpawn(flashAction) {
  const flash = flashAction.payload.flash;
  const startTime = flash.startTime + flash.duration;

  return {
    id: 'marker-spawn',
    type: 'marker-spawn',
    time: startTime,
    title: 'Marker + tower spawn',
    callout: 'Cone, AoE, and stack markers appear as the first tower pair spawns.',
    detail: 'Either supports or DPS receive cones, the other group receives AoEs, then one support and one DPS are changed to stack markers. Forsaken also rolls its initial tower position and rotation direction.',
    payload: {
      markers: {
        id: 'forsaken-opening-markers',
        startTime,
        visibleDuration: 5,
        fadeDuration: 1
      }
    }
  };
}

export function createForsakenOpeningMarkerAssignments(
  players,
  randomSource = DEFAULT_RANDOM_SOURCE,
  avoidSignature = null,
  options = {}
) {
  return createOpeningMarkerAssignments(players, randomSource, avoidSignature, options);
}

function createOpeningMarkerAssignments(
  players,
  randomSource = DEFAULT_RANDOM_SOURCE,
  avoidSignature = null,
  options = {}
) {
  let matchingAssignment = null;

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const assignments = createOpeningMarkerAssignmentCandidate(players, randomSource);

    if (!openingMarkerAssignmentMatchesOptions(assignments, options)) {
      continue;
    }

    matchingAssignment ??= assignments;

    if (!avoidSignature || getOpeningMarkerSignature(assignments) !== avoidSignature) {
      return assignments;
    }
  }

  if (matchingAssignment) {
    return matchingAssignment;
  }

  return createOpeningMarkerAssignmentCandidate(players, randomSource);
}

function createOpeningMarkerAssignmentCandidate(players, randomSource) {
  const coneGroup = randomSource.bool() ? 'supports' : 'dps';
  const aoeGroup = coneGroup === 'supports' ? 'dps' : 'supports';
  const supportStackRole = pickRandomRole(players, ROLE_GROUPS.supports, randomSource);
  const dpsStackRole = pickRandomRole(players, ROLE_GROUPS.dps, randomSource);
  const markers = {};

  ROLE_GROUPS[coneGroup].forEach((roleId) => {
    markers[roleId] = 'cone';
  });

  ROLE_GROUPS[aoeGroup].forEach((roleId) => {
    markers[roleId] = 'aoe';
  });

  markers[supportStackRole] = 'stack';
  markers[dpsStackRole] = 'stack';

  return {
    coneGroup,
    aoeGroup,
    stackRoles: [supportStackRole, dpsStackRole],
    markers
  };
}

function openingMarkerAssignmentMatchesOptions(assignments, options = {}) {
  const forcedGroup = normalizeOpeningMarkerGroup(options.forcedGroup);
  const forcedRoleId = options.forcedRoleId ?? null;

  if (!forcedGroup || !forcedRoleId) {
    return true;
  }

  return getOpeningMarkerGroupForRole(assignments.markers, forcedRoleId) === forcedGroup;
}

function normalizeOpeningMarkerGroup(groupKey) {
  return groupKey === 'groupA' || groupKey === 'groupB' ? groupKey : null;
}

function getOpeningMarkerGroupForRole(markers, roleId) {
  const pair = FORSAKEN_MARKER_PAIR_GROUPS.find((roleIds) => roleIds.includes(roleId));

  if (!pair) {
    return null;
  }

  const [firstRoleId, secondRoleId] = pair;
  const firstMarker = markers[firstRoleId];
  const secondMarker = markers[secondRoleId];

  if (!firstMarker || !secondMarker) {
    return null;
  }

  return firstMarker === secondMarker ? 'groupB' : 'groupA';
}

function pickRandomRole(players, roleIds, randomSource = DEFAULT_RANDOM_SOURCE) {
  const presentRoleIds = roleIds.filter((roleId) => players.some((player) => player.roleId === roleId));

  return randomSource.choice(presentRoleIds);
}
