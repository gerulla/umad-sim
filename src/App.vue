<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { GameLoop } from './core/GameLoop.js';
import { MechanicObject } from './core/MechanicObject.js';
import {
  createForsakenOpeningMarkerAssignments,
  FORSAKEN_TOWER_ROLE_STYLES,
  getForsakenTowerRoles,
  POSSIBLE_TOWER_POSITIONS
} from './mechanics/forsaken/ForsakenMechanic.js';
import {
  createEncounterByIds,
  createMechanicById,
  createStrategyById,
  getMechanicOptions,
  getStrategyOptionsForMechanic
} from './systems/encounterRegistry.js';

const roleIconSources = {
  tank: '/role-icons/Tank_Icon_1.png',
  healer: '/role-icons/Healer_Icon_1.png',
  melee: '/role-icons/Melee_DPS_Icon_1.png',
  physicalRanged: '/role-icons/Physical_Ranged_DPS_Icon_1.png',
  magicRanged: '/role-icons/Magic_Ranged_DPS_Icon_1.png'
};

const overheadMarkerIcons = {
  cone: { icon: '/markers/cone.svg', widthScale: 1.12, heightScale: 1.34, yOffsetScale: 0.58 },
  aoe: { icon: '/markers/aoe.svg', widthScale: 1.18, heightScale: 1.18, yOffsetScale: 0.58 },
  stack: { icon: '/markers/stack.svg', widthScale: 1.95, heightScale: 1.95, yOffsetScale: 0.68 }
};

const LIVING_PLAYER_HEAL_INTERVAL_SECONDS = 2;
const REPLAY_RECORD_INTERVAL_SECONDS = 0.1;
const FAILURE_TOAST_LIFETIME_MS = 5000;
const WATCH_BOTS_ROLE_ID = 'WATCH_BOTS';
const watchBotsRole = {
  id: WATCH_BOTS_ROLE_ID,
  label: 'Watch Bots',
  group: 'Simulation',
  color: '#c084fc',
  icon: null,
  badge: 'WB'
};

const mechanicImageSources = [
  '/boss-target.svg',
  ...Object.values(overheadMarkerIcons).map((marker) => marker.icon)
];

const roles = [
  { id: 'MT', label: 'MT', group: 'Tank', color: '#60a5fa', icon: roleIconSources.tank, badge: '1' },
  { id: 'OT', label: 'OT', group: 'Tank', color: '#60a5fa', icon: roleIconSources.tank, badge: '2' },
  { id: 'H1', label: 'H1', group: 'Healer', color: '#34d399', icon: roleIconSources.healer, badge: '1' },
  { id: 'H2', label: 'H2', group: 'Healer', color: '#34d399', icon: roleIconSources.healer, badge: '2' },
  { id: 'M1', label: 'M1', group: 'Melee', color: '#f87171', icon: roleIconSources.melee, badge: '1' },
  { id: 'M2', label: 'M2', group: 'Melee', color: '#fb7185', icon: roleIconSources.melee, badge: '2' },
  { id: 'R1', label: 'R1', group: 'Physical Ranged', color: '#facc15', icon: roleIconSources.physicalRanged, badge: 'R1' },
  { id: 'R2', label: 'R2', group: 'Magic Ranged', color: '#a78bfa', icon: roleIconSources.magicRanged, badge: 'R2' }
];

const forsakenTowerSoakSequence = ['A', 'A', 'A', 'B', 'B', 'B', 'B', 'A'];
const forsakenMarkerPairGroups = [
  ['MT', 'H1'],
  ['OT', 'H2'],
  ['M1', 'R1'],
  ['M2', 'R2']
];
const markerHoldLabels = {
  aoe: 'AOE',
  cone: 'Cone',
  stack: 'Stack'
};

const towerTestRoleGroups = {
  supports: ['MT', 'OT', 'H1', 'H2'],
  dps: ['M1', 'M2', 'R1', 'R2']
};

const mechanicOptions = getMechanicOptions();

const canvasRef = ref(null);
const stageRef = ref(null);
const showDevMenu = import.meta.env.VITE_APP_ENV === 'development' && !import.meta.env.PROD;
const selectedRole = ref('MT');
const selectedMechanicId = ref('forsaken');
const strategyOptions = computed(() => getStrategyOptionsForMechanic(selectedMechanicId.value));
const selectedStrategyId = ref('lpdu');
const encounter = reactive(createEncounterByIds({
  mechanicId: selectedMechanicId.value,
  strategyId: selectedStrategyId.value,
  roles,
  controlledRoleId: getSelectedControlledRoleId()
}));
const isPlaying = ref(false);
const resolveNoteHidden = ref(false);
const practiceSettings = reactive({
  lateBotMovement: false,
  lockTowersToC: false,
  forcedOpeningGroup: null
});
const partyPositionsOutput = ref('');
const wipePause = reactive({
  active: false,
  dismissed: false,
  time: 0
});
const failureToasts = reactive([]);
const mobileActivePanel = ref('run');
const mobileDrawerOpen = ref(false);
const devSettings = reactive({
  showPlayerHitbox: false,
  showAllHitboxes: false,
  showTowerHitboxes: false,
  showBossFacing: false,
  devMovement: false,
  previewMarkerEffects: false,
  devTowerRadius: 0.085,
  towerTestIndex: 0,
  botMovementSpeed: 0.45,
  aoeRadius: 0.105,
  stackRadius: 0.105,
  coneLength: 0.5,
  coneDegrees: 70,
  coneFacingDegrees: -90
});
const devDragState = reactive({
  targetType: null,
  objectId: null,
  offsetX: 0,
  offsetY: 0
});
const periodicHealState = reactive({
  nextHealTime: LIVING_PLAYER_HEAL_INTERVAL_SECONDS
});
const replayState = reactive({
  frames: [],
  active: false,
  index: 0,
  recording: false,
  playing: false,
  nextRecordTime: 0,
  completed: false
});
const canvasState = reactive({
  imageReady: false,
  size: { width: 0, height: 0 },
  feedback: 'Select a role, then click the arena to move that bot.',
  suppressNextClick: false
});

let arenaImage;
const roleIconImages = new Map();
const mechanicObjectImages = new Map();
let resizeObserver;
let encounterLoop;
let replayPlaybackTimer;
let manualMovementFrameId = null;
let manualMovementLastFrameMs = 0;
let assetLoadId = 0;
let failureToastId = 0;
const failureToastTimers = new Map();
const shownFailureKeys = new Set();

const selectedRoleData = computed(() => {
  if (selectedRole.value === WATCH_BOTS_ROLE_ID) {
    return watchBotsRole;
  }

  return roles.find((role) => role.id === selectedRole.value) || roles[0];
});

const selectedStrategyData = computed(() => {
  return strategyOptions.value.find((strategy) => strategy.id === selectedStrategyId.value) ?? null;
});

const selectedRaidplanUrl = computed(() => selectedStrategyData.value?.raidplanUrl ?? null);

const mobilePanelItems = computed(() => [
  { id: 'setup', label: 'Setup' },
  { id: 'party', label: encounterActive.value ? 'Party' : 'Roles' },
  { id: 'run', label: 'Run' },
  { id: 'notes', label: 'Notes' },
  { id: 'timeline', label: 'Timeline' }
]);

const mobileActivePanelLabel = computed(() => (
  mobilePanelItems.value.find((item) => item.id === mobileActivePanel.value)?.label ?? 'Options'
));

const currentReplayFrame = computed(() => {
  if (!replayState.active) {
    return null;
  }

  return replayState.frames[replayState.index] ?? null;
});

const hasReplayFrames = computed(() => replayState.frames.length > 0);

const replayMaxIndex = computed(() => Math.max(0, replayState.frames.length - 1));

const displayElapsedSeconds = computed(() => {
  return currentReplayFrame.value?.elapsedSeconds ?? encounter.elapsedSeconds;
});

const displayStatus = computed(() => {
  return currentReplayFrame.value?.status ?? encounter.status;
});

const displayCurrentActionIndex = computed(() => {
  return currentReplayFrame.value?.currentActionIndex ?? encounter.currentActionIndex;
});

const displayPlayers = computed(() => {
  return currentReplayFrame.value?.players ?? encounter.state.players;
});

const displayMechanicObjects = computed(() => {
  return currentReplayFrame.value?.mechanicObjects ?? encounter.state.mechanicObjects;
});

const encounterActive = computed(() => replayState.active || encounter.status !== 'idle');

const controlledBot = computed(() => {
  const controlledRoleId = getSelectedControlledRoleId();
  return controlledRoleId ? getDisplayBotByRole(controlledRoleId) : null;
});

const partyListRows = computed(() => {
  const controlledRoleId = controlledBot.value?.roleId ?? null;
  const orderedRoleIds = controlledRoleId
    ? [
        controlledRoleId,
        ...roles.map((role) => role.id).filter((roleId) => roleId !== controlledRoleId)
      ]
    : roles.map((role) => role.id);

  return orderedRoleIds
    .map((roleId, index) => {
      const bot = getDisplayBotByRole(roleId);

      if (!bot) {
        return null;
      }

      return {
        bot,
        role: bot.role,
        isPlayer: Boolean(controlledRoleId) && index === 0,
        hpPercent: getBotHpPercent(bot),
        debuffs: getPartyDebuffs(bot)
      };
    })
    .filter(Boolean);
});

const selectedStep = computed(() => {
  const replayFrame = currentReplayFrame.value;

  if (replayFrame) {
    if (replayFrame.status === 'idle') {
      return encounter.mechanic.start;
    }

    if (replayFrame.status === 'complete') {
      return encounter.mechanic.end;
    }

    return encounter.timelineActions[replayFrame.currentActionIndex] ?? encounter.mechanic.start;
  }

  return encounter.currentTimelineItem;
});

const resolveDisplayData = computed(() => {
  if (currentReplayFrame.value?.resolveDisplay) {
    return currentReplayFrame.value.resolveDisplay;
  }

  return createResolveDisplayData(encounter.state, selectedStep.value, encounter.elapsedSeconds);
});

const resolveNoteMasked = computed(() => resolveNoteHidden.value && displayStatus.value === 'running');

const visibleResolveDisplayData = computed(() => {
  if (resolveNoteMasked.value) {
    return createMaskedResolveDisplayData();
  }

  return resolveDisplayData.value;
});

const timelineItems = computed(() => encounter.timelineActions);

const activeWaymarkers = computed(() => encounter.strategy.waymarkers);

const elapsedLabel = computed(() => formatElapsedTime(displayElapsedSeconds.value));

const activeCast = computed(() => currentReplayFrame.value?.activeCast ?? encounter.activeCast);

const activeScreenFlash = computed(() => currentReplayFrame.value?.activeScreenFlash ?? encounter.activeScreenFlash);

const castProgressPercent = computed(() => `${getDisplayCastProgress() * 100}%`);

const castRemainingLabel = computed(() => formatCastTime(getDisplayCastRemainingSeconds()));

const devTowerSizeLabel = computed(() => `${Math.round(devSettings.devTowerRadius * 200)}%`);

const towerTestLabel = computed(() => {
  const towerTest = getTowerTestConfig();

  return `Tower test: W${towerTest.waveNumber} ${towerTest.position.marker}`;
});

const botMovementSpeedLabel = computed(() => `${devSettings.botMovementSpeed.toFixed(2)} arena/s`);

const timerActionLabel = computed(() => {
  if (isPlaying.value) {
    return 'Pause';
  }

  return wipePause.active ? 'Keep Going' : 'Start';
});

const aoeRadiusLabel = computed(() => formatNormalizedRadius(devSettings.aoeRadius));

const stackRadiusLabel = computed(() => formatNormalizedRadius(devSettings.stackRadius));

const coneLengthLabel = computed(() => formatNormalizedRadius(devSettings.coneLength));

const coneDegreesLabel = computed(() => `${devSettings.coneDegrees} deg`);

const coneFacingLabel = computed(() => `${devSettings.coneFacingDegrees} deg`);

const replayCurrentLabel = computed(() => {
  const frame = replayState.frames[replayState.index];

  return frame ? formatElapsedTime(frame.elapsedSeconds) : '00:00.000';
});

const replayDurationLabel = computed(() => {
  const lastFrame = replayState.frames[replayState.frames.length - 1];

  return lastFrame ? formatElapsedTime(lastFrame.elapsedSeconds) : '00:00.000';
});

const replayStatusLabel = computed(() => {
  if (replayState.active) {
    return replayState.playing ? 'Playing Replay' : 'Viewing Replay';
  }

  if (replayState.recording) {
    return 'Recording';
  }

  if (replayState.completed) {
    return 'Run Saved';
  }

  return hasReplayFrames.value ? 'Partial Run Saved' : 'No Run Saved';
});

const replayActionLabel = computed(() => (replayState.playing ? 'Pause' : 'Play'));

function setMobilePanel(panelId) {
  if (mobileActivePanel.value === panelId && mobileDrawerOpen.value) {
    mobileDrawerOpen.value = false;
    return;
  }

  mobileActivePanel.value = panelId;
  mobileDrawerOpen.value = true;
}

function closeMobileDrawer() {
  mobileDrawerOpen.value = false;
}

function getSelectedControlledRoleId() {
  return selectedRole.value === WATCH_BOTS_ROLE_ID ? null : selectedRole.value;
}

function getDisplayBotByRole(roleId) {
  return displayPlayers.value.find((player) => player.roleId === roleId) ?? null;
}

function getBotHpPercent(bot) {
  if (typeof bot.hpPercent === 'number') {
    return bot.hpPercent;
  }

  if (bot.maxHp <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (bot.hp / bot.maxHp) * 100));
}

function getPartyDebuffs(bot) {
  return bot.debuffs;
}

function createResolveDisplayData(state, action = null, elapsedSeconds = 0) {
  const openingMarkers = clonePlain(state.getMechanicData('openingMarkerAssignments')?.markers) ?? {};
  const storedMarkers = clonePlain(state.getMechanicData('storedMarkers')) ?? {};
  const groups = getForsakenResolveGroups(openingMarkers);

  return {
    soakSequence: [...forsakenTowerSoakSequence],
    activeTowerIndex: getResolveActiveTowerIndex(state, action, elapsedSeconds),
    groups,
    groupsReady: groups.groupA.length > 0 || groups.groupB.length > 0,
    markerRows: roles.map((role) => {
      const markerType = normalizeMarkerType(storedMarkers[role.id]);

      return {
        roleId: role.id,
        markerType: markerType ?? 'none',
        markerLabel: markerType ? markerHoldLabels[markerType] : '-'
      };
    })
  };
}

function createMaskedResolveDisplayData() {
  return {
    soakSequence: forsakenTowerSoakSequence.map(() => '?'),
    activeTowerIndex: -1,
    groups: {
      groupA: ['Hidden'],
      groupB: ['Hidden']
    },
    groupsReady: true,
    markerRows: roles.map((role) => ({
      roleId: role.id,
      markerType: 'none',
      markerLabel: '-'
    }))
  };
}

function getForsakenResolveGroups(markers) {
  return forsakenMarkerPairGroups.reduce((result, pair) => {
    const [firstRoleId, secondRoleId] = pair;
    const firstMarker = markers[firstRoleId];
    const secondMarker = markers[secondRoleId];

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

function getResolveActiveTowerIndex(state, action, elapsedSeconds) {
  const sequence = state.getMechanicData('towerSequence');

  if (sequence?.waves?.length) {
    const activeWaves = sequence.waves.filter((wave) => (
      elapsedSeconds >= wave.startTime && elapsedSeconds < wave.endTime
    ));

    if (activeWaves.length > 0) {
      return normalizeTowerIndex(Math.max(...activeWaves.map((wave) => wave.wave)));
    }

    const latestCompletedWave = [...sequence.waves]
      .reverse()
      .find((wave) => elapsedSeconds >= wave.endTime);

    if (latestCompletedWave) {
      return normalizeTowerIndex(latestCompletedWave.wave);
    }
  }

  const stateWave = Number(state.getMechanicData('currentTowerWave') ?? 0);

  if (stateWave > 0) {
    return normalizeTowerIndex(stateWave);
  }

  const actionWave = action?.type === 'marker-spawn'
    ? 1
    : Number(action?.payload?.wave ?? 0);

  return normalizeTowerIndex(actionWave);
}

function normalizeTowerIndex(waveNumber) {
  if (waveNumber < 1 || waveNumber > forsakenTowerSoakSequence.length) {
    return -1;
  }

  return waveNumber - 1;
}

function normalizeMarkerType(markerType) {
  return markerHoldLabels[markerType] ? markerType : null;
}

function getDisplayCastProgress() {
  const cast = activeCast.value;

  if (!cast) {
    return 0;
  }

  return clamp(
    (displayElapsedSeconds.value - cast.startTime) / cast.duration,
    0,
    1
  );
}

function getDisplayCastRemainingSeconds() {
  const cast = activeCast.value;

  if (!cast) {
    return 0;
  }

  return Math.max(0, cast.endTime - displayElapsedSeconds.value);
}

function getActiveDebuffIconSources() {
  return encounter.state.players
    .flatMap((player) => player.debuffs.map((debuff) => debuff.icon))
    .filter(Boolean);
}

function resizeCanvas() {
  if (!stageRef.value || !canvasRef.value) {
    return;
  }

  const bounds = stageRef.value.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const canvas = canvasRef.value;

  canvasState.size.width = bounds.width;
  canvasState.size.height = bounds.height;
  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;

  drawArena();
}

async function preloadRenderableAssets() {
  const loadId = ++assetLoadId;
  const arenaSource = encounter.mechanic.arena.backgroundImage;
  const roleSources = unique(roles.map((role) => role.icon));
  const debuffSources = getActiveDebuffIconSources();

  canvasState.imageReady = false;

  try {
    const arenaPromise = preloadImage(arenaSource);
    const cachePromises = [
      ...roleSources.map((source) => preloadCachedImage(roleIconImages, source)),
      ...unique([...mechanicImageSources, ...debuffSources]).map((source) => (
        preloadCachedImage(mechanicObjectImages, source)
      ))
    ];
    const loadedArena = await arenaPromise;

    await Promise.allSettled(cachePromises);

    if (loadId !== assetLoadId || arenaSource !== encounter.mechanic.arena.backgroundImage) {
      return;
    }

    arenaImage = loadedArena;
    canvasState.imageReady = true;
    resizeCanvas();
  } catch (error) {
    console.error('Unable to preload arena assets.', error);
  }
}

function preloadCachedImage(cache, source) {
  if (cache.has(source)) {
    return Promise.resolve(cache.get(source));
  }

  return preloadImage(source).then((image) => {
    cache.set(source, image);
    return image;
  });
}

function preloadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.decoding = 'async';
    image.onload = async () => {
      try {
        await image.decode?.();
      } catch {
        // Some SVG/image paths do not need or support decode; loaded is enough.
      }

      resolve(image);
    };
    image.onerror = () => reject(new Error(`Unable to load image: ${source}`));
    image.src = source;
  });
}

function unique(values) {
  return [...new Set(values)];
}

function getMarkerEffectConfigFromDevSettings() {
  return {
    aoeRadius: devSettings.aoeRadius,
    stackRadius: devSettings.stackRadius,
    coneLength: devSettings.coneLength,
    coneDegrees: devSettings.coneDegrees,
    coneFacingDegrees: devSettings.coneFacingDegrees,
    displayDuration: 1
  };
}

function syncMarkerEffectConfig() {
  if (encounter.mechanic.id !== 'forsaken') {
    return;
  }

  encounter.state.setMechanicData('markerEffectConfig', getMarkerEffectConfigFromDevSettings());
}

function syncStrategyMovementSpeed() {
  encounter.setStrategyMovementSpeed(devSettings.botMovementSpeed);
}

function syncLateBotMovement() {
  encounter.setLateStrategyMovement(practiceSettings.lateBotMovement);
}

function syncMechanicPracticeSettings() {
  const openingMarkerOptions = getOpeningMarkerRngOptions();

  encounter.setMechanicSettings({
    fixedTowerMarker: practiceSettings.lockTowersToC ? 'C' : null,
    forcedOpeningMarkerGroup: openingMarkerOptions.forcedGroup,
    forcedOpeningMarkerRoleId: openingMarkerOptions.forcedRoleId
  });
}

function getOpeningMarkerRngOptions() {
  return {
    forcedGroup: practiceSettings.forcedOpeningGroup,
    forcedRoleId: getSelectedControlledRoleId()
  };
}

function setForcedOpeningGroup(groupKey, checked) {
  practiceSettings.forcedOpeningGroup = checked ? groupKey : null;
}

function refreshIdleMechanicState() {
  if (encounter.status !== 'idle') {
    return;
  }

  clearReplay();
  clearWipePause();
  clearFailureToasts();
  resetPeriodicHealing();
  encounter.resetToIdle();
  syncMarkerEffectConfig();
  syncStrategyMovementSpeed();
  syncLateBotMovement();
  drawArena();
}

function drawArena() {
  const canvas = canvasRef.value;
  if (!canvas || !canvasState.imageReady) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvasState.size.width;
  const height = canvasState.size.height;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  drawImageCover(ctx, arenaImage, width, height);
  drawArenaOverlay(ctx, width, height);
  activeWaymarkers.value.forEach((marker) => drawWaymarker(ctx, marker, width, height));
  displayMechanicObjects.value.forEach((object) => drawMechanicObject(ctx, object, width, height));
  drawMarkerEffectPreview(ctx, width, height);
  displayPlayers.value.forEach((bot) => drawBot(ctx, bot, width, height));
  drawScreenFlash(ctx, width, height);

  ctx.restore();
}

function drawImageCover(ctx, image, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawArenaOverlay(ctx, width, height) {
  const radius = Math.min(width, height);
  const gradient = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    radius * 0.1,
    width * 0.5,
    height * 0.5,
    radius * 0.58
  );

  gradient.addColorStop(0, 'rgba(8, 13, 18, 0)');
  gradient.addColorStop(0.78, 'rgba(8, 13, 18, 0.02)');
  gradient.addColorStop(1, 'rgba(8, 13, 18, 0.22)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawWaymarker(ctx, marker, width, height) {
  const size = Math.min(width, height) * 0.072;
  const x = marker.x * width;
  const y = marker.y * height;
  const half = size * 0.5;

  ctx.save();
  ctx.shadowColor = marker.color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = hexToRgba(marker.color, 0.42);
  ctx.strokeStyle = hexToRgba('#ffffff', 0.28);
  ctx.lineWidth = 2;

  if (marker.shape === 'square') {
    roundedRect(ctx, x - half, y - half, size, size, size * 0.08);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, half, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(size * 0.58)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(marker.label, x, y + size * 0.03);
  ctx.restore();
}

function drawMechanicObject(ctx, object, width, height) {
  if (!object.active) {
    return;
  }

  if (object.type === 'boss-target') {
    drawMechanicIcon(ctx, object, width, height);
    return;
  }

  if (object.type === 'boss-clone') {
    drawMechanicIcon(ctx, object, width, height);
    return;
  }

  if (object.type === 'tower') {
    drawTower(ctx, object, width, height);
    return;
  }

  if (object.type === 'marker-effect') {
    drawMarkerEffect(ctx, object, width, height);
    return;
  }

  if (object.type === 'raidwide-effect') {
    drawRaidwideEffect(ctx, object, width, height);
  }
}

function drawMechanicIcon(ctx, object, width, height) {
  const icon = getMechanicObjectImage(object.data.icon);

  if (!icon?.complete || icon.naturalWidth <= 0) {
    return;
  }

  const x = object.x * width;
  const y = object.y * height;
  const size = object.radius * Math.min(width, height) * 2;
  const rotationDegrees = object.data?.rotationDegrees;

  ctx.save();
  ctx.translate(x, y);

  if (devSettings.showBossFacing && typeof rotationDegrees === 'number') {
    drawFacingLine(ctx, size, rotationDegrees);
    ctx.rotate(degreesToRadians(rotationDegrees));
  }

  ctx.drawImage(icon, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawFacingLine(ctx, size, rotationDegrees) {
  const angle = degreesToRadians(rotationDegrees);
  const lineStart = size * 0.25;
  const lineEnd = size * 0.82;

  ctx.save();
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.92)';
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.shadowColor = 'rgba(248, 113, 113, 0.72)';
  ctx.shadowBlur = size * 0.14;
  ctx.beginPath();
  ctx.moveTo(Math.cos(angle) * lineStart, Math.sin(angle) * lineStart);
  ctx.lineTo(Math.cos(angle) * lineEnd, Math.sin(angle) * lineEnd);
  ctx.stroke();
  ctx.restore();
}

function getMechanicObjectImage(source) {
  if (!source) {
    return null;
  }

  if (mechanicObjectImages.has(source)) {
    return mechanicObjectImages.get(source);
  }

  const image = new Image();
  image.decoding = 'async';
  image.onload = drawArena;
  image.src = source;
  mechanicObjectImages.set(source, image);

  return image;
}

function drawTower(ctx, object, width, height) {
  const x = object.x * width;
  const y = object.y * height;
  const radius = object.radius * Math.min(width, height);
  const isDevTower = object.data?.devTower;
  const towerStyle = object.data?.style ?? {};
  const showLabel = object.data?.showLabel !== false;

  ctx.save();
  ctx.shadowColor = isDevTower
    ? 'rgba(45, 212, 191, 0.75)'
    : towerStyle.shadow ?? 'rgba(251, 191, 36, 0.62)';
  ctx.shadowBlur = radius * 0.36;
  ctx.fillStyle = isDevTower
    ? 'rgba(20, 184, 166, 0.2)'
    : towerStyle.fill ?? 'rgba(251, 191, 36, 0.2)';
  ctx.strokeStyle = isDevTower
    ? 'rgba(153, 246, 228, 0.95)'
    : towerStyle.stroke ?? 'rgba(253, 230, 138, 0.9)';
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  if (devSettings.showTowerHitboxes) {
    drawTowerHitbox(ctx, x, y, radius);
  }

  if (showLabel) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(radius * 0.42)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, radius * 0.07);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.strokeText(object.label || 'T', x, y);
    ctx.fillText(object.label || 'T', x, y);
  }

  if (object.data?.showPosition) {
    drawObjectPosition(ctx, object, x, y + radius + 12, radius);
  }

  ctx.restore();
}

function drawTowerHitbox(ctx, x, y, radius) {
  ctx.save();
  ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.98)';
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMarkerEffect(ctx, object, width, height) {
  const shape = object.data?.shape;
  const style = object.data?.style ?? {};
  const isPending = object.data?.phase === 'pending';
  const alpha = getMarkerEffectAlpha(object);

  if (shape === 'cone') {
    drawConeEffectShape(ctx, {
      x: object.x * width,
      y: object.y * height,
      length: (object.data.length ?? object.radius) * Math.min(width, height),
      angleDegrees: object.data.angleDegrees,
      facingDegrees: object.data.facingDegrees,
      style,
      alpha,
      dashed: isPending
    });
    return;
  }

  drawCircleEffectShape(ctx, {
    x: object.x * width,
    y: object.y * height,
    radius: (object.data.radius ?? object.radius) * Math.min(width, height),
    style,
    alpha,
    dashed: isPending
  });
}

function drawRaidwideEffect(ctx, object, width, height) {
  const style = object.data?.style ?? {};
  const alpha = getMarkerEffectAlpha(object);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style.fill ?? 'rgba(239, 68, 68, 0.22)';
  ctx.shadowColor = style.shadow ?? 'rgba(248, 113, 113, 0.7)';
  ctx.shadowBlur = Math.min(width, height) * 0.08;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = style.stroke ?? 'rgba(248, 113, 113, 0.9)';
  ctx.lineWidth = Math.max(3, Math.min(width, height) * 0.008);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
  ctx.restore();
}

function drawMarkerEffectPreview(ctx, width, height) {
  if (replayState.active || !showDevMenu || !devSettings.previewMarkerEffects) {
    return;
  }

  const bot = controlledBot.value;

  if (!bot) {
    return;
  }

  const x = bot.x * width;
  const y = bot.y * height;
  const scale = Math.min(width, height);

  drawConeEffectShape(ctx, {
    x,
    y,
    length: devSettings.coneLength * scale,
    angleDegrees: devSettings.coneDegrees,
    facingDegrees: devSettings.coneFacingDegrees,
    style: {
      fill: 'rgba(234, 88, 12, 0.1)',
      stroke: 'rgba(251, 146, 60, 0.95)',
      shadow: 'rgba(249, 115, 22, 0.42)'
    },
    alpha: 1
  });
  drawCircleEffectShape(ctx, {
    x,
    y,
    radius: devSettings.aoeRadius * scale,
    style: {
      fill: 'rgba(234, 88, 12, 0.08)',
      stroke: 'rgba(251, 146, 60, 0.9)',
      shadow: 'rgba(249, 115, 22, 0.34)'
    },
    alpha: 1
  });
  drawCircleEffectShape(ctx, {
    x,
    y,
    radius: devSettings.stackRadius * scale,
    style: {
      fill: 'rgba(14, 165, 233, 0.06)',
      stroke: 'rgba(125, 211, 252, 0.9)',
      shadow: 'rgba(56, 189, 248, 0.32)'
    },
    alpha: 1,
    dashed: true
  });
}

function drawCircleEffectShape(ctx, { x, y, radius, style, alpha, dashed = false }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = style.shadow ?? 'rgba(249, 115, 22, 0.7)';
  ctx.shadowBlur = radius * 0.18;
  ctx.fillStyle = style.fill ?? 'rgba(234, 88, 12, 0.2)';
  const lineWidth = style.lineWidth ?? Math.max(2, radius * 0.035);
  const shouldStroke = lineWidth > 0 && style.stroke !== null;

  if (dashed) {
    ctx.setLineDash([Math.max(6, radius * 0.1), Math.max(4, radius * 0.06)]);
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  if (shouldStroke) {
    ctx.strokeStyle = style.stroke ?? 'rgba(251, 146, 60, 0.95)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  ctx.restore();
}

function drawConeEffectShape(ctx, { x, y, length, angleDegrees, facingDegrees, style, alpha, dashed = false }) {
  const halfAngle = degreesToRadians(angleDegrees / 2);
  const facing = degreesToRadians(facingDegrees);
  const startAngle = facing - halfAngle;
  const endAngle = facing + halfAngle;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = style.shadow ?? 'rgba(249, 115, 22, 0.7)';
  ctx.shadowBlur = length * 0.12;
  ctx.fillStyle = style.fill ?? 'rgba(234, 88, 12, 0.2)';
  const lineWidth = style.lineWidth ?? Math.max(2, length * 0.02);
  const shouldStroke = lineWidth > 0 && style.stroke !== null;

  if (dashed) {
    ctx.setLineDash([Math.max(8, length * 0.055), Math.max(5, length * 0.035)]);
  }

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(startAngle) * length, y + Math.sin(startAngle) * length);
  ctx.arc(x, y, length, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();

  if (shouldStroke) {
    ctx.strokeStyle = style.stroke ?? 'rgba(251, 146, 60, 0.95)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  ctx.restore();
}

function getMarkerEffectAlpha(object) {
  const startTime = object.data?.startTime;
  const endTime = object.data?.endTime;

  if (typeof startTime !== 'number' || typeof endTime !== 'number' || endTime <= startTime) {
    return 1;
  }

  if (object.data?.phase === 'pending') {
    return 0.48 + Math.sin(displayElapsedSeconds.value * Math.PI * 3) * 0.12;
  }

  const holdSeconds = object.data?.phase === 'firing'
    ? Math.max(0, Number(object.data?.firingHoldSeconds ?? 0))
    : 0;
  const fadeStartTime = startTime + holdSeconds;

  if (displayElapsedSeconds.value <= fadeStartTime) {
    return 1;
  }

  if (endTime <= fadeStartTime) {
    return 1;
  }

  const progress = clamp((displayElapsedSeconds.value - fadeStartTime) / (endTime - fadeStartTime), 0, 1);

  return Math.max(0, 1 - progress);
}

function drawObjectPosition(ctx, object, x, y, radius) {
  const label = `x ${object.x.toFixed(3)}  y ${object.y.toFixed(3)}`;

  ctx.save();
  ctx.font = `800 ${Math.max(10, Math.round(radius * 0.24))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.86)';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(label, x, y);
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawBotPosition(ctx, bot, x, y, size) {
  const label = `${bot.roleId}  x ${bot.x.toFixed(3)}  y ${bot.y.toFixed(3)}`;

  ctx.save();
  ctx.font = `800 ${Math.max(9, Math.round(size * 0.24))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.86)';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(label, x, y);
  ctx.fillText(label, x, y);
  ctx.restore();
}

function drawBot(ctx, bot, width, height) {
  const x = bot.x * width;
  const y = bot.y * height;
  const iconSize = getPlayerIconSize(width, height);
  const hitboxRadius = getPlayerHitboxRadius(bot, width, height);
  const icon = roleIconImages.get(bot.icon);

  ctx.save();

  if (icon?.complete && icon.naturalWidth > 0) {
    const iconX = x - iconSize / 2;
    const iconY = y - iconSize / 2;

    ctx.filter = 'brightness(0.62) saturate(0.92)';
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = bot.color;
    ctx.font = `900 ${Math.round(iconSize * 0.42)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bot.label, x, y + 1);
  }

  drawRoleLabel(ctx, bot.label, x, y, iconSize);

  if (devSettings.showAllHitboxes || (devSettings.showPlayerHitbox && bot.controlled)) {
    drawPlayerHitbox(ctx, x, y, hitboxRadius);
  }

  if (bot.controlled) {
    drawControlledIndicator(ctx, x, y, iconSize);
  }

  if (bot.marker) {
    drawBotMarker(ctx, bot.marker, x, y, iconSize);
  }

  if (showDevMenu && devSettings.devMovement) {
    drawBotPosition(ctx, bot, x, y + iconSize / 2 + 5, iconSize);
  }

  ctx.restore();
}

function drawBotMarker(ctx, marker, x, y, size) {
  const markerIcon = overheadMarkerIcons[marker.type];

  if (!markerIcon) {
    return;
  }

  const image = getMechanicObjectImage(markerIcon.icon);

  if (!image?.complete || image.naturalWidth <= 0) {
    return;
  }

  const baseSize = Math.max(34, size * 1.12);
  const markerWidth = baseSize * markerIcon.widthScale;
  const markerHeight = baseSize * markerIcon.heightScale;
  const markerX = x - markerWidth / 2;
  const markerY = y - size * markerIcon.yOffsetScale - markerHeight;

  ctx.save();
  ctx.globalAlpha = marker.alpha;
  ctx.drawImage(image, markerX, markerY, markerWidth, markerHeight);
  ctx.restore();
}

function getPlayerIconSize(width, height) {
  return Math.min(width, height) * 0.078 * 0.7;
}

function getPlayerHitboxRadius(bot, width, height) {
  return Math.max(2, bot.hitboxRadius * Math.min(width, height));
}

function drawRoleLabel(ctx, label, x, y, size) {
  ctx.save();
  ctx.font = `900 ${Math.round(size * 0.48)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(label, x, y + 1);
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}

function drawPlayerHitbox(ctx, x, y, radius) {
  ctx.save();
  ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.98)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawControlledIndicator(ctx, x, y, size) {
  const radius = Math.max(3, size * 0.13);
  const dotX = x - size / 2 + radius + 1;
  const dotY = y - size / 2 + radius + 1;

  ctx.save();
  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = 'rgba(4, 12, 8, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawScreenFlash(ctx, width, height) {
  const flash = activeScreenFlash.value;

  if (!flash) {
    return;
  }

  ctx.save();
  ctx.fillStyle = hexToRgba(flash.color, Math.min(0.95, Math.max(0, flash.alpha)));
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function handleCanvasClick(event) {
  if (canvasState.suppressNextClick) {
    canvasState.suppressNextClick = false;
    return;
  }

  if (replayState.active) {
    canvasState.feedback = 'Exit replay before moving player/bots.';
    return;
  }

  if (devSettings.devMovement) {
    return;
  }

  const rect = canvasRef.value.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const bot = encounter.moveControlledBot(x, y);

  if (!bot) {
    canvasState.feedback = 'Watch Bots is selected, so no player-controlled bot will move from clicks.';
    drawArena();
    return;
  }

  if (!encounterLoop?.running) {
    startManualMovementLoop();
  }

  canvasState.feedback = `${bot.label} moving to ${Math.round(x * 100)}%, ${Math.round(y * 100)}%.`;
  drawArena();
}

function handleCanvasPointerDown(event) {
  if (replayState.active || !showDevMenu) {
    return;
  }

  const point = getCanvasPoint(event);

  if (devSettings.devMovement) {
    const bot = findBotAt(point.x, point.y);

    if (bot) {
      devDragState.targetType = 'bot';
      devDragState.objectId = bot.roleId;
      devDragState.offsetX = bot.x - point.x;
      devDragState.offsetY = bot.y - point.y;
      canvasState.suppressNextClick = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
  }

  const tower = findDevTowerAt(point.x, point.y);

  if (!tower) {
    return;
  }

  devDragState.targetType = 'tower';
  devDragState.objectId = tower.id;
  devDragState.offsetX = tower.x - point.x;
  devDragState.offsetY = tower.y - point.y;
  canvasState.suppressNextClick = true;
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleCanvasPointerMove(event) {
  if (!devDragState.objectId) {
    return;
  }

  const point = getCanvasPoint(event);

  if (devDragState.targetType === 'bot') {
    const bot = encounter.state.getBotByRole(devDragState.objectId);

    if (!bot) {
      clearDevDragState();
      return;
    }

    bot.moveTo(point.x + devDragState.offsetX, point.y + devDragState.offsetY);
    canvasState.feedback = `${bot.label} at x ${bot.x.toFixed(3)}, y ${bot.y.toFixed(3)}.`;
    drawArena();
    event.preventDefault();
    return;
  }

  const tower = encounter.state.getMechanicObjectById(devDragState.objectId);

  if (!tower) {
    clearDevDragState();
    return;
  }

  tower.moveTo(point.x + devDragState.offsetX, point.y + devDragState.offsetY);
  canvasState.feedback = `${tower.label} at x ${tower.x.toFixed(3)}, y ${tower.y.toFixed(3)}.`;
  drawArena();
  event.preventDefault();
}

function handleCanvasPointerUp(event) {
  if (devDragState.objectId) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  clearDevDragState();
}

function clearDevDragState() {
  devDragState.targetType = null;
  devDragState.objectId = null;
  devDragState.offsetX = 0;
  devDragState.offsetY = 0;
}

function getCanvasPoint(event) {
  const rect = canvasRef.value.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height
  };
}

function findDevTowerAt(x, y) {
  for (let index = encounter.state.mechanicObjects.length - 1; index >= 0; index -= 1) {
    const object = encounter.state.mechanicObjects[index];

    if (object.data?.devTower && object.containsPoint(x, y)) {
      return object;
    }
  }

  return null;
}

function findBotAt(x, y) {
  const width = canvasState.size.width;
  const height = canvasState.size.height;
  const iconRadius = getPlayerIconSize(width, height) / 2 + 4;

  for (let index = encounter.state.players.length - 1; index >= 0; index -= 1) {
    const bot = encounter.state.players[index];
    const dx = bot.x * width - x * width;
    const dy = bot.y * height - y * height;

    if (Math.hypot(dx, dy) <= iconRadius) {
      return bot;
    }
  }

  return null;
}

function spawnDevTower() {
  const nextTowerNumber = encounter.state.mechanicObjects.filter((object) => object.data?.devTower).length + 1;
  const spawnPoint = getDevTowerSpawnPoint(nextTowerNumber);
  const tower = encounter.state.addMechanicObject(new MechanicObject({
    id: `dev-tower-${Date.now()}-${nextTowerNumber}`,
    type: 'tower',
    x: spawnPoint.x,
    y: spawnPoint.y,
    radius: devSettings.devTowerRadius,
    label: `T${nextTowerNumber}`,
    sourceActionId: 'dev-menu',
    data: {
      devTower: true,
      showPosition: true
    }
  }));

  canvasState.feedback = `${tower.label} spawned at x ${tower.x.toFixed(3)}, y ${tower.y.toFixed(3)}.`;
  drawArena();
}

function getDevTowerSpawnPoint(towerNumber) {
  if (towerNumber === 1) {
    return { x: 0.5, y: 0.5 };
  }

  const angle = -Math.PI / 2 + ((towerNumber - 2) * Math.PI) / 4;
  const radius = 0.12;

  return {
    x: 0.5 + Math.cos(angle) * radius,
    y: 0.5 + Math.sin(angle) * radius
  };
}

function updateDevTowerSizes() {
  encounter.state.mechanicObjects.forEach((object) => {
    if (object.data?.devTower) {
      object.radius = devSettings.devTowerRadius;
    }
  });

  drawArena();
}

function getTowerTestConfig() {
  const positionIndex = devSettings.towerTestIndex % POSSIBLE_TOWER_POSITIONS.length;

  return {
    positionIndex,
    waveNumber: positionIndex + 1,
    position: POSSIBLE_TOWER_POSITIONS[positionIndex]
  };
}

function clearDevTowers() {
  encounter.state.clearMechanicObjects((object) => object.data?.devTower || object.data?.towerTest);
  clearDevDragState();
  canvasState.feedback = 'Dev towers cleared.';
  drawArena();
}

function runTowerTest() {
  const towerTest = getTowerTestConfig();
  const towerPosition = towerTest.position;
  const waveNumber = towerTest.waveNumber;

  stopEncounterLoop();
  clearWipePause();
  clearFailureToasts();
  resetPeriodicHealing();
  syncMechanicPracticeSettings();
  encounter.resetToIdle();
  syncMarkerEffectConfig();
  syncStrategyMovementSpeed();
  syncLateBotMovement();
  encounter.mechanic.ensureBossSpawned?.(encounter.state);

  const markerAssignments = createForsakenOpeningMarkerAssignments(
    encounter.state.players,
    encounter.randomSource,
    null,
    getOpeningMarkerRngOptions()
  );

  encounter.state.setMechanicData('openingMarkerAssignments', markerAssignments);
  const storedMarkers = waveNumber % 2 === 0
    ? createEvenTowerTestStoredMarkers(markerAssignments.markers)
    : { ...markerAssignments.markers };

  encounter.state.setMechanicData('storedMarkers', storedMarkers);
  encounter.state.clearPlayerMarkers();
  Object.entries(storedMarkers).forEach(([roleId, markerType]) => {
    encounter.state.showPlayerMarker(roleId, {
      type: markerType,
      startTime: encounter.elapsedSeconds
    }, 0, {
      startTime: encounter.elapsedSeconds,
      holdSeconds: 0
    });
  });

  spawnTowerTestPair(towerPosition);

  const positions = encounter.strategy.getTowerTestPositions?.(
    encounter.state,
    towerPosition,
    waveNumber
  ) ?? [];

  positions.forEach((position) => {
    encounter.state.getBotByRole(position.roleId)
      ?.clearMovementTarget()
      .moveTo(position.x, position.y);
  });

  devSettings.towerTestIndex = (devSettings.towerTestIndex + 1) % POSSIBLE_TOWER_POSITIONS.length;
  canvasState.feedback = `Tower test W${waveNumber} ${towerPosition.marker}: rolled markers and teleported ${positions.length} player/bots.`;
  drawArena();
}

function createEvenTowerTestStoredMarkers(openingMarkers) {
  const supportRolesHaveCones = encounter.randomSource.bool();

  return Object.fromEntries(
    Object.entries(openingMarkers).map(([roleId]) => {
      const isSupport = towerTestRoleGroups.supports.includes(roleId);
      const markerType = isSupport === supportRolesHaveCones ? 'cone' : 'aoe';

      return [roleId, markerType];
    })
  );
}

function spawnTowerTestPair(towerPosition) {
  encounter.state.clearMechanicObjects((object) => object.data?.towerTest);

  const towerRoles = getForsakenTowerRoles(towerPosition);

  towerPosition.towers.forEach((tower, index) => {
    const towerRole = towerRoles.get(tower);

    encounter.state.addMechanicObject(new MechanicObject({
      id: `tower-test-${towerPosition.marker}-${index + 1}`,
      type: 'tower',
      x: tower.x,
      y: tower.y,
      radius: tower.radius ?? towerPosition.radius,
      label: tower.label,
      sourceActionId: 'dev-tower-test',
      data: {
        towerTest: true,
        marker: towerPosition.marker,
        towerRole,
        style: FORSAKEN_TOWER_ROLE_STYLES[towerRole],
        showLabel: false
      }
    }));
  });
}

function resetBotsToSpawnCircle() {
  encounter.resetPlayerSpawns();
  canvasState.feedback = 'Bots reset to their starting circle.';
  drawArena();
}

function printPartyPositions() {
  const positions = encounter.state.players.map((player) => ({
    roleId: player.roleId,
    x: Number(player.x.toFixed(3)),
    y: Number(player.y.toFixed(3))
  }));

  partyPositionsOutput.value = JSON.stringify(positions, null, 2);
  canvasState.feedback = 'Party positions printed in the dev menu.';
}

function showFailureToast({ key, title = 'Mechanic failed', message, elapsedSeconds = encounter.elapsedSeconds }) {
  if (!message || shownFailureKeys.has(key)) {
    return;
  }

  shownFailureKeys.add(key);

  const toast = {
    id: ++failureToastId,
    title,
    message,
    time: formatElapsedTime(elapsedSeconds)
  };

  failureToasts.push(toast);

  const timeoutId = window.setTimeout(() => {
    removeFailureToast(toast.id);
  }, FAILURE_TOAST_LIFETIME_MS);

  failureToastTimers.set(toast.id, timeoutId);
}

function removeFailureToast(toastId) {
  const timeoutId = failureToastTimers.get(toastId);

  if (timeoutId) {
    window.clearTimeout(timeoutId);
    failureToastTimers.delete(toastId);
  }

  const toastIndex = failureToasts.findIndex((toast) => toast.id === toastId);

  if (toastIndex >= 0) {
    failureToasts.splice(toastIndex, 1);
  }
}

function clearFailureToasts({ clearSeen = true } = {}) {
  failureToastTimers.forEach((timeoutId) => window.clearTimeout(timeoutId));
  failureToastTimers.clear();
  failureToasts.splice(0, failureToasts.length);

  if (clearSeen) {
    shownFailureKeys.clear();
  }
}

function createHpSnapshot() {
  return new Map(encounter.state.players.map((player) => [player.roleId, player.hp]));
}

function syncFailureToasts(previousHp) {
  syncEmptyTowerFailureToasts();
  syncStackFailureToasts();
  syncDeathFailureToasts(previousHp);
}

function syncEmptyTowerFailureToasts() {
  const towerSnapshots = encounter.state.getMechanicData('towerSnapshots') ?? [];

  towerSnapshots.forEach((snapshot) => {
    if ((snapshot.occupantRoleIds?.length ?? 0) > 0) {
      return;
    }

    showFailureToast({
      key: `empty-tower-${snapshot.wave}-${snapshot.towerLabel}-${snapshot.resolvedAt}`,
      title: 'Tower missed',
      message: `Tower ${snapshot.towerLabel} had nobody inside.`,
      elapsedSeconds: snapshot.resolvedAt
    });
  });
}

function syncStackFailureToasts() {
  const markerResolves = encounter.state.getMechanicData('markerResolves') ?? [];

  markerResolves.forEach((resolve) => {
    if (
      resolve.markerType !== 'stack'
      || resolve.stackRequirementMet !== false
      || !resolve.stackRequirement
    ) {
      return;
    }

    const hitCount = new Set(resolve.hitRoleIds ?? []).size;

    showFailureToast({
      key: `stack-${resolve.wave}-${resolve.towerLabel}-${resolve.roleId}-${resolve.resolvedAt}`,
      title: 'Stack failed',
      message: `${resolve.roleId} stack only hit ${hitCount}/${resolve.stackRequirement} players.`,
      elapsedSeconds: resolve.resolvedAt
    });
  });
}

function syncDeathFailureToasts(previousHp) {
  const killedRoleIds = encounter.state.players
    .filter((player) => (previousHp.get(player.roleId) ?? player.hp) > 0 && player.hp <= 0)
    .map((player) => player.roleId);

  if (killedRoleIds.length === 0) {
    return;
  }

  showFailureToast({
    key: `death-${encounter.elapsedSeconds.toFixed(3)}-${killedRoleIds.join('-')}`,
    title: 'Player death',
    message: `Damage killed ${killedRoleIds.join(', ')}.`,
    elapsedSeconds: encounter.elapsedSeconds
  });
}

function syncControlledBot() {
  encounter.setControlledRole(getSelectedControlledRoleId());
}

function beginReplayRecording() {
  stopReplayPlayback();
  replayState.frames.splice(0, replayState.frames.length);
  replayState.active = false;
  replayState.index = 0;
  replayState.recording = true;
  replayState.completed = false;
  replayState.nextRecordTime = 0;
}

function recordReplayFrame(force = false) {
  if (!replayState.recording) {
    return;
  }

  if (!force && encounter.elapsedSeconds + 0.0001 < replayState.nextRecordTime) {
    return;
  }

  const frame = createReplayFrame();
  const lastFrame = replayState.frames[replayState.frames.length - 1];

  if (lastFrame && Math.abs(lastFrame.elapsedSeconds - frame.elapsedSeconds) < 0.001) {
    replayState.frames.splice(replayState.frames.length - 1, 1, frame);
  } else {
    replayState.frames.push(frame);
  }

  replayState.index = replayState.frames.length - 1;

  while (replayState.nextRecordTime <= encounter.elapsedSeconds) {
    replayState.nextRecordTime += REPLAY_RECORD_INTERVAL_SECONDS;
  }
}

function finishReplayRecording({ setFeedback = true } = {}) {
  if (!replayState.recording) {
    return;
  }

  recordReplayFrame(true);
  replayState.recording = false;
  replayState.completed = encounter.status === 'complete';
  replayState.index = replayState.frames.length - 1;

  if (setFeedback) {
    canvasState.feedback = replayState.completed
      ? 'Run complete. Replay timeline saved.'
      : 'Replay timeline saved up to the current point.';
  }
}

function clearReplay() {
  stopReplayPlayback();
  replayState.frames.splice(0, replayState.frames.length);
  replayState.active = false;
  replayState.index = 0;
  replayState.recording = false;
  replayState.completed = false;
  replayState.nextRecordTime = 0;
}

function createReplayFrame() {
  const timelineItem = encounter.currentTimelineItem;

  return {
    elapsedSeconds: encounter.elapsedSeconds,
    status: encounter.status,
    currentActionIndex: encounter.currentActionIndex,
    currentActionId: timelineItem?.id ?? null,
    resolveDisplay: createResolveDisplayData(encounter.state, timelineItem, encounter.elapsedSeconds),
    activeCast: clonePlain(encounter.activeCast),
    activeScreenFlash: clonePlain(encounter.activeScreenFlash),
    mechanicObjects: encounter.state.mechanicObjects.map((object) => ({
      id: object.id,
      type: object.type,
      x: object.x,
      y: object.y,
      radius: object.radius,
      label: object.label,
      sourceActionId: object.sourceActionId,
      active: object.active,
      data: clonePlain(object.data) ?? {}
    })),
    players: encounter.state.players.map((player) => ({
      id: player.id,
      role: player.role,
      roleId: player.roleId,
      label: player.label,
      color: player.color,
      icon: player.icon,
      x: player.x,
      y: player.y,
      controlled: player.controlled,
      maxHp: player.maxHp,
      hp: player.hp,
      hitboxRadius: player.hitboxRadius,
      marker: clonePlain(player.marker),
      debuffs: player.debuffs.map((debuff) => ({
        id: debuff.id,
        label: debuff.label,
        stacks: debuff.stacks,
        icon: debuff.icon,
        iconType: debuff.iconType
      }))
    }))
  };
}

function clonePlain(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function seekReplay() {
  if (!hasReplayFrames.value) {
    return;
  }

  stopEncounterLoop();
  stopManualMovementLoop();
  stopReplayPlayback();
  replayState.recording = false;
  replayState.index = Math.round(clamp(replayState.index, 0, replayMaxIndex.value));
  replayState.active = true;
  canvasState.feedback = `Replay at ${replayCurrentLabel.value}.`;
  drawArena();
}

function jumpReplayToStart() {
  if (!hasReplayFrames.value) {
    return;
  }

  stopEncounterLoop();
  stopManualMovementLoop();
  stopReplayPlayback();
  replayState.recording = false;
  replayState.index = 0;
  replayState.active = true;
  canvasState.feedback = 'Replay moved to the beginning.';
  drawArena();
}

function toggleReplayPlayback() {
  if (!hasReplayFrames.value) {
    return;
  }

  if (replayState.playing) {
    stopReplayPlayback();
    return;
  }

  stopEncounterLoop();
  stopManualMovementLoop();
  replayState.recording = false;
  replayState.active = true;
  replayState.playing = true;

  if (replayState.index >= replayMaxIndex.value) {
    replayState.index = 0;
  }

  replayPlaybackTimer = window.setInterval(() => {
    if (replayState.index >= replayMaxIndex.value) {
      stopReplayPlayback();
      drawArena();
      return;
    }

    replayState.index += 1;
    drawArena();
  }, REPLAY_RECORD_INTERVAL_SECONDS * 1000);

  drawArena();
}

function stopReplayPlayback() {
  window.clearInterval(replayPlaybackTimer);
  replayPlaybackTimer = null;
  replayState.playing = false;
}

function exitReplay() {
  stopReplayPlayback();
  replayState.active = false;
  canvasState.feedback = 'Returned to the live sim state.';
  drawArena();
}

function toggleTimer() {
  if (isPlaying.value) {
    stopEncounterLoop();
    return;
  }

  stopManualMovementLoop();

  if (replayState.active) {
    exitReplay();
  }

  if (wipePause.active) {
    continueAfterWipe();
    return;
  }

  syncMechanicPracticeSettings();
  syncMarkerEffectConfig();
  syncStrategyMovementSpeed();
  syncLateBotMovement();
  if (encounter.status === 'complete') {
    clearWipePause();
    clearFailureToasts();
    resetPeriodicHealing();
    encounter.resetToIdle();
    syncMarkerEffectConfig();
    syncStrategyMovementSpeed();
    syncLateBotMovement();
  }

  if (encounter.status === 'idle') {
    clearFailureToasts();
    resetPeriodicHealing();
    beginReplayRecording();
  } else if (!replayState.completed && hasReplayFrames.value) {
    replayState.recording = true;
    replayState.nextRecordTime = encounter.elapsedSeconds;
  }
  encounter.start();
  recordReplayFrame(true);
  isPlaying.value = true;
  encounterLoop?.start();
  drawArena();
}

function resetTimer() {
  stopEncounterLoop();
  stopManualMovementLoop();
  stopReplayPlayback();
  replayState.active = false;
  replayState.recording = false;
  clearWipePause();
  clearFailureToasts();
  resetPeriodicHealing();
  syncMechanicPracticeSettings();
  encounter.resetToIdle();
  syncMarkerEffectConfig();
  syncStrategyMovementSpeed();
  syncLateBotMovement();
  drawArena();
}

function updateEncounter(deltaSeconds) {
  const previousHp = createHpSnapshot();

  syncPeriodicLivingPlayerHeal(deltaSeconds);
  encounter.update(deltaSeconds);
  syncFailureToasts(previousHp);
  recordReplayFrame();

  if (handlePotentialWipePause()) {
    finishReplayRecording({ setFeedback: false });
    return;
  }

  if (encounter.status === 'complete') {
    finishReplayRecording();
    stopEncounterLoop();
  }
}

function startManualMovementLoop() {
  if (manualMovementFrameId !== null || encounterLoop?.running) {
    return;
  }

  manualMovementLastFrameMs = performance.now();
  manualMovementFrameId = requestAnimationFrame(updateManualMovementFrame);
}

function updateManualMovementFrame(nowMs) {
  const deltaSeconds = Math.min((nowMs - manualMovementLastFrameMs) / 1000, 0.25);
  manualMovementLastFrameMs = nowMs;
  encounter.updateControlledPlayerMovement(deltaSeconds);
  drawArena();

  if (encounter.hasControlledMovementTarget() && !encounterLoop?.running) {
    manualMovementFrameId = requestAnimationFrame(updateManualMovementFrame);
    return;
  }

  manualMovementFrameId = null;
}

function stopManualMovementLoop() {
  if (manualMovementFrameId === null) {
    return;
  }

  cancelAnimationFrame(manualMovementFrameId);
  manualMovementFrameId = null;
}

function stopEncounterLoop() {
  encounterLoop?.stop();
  isPlaying.value = false;
}

function syncPeriodicLivingPlayerHeal(deltaSeconds = 0) {
  const targetElapsedSeconds = encounter.elapsedSeconds + deltaSeconds;

  if (encounter.status !== 'running' || targetElapsedSeconds < periodicHealState.nextHealTime) {
    return;
  }

  while (periodicHealState.nextHealTime <= targetElapsedSeconds) {
    periodicHealState.nextHealTime += LIVING_PLAYER_HEAL_INTERVAL_SECONDS;
  }

  encounter.state.healLivingPlayersToFull();
}

function resetPeriodicHealing() {
  periodicHealState.nextHealTime = LIVING_PLAYER_HEAL_INTERVAL_SECONDS;
}

function handlePotentialWipePause() {
  if (encounter.status !== 'running' || wipePause.active || wipePause.dismissed) {
    return false;
  }

  if (!areAllPlayersDefeated()) {
    return false;
  }

  wipePause.active = true;
  wipePause.time = encounter.elapsedSeconds;
  canvasState.feedback = `Party KO at ${formatElapsedTime(encounter.elapsedSeconds)}.`;
  recordReplayFrame(true);
  stopEncounterLoop();
  drawArena();
  return true;
}

function areAllPlayersDefeated() {
  return encounter.state.players.length > 0
    && encounter.state.players.every((player) => player.hp <= 0);
}

function continueAfterWipe() {
  if (replayState.active) {
    exitReplay();
  }

  stopManualMovementLoop();
  wipePause.active = false;
  wipePause.dismissed = true;
  replayState.recording = true;
  replayState.nextRecordTime = encounter.elapsedSeconds;
  canvasState.feedback = 'Continuing after party KO for timeline review.';
  encounter.start();
  isPlaying.value = true;
  encounterLoop?.start();
  drawArena();
}

function clearWipePause() {
  wipePause.active = false;
  wipePause.dismissed = false;
  wipePause.time = 0;
}

function formatTime(seconds) {
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatElapsedTime(seconds) {
  const totalMilliseconds = Math.max(0, Math.floor(seconds * 1000));
  const minutes = Math.floor(totalMilliseconds / 60000);
  const secondsPart = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return `${String(minutes).padStart(2, '0')}:${String(secondsPart).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

function formatCastTime(seconds) {
  return `${seconds.toFixed(1)}s`;
}

function formatNormalizedRadius(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

watch(selectedRole, () => {
  if (selectedRole.value === WATCH_BOTS_ROLE_ID && practiceSettings.forcedOpeningGroup) {
    practiceSettings.forcedOpeningGroup = null;
  }

  syncControlledBot();
  syncMechanicPracticeSettings();
  if (practiceSettings.forcedOpeningGroup) {
    refreshIdleMechanicState();
  }
  canvasState.feedback = selectedRole.value === WATCH_BOTS_ROLE_ID
    ? 'Watch Bots selected. Strategy movement will control the full party.'
    : `${selectedRoleData.value.label} selected. Click the arena to move that player/bot.`;
  drawArena();
});

watch(
  () => [
    devSettings.showPlayerHitbox,
    devSettings.showAllHitboxes,
    devSettings.showTowerHitboxes,
    devSettings.showBossFacing,
    devSettings.devMovement,
    devSettings.previewMarkerEffects
  ],
  () => {
    drawArena();
  }
);

watch(
  () => practiceSettings.lateBotMovement,
  () => {
    syncLateBotMovement();
  }
);

watch(
  () => practiceSettings.lockTowersToC,
  () => {
    syncMechanicPracticeSettings();
    refreshIdleMechanicState();
  }
);

watch(
  () => practiceSettings.forcedOpeningGroup,
  () => {
    syncMechanicPracticeSettings();
    refreshIdleMechanicState();
  }
);

watch(
  () => devSettings.devMovement,
  (enabled) => {
    if (!enabled) {
      clearDevDragState();
    }
  }
);

watch(
  () => [
    devSettings.aoeRadius,
    devSettings.stackRadius,
    devSettings.coneLength,
    devSettings.coneDegrees,
    devSettings.coneFacingDegrees
  ],
  () => {
    syncMarkerEffectConfig();
    drawArena();
  }
);

watch(
  () => devSettings.botMovementSpeed,
  () => {
    syncStrategyMovementSpeed();
  }
);

watch(
  () => devSettings.devTowerRadius,
  () => {
    updateDevTowerSizes();
  }
);

watch(selectedMechanicId, (mechanicId) => {
  const firstStrategy = getStrategyOptionsForMechanic(mechanicId)[0];

  if (!firstStrategy) {
    return;
  }

  clearReplay();
  selectedStrategyId.value = firstStrategy.id;
  stopEncounterLoop();
  clearWipePause();
  clearFailureToasts();
  resetPeriodicHealing();
  syncMechanicPracticeSettings();
  encounter.load({
    mechanic: createMechanicById(mechanicId),
    strategy: createStrategyById(firstStrategy.id),
    roles,
    controlledRoleId: getSelectedControlledRoleId()
  });
  syncMarkerEffectConfig();
  syncStrategyMovementSpeed();
  syncLateBotMovement();
  canvasState.feedback = `${encounter.mechanic.label} selected. Start the timer or choose a timeline item to begin.`;
  preloadRenderableAssets();
  drawArena();
});

watch(selectedStrategyId, (strategyId) => {
  const strategy = createStrategyById(strategyId);

  if (strategy.mechanicId === encounter.mechanic.id) {
    clearReplay();
    clearFailureToasts();
    encounter.setStrategy(strategy);
    syncStrategyMovementSpeed();
    syncLateBotMovement();
    drawArena();
  }
});

onMounted(async () => {
  encounterLoop = new GameLoop({
    tickRate: 30,
    update: updateEncounter,
    render: drawArena
  });

  syncMechanicPracticeSettings();
  syncMarkerEffectConfig();
  syncStrategyMovementSpeed();
  syncLateBotMovement();
  await preloadRenderableAssets();

  await nextTick();
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(stageRef.value);
  window.addEventListener('resize', resizeCanvas);
});

onBeforeUnmount(() => {
  encounterLoop?.dispose();
  stopManualMovementLoop();
  stopReplayPlayback();
  clearFailureToasts();
  resizeObserver?.disconnect();
  window.removeEventListener('resize', resizeCanvas);
});
</script>

<template>
  <div class="app-shell">
    <aside v-if="showDevMenu" class="dev-menu" aria-label="Developer menu">
      <h2>DEV MENU</h2>
      <label class="dev-toggle">
        <input v-model="devSettings.showPlayerHitbox" type="checkbox" />
        <span>Show controlled player/bot hitbox</span>
      </label>
      <label class="dev-toggle">
        <input v-model="devSettings.showAllHitboxes" type="checkbox" />
        <span>Show all player/bot hitboxes</span>
      </label>
      <label class="dev-toggle">
        <input v-model="devSettings.showTowerHitboxes" type="checkbox" />
        <span>Show tower hitboxes</span>
      </label>
      <label class="dev-toggle">
        <input v-model="devSettings.showBossFacing" type="checkbox" />
        <span>Show boss/clone facing</span>
      </label>
      <div class="dev-actions">
        <button type="button" class="dev-action-button" @click="spawnDevTower">
          Spawn tower
        </button>
        <button type="button" class="dev-action-button" @click="runTowerTest">
          {{ towerTestLabel }}
        </button>
        <button type="button" class="dev-action-button" @click="clearDevTowers">
          Clear towers
        </button>
      </div>
      <label class="dev-range">
        <span>Tower size {{ devTowerSizeLabel }}</span>
        <input
          v-model.number="devSettings.devTowerRadius"
          type="range"
          min="0.025"
          max="0.14"
          step="0.005"
        />
      </label>
      <div class="dev-section">
        <h3>Movement</h3>
        <label class="dev-range">
          <span>Bot movement speed {{ botMovementSpeedLabel }}</span>
          <input
            v-model.number="devSettings.botMovementSpeed"
            type="range"
            min="0.05"
            max="1.4"
            step="0.05"
          />
        </label>
        <label class="dev-toggle">
          <input v-model="devSettings.devMovement" type="checkbox" />
          <span>Dev Movement</span>
        </label>
        <button type="button" class="dev-action-button wide" @click="printPartyPositions">
          Print party positions
        </button>
        <pre v-if="partyPositionsOutput" class="dev-output">{{ partyPositionsOutput }}</pre>
      </div>
      <div class="dev-section">
        <h3>Marker Effects</h3>
        <label class="dev-toggle">
          <input v-model="devSettings.previewMarkerEffects" type="checkbox" />
          <span>Preview marker hitboxes</span>
        </label>
        <label class="dev-range">
          <span>AOE radius {{ aoeRadiusLabel }}</span>
          <input
            v-model.number="devSettings.aoeRadius"
            type="range"
            min="0.03"
            max="0.35"
            step="0.005"
          />
        </label>
        <label class="dev-range">
          <span>Stack radius {{ stackRadiusLabel }}</span>
          <input
            v-model.number="devSettings.stackRadius"
            type="range"
            min="0.03"
            max="0.35"
            step="0.005"
          />
        </label>
        <label class="dev-range">
          <span>Cone length {{ coneLengthLabel }}</span>
          <input
            v-model.number="devSettings.coneLength"
            type="range"
            min="0.05"
            max="0.5"
            step="0.005"
          />
        </label>
        <label class="dev-range">
          <span>Cone width {{ coneDegreesLabel }}</span>
          <input
            v-model.number="devSettings.coneDegrees"
            type="range"
            min="10"
            max="180"
            step="5"
          />
        </label>
        <label class="dev-range">
          <span>Cone facing {{ coneFacingLabel }}</span>
          <input
            v-model.number="devSettings.coneFacingDegrees"
            type="range"
            min="-180"
            max="180"
            step="5"
          />
        </label>
      </div>
    </aside>

    <div v-if="failureToasts.length" class="failure-toast-stack" aria-live="assertive">
      <article
        v-for="toast in failureToasts"
        :key="toast.id"
        class="failure-toast"
        role="alert"
      >
        <span>{{ toast.time }}</span>
        <div>
          <strong>{{ toast.title }}</strong>
          <p>{{ toast.message }}</p>
        </div>
      </article>
    </div>

    <main class="layout-board" aria-label="UMAD mechanic simulator">
      <section class="control-panel card-surface">
        <div class="top-cell">
          <p class="eyebrow">UMAD</p>
          <h1>Mechanic Sim</h1>
        </div>

        <div class="top-cell">
          <p class="eyebrow">Built By</p>
          <strong>Your Local Grey-Parser</strong>
        </div>

        <a
          class="top-cell top-link"
          href="https://discord.gg/3HWQfqY7B9"
          target="_blank"
          rel="noreferrer"
        >
          <p class="eyebrow">Complain Here</p>
          <strong>
            <svg class="discord-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.6 5.2a15 15 0 0 0-3.7-1.1l-.5 1a13.7 13.7 0 0 0-4.8 0l-.5-1a15 15 0 0 0-3.7 1.1C3.1 8.6 2.5 12 2.8 15.4a15.1 15.1 0 0 0 4.6 2.3l1-1.6a9 9 0 0 1-1.6-.8l.4-.3a10.8 10.8 0 0 0 9.6 0l.4.3a9 9 0 0 1-1.6.8l1 1.6a15.1 15.1 0 0 0 4.6-2.3c.4-4-.7-7.3-3.6-10.2ZM9.1 13.8c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm5.8 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z" />
            </svg>
            Discord
          </strong>
        </a>

        <label class="control-field">
          <span>Mechanic</span>
          <select v-model="selectedMechanicId" :disabled="encounterActive">
            <option
              v-for="mechanic in mechanicOptions"
              :key="mechanic.id"
              :value="mechanic.id"
            >
              {{ mechanic.label }}
            </option>
          </select>
        </label>

        <label class="control-field">
          <span>Strategy</span>
          <select v-model="selectedStrategyId" :disabled="encounterActive">
            <option
              v-for="strategy in strategyOptions"
              :key="strategy.id"
              :value="strategy.id"
            >
              {{ strategy.label }}
            </option>
          </select>
        </label>
      </section>

      <section v-if="selectedRaidplanUrl" class="raidplan-card card-surface" aria-label="Selected strategy raidplan">
        <p class="eyebrow">Raidplan</p>
        <a
          :href="selectedRaidplanUrl"
          target="_blank"
          rel="noreferrer"
        >
          {{ selectedRaidplanUrl }}
        </a>
      </section>

      <aside class="role-panel-stack" :aria-label="encounterActive ? 'Party list and timeline' : 'Select role and timeline'">
        <section class="role-panel card-surface" :aria-label="encounterActive ? 'Party list' : 'Select role'">
          <div v-if="!encounterActive">
            <p class="eyebrow">Roles</p>
            <h2 class="text-lg font-black text-slate-50">Select Role</h2>
          </div>

          <label v-if="!encounterActive" class="mobile-role-select control-field">
            <span>Role</span>
            <select v-model="selectedRole" aria-label="Select role">
              <option :value="WATCH_BOTS_ROLE_ID">{{ watchBotsRole.label }}</option>
              <option
                v-for="role in roles"
                :key="role.id"
                :value="role.id"
              >
                {{ role.label }} - {{ role.group }}
              </option>
            </select>
          </label>

          <div v-if="!encounterActive" class="desktop-role-grid grid grid-cols-2 gap-3">
            <button
              type="button"
              class="role-button watch-bots-role col-span-2"
              :class="{ active: selectedRole === WATCH_BOTS_ROLE_ID }"
              :style="{ '--role-color': watchBotsRole.color }"
              aria-label="Watch Bots"
              @click="selectedRole = WATCH_BOTS_ROLE_ID"
            >
              <span class="role-icon-stack watch-bots-icon" aria-hidden="true">
                <span>{{ watchBotsRole.badge }}</span>
              </span>
              <span class="role-label">{{ watchBotsRole.label }}</span>
            </button>
            <button
              v-for="role in roles"
              :key="role.id"
              type="button"
              class="role-button"
              :class="{ active: selectedRole === role.id }"
              :style="{ '--role-color': role.color }"
              :aria-label="`Select ${role.label}`"
              @click="selectedRole = role.id"
            >
              <span class="role-icon-stack" aria-hidden="true">
                <img :src="role.icon" :alt="`${role.group} icon`" />
                <span class="role-badge">{{ role.badge }}</span>
              </span>
              <span class="role-label">{{ role.label }}</span>
            </button>
          </div>

          <div v-else class="party-list-shell">
            <div>
              <p class="eyebrow">Party</p>
              <h2 class="text-lg font-black text-slate-50">Party List</h2>
            </div>

            <div class="party-list" aria-label="Party members">
              <article
                v-for="row in partyListRows"
                :key="row.bot.roleId"
                class="party-row"
                :class="{ player: row.isPlayer }"
                :style="{ '--role-color': row.role.color }"
              >
                <span class="party-role-icon" aria-hidden="true">
                  <img :src="row.role.icon" :alt="`${row.role.group} icon`" />
                </span>
                <div class="party-frame">
                  <div class="party-header">
                    <strong>{{ row.isPlayer ? 'PLAYER' : row.role.label }}</strong>
                    <span v-if="row.isPlayer">{{ row.role.label }}</span>
                  </div>
                  <div class="hp-track" aria-label="HP">
                    <span class="hp-fill" :style="{ width: `${row.hpPercent}%` }" />
                  </div>
                </div>
                <div class="party-debuffs" aria-label="Debuffs">
                  <span
                    v-for="debuff in row.debuffs"
                    :key="debuff.id"
                    class="party-debuff-icon"
                    :class="debuff.iconType"
                    :aria-label="`${debuff.label} ${debuff.stacks}`"
                    :title="`${debuff.label} x${debuff.stacks}`"
                  >
                    <img v-if="debuff.icon" :src="debuff.icon" :alt="debuff.label" />
                    <span>{{ debuff.stacks }}</span>
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="card-surface timeline-card">
          <p class="eyebrow">Timeline</p>
          <div class="timeline-list mt-3" aria-label="Mechanic timeline">
            <div
              v-for="(step, index) in timelineItems"
              :key="step.id"
              :class="{ active: displayStatus === 'running' && displayCurrentActionIndex === index }"
            >
              <span>{{ formatTime(step.time) }}</span>
              <strong>{{ step.title }}</strong>
            </div>
          </div>
        </section>

        <section class="card-surface controlled-bot-card">
          <p class="eyebrow">Controlled bot</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ canvasState.feedback }}</p>
          <button type="button" class="panel-button mt-3 w-full" @click="resetBotsToSpawnCircle">
            Reset bot positions
          </button>
        </section>
      </aside>

      <section class="arena-panel" aria-label="Arena simulator">
        <div ref="stageRef" class="canvas-stage">
          <canvas
            ref="canvasRef"
            aria-label="UMAD arena map"
            @pointerdown="handleCanvasPointerDown"
            @pointermove="handleCanvasPointerMove"
            @pointerup="handleCanvasPointerUp"
            @pointerleave="handleCanvasPointerUp"
            @click="handleCanvasClick"
          />
        </div>

        <section v-if="activeCast" class="boss-castbar" aria-label="Boss castbar">
          <div class="castbar-frame">
            <div class="castbar-track">
              <div class="castbar-fill" :style="{ width: castProgressPercent }" />
              <div class="castbar-shine" />
            </div>
            <div class="castbar-name">{{ activeCast.label }}</div>
            <div class="castbar-time">{{ castRemainingLabel }}</div>
          </div>
        </section>
      </section>

      <aside class="info-panel-stack" aria-label="Mechanic information">
        <section class="card-surface role-summary">
          <span
            class="role-summary-icon"
            :class="{ 'watch-bots-icon': selectedRoleData.id === WATCH_BOTS_ROLE_ID }"
            :style="{ '--role-color': selectedRoleData.color }"
          >
            <img
              v-if="selectedRoleData.icon"
              :src="selectedRoleData.icon"
              :alt="`${selectedRoleData.group} icon`"
            />
            <span>{{ selectedRoleData.badge }}</span>
          </span>
          <div class="min-w-0">
            <p class="eyebrow">Selected role</p>
            <h2 class="truncate text-base font-black text-slate-50">
              {{ selectedRoleData.label }}
              <span v-if="selectedRoleData.id !== WATCH_BOTS_ROLE_ID"> - {{ selectedRoleData.group }}</span>
            </h2>
          </div>
        </section>

        <section class="card-surface">
          <p class="eyebrow">Timer</p>
          <div class="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <strong class="timer-value">
              {{ elapsedLabel }}
            </strong>
            <button
              type="button"
              class="panel-button timer-action"
              :class="isPlaying ? 'pause' : 'start'"
              @click="toggleTimer"
            >
              {{ timerActionLabel }}
            </button>
            <button type="button" class="panel-button timer-action reset" @click="resetTimer">Reset</button>
          </div>
          <label class="practice-toggle">
            <input v-model="practiceSettings.lateBotMovement" type="checkbox" />
            <span>Late bot movement</span>
          </label>
          <label class="practice-toggle">
            <input
              v-model="practiceSettings.lockTowersToC"
              type="checkbox"
              :disabled="encounterActive"
            />
            <span>Force C-side towers</span>
          </label>
          <label class="practice-toggle">
            <input
              type="checkbox"
              :checked="practiceSettings.forcedOpeningGroup === 'groupA'"
              :disabled="encounterActive || selectedRole === WATCH_BOTS_ROLE_ID"
              @change="setForcedOpeningGroup('groupA', $event.target.checked)"
            />
            <span>Force Group A RNG</span>
          </label>
          <label class="practice-toggle">
            <input
              type="checkbox"
              :checked="practiceSettings.forcedOpeningGroup === 'groupB'"
              :disabled="encounterActive || selectedRole === WATCH_BOTS_ROLE_ID"
              @change="setForcedOpeningGroup('groupB', $event.target.checked)"
            />
            <span>Force Group B RNG</span>
          </label>
        </section>

        <section class="card-surface replay-card">
          <div class="replay-card-header">
            <div>
              <p class="eyebrow">Replay</p>
              <strong>{{ replayStatusLabel }}</strong>
            </div>
            <button
              type="button"
              class="panel-button replay-play"
              :disabled="!hasReplayFrames"
              @click="toggleReplayPlayback"
            >
              {{ replayActionLabel }}
            </button>
          </div>
          <input
            v-model.number="replayState.index"
            class="replay-slider"
            type="range"
            min="0"
            :max="replayMaxIndex"
            step="1"
            :disabled="!hasReplayFrames"
            aria-label="Replay scrubber"
            @input="seekReplay"
          />
          <div class="replay-time-row">
            <span>{{ replayCurrentLabel }}</span>
            <span>{{ replayDurationLabel }}</span>
          </div>
          <div class="replay-actions">
            <button
              type="button"
              class="panel-button"
              :disabled="!hasReplayFrames"
              @click="jumpReplayToStart"
            >
              Start
            </button>
            <button
              type="button"
              class="panel-button"
              :disabled="!replayState.active"
              @click="exitReplay"
            >
              Live
            </button>
          </div>
        </section>

        <section v-if="wipePause.active" class="card-surface wipe-card">
          <p class="eyebrow">Party KO</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">
            All HP reached 0 at {{ formatElapsedTime(wipePause.time) }}.
          </p>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" class="panel-button wipe-continue" @click="continueAfterWipe">
              Keep Going
            </button>
            <button type="button" class="panel-button timer-action reset" @click="resetTimer">
              Reset
            </button>
          </div>
        </section>

        <section class="card-surface">
          <p class="eyebrow">Current call</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ selectedStep.callout }}</p>
        </section>

        <section class="card-surface resolve-note-card">
          <div class="resolve-note-header">
            <p class="eyebrow">Resolve note</p>
            <button
              type="button"
              class="resolve-hide-button"
              @click="resolveNoteHidden = !resolveNoteHidden"
            >
              {{ resolveNoteHidden ? 'Show' : 'Hide' }}
            </button>
          </div>

          <div class="resolve-note-body" :class="{ 'is-blurred': resolveNoteHidden }">
            <div class="resolve-progress" aria-label="Tower group soak sequence">
              <span
                v-for="(group, index) in visibleResolveDisplayData.soakSequence"
                :key="`${group}-${index}`"
                :class="{ active: index === visibleResolveDisplayData.activeTowerIndex }"
              >
                {{ group }}
              </span>
            </div>

            <div class="resolve-groups">
              <div>
                <span>Group A</span>
                <strong>{{ visibleResolveDisplayData.groupsReady ? visibleResolveDisplayData.groups.groupA.join('') : 'Pending' }}</strong>
              </div>
              <div>
                <span>Group B</span>
                <strong>{{ visibleResolveDisplayData.groupsReady ? visibleResolveDisplayData.groups.groupB.join('') : 'Pending' }}</strong>
              </div>
            </div>

            <table class="resolve-marker-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Holding</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visibleResolveDisplayData.markerRows" :key="row.roleId">
                  <th>{{ row.roleId }}</th>
                  <td :class="`marker-${row.markerType}`">{{ row.markerLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </aside>
    </main>

    <section
      class="mobile-options-drawer"
      :class="{ open: mobileDrawerOpen }"
      :aria-hidden="!mobileDrawerOpen"
      aria-label="Mobile simulator options"
    >
      <div class="mobile-drawer-header">
        <p class="eyebrow">{{ mobileActivePanelLabel }}</p>
        <button type="button" class="mobile-close-button" @click="closeMobileDrawer">
          Close
        </button>
      </div>

      <div v-show="mobileActivePanel === 'setup'" class="mobile-drawer-panel">
        <div class="mobile-meta-grid">
          <div>
            <p class="eyebrow">UMAD</p>
            <strong>Mechanic Sim</strong>
          </div>
          <div>
            <p class="eyebrow">Built By</p>
            <strong>Your Local Grey-Parser</strong>
          </div>
          <a
            href="https://discord.gg/3HWQfqY7B9"
            target="_blank"
            rel="noreferrer"
          >
            <p class="eyebrow">Complain Here</p>
            <strong>
              <svg class="discord-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.6 5.2a15 15 0 0 0-3.7-1.1l-.5 1a13.7 13.7 0 0 0-4.8 0l-.5-1a15 15 0 0 0-3.7 1.1C3.1 8.6 2.5 12 2.8 15.4a15.1 15.1 0 0 0 4.6 2.3l1-1.6a9 9 0 0 1-1.6-.8l.4-.3a10.8 10.8 0 0 0 9.6 0l.4.3a9 9 0 0 1-1.6.8l1 1.6a15.1 15.1 0 0 0 4.6-2.3c.4-4-.7-7.3-3.6-10.2ZM9.1 13.8c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm5.8 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z" />
              </svg>
              Discord
            </strong>
          </a>
        </div>

        <div class="mobile-select-grid">
          <label class="control-field">
            <span>Mechanic</span>
            <select v-model="selectedMechanicId" :disabled="encounterActive">
              <option
                v-for="mechanic in mechanicOptions"
                :key="mechanic.id"
                :value="mechanic.id"
              >
                {{ mechanic.label }}
              </option>
            </select>
          </label>

          <label class="control-field">
            <span>Strategy</span>
            <select v-model="selectedStrategyId" :disabled="encounterActive">
              <option
                v-for="strategy in strategyOptions"
                :key="strategy.id"
                :value="strategy.id"
              >
                {{ strategy.label }}
              </option>
            </select>
          </label>
        </div>

        <div v-if="selectedRaidplanUrl" class="mobile-raidplan">
          <p class="eyebrow">Raidplan</p>
          <a :href="selectedRaidplanUrl" target="_blank" rel="noreferrer">
            {{ selectedRaidplanUrl }}
          </a>
        </div>
      </div>

      <div v-show="mobileActivePanel === 'party'" class="mobile-drawer-panel">
        <template v-if="!encounterActive">
          <label class="control-field">
            <span>Role</span>
            <select v-model="selectedRole" aria-label="Select role">
              <option :value="WATCH_BOTS_ROLE_ID">{{ watchBotsRole.label }}</option>
              <option
                v-for="role in roles"
                :key="role.id"
                :value="role.id"
              >
                {{ role.label }} - {{ role.group }}
              </option>
            </select>
          </label>

          <section class="mobile-option-group role-summary">
            <span
              class="role-summary-icon"
              :class="{ 'watch-bots-icon': selectedRoleData.id === WATCH_BOTS_ROLE_ID }"
              :style="{ '--role-color': selectedRoleData.color }"
            >
              <img
                v-if="selectedRoleData.icon"
                :src="selectedRoleData.icon"
                :alt="`${selectedRoleData.group} icon`"
              />
              <span>{{ selectedRoleData.badge }}</span>
            </span>
            <div class="min-w-0">
              <p class="eyebrow">Selected role</p>
              <h2 class="truncate text-base font-black text-slate-50">
                {{ selectedRoleData.label }}
                <span v-if="selectedRoleData.id !== WATCH_BOTS_ROLE_ID"> - {{ selectedRoleData.group }}</span>
              </h2>
            </div>
          </section>
        </template>

        <div v-else class="party-list-shell">
          <div class="party-list" aria-label="Party members">
            <article
              v-for="row in partyListRows"
              :key="row.bot.roleId"
              class="party-row"
              :class="{ player: row.isPlayer }"
              :style="{ '--role-color': row.role.color }"
            >
              <span class="party-role-icon" aria-hidden="true">
                <img :src="row.role.icon" :alt="`${row.role.group} icon`" />
              </span>
              <div class="party-frame">
                <div class="party-header">
                  <strong>{{ row.isPlayer ? 'PLAYER' : row.role.label }}</strong>
                  <span v-if="row.isPlayer">{{ row.role.label }}</span>
                </div>
                <div class="hp-track" aria-label="HP">
                  <span class="hp-fill" :style="{ width: `${row.hpPercent}%` }" />
                </div>
              </div>
              <div class="party-debuffs" aria-label="Debuffs">
                <span
                  v-for="debuff in row.debuffs"
                  :key="debuff.id"
                  class="party-debuff-icon"
                  :class="debuff.iconType"
                  :aria-label="`${debuff.label} ${debuff.stacks}`"
                  :title="`${debuff.label} x${debuff.stacks}`"
                >
                  <img v-if="debuff.icon" :src="debuff.icon" :alt="debuff.label" />
                  <span>{{ debuff.stacks }}</span>
                </span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div v-show="mobileActivePanel === 'run'" class="mobile-drawer-panel">
        <section class="mobile-option-group">
          <p class="eyebrow">Timer</p>
          <div class="mobile-timer-row">
            <strong class="timer-value">{{ elapsedLabel }}</strong>
            <button
              type="button"
              class="panel-button timer-action"
              :class="isPlaying ? 'pause' : 'start'"
              @click="toggleTimer"
            >
              {{ timerActionLabel }}
            </button>
            <button type="button" class="panel-button timer-action reset" @click="resetTimer">
              Reset
            </button>
          </div>
          <label class="practice-toggle">
            <input v-model="practiceSettings.lateBotMovement" type="checkbox" />
            <span>Late bot movement</span>
          </label>
          <label class="practice-toggle">
            <input
              v-model="practiceSettings.lockTowersToC"
              type="checkbox"
              :disabled="encounterActive"
            />
            <span>Force C-side towers</span>
          </label>
          <label class="practice-toggle">
            <input
              type="checkbox"
              :checked="practiceSettings.forcedOpeningGroup === 'groupA'"
              :disabled="encounterActive || selectedRole === WATCH_BOTS_ROLE_ID"
              @change="setForcedOpeningGroup('groupA', $event.target.checked)"
            />
            <span>Force Group A RNG</span>
          </label>
          <label class="practice-toggle">
            <input
              type="checkbox"
              :checked="practiceSettings.forcedOpeningGroup === 'groupB'"
              :disabled="encounterActive || selectedRole === WATCH_BOTS_ROLE_ID"
              @change="setForcedOpeningGroup('groupB', $event.target.checked)"
            />
            <span>Force Group B RNG</span>
          </label>
        </section>

        <section class="mobile-option-group replay-card">
          <div class="replay-card-header">
            <div>
              <p class="eyebrow">Replay</p>
              <strong>{{ replayStatusLabel }}</strong>
            </div>
            <button
              type="button"
              class="panel-button replay-play"
              :disabled="!hasReplayFrames"
              @click="toggleReplayPlayback"
            >
              {{ replayActionLabel }}
            </button>
          </div>
          <input
            v-model.number="replayState.index"
            class="replay-slider"
            type="range"
            min="0"
            :max="replayMaxIndex"
            step="1"
            :disabled="!hasReplayFrames"
            aria-label="Replay scrubber"
            @input="seekReplay"
          />
          <div class="replay-time-row">
            <span>{{ replayCurrentLabel }}</span>
            <span>{{ replayDurationLabel }}</span>
          </div>
          <div class="replay-actions">
            <button
              type="button"
              class="panel-button"
              :disabled="!hasReplayFrames"
              @click="jumpReplayToStart"
            >
              Start
            </button>
            <button
              type="button"
              class="panel-button"
              :disabled="!replayState.active"
              @click="exitReplay"
            >
              Live
            </button>
          </div>
        </section>

        <section v-if="wipePause.active" class="mobile-option-group wipe-card">
          <p class="eyebrow">Party KO</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">
            All HP reached 0 at {{ formatElapsedTime(wipePause.time) }}.
          </p>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" class="panel-button wipe-continue" @click="continueAfterWipe">
              Keep Going
            </button>
            <button type="button" class="panel-button timer-action reset" @click="resetTimer">
              Reset
            </button>
          </div>
        </section>

        <section class="mobile-option-group">
          <p class="eyebrow">Current call</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ selectedStep.callout }}</p>
        </section>
      </div>

      <div v-show="mobileActivePanel === 'notes'" class="mobile-drawer-panel">
        <section class="resolve-note-card">
          <div class="resolve-note-header">
            <p class="eyebrow">Resolve note</p>
            <button
              type="button"
              class="resolve-hide-button"
              @click="resolveNoteHidden = !resolveNoteHidden"
            >
              {{ resolveNoteHidden ? 'Show' : 'Hide' }}
            </button>
          </div>

          <div class="resolve-note-body" :class="{ 'is-blurred': resolveNoteHidden }">
            <div class="resolve-progress" aria-label="Tower group soak sequence">
              <span
                v-for="(group, index) in visibleResolveDisplayData.soakSequence"
                :key="`${group}-${index}`"
                :class="{ active: index === visibleResolveDisplayData.activeTowerIndex }"
              >
                {{ group }}
              </span>
            </div>

            <div class="resolve-groups">
              <div>
                <span>Group A</span>
                <strong>{{ visibleResolveDisplayData.groupsReady ? visibleResolveDisplayData.groups.groupA.join('') : 'Pending' }}</strong>
              </div>
              <div>
                <span>Group B</span>
                <strong>{{ visibleResolveDisplayData.groupsReady ? visibleResolveDisplayData.groups.groupB.join('') : 'Pending' }}</strong>
              </div>
            </div>

            <table class="resolve-marker-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Holding</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visibleResolveDisplayData.markerRows" :key="row.roleId">
                  <th>{{ row.roleId }}</th>
                  <td :class="`marker-${row.markerType}`">{{ row.markerLabel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div v-show="mobileActivePanel === 'timeline'" class="mobile-drawer-panel">
        <section class="timeline-card">
          <p class="eyebrow">Timeline</p>
          <div class="timeline-list mt-3" aria-label="Mechanic timeline">
            <div
              v-for="(step, index) in timelineItems"
              :key="step.id"
              :class="{ active: displayStatus === 'running' && displayCurrentActionIndex === index }"
            >
              <span>{{ formatTime(step.time) }}</span>
              <strong>{{ step.title }}</strong>
            </div>
          </div>
        </section>

        <section class="mobile-option-group controlled-bot-card">
          <p class="eyebrow">Controlled bot</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ canvasState.feedback }}</p>
          <button type="button" class="panel-button mt-3 w-full" @click="resetBotsToSpawnCircle">
            Reset bot positions
          </button>
        </section>
      </div>
    </section>

    <nav class="mobile-bottom-nav" aria-label="Mobile simulator navigation">
      <button
        v-for="item in mobilePanelItems"
        :key="item.id"
        type="button"
        :class="{ active: mobileDrawerOpen && mobileActivePanel === item.id }"
        :aria-expanded="mobileDrawerOpen && mobileActivePanel === item.id"
        @click="setMobilePanel(item.id)"
      >
        <svg class="mobile-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          <g v-if="item.id === 'setup'">
            <path d="M4 7.5h16" />
            <path d="M4 16.5h16" />
            <circle cx="9" cy="7.5" r="2" />
            <circle cx="15" cy="16.5" r="2" />
          </g>
          <g v-else-if="item.id === 'party'">
            <circle cx="8" cy="8" r="3" />
            <circle cx="16" cy="8" r="3" />
            <path d="M3.5 19c.7-3.2 2.3-5 4.5-5s3.8 1.8 4.5 5" />
            <path d="M11.5 19c.7-3.2 2.3-5 4.5-5s3.8 1.8 4.5 5" />
          </g>
          <g v-else-if="item.id === 'run'">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" />
          </g>
          <g v-else-if="item.id === 'notes'">
            <path d="M7 4.5h10l2 2v13H5v-15h2Z" />
            <path d="M8 10h8" />
            <path d="M8 14h5" />
          </g>
          <g v-else>
            <path d="M5 6h14" />
            <path d="M5 12h14" />
            <path d="M5 18h14" />
            <circle cx="8" cy="6" r="1.5" />
            <circle cx="14" cy="12" r="1.5" />
            <circle cx="11" cy="18" r="1.5" />
          </g>
        </svg>
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>
