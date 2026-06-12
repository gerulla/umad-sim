import {
  C_FACING_TOWER_CENTERS,
  LPDUStrategy,
  mapTowerSlotPolarOffsets,
  ODD_TOWER_SLOT_IDS,
  ODD_TOWER_SLOT_TOWER_TYPES
} from '../lpdu/LPDUStrategy.js';

const KROXY_ODD_TOWER_C_FACING_SLOT_POSITIONS = {
  [ODD_TOWER_SLOT_IDS.tankHelper]: { x: 0.448, y: 0.549 },
  [ODD_TOWER_SLOT_IDS.healerHelper]: { x: 0.343, y: 0.737 },
  [ODD_TOWER_SLOT_IDS.dpsHelper1]: { x: 0.547, y: 0.55 },
  [ODD_TOWER_SLOT_IDS.dpsHelper2]: { x: 0.592, y: 0.53 },
  [ODD_TOWER_SLOT_IDS.activeCone]: { x: 0.365, y: 0.686 },
  [ODD_TOWER_SLOT_IDS.activeAoe]: { x: 0.63, y: 0.706 },
  [ODD_TOWER_SLOT_IDS.coneStackBuddy]: { x: 0.394, y: 0.627 },
  [ODD_TOWER_SLOT_IDS.aoeStackBuddy]: { x: 0.604, y: 0.59 }
};

const KROXY_ODD_TOWER_SLOT_POLAR_OFFSETS = mapTowerSlotPolarOffsets(
  KROXY_ODD_TOWER_C_FACING_SLOT_POSITIONS,
  ODD_TOWER_SLOT_TOWER_TYPES,
  C_FACING_TOWER_CENTERS
);

export class KroxyRinnon341Strategy extends LPDUStrategy {
  constructor() {
    super({
      id: 'kroxy-rinnon-341',
      label: 'Kroxy-Rinnon 341',
      raidplanUrl: 'https://raidplan.io/plan/UATE__aDcw1-bgVv',
      oddTowerSlotPolarOffsets: KROXY_ODD_TOWER_SLOT_POLAR_OFFSETS
    });
  }
}
