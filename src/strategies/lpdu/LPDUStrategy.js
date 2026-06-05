import { BaseStrategy } from '../../core/BaseStrategy.js';
import {
  absolutePosition,
  conditionBasedMovement,
  timeBasedMovement
} from '../../core/StrategyMovement.js';

const FORSAKEN_CAST_LINEUP_POSITIONS = {
  MT: { x: 0.307, y: 0.447 },
  OT: { x: 0.315, y: 0.603 },
  H1: { x: 0.36, y: 0.335 },
  H2: { x: 0.382, y: 0.694 },
  M1: { x: 0.695, y: 0.446 },
  M2: { x: 0.679, y: 0.613 },
  R1: { x: 0.63, y: 0.344 },
  R2: { x: 0.591, y: 0.696 }
};

const FORSAKEN_MARKER_PAIR_GROUPS = [
  ['MT', 'H1'],
  ['OT', 'H2'],
  ['M1', 'R1'],
  ['M2', 'R2']
];
const ODD_TOWER_WAVES = [1, 3, 5, 7];
const EVEN_TOWER_WAVES = [2, 4, 6, 8];
const ODD_TOWER_MOVEMENT_DELAY = 1.5;
const EVEN_TOWER_MOVEMENT_DELAY = 1.5;
const EVEN_TOWER_BAIT_MOVEMENT_DELAY = ODD_TOWER_MOVEMENT_DELAY;
const ALL_THINGS_NEXT_TOWER_MOVE_DELAY = 1;
const FINAL_SPREAD_AFTER_CLEAVE_DELAY = 1;
const BOT_REVEAL_LEAD_TIME = 1;
const FINAL_TOWER_WAVE = 8;
const SET_ONE_STACK_MODES = {
  buddy: 'buddy',
  supportDpsPriority: 'supportDpsPriority'
};
const GROUP_B_HELPER_TOWERS = new Set([1, 2, 3, 8]);
const ROLE_CATEGORIES = {
  tanks: ['MT', 'OT'],
  healers: ['H1', 'H2'],
  melee: ['M1', 'M2'],
  ranged: ['R1', 'R2']
};
const ARENA_CENTER = { x: 0.5, y: 0.5 };
const ODD_TOWER_SLOT_IDS = {
  tankHelper: 'tankHelper',
  healerHelper: 'healerHelper',
  dpsHelper1: 'dpsHelper1',
  dpsHelper2: 'dpsHelper2',
  activeCone: 'activeCone',
  activeAoe: 'activeAoe',
  coneStackBuddy: 'coneStackBuddy',
  aoeStackBuddy: 'aoeStackBuddy'
};
const ODD_TOWER_SLOT_LABELS = {
  [ODD_TOWER_SLOT_IDS.tankHelper]: 'Tank Helper',
  [ODD_TOWER_SLOT_IDS.healerHelper]: 'Healer Helper',
  [ODD_TOWER_SLOT_IDS.dpsHelper1]: 'DPS Helper1',
  [ODD_TOWER_SLOT_IDS.dpsHelper2]: 'DPS Helper2',
  [ODD_TOWER_SLOT_IDS.activeCone]: 'Active Cone',
  [ODD_TOWER_SLOT_IDS.activeAoe]: 'Active AOE',
  [ODD_TOWER_SLOT_IDS.coneStackBuddy]: 'Cone Stack Buddy',
  [ODD_TOWER_SLOT_IDS.aoeStackBuddy]: 'AOE Stack Buddy'
};
const EVEN_TOWER_SLOT_IDS = {
  tankHelper: 'tankHelper',
  healerHelper: 'healerHelper',
  dpsHelper1: 'dpsHelper1',
  dpsHelper2: 'dpsHelper2',
  coneTowerCleave: 'coneTowerCleave',
  coneTowerAoe: 'coneTowerAoe',
  circleTowerCleave: 'circleTowerCleave',
  circleTowerAoe: 'circleTowerAoe'
};
const EVEN_TOWER_SLOT_LABELS = {
  [EVEN_TOWER_SLOT_IDS.tankHelper]: 'Tank Helper',
  [EVEN_TOWER_SLOT_IDS.healerHelper]: 'Healer Helper',
  [EVEN_TOWER_SLOT_IDS.dpsHelper1]: 'DPS Helper1',
  [EVEN_TOWER_SLOT_IDS.dpsHelper2]: 'DPS Helper2',
  [EVEN_TOWER_SLOT_IDS.coneTowerCleave]: 'Cone Tower Cleave',
  [EVEN_TOWER_SLOT_IDS.coneTowerAoe]: 'Cone Tower AOE',
  [EVEN_TOWER_SLOT_IDS.circleTowerCleave]: 'Circle Tower Cleave',
  [EVEN_TOWER_SLOT_IDS.circleTowerAoe]: 'Circle Tower AOE'
};
const D_FACING_TOWER_CENTERS = {
  cone: { x: 0.358, y: 0.385 },
  aoe: { x: 0.358, y: 0.615 }
};
const ONE_FACING_TOWER_CENTERS = {
  cone: { x: 0.481, y: 0.318 },
  aoe: { x: 0.318, y: 0.481 }
};
const A_FACING_TOWER_MARKER_POINT = { x: 0.5, y: 0.358 };
const ODD_TOWER_SLOT_TOWER_TYPES = {
  [ODD_TOWER_SLOT_IDS.tankHelper]: 'cone',
  [ODD_TOWER_SLOT_IDS.healerHelper]: 'cone',
  [ODD_TOWER_SLOT_IDS.coneStackBuddy]: 'cone',
  [ODD_TOWER_SLOT_IDS.activeCone]: 'cone',
  [ODD_TOWER_SLOT_IDS.activeAoe]: 'aoe',
  [ODD_TOWER_SLOT_IDS.aoeStackBuddy]: 'aoe',
  [ODD_TOWER_SLOT_IDS.dpsHelper1]: 'aoe',
  [ODD_TOWER_SLOT_IDS.dpsHelper2]: 'aoe'
};
const EVEN_TOWER_SLOT_TOWER_TYPES = {
  [EVEN_TOWER_SLOT_IDS.tankHelper]: 'cone',
  [EVEN_TOWER_SLOT_IDS.healerHelper]: 'cone',
  [EVEN_TOWER_SLOT_IDS.dpsHelper1]: 'aoe',
  [EVEN_TOWER_SLOT_IDS.dpsHelper2]: 'aoe',
  [EVEN_TOWER_SLOT_IDS.coneTowerCleave]: 'cone',
  [EVEN_TOWER_SLOT_IDS.coneTowerAoe]: 'cone',
  [EVEN_TOWER_SLOT_IDS.circleTowerCleave]: 'aoe',
  [EVEN_TOWER_SLOT_IDS.circleTowerAoe]: 'aoe'
};
const ODD_TOWER_D_FACING_SLOT_POSITIONS = {
  [ODD_TOWER_SLOT_IDS.tankHelper]: { x: 0.475, y: 0.351 },
  [ODD_TOWER_SLOT_IDS.healerHelper]: { x: 0.269, y: 0.297 },
  [ODD_TOWER_SLOT_IDS.coneStackBuddy]: { x: 0.324, y: 0.347 },
  [ODD_TOWER_SLOT_IDS.activeCone]: { x: 0.416, y: 0.377 },
  [ODD_TOWER_SLOT_IDS.activeAoe]: { x: 0.401, y: 0.668 },
  [ODD_TOWER_SLOT_IDS.aoeStackBuddy]: { x: 0.321, y: 0.581 },
  [ODD_TOWER_SLOT_IDS.dpsHelper1]: { x: 0.301, y: 0.519 },
  [ODD_TOWER_SLOT_IDS.dpsHelper2]: { x: 0.262, y: 0.549 }
};
const EVEN_TOWER_ONE_FACING_SLOT_POSITIONS = {
  [EVEN_TOWER_SLOT_IDS.tankHelper]: { x: 0.64, y: 0.491 },
  [EVEN_TOWER_SLOT_IDS.healerHelper]: { x: 0.595, y: 0.299 },
  [EVEN_TOWER_SLOT_IDS.dpsHelper1]: { x: 0.526, y: 0.629 },
  [EVEN_TOWER_SLOT_IDS.dpsHelper2]: { x: 0.336, y: 0.59 },
  [EVEN_TOWER_SLOT_IDS.coneTowerCleave]: { x: 0.523, y: 0.373 },
  [EVEN_TOWER_SLOT_IDS.coneTowerAoe]: { x: 0.447, y: 0.253 },
  [EVEN_TOWER_SLOT_IDS.circleTowerCleave]: { x: 0.376, y: 0.507 },
  [EVEN_TOWER_SLOT_IDS.circleTowerAoe]: { x: 0.264, y: 0.445 }
};
const PAST_END_A_FACING_BAIT_POSITIONS = {
  MT: { x: 0.502, y: 0.33 },
  OT: { x: 0.486, y: 0.329 },
  H1: { x: 0.491, y: 0.357 },
  H2: { x: 0.502, y: 0.361 },
  M1: { x: 0.501, y: 0.366 },
  M2: { x: 0.507, y: 0.353 },
  R1: { x: 0.51, y: 0.342 },
  R2: { x: 0.498, y: 0.332 }
};
const FUTURE_END_A_FACING_BAIT_POSITIONS = {
  MT: { x: 0.5, y: 0.663 },
  OT: { x: 0.516, y: 0.681 },
  H1: { x: 0.476, y: 0.659 },
  H2: { x: 0.513, y: 0.666 },
  M1: { x: 0.482, y: 0.699 },
  M2: { x: 0.51, y: 0.69 },
  R1: { x: 0.481, y: 0.671 },
  R2: { x: 0.495, y: 0.667 }
};
const FINAL_SPREAD_BOSS_RELATIVE_POSITIONS = {
  MT: { x: 0.507, y: 0.303 },
  OT: { x: 0.672, y: 0.408 },
  H1: { x: 0.476, y: 0.733 },
  H2: { x: 0.698, y: 0.698 },
  M1: { x: 0.54, y: 0.547 },
  M2: { x: 0.457, y: 0.577 },
  R1: { x: 0.364, y: 0.65 },
  R2: { x: 0.587, y: 0.659 }
};
const ODD_TOWER_SLOT_POLAR_OFFSETS = mapTowerSlotPolarOffsets(
  ODD_TOWER_D_FACING_SLOT_POSITIONS,
  ODD_TOWER_SLOT_TOWER_TYPES,
  D_FACING_TOWER_CENTERS
);
const EVEN_TOWER_SLOT_POLAR_OFFSETS = mapTowerSlotPolarOffsets(
  EVEN_TOWER_ONE_FACING_SLOT_POSITIONS,
  EVEN_TOWER_SLOT_TOWER_TYPES,
  ONE_FACING_TOWER_CENTERS
);
const PAST_END_BAIT_POLAR_OFFSETS = mapBossRelativePolarOffsets(PAST_END_A_FACING_BAIT_POSITIONS);
const FUTURE_END_BAIT_POLAR_OFFSETS = mapBossRelativePolarOffsets(FUTURE_END_A_FACING_BAIT_POSITIONS);
const FINAL_SPREAD_BOSS_OFFSETS = mapBossRelativeOffsets(FINAL_SPREAD_BOSS_RELATIVE_POSITIONS);

const LPDU_WAYMARKERS = [
  { label: 'A', x: 0.5, y: 0.08, color: '#f05270', shape: 'circle' },
  { label: 'B', x: 0.92, y: 0.5, color: '#e7cf50', shape: 'circle' },
  { label: 'C', x: 0.5, y: 0.92, color: '#62aef7', shape: 'circle' },
  { label: 'D', x: 0.08, y: 0.5, color: '#a978dc', shape: 'circle' },
  { label: '1', x: 0.25, y: 0.25, color: '#f05270', shape: 'square' },
  { label: '2', x: 0.75, y: 0.25, color: '#e7cf50', shape: 'square' },
  { label: '3', x: 0.75, y: 0.75, color: '#62aef7', shape: 'square' },
  { label: '4', x: 0.25, y: 0.75, color: '#a978dc', shape: 'square' }
];

const LPDU_MOVEMENT_PLAN = [
  timeBasedMovement({
    id: 'lpdu-forsaken-cast-lineup',
    label: 'Forsaken cast lineup',
    at: 2,
    positions: mapAbsolutePositions(FORSAKEN_CAST_LINEUP_POSITIONS)
  }),
  ...createEvenTowerBaitMovementItems(),
  ...createFinalTowerMovementItems(),
  ...createOddTowerMovementItems(),
  ...createEvenTowerMovementItems()
];

export class LPDUStrategy extends BaseStrategy {
  constructor({
    id = 'lpdu',
    label = 'LPDU Buddy Set1',
    setOneStackMode = SET_ONE_STACK_MODES.buddy
  } = {}) {
    super({
      id,
      label,
      mechanicId: 'forsaken',
      waymarkers: LPDU_WAYMARKERS,
      movementPlan: LPDU_MOVEMENT_PLAN
    });
    this.setOneStackMode = setOneStackMode;
  }

  resolveAction(action, state) {
    return {
      assignments: {
        strategy: this.id,
        actionId: action.id,
        mode: action.type,
        oddTower: getOddTowerAssignmentRowsForAction(action, state, this),
        evenTower: getEvenTowerAssignmentRowsForAction(action, state),
        bait: getBaitAssignmentRowsForAction(action, state),
        finalSpread: getFinalSpreadAssignmentRowsForAction(action, state)
      },
      movementPlan: this.movementPlan,
      activeTargets: state.players.map((bot) => ({
        roleId: bot.roleId,
        target: bot.movementTarget
      }))
    };
  }

  getExpectedPositions() {
    return [];
  }

  getOddTowerTestPositions(state, towerPosition, waveNumber = 1) {
    const slotAssignments = getOddTowerSlotAssignments(state, waveNumber, this);

    if (!slotAssignments) {
      return [];
    }

    const towerAnchors = getTowerAnchors({
      wave: waveNumber,
      position: towerPosition
    }, state);

    return Object.entries(slotAssignments).map(([roleId, slotId]) => ({
      roleId,
      slotId,
      ...resolveTowerSlotPosition(slotId, towerAnchors)
    }));
  }

  getEvenTowerTestPositions(state, towerPosition, waveNumber = 2) {
    const slotAssignments = getEvenTowerSlotAssignments(state, waveNumber);

    if (!slotAssignments) {
      return [];
    }

    const towerAnchors = getTowerAnchors({
      wave: waveNumber,
      position: towerPosition
    }, state);

    return Object.entries(slotAssignments).map(([roleId, slotId]) => ({
      roleId,
      slotId,
      ...resolveTowerSlotPosition(
        slotId,
        towerAnchors,
        EVEN_TOWER_SLOT_TOWER_TYPES,
        EVEN_TOWER_SLOT_POLAR_OFFSETS
      )
    }));
  }

  getTowerTestPositions(state, towerPosition, waveNumber = 1) {
    if (EVEN_TOWER_WAVES.includes(waveNumber)) {
      return this.getEvenTowerTestPositions(state, towerPosition, waveNumber);
    }

    return this.getOddTowerTestPositions(state, towerPosition, waveNumber);
  }

  getResolveNote(action, state) {
    if (action?.type === 'marker-spawn') {
      return [
        getForsakenMarkerGroupNote(state),
        getOddTowerResolveNote(state, 1, this)
      ].join('\n');
    }

    if (action?.type === 'tower-wave' && ODD_TOWER_WAVES.includes(action.payload?.wave)) {
      return getOddTowerResolveNote(state, action.payload.wave, this);
    }

    if (action?.type === 'tower-wave' && EVEN_TOWER_WAVES.includes(action.payload?.wave)) {
      return getEvenTowerResolveNote(state, action.payload.wave);
    }

    if (action?.type === 'clone-spawn' && EVEN_TOWER_WAVES.includes(action.payload?.wave)) {
      return getBaitResolveNote(state, action.payload.wave);
    }

    if (action?.type === 'all-things-cast' && EVEN_TOWER_WAVES.includes(action.payload?.wave)) {
      return getAllThingsResolveNote(state, action.payload.wave, this);
    }

    if (action?.type === 'all-things-cleave' && action.payload?.wave === FINAL_TOWER_WAVE) {
      return getFinalSpreadResolveNote(state);
    }

    if (action?.id === 'forsaken-cast') {
      return 'Move into the LPDU opening lineup.';
    }

    return 'No LPDU resolve note has been defined for this step yet.';
  }
}

export class LPDUFinalTwoStrategy extends LPDUStrategy {
  constructor() {
    super({
      id: 'lpdu-final-2',
      label: 'LPDU Final 2',
      setOneStackMode: SET_ONE_STACK_MODES.supportDpsPriority
    });
  }
}

function mapAbsolutePositions(positions) {
  return Object.fromEntries(
    Object.entries(positions).map(([roleId, position]) => [
      roleId,
      absolutePosition(position)
    ])
  );
}

function createOddTowerMovementItems() {
  return ODD_TOWER_WAVES.map((wave) => (
    conditionBasedMovement({
      id: `lpdu-odd-tower-wave-${wave}`,
      label: `Odd tower ${wave} LPDU solve`,
      condition: ({ encounter, state }) => {
        const towerWave = getTowerWave(state, wave);
        const readyTime = getTowerSolveReadyTime(state, towerWave, ODD_TOWER_MOVEMENT_DELAY);

        return Boolean(
          towerWave
          && encounter.elapsedSeconds >= readyTime
          && encounter.elapsedSeconds < towerWave.resolveStartTime
          && getForsakenMarkerGroups(state)
          && getStoredMarkers(state)
        );
      },
      positions: (context) => getOddTowerRolePositions(context, wave),
      visibility: createTowerSolveVisibility(wave)
    })
  ));
}

function createEvenTowerMovementItems() {
  return EVEN_TOWER_WAVES.map((wave) => (
    conditionBasedMovement({
      id: `lpdu-even-tower-wave-${wave}`,
      label: `Even tower ${wave} LPDU solve`,
      condition: ({ encounter, state }) => {
        const towerWave = getTowerWave(state, wave);
        const readyTime = getTowerSolveReadyTime(state, towerWave, EVEN_TOWER_MOVEMENT_DELAY);

        return Boolean(
          towerWave
          && encounter.elapsedSeconds >= readyTime
          && encounter.elapsedSeconds < towerWave.resolveStartTime
          && getForsakenMarkerGroups(state)
          && getStoredMarkers(state)
        );
      },
      positions: (context) => getEvenTowerRolePositions(context, wave),
      visibility: createTowerSolveVisibility(wave)
    })
  ));
}

function createEvenTowerBaitMovementItems() {
  return EVEN_TOWER_WAVES.map((wave) => (
    conditionBasedMovement({
      id: `lpdu-even-tower-wave-${wave}-future-past-bait`,
      label: `Tower ${wave} Future/Past bait`,
      condition: ({ encounter, state }) => {
        const towerWave = getTowerWave(state, wave);
        const event = getEvenTowerEvent(state, wave);

        return Boolean(
          towerWave
          && event
          && encounter.elapsedSeconds >= towerWave.resolveStartTime + EVEN_TOWER_BAIT_MOVEMENT_DELAY
          && encounter.elapsedSeconds < event.allThingsStartTime + ALL_THINGS_NEXT_TOWER_MOVE_DELAY
        );
      },
      positions: (context) => (
        wave === FINAL_TOWER_WAVE
          ? getSpecificBaitRolePositions(context, wave, PAST_END_BAIT_POLAR_OFFSETS)
          : getBaitRolePositions(context, wave)
      ),
      visibility: createBaitVisibility(wave)
    })
  ));
}

function createFinalTowerMovementItems() {
  return [
    conditionBasedMovement({
      id: 'lpdu-final-tower-future-bait',
      label: 'Tower 8 Future bait',
      condition: ({ encounter, state }) => {
        const event = getEvenTowerEvent(state, FINAL_TOWER_WAVE);

        return Boolean(
          isFutureEnd(event)
          && encounter.elapsedSeconds >= event.allThingsStartTime + ALL_THINGS_NEXT_TOWER_MOVE_DELAY
          && encounter.elapsedSeconds < event.cleaveTime + FINAL_SPREAD_AFTER_CLEAVE_DELAY
        );
      },
      positions: (context) => getSpecificBaitRolePositions(context, FINAL_TOWER_WAVE, FUTURE_END_BAIT_POLAR_OFFSETS),
      visibility: createFinalFutureBaitVisibility()
    }),
    conditionBasedMovement({
      id: 'lpdu-final-spread',
      label: 'Final spread',
      condition: ({ encounter, state }) => {
        const event = getEvenTowerEvent(state, FINAL_TOWER_WAVE);

        return Boolean(
          event
          && encounter.elapsedSeconds >= event.cleaveTime + FINAL_SPREAD_AFTER_CLEAVE_DELAY
        );
      },
      positions: (context) => getFinalSpreadRolePositions(context)
    })
  ];
}

function createTowerSolveVisibility(waveNumber) {
  return ({ state }) => {
    const towerWave = getTowerWave(state, waveNumber);

    if (!towerWave) {
      return null;
    }

    return {
      label: `Tower ${waveNumber} solve`,
      revealAt: towerWave.resolveStartTime - BOT_REVEAL_LEAD_TIME,
      resolveAt: towerWave.resolveStartTime
    };
  };
}

function createBaitVisibility(waveNumber) {
  return ({ state }) => {
    const event = getEvenTowerEvent(state, waveNumber);

    if (!event) {
      return null;
    }

    return {
      label: `Tower ${waveNumber} bait`,
      revealAt: event.allThingsStartTime - BOT_REVEAL_LEAD_TIME,
      resolveAt: event.allThingsStartTime
    };
  };
}

function createFinalFutureBaitVisibility() {
  return ({ state }) => {
    const event = getEvenTowerEvent(state, FINAL_TOWER_WAVE);

    if (!event) {
      return null;
    }

    return {
      label: 'Tower 8 Future bait',
      revealAt: event.cleaveTime - BOT_REVEAL_LEAD_TIME,
      resolveAt: event.cleaveTime
    };
  };
}

function getOddTowerRolePositions({ state, strategy }, waveNumber) {
  const towerWave = getTowerWave(state, waveNumber);
  const slotAssignments = getOddTowerSlotAssignments(state, waveNumber, strategy);

  if (!towerWave || !slotAssignments) {
    return [];
  }

  const towerAnchors = getTowerAnchors(towerWave, state);

  return Object.entries(slotAssignments).map(([roleId, slotId]) => ({
    roleId,
    slotId,
    ...resolveTowerSlotPosition(slotId, towerAnchors)
  }));
}

function getEvenTowerRolePositions({ state }, waveNumber) {
  const towerWave = getTowerWave(state, waveNumber);
  const slotAssignments = getEvenTowerSlotAssignments(state, waveNumber);

  if (!towerWave || !slotAssignments) {
    return [];
  }

  const towerAnchors = getTowerAnchors(towerWave, state);

  return Object.entries(slotAssignments).map(([roleId, slotId]) => ({
    roleId,
    slotId,
    ...resolveTowerSlotPosition(
      slotId,
      towerAnchors,
      EVEN_TOWER_SLOT_TOWER_TYPES,
      EVEN_TOWER_SLOT_POLAR_OFFSETS
    )
  }));
}

function getBaitRolePositions({ state }, waveNumber) {
  const towerWave = getBaitReferenceTowerWave(state, waveNumber);
  const event = getEvenTowerEvent(state, waveNumber);
  const polarOffsets = getBaitPolarOffsets(event);

  return event ? resolveBaitRolePositions(state, towerWave, polarOffsets) : [];
}

function getSpecificBaitRolePositions({ state }, waveNumber, polarOffsets) {
  const towerWave = getBaitReferenceTowerWave(state, waveNumber);

  return resolveBaitRolePositions(state, towerWave, polarOffsets);
}

function resolveBaitRolePositions(state, towerWave, polarOffsets) {
  if (!towerWave || !polarOffsets) {
    return [];
  }

  const bossPoint = getBossPoint(state);
  const markerPoint = getTowerMarkerPoint(towerWave);
  const bossToMarkerAngle = getAngleRadians(bossPoint, markerPoint);

  return Object.entries(polarOffsets).map(([roleId, polarOffset]) => {
    const positionAngle = bossToMarkerAngle + polarOffset.angleOffsetRadians;

    return {
      roleId,
      x: bossPoint.x + Math.cos(positionAngle) * polarOffset.distance,
      y: bossPoint.y + Math.sin(positionAngle) * polarOffset.distance
    };
  });
}

function getFinalSpreadRolePositions({ state }) {
  const bossPoint = getBossPoint(state);

  return Object.entries(FINAL_SPREAD_BOSS_OFFSETS).map(([roleId, offset]) => ({
    roleId,
    x: bossPoint.x + offset.x,
    y: bossPoint.y + offset.y
  }));
}

function getOddTowerSlotAssignments(state, waveNumber, strategy = null) {
  const markerGroups = getForsakenMarkerGroups(state);
  const storedMarkers = getStoredMarkers(state);

  if (!markerGroups || !storedMarkers) {
    return null;
  }

  const helperGroupKey = getHelperGroupKeyForTower(waveNumber);
  const activeGroupKey = helperGroupKey === 'groupA' ? 'groupB' : 'groupA';
  const helperRoles = markerGroups[helperGroupKey];
  const activeRoles = markerGroups[activeGroupKey];
  const activeConeRoleId = activeRoles.find((roleId) => storedMarkers[roleId] === 'cone');
  const activeAoeRoleId = activeRoles.find((roleId) => storedMarkers[roleId] === 'aoe');
  const stackRoleIds = activeRoles.filter((roleId) => storedMarkers[roleId] === 'stack');
  const assignments = {};

  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.tanks), ODD_TOWER_SLOT_IDS.tankHelper);
  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.healers), ODD_TOWER_SLOT_IDS.healerHelper);
  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.melee), ODD_TOWER_SLOT_IDS.dpsHelper1);
  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.ranged), ODD_TOWER_SLOT_IDS.dpsHelper2);
  assignSlot(assignments, activeConeRoleId, ODD_TOWER_SLOT_IDS.activeCone);
  assignSlot(assignments, activeAoeRoleId, ODD_TOWER_SLOT_IDS.activeAoe);
  assignOddTowerStackBuddySlots({
    assignments,
    activeRoles,
    activeConeRoleId,
    activeAoeRoleId,
    stackRoleIds,
    storedMarkers,
    waveNumber,
    strategy
  });

  return assignments;
}

function getEvenTowerSlotAssignments(state, waveNumber) {
  const markerGroups = getForsakenMarkerGroups(state);
  const storedMarkers = getStoredMarkers(state);

  if (!markerGroups || !storedMarkers) {
    return null;
  }

  const helperGroupKey = getHelperGroupKeyForTower(waveNumber);
  const activeGroupKey = helperGroupKey === 'groupA' ? 'groupB' : 'groupA';
  const helperRoles = markerGroups[helperGroupKey];
  const activeRoles = markerGroups[activeGroupKey];
  const activeTankRoleId = findFirstRole(activeRoles, ROLE_CATEGORIES.tanks);
  const activeHealerRoleId = findFirstRole(activeRoles, ROLE_CATEGORIES.healers);
  const activeMeleeRoleId = findFirstRole(activeRoles, ROLE_CATEGORIES.melee);
  const activeRangedRoleId = findFirstRole(activeRoles, ROLE_CATEGORIES.ranged);
  const assignments = {};

  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.tanks), EVEN_TOWER_SLOT_IDS.tankHelper);
  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.healers), EVEN_TOWER_SLOT_IDS.healerHelper);
  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.melee), EVEN_TOWER_SLOT_IDS.dpsHelper1);
  assignSlot(assignments, findFirstRole(helperRoles, ROLE_CATEGORIES.ranged), EVEN_TOWER_SLOT_IDS.dpsHelper2);
  assignEvenTowerActiveSlots({
    assignments,
    activeTankRoleId,
    activeHealerRoleId,
    activeMeleeRoleId,
    activeRangedRoleId,
    storedMarkers
  });

  return assignments;
}

function assignOddTowerStackBuddySlots({
  assignments,
  activeRoles,
  activeConeRoleId,
  activeAoeRoleId,
  stackRoleIds,
  storedMarkers,
  waveNumber,
  strategy
}) {
  const supportStackRoleId = getSupportStackRoleId(stackRoleIds);
  const dpsStackRoleId = getDpsStackRoleId(stackRoleIds);
  const shouldUseBuddyStacks = waveNumber === 1
    && getSetOneStackMode(strategy) === SET_ONE_STACK_MODES.buddy;

  if (!shouldUseBuddyStacks && supportStackRoleId && dpsStackRoleId) {
    assignSlot(assignments, supportStackRoleId, ODD_TOWER_SLOT_IDS.coneStackBuddy);
    assignSlot(assignments, dpsStackRoleId, ODD_TOWER_SLOT_IDS.aoeStackBuddy);
    return;
  }

  const coneBuddyRoleId = getBuddyRoleId(activeConeRoleId);
  const aoeBuddyRoleId = getBuddyRoleId(activeAoeRoleId);
  const assignedStackRoleIds = new Set();

  if (isActiveStackRole(coneBuddyRoleId, activeRoles, storedMarkers)) {
    assignSlot(assignments, coneBuddyRoleId, ODD_TOWER_SLOT_IDS.coneStackBuddy);
    assignedStackRoleIds.add(coneBuddyRoleId);
  }

  if (isActiveStackRole(aoeBuddyRoleId, activeRoles, storedMarkers)) {
    assignSlot(assignments, aoeBuddyRoleId, ODD_TOWER_SLOT_IDS.aoeStackBuddy);
    assignedStackRoleIds.add(aoeBuddyRoleId);
  }

  const unassignedStackRoleIds = stackRoleIds.filter((roleId) => !assignedStackRoleIds.has(roleId));

  if (unassignedStackRoleIds.length === 0) {
    return;
  }

  if (unassignedStackRoleIds.length >= 2) {
    const aoeStackRoleId = getRightSideStackRoleId(unassignedStackRoleIds);
    const coneStackRoleId = unassignedStackRoleIds.find((roleId) => roleId !== aoeStackRoleId);

    assignSlot(assignments, coneStackRoleId, ODD_TOWER_SLOT_IDS.coneStackBuddy);
    assignSlot(assignments, aoeStackRoleId, ODD_TOWER_SLOT_IDS.aoeStackBuddy);
    return;
  }

  const [stackRoleId] = unassignedStackRoleIds;
  const hasConeStackBuddy = Object.values(assignments).includes(ODD_TOWER_SLOT_IDS.coneStackBuddy);
  const hasAoeStackBuddy = Object.values(assignments).includes(ODD_TOWER_SLOT_IDS.aoeStackBuddy);

  if (!hasConeStackBuddy) {
    assignSlot(assignments, stackRoleId, ODD_TOWER_SLOT_IDS.coneStackBuddy);
  } else if (!hasAoeStackBuddy) {
    assignSlot(assignments, stackRoleId, ODD_TOWER_SLOT_IDS.aoeStackBuddy);
  }
}

function getSetOneStackMode(strategy) {
  return strategy?.setOneStackMode ?? SET_ONE_STACK_MODES.buddy;
}

function isActiveStackRole(roleId, activeRoles, storedMarkers) {
  return Boolean(roleId && activeRoles.includes(roleId) && storedMarkers[roleId] === 'stack');
}

function getSupportStackRoleId(stackRoleIds) {
  return findFirstRole(stackRoleIds, ROLE_CATEGORIES.healers)
    ?? findFirstRole(stackRoleIds, ROLE_CATEGORIES.tanks);
}

function getDpsStackRoleId(stackRoleIds) {
  return findFirstRole(stackRoleIds, ROLE_CATEGORIES.melee)
    ?? findFirstRole(stackRoleIds, ROLE_CATEGORIES.ranged);
}

function getRightSideStackRoleId(stackRoleIds) {
  return findFirstRole(stackRoleIds, ROLE_CATEGORIES.tanks)
    ?? findFirstRole(stackRoleIds, ROLE_CATEGORIES.ranged)
    ?? findFirstRole(stackRoleIds, ROLE_CATEGORIES.melee)
    ?? stackRoleIds[0];
}

function assignEvenTowerActiveSlots({
  assignments,
  activeTankRoleId,
  activeHealerRoleId,
  activeMeleeRoleId,
  activeRangedRoleId,
  storedMarkers
}) {
  assignEvenTowerAnchorSlot(
    assignments,
    activeHealerRoleId,
    storedMarkers,
    EVEN_TOWER_SLOT_IDS.coneTowerCleave,
    EVEN_TOWER_SLOT_IDS.coneTowerAoe
  );
  assignEvenTowerAnchorSlot(
    assignments,
    activeRangedRoleId,
    storedMarkers,
    EVEN_TOWER_SLOT_IDS.circleTowerCleave,
    EVEN_TOWER_SLOT_IDS.circleTowerAoe
  );
  assignEvenTowerRemainingSlots({
    assignments,
    activeTankRoleId,
    activeMeleeRoleId,
    storedMarkers
  });
}

function assignEvenTowerAnchorSlot(assignments, roleId, storedMarkers, cleaveSlotId, aoeSlotId) {
  const slotId = getEvenTowerSlotForMarker(storedMarkers[roleId], cleaveSlotId, aoeSlotId);
  assignSlot(assignments, roleId, slotId);
}

function assignEvenTowerRemainingSlots({ assignments, activeTankRoleId, activeMeleeRoleId, storedMarkers }) {
  const remainingRoleIds = new Set([activeTankRoleId, activeMeleeRoleId].filter(Boolean));
  const openSlots = getEvenTowerOpenActiveSlots(assignments);

  openSlots.forEach((slot) => {
    const matchingRoleIds = [...remainingRoleIds].filter((roleId) => storedMarkers[roleId] === slot.markerType);

    if (matchingRoleIds.length === 0) {
      return;
    }

    const preferredRoleId = slot.towerType === 'cone' ? activeTankRoleId : activeMeleeRoleId;
    const roleId = matchingRoleIds.includes(preferredRoleId) ? preferredRoleId : matchingRoleIds[0];

    assignSlot(assignments, roleId, slot.slotId);
    remainingRoleIds.delete(roleId);
  });
}

function getEvenTowerOpenActiveSlots(assignments) {
  const assignedSlotIds = new Set(Object.values(assignments));

  return [
    {
      slotId: EVEN_TOWER_SLOT_IDS.coneTowerCleave,
      markerType: 'cone',
      towerType: 'cone'
    },
    {
      slotId: EVEN_TOWER_SLOT_IDS.coneTowerAoe,
      markerType: 'aoe',
      towerType: 'cone'
    },
    {
      slotId: EVEN_TOWER_SLOT_IDS.circleTowerCleave,
      markerType: 'cone',
      towerType: 'aoe'
    },
    {
      slotId: EVEN_TOWER_SLOT_IDS.circleTowerAoe,
      markerType: 'aoe',
      towerType: 'aoe'
    }
  ].filter((slot) => !assignedSlotIds.has(slot.slotId));
}

function getEvenTowerSlotForMarker(markerType, cleaveSlotId, aoeSlotId) {
  if (markerType === 'cone') {
    return cleaveSlotId;
  }

  if (markerType === 'aoe') {
    return aoeSlotId;
  }

  return null;
}

function getForsakenMarkerGroupNote(state) {
  const groups = getForsakenMarkerGroups(state);

  if (!groups) {
    return 'Marker groups pending...';
  }

  return [
    `Group A: ${groups.groupA.join('')}`,
    `Group B: ${groups.groupB.join('')}`
  ].join('\n');
}

function getForsakenMarkerGroups(state) {
  const markerAssignments = state.getMechanicData('openingMarkerAssignments')?.markers;

  if (!markerAssignments) {
    return null;
  }

  return FORSAKEN_MARKER_PAIR_GROUPS.reduce((result, pair) => {
    const [firstRoleId, secondRoleId] = pair;
    const firstMarker = markerAssignments[firstRoleId];
    const secondMarker = markerAssignments[secondRoleId];

    if (!firstMarker || !secondMarker) {
      return result;
    }

    const groupKey = firstMarker === secondMarker ? 'groupB' : 'groupA';
    result[groupKey].push(...pair);
    return result;
  }, {
    groupA: [],
    groupB: []
  });
}

function getOddTowerResolveNote(state, waveNumber, strategy = null) {
  const slotAssignments = getOddTowerSlotAssignments(state, waveNumber, strategy);

  if (!slotAssignments) {
    return `Tower ${waveNumber} LPDU odd-tower assignments pending...`;
  }

  const helperGroup = getHelperGroupKeyForTower(waveNumber) === 'groupA' ? 'Group A' : 'Group B';
  const slotRoles = Object.fromEntries(
    Object.entries(slotAssignments).map(([roleId, slotId]) => [slotId, roleId])
  );
  const slotPositions = getOddTowerSlotPositionMap(state, waveNumber, strategy);

  return [
    `Tower ${waveNumber}: ${helperGroup} helps`,
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.tankHelper, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.healerHelper, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.dpsHelper1, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.dpsHelper2, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.activeCone, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.activeAoe, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.coneStackBuddy, ODD_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, ODD_TOWER_SLOT_IDS.aoeStackBuddy, ODD_TOWER_SLOT_LABELS)
  ].join('\n');
}

function getEvenTowerResolveNote(state, waveNumber) {
  const slotAssignments = getEvenTowerSlotAssignments(state, waveNumber);

  if (!slotAssignments) {
    return `Tower ${waveNumber} LPDU even-tower assignments pending...`;
  }

  const helperGroup = getHelperGroupKeyForTower(waveNumber) === 'groupA' ? 'Group A' : 'Group B';
  const slotRoles = Object.fromEntries(
    Object.entries(slotAssignments).map(([roleId, slotId]) => [slotId, roleId])
  );
  const slotPositions = getEvenTowerSlotPositionMap(state, waveNumber);

  return [
    `Tower ${waveNumber}: ${helperGroup} helps`,
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.tankHelper, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.healerHelper, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.dpsHelper1, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.dpsHelper2, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.coneTowerCleave, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.coneTowerAoe, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.circleTowerCleave, EVEN_TOWER_SLOT_LABELS),
    formatSlotAssignment(slotRoles, slotPositions, EVEN_TOWER_SLOT_IDS.circleTowerAoe, EVEN_TOWER_SLOT_LABELS)
  ].join('\n');
}

function getBaitResolveNote(state, waveNumber) {
  const event = getEvenTowerEvent(state, waveNumber);
  const positions = getBaitRolePositions({ state }, waveNumber);

  if (!event || positions.length === 0) {
    return `Tower ${waveNumber} Future/Past bait positions pending...`;
  }

  return [
    `Tower ${waveNumber}: ${event.baitCastName} bait`,
    ...positions.map((position) => (
      `${position.roleId}: [${formatCoordinate(position.x)}, ${formatCoordinate(position.y)}]`
    ))
  ].join('\n');
}

function getAllThingsResolveNote(state, waveNumber, strategy = null) {
  const event = getEvenTowerEvent(state, waveNumber);
  const nextWaveNumber = waveNumber + 1;
  const nextTowerNote = ODD_TOWER_WAVES.includes(nextWaveNumber)
    ? getOddTowerResolveNote(state, nextWaveNumber, strategy)
    : null;

  if (waveNumber === FINAL_TOWER_WAVE) {
    return [
      event
        ? getFinalTowerAllThingsInstruction(event)
        : 'All Things Ending locked. Prepare for final spread after cleaves.',
      getFinalSpreadResolveNote(state)
    ].join('\n');
  }

  return [
    event
      ? `All Things Ending locked for ${event.baitCastName}. Move to tower ${nextWaveNumber} after ${ALL_THINGS_NEXT_TOWER_MOVE_DELAY.toFixed(1)}s.`
      : `All Things Ending locked. Move to tower ${nextWaveNumber} after ${ALL_THINGS_NEXT_TOWER_MOVE_DELAY.toFixed(1)}s.`,
    nextTowerNote
  ].filter(Boolean).join('\n');
}

function getFinalTowerAllThingsInstruction(event) {
  if (isFutureEnd(event)) {
    return `All Things Ending locked for ${event.baitCastName}. Move to the Future bait after ${ALL_THINGS_NEXT_TOWER_MOVE_DELAY.toFixed(1)}s.`;
  }

  return `All Things Ending locked for ${event.baitCastName}. Stay on the Past bait until cleaves resolve.`;
}

function getFinalSpreadResolveNote(state) {
  return [
    `Final spread: move ${FINAL_SPREAD_AFTER_CLEAVE_DELAY.toFixed(1)}s after cleaves`,
    ...getFinalSpreadRolePositions({ state }).map((position) => (
      `${position.roleId}: [${formatCoordinate(position.x)}, ${formatCoordinate(position.y)}]`
    ))
  ].join('\n');
}

function getOddTowerAssignmentRowsForAction(action, state, strategy = null) {
  const waveNumber = getOddTowerWaveForAction(action);

  if (!waveNumber) {
    return [];
  }

  const slotAssignments = getOddTowerSlotAssignments(state, waveNumber, strategy);

  if (!slotAssignments) {
    return [];
  }
  const positionsByRole = Object.fromEntries(
    getOddTowerRolePositions({ state, strategy }, waveNumber).map((position) => [
      position.roleId,
      position
    ])
  );

  return Object.entries(slotAssignments).map(([roleId, slotId]) => {
    const position = positionsByRole[roleId];

    return {
      roleId,
      slotId,
      label: ODD_TOWER_SLOT_LABELS[slotId],
      towerType: ODD_TOWER_SLOT_TOWER_TYPES[slotId],
      x: position?.x,
      y: position?.y
    };
  });
}

function getEvenTowerAssignmentRowsForAction(action, state) {
  const waveNumber = getEvenTowerWaveForAction(action);

  if (!waveNumber) {
    return [];
  }

  const slotAssignments = getEvenTowerSlotAssignments(state, waveNumber);

  if (!slotAssignments) {
    return [];
  }

  const positionsByRole = Object.fromEntries(
    getEvenTowerRolePositions({ state }, waveNumber).map((position) => [
      position.roleId,
      position
    ])
  );

  return Object.entries(slotAssignments).map(([roleId, slotId]) => {
    const position = positionsByRole[roleId];

    return {
      roleId,
      slotId,
      label: EVEN_TOWER_SLOT_LABELS[slotId],
      towerType: EVEN_TOWER_SLOT_TOWER_TYPES[slotId],
      x: position?.x,
      y: position?.y
    };
  });
}

function getBaitAssignmentRowsForAction(action, state) {
  const waveNumber = getBaitWaveForAction(action);

  if (!waveNumber) {
    return [];
  }

  const event = getEvenTowerEvent(state, waveNumber);
  const positions = getBaitRolePositions({ state }, waveNumber);

  if (!event || positions.length === 0) {
    return [];
  }

  return positions.map((position) => ({
    roleId: position.roleId,
    label: `${event.baitCastName} bait`,
    x: position.x,
    y: position.y
  }));
}

function getFinalSpreadAssignmentRowsForAction(action, state) {
  if (action?.type !== 'all-things-cleave' || action.payload?.wave !== FINAL_TOWER_WAVE) {
    return [];
  }

  return getFinalSpreadRolePositions({ state }).map((position) => ({
    roleId: position.roleId,
    label: 'Final spread',
    x: position.x,
    y: position.y
  }));
}

function getOddTowerWaveForAction(action) {
  if (action?.type === 'marker-spawn') {
    return 1;
  }

  if (action?.type === 'tower-wave' && ODD_TOWER_WAVES.includes(action.payload?.wave)) {
    return action.payload.wave;
  }

  return null;
}

function getEvenTowerWaveForAction(action) {
  if (action?.type === 'tower-wave' && EVEN_TOWER_WAVES.includes(action.payload?.wave)) {
    return action.payload.wave;
  }

  return null;
}

function getBaitWaveForAction(action) {
  if (
    ['clone-spawn', 'all-things-cast', 'all-things-cleave'].includes(action?.type)
    && EVEN_TOWER_WAVES.includes(action.payload?.wave)
  ) {
    return action.payload.wave;
  }

  return null;
}

function formatSlotAssignment(slotRoles, slotPositions, slotId, slotLabels) {
  const roleId = slotRoles[slotId] ?? '-';
  const position = slotPositions[slotId];
  const coordinateLabel = position ? ` [${formatCoordinate(position.x)}, ${formatCoordinate(position.y)}]` : '';

  return `${slotLabels[slotId]}: ${roleId}${coordinateLabel}`;
}

function getOddTowerSlotPositionMap(state, waveNumber, strategy = null) {
  return Object.fromEntries(
    getOddTowerRolePositions({ state, strategy }, waveNumber).map((position) => [
      position.slotId,
      position
    ])
  );
}

function getEvenTowerSlotPositionMap(state, waveNumber) {
  return Object.fromEntries(
    getEvenTowerRolePositions({ state }, waveNumber).map((position) => [
      position.slotId,
      position
    ])
  );
}

function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(3) : '-';
}

function getStoredMarkers(state) {
  return state.getMechanicData('storedMarkers') ?? null;
}

function getTowerWave(state, waveNumber) {
  return state.getMechanicData('towerSequence')?.waves.find((wave) => wave.wave === waveNumber) ?? null;
}

function getEvenTowerEvent(state, waveNumber) {
  return state.getMechanicData('evenTowerEvents')?.find((event) => event.wave === waveNumber) ?? null;
}

function getBaitReferenceTowerWave(state, waveNumber) {
  return getTowerWave(state, waveNumber + 1) ?? getTowerWave(state, waveNumber);
}

function getTowerSolveReadyTime(state, towerWave, defaultDelay) {
  if (!towerWave) {
    return Number.POSITIVE_INFINITY;
  }

  const previousEvenEvent = towerWave.wave % 2 === 1 && towerWave.wave > 1
    ? getEvenTowerEvent(state, towerWave.wave - 1)
    : null;

  return previousEvenEvent
    ? previousEvenEvent.allThingsStartTime + ALL_THINGS_NEXT_TOWER_MOVE_DELAY
    : towerWave.startTime + defaultDelay;
}

function getHelperGroupKeyForTower(waveNumber) {
  return GROUP_B_HELPER_TOWERS.has(waveNumber) ? 'groupB' : 'groupA';
}

function assignSlot(assignments, roleId, slotId, allowedRoleIds = null) {
  if (!roleId || !slotId || (allowedRoleIds && !allowedRoleIds.includes(roleId))) {
    return;
  }

  assignments[roleId] = slotId;
}

function findFirstRole(roleIds, candidates) {
  return candidates.find((candidate) => roleIds.includes(candidate)) ?? null;
}

function getBuddyRoleId(roleId) {
  if (!roleId) {
    return null;
  }

  const pair = FORSAKEN_MARKER_PAIR_GROUPS.find((roles) => roles.includes(roleId));

  return pair?.find((buddyRoleId) => buddyRoleId !== roleId) ?? null;
}

function mapTowerSlotPolarOffsets(slotPositions, slotTowerTypes, referenceTowerCenters, referenceBossCenter = ARENA_CENTER) {
  return Object.fromEntries(
    Object.entries(slotPositions).map(([slotId, position]) => {
      const towerType = slotTowerTypes[slotId];
      const towerCenter = referenceTowerCenters[towerType];
      const towerToBossAngle = getAngleRadians(towerCenter, referenceBossCenter);
      const towerToPositionAngle = getAngleRadians(towerCenter, position);

      return [
        slotId,
        {
          distance: Math.hypot(position.x - towerCenter.x, position.y - towerCenter.y),
          angleOffsetRadians: normalizeRadians(towerToPositionAngle - towerToBossAngle)
        }
      ];
    })
  );
}

function mapBossRelativePolarOffsets(
  rolePositions,
  referenceBossCenter = ARENA_CENTER,
  referenceMarkerPoint = A_FACING_TOWER_MARKER_POINT
) {
  const bossToMarkerAngle = getAngleRadians(referenceBossCenter, referenceMarkerPoint);

  return Object.fromEntries(
    Object.entries(rolePositions).map(([roleId, position]) => {
      const bossToPositionAngle = getAngleRadians(referenceBossCenter, position);

      return [
        roleId,
        {
          distance: Math.hypot(position.x - referenceBossCenter.x, position.y - referenceBossCenter.y),
          angleOffsetRadians: normalizeRadians(bossToPositionAngle - bossToMarkerAngle)
        }
      ];
    })
  );
}

function mapBossRelativeOffsets(rolePositions, referenceBossCenter = ARENA_CENTER) {
  return Object.fromEntries(
    Object.entries(rolePositions).map(([roleId, position]) => [
      roleId,
      {
        x: position.x - referenceBossCenter.x,
        y: position.y - referenceBossCenter.y
      }
    ])
  );
}

function getBaitPolarOffsets(event) {
  if (event?.baitCastName === "Past's End") {
    return PAST_END_BAIT_POLAR_OFFSETS;
  }

  if (event?.baitCastName === "Future's End") {
    return FUTURE_END_BAIT_POLAR_OFFSETS;
  }

  return null;
}

function isFutureEnd(event) {
  return event?.baitCastName === "Future's End";
}

function getTowerAnchors(towerWave, state) {
  const markerPoint = getTowerMarkerPoint(towerWave);
  const towerRoles = getRuntimeTowerRoles(towerWave, markerPoint);

  return {
    boss: getBossPoint(state),
    cone: towerRoles.cone,
    aoe: towerRoles.aoe
  };
}

function resolveTowerSlotPosition(
  slotId,
  towerAnchors,
  slotTowerTypes = ODD_TOWER_SLOT_TOWER_TYPES,
  polarOffsets = ODD_TOWER_SLOT_POLAR_OFFSETS
) {
  const towerType = slotTowerTypes[slotId];
  const towerCenter = towerAnchors[towerType];
  const polarOffset = polarOffsets[slotId];
  const towerToBossAngle = getAngleRadians(towerCenter, towerAnchors.boss);
  const positionAngle = towerToBossAngle + polarOffset.angleOffsetRadians;

  return {
    x: towerCenter.x + Math.cos(positionAngle) * polarOffset.distance,
    y: towerCenter.y + Math.sin(positionAngle) * polarOffset.distance
  };
}

function getRuntimeTowerRoles(towerWave, markerPoint) {
  const direction = {
    x: markerPoint.x - ARENA_CENTER.x,
    y: markerPoint.y - ARENA_CENTER.y
  };
  const rankedTowers = towerWave.position.towers
    .map((tower) => ({
      tower,
      side: cross2d(direction, {
        x: tower.x - ARENA_CENTER.x,
        y: tower.y - ARENA_CENTER.y
      })
    }))
    .sort((a, b) => a.side - b.side);

  return {
    aoe: rankedTowers[0].tower,
    cone: rankedTowers[rankedTowers.length - 1].tower
  };
}

function getTowerMarkerPoint(towerWave) {
  const towers = towerWave.position.towers;
  const sum = towers.reduce((total, tower) => ({
    x: total.x + tower.x,
    y: total.y + tower.y
  }), { x: 0, y: 0 });

  return {
    x: sum.x / towers.length,
    y: sum.y / towers.length
  };
}

function getBossPoint(state) {
  const boss = state.getMechanicObjectById('forsaken-boss');

  return boss
    ? { x: boss.x, y: boss.y }
    : ARENA_CENTER;
}

function cross2d(a, b) {
  return a.x * b.y - a.y * b.x;
}

function getAngleRadians(source, target) {
  return Math.atan2(target.y - source.y, target.x - source.x);
}

function normalizeRadians(radians) {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}
