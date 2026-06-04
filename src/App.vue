<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

const roleIconSources = {
  tank: '/role-icons/Tank_Icon_1.png',
  healer: '/role-icons/Healer_Icon_1.png',
  melee: '/role-icons/Melee_DPS_Icon_1.png',
  physicalRanged: '/role-icons/Physical_Ranged_DPS_Icon_1.png',
  magicRanged: '/role-icons/Magic_Ranged_DPS_Icon_1.png'
};

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

const mechanicOptions = [
  { id: 'forsaken', label: 'Forsaken' }
];

const strategyOptions = [
  { id: 'lpdu', label: 'LPDU' }
];

const forsakenSteps = [
  {
    id: 'conga',
    time: 0,
    title: 'Opening lineup',
    callout: 'Identify your role, marker type, and conga priority.',
    detail: 'Start from the assigned conga. Supports and DPS split by the plan once cone, stack, and chariot markers appear.'
  },
  {
    id: 'safe-1',
    time: 8,
    title: 'Tower set 1 - Safe',
    callout: 'Stacks, one cone, and one chariot activate the first safe towers.',
    detail: 'Face the tower pair as relative south. Cones sort left, chariots sort right, and stack players share the safe tower.'
  },
  {
    id: 'bait-2',
    time: 18,
    title: 'Tower set 2 - Bait',
    callout: 'Players who did not just soak handle the bait towers.',
    detail: 'The previous tower soakers stay close to boss for Kefka clone baits while the new cone and chariot players take towers.'
  },
  {
    id: 'safe-3',
    time: 30,
    title: 'Tower set 3 - Safe',
    callout: 'Resolve clone kicks together, then move into the safe towers.',
    detail: 'The players who soaked set 2 now continue the debuff cycle. Match roles first, then use north-to-south priority.'
  },
  {
    id: 'bait-4',
    time: 42,
    title: 'Tower set 4 - Bait',
    callout: 'Swap back to the players who skipped the previous tower.',
    detail: 'Bait towers keep the cone and chariot economy moving. The group that just soaked handles clone baiting near boss.'
  },
  {
    id: 'safe-5',
    time: 54,
    title: 'Tower set 5 - Safe',
    callout: 'Repeat the safe tower pattern with the refreshed markers.',
    detail: 'Safe sets consume stack markers and refresh the next pair of cone and chariot assignments.'
  },
  {
    id: 'bait-6',
    time: 66,
    title: 'Tower set 6 - Bait',
    callout: 'Non-soakers take the bait towers again.',
    detail: 'Keep the clone baits tight inside the boss hitbox so the party can move together after the cast locks.'
  },
  {
    id: 'safe-7',
    time: 78,
    title: 'Tower set 7 - Safe',
    callout: 'Final safe tower cycle before the last bait set.',
    detail: 'Everyone should be approaching zero Spell Trouble stacks. Stay strict on priority so nobody steals a soak.'
  },
  {
    id: 'bait-8',
    time: 90,
    title: 'Tower set 8 - Bait',
    callout: 'Last tower set. Finish the fourth soak count cleanly.',
    detail: 'After this set, every player should have soaked exactly four times before the final raidwide.'
  },
  {
    id: 'post',
    time: 102,
    title: 'Post-towers',
    callout: 'Stack for the final bait and prepare for the raidwide.',
    detail: 'Finish the last All Things Ending movement, then stabilize north for the end of Forsaken.'
  },
  {
    id: 'loj',
    time: 112,
    title: 'Light of Judgement',
    callout: 'Heavy raidwide. Any remaining Spell Trouble stacks kill.',
    detail: 'This is the check that everyone completed their four tower soaks.'
  }
];

const waymarkers = [
  { label: 'A', x: 0.5, y: 0.08, color: '#f05270', shape: 'circle' },
  { label: 'B', x: 0.92, y: 0.5, color: '#e7cf50', shape: 'circle' },
  { label: 'C', x: 0.5, y: 0.92, color: '#62aef7', shape: 'circle' },
  { label: 'D', x: 0.08, y: 0.5, color: '#a978dc', shape: 'circle' },
  { label: '1', x: 0.25, y: 0.25, color: '#f05270', shape: 'square' },
  { label: '2', x: 0.75, y: 0.25, color: '#e7cf50', shape: 'square' },
  { label: '3', x: 0.75, y: 0.75, color: '#62aef7', shape: 'square' },
  { label: '4', x: 0.25, y: 0.75, color: '#a978dc', shape: 'square' }
];

const canvasRef = ref(null);
const stageRef = ref(null);
const selectedRole = ref('MT');
const selectedMechanicId = ref('forsaken');
const selectedStrategyId = ref('lpdu');
const selectedStepIndex = ref(0);
const elapsedSeconds = ref(0);
const isPlaying = ref(false);
const canvasState = reactive({
  imageReady: false,
  size: { width: 0, height: 0 },
  placement: null,
  feedback: 'Click the arena to drop your selected role marker.'
});

let arenaImage;
const roleIconImages = new Map();
let resizeObserver;
let timerId;

const selectedMechanic = computed(() => {
  return mechanicOptions.find((mechanic) => mechanic.id === selectedMechanicId.value) || mechanicOptions[0];
});

const selectedRoleData = computed(() => {
  return roles.find((role) => role.id === selectedRole.value) || roles[0];
});

const selectedStep = computed(() => {
  return forsakenSteps[selectedStepIndex.value] || forsakenSteps[0];
});

const elapsedLabel = computed(() => formatTime(elapsedSeconds.value));

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
  waymarkers.forEach((marker) => drawWaymarker(ctx, marker, width, height));

  if (canvasState.placement) {
    drawRolePlacement(ctx, canvasState.placement, width, height);
  }

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

function drawRolePlacement(ctx, placement, width, height) {
  const role = selectedRoleData.value;
  const x = placement.x * width;
  const y = placement.y * height;
  const markerSize = Math.min(width, height) * 0.078;
  const radius = markerSize * 0.5;
  const icon = roleIconImages.get(role.icon);

  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 18, 0.88)';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = role.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (icon?.complete && icon.naturalWidth > 0) {
    const imageSize = markerSize * 0.72;
    ctx.drawImage(icon, x - imageSize / 2, y - imageSize / 2, imageSize, imageSize);
  } else {
    ctx.fillStyle = role.color;
    ctx.font = `900 ${Math.round(radius * 0.72)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(role.label, x, y + 1);
  }

  drawRoleBadge(ctx, role.badge, x + radius * 0.48, y + radius * 0.48, role.color, markerSize * 0.34);
  ctx.restore();
}

function drawRoleBadge(ctx, label, x, y, color, size) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 18, 0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(size * (label.length > 1 ? 0.42 : 0.58))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
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
  const rect = canvasRef.value.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const role = selectedRoleData.value;

  canvasState.placement = { x, y };
  canvasState.feedback = `${role.label} placed at ${Math.round(x * 100)}%, ${Math.round(y * 100)}%.`;
  drawArena();
}

function resetPlacement() {
  canvasState.placement = null;
  canvasState.feedback = 'Click the arena to drop your selected role marker.';
  drawArena();
}

function setStep(index) {
  selectedStepIndex.value = Math.max(0, Math.min(index, forsakenSteps.length - 1));
  elapsedSeconds.value = forsakenSteps[selectedStepIndex.value].time;
}

function previousStep() {
  setStep(selectedStepIndex.value - 1);
}

function nextStep() {
  setStep(selectedStepIndex.value + 1);
}

function toggleTimer() {
  isPlaying.value = !isPlaying.value;
}

function resetTimer() {
  isPlaying.value = false;
  setStep(0);
}

function syncStepToElapsed(seconds) {
  let nextIndex = 0;

  forsakenSteps.forEach((step, index) => {
    if (seconds >= step.time) {
      nextIndex = index;
    }
  });

  selectedStepIndex.value = nextIndex;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

watch(selectedRole, () => {
  drawArena();
});

watch(selectedStepIndex, () => {
  drawArena();
});

watch(elapsedSeconds, (seconds) => {
  syncStepToElapsed(seconds);
});

watch(isPlaying, (playing) => {
  window.clearInterval(timerId);

  if (!playing) {
    return;
  }

  timerId = window.setInterval(() => {
    elapsedSeconds.value += 1;

    if (elapsedSeconds.value >= forsakenSteps[forsakenSteps.length - 1].time) {
      isPlaying.value = false;
    }
  }, 1000);
});

onMounted(async () => {
  arenaImage = new Image();
  arenaImage.src = '/umad_bg.jpeg';
  arenaImage.onload = () => {
    canvasState.imageReady = true;
    resizeCanvas();
  };

  roles.forEach((role) => {
    if (roleIconImages.has(role.icon)) {
      return;
    }

    const image = new Image();
    image.onload = drawArena;
    image.src = role.icon;
    roleIconImages.set(role.icon, image);
  });

  await nextTick();
  resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(stageRef.value);
  window.addEventListener('resize', resizeCanvas);
});

onBeforeUnmount(() => {
  window.clearInterval(timerId);
  resizeObserver?.disconnect();
  window.removeEventListener('resize', resizeCanvas);
});
</script>

<template>
  <div class="app-shell">
    <main class="layout-board" aria-label="UMAD mechanic simulator">
      <section class="control-panel card-surface">
        <div class="min-w-0">
          <p class="eyebrow">UMAD</p>
          <h1 class="truncate text-base font-black text-slate-50">Mechanic Sim</h1>
        </div>

        <div class="grid min-w-0 grid-cols-2 gap-3">
          <label class="control-field">
            <span>Mechanic</span>
            <select v-model="selectedMechanicId">
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
            <select v-model="selectedStrategyId">
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
      </section>

      <section class="role-panel card-surface" aria-label="Select role">
        <div>
          <p class="eyebrow">Roles</p>
          <h2 class="text-lg font-black text-slate-50">Select Role</h2>
        </div>

        <div class="grid grid-cols-2 gap-3">
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
      </section>

      <section class="arena-panel" aria-label="Arena simulator">
        <div ref="stageRef" class="canvas-stage">
          <canvas
            ref="canvasRef"
            aria-label="UMAD arena map"
            @click="handleCanvasClick"
          />
        </div>
      </section>

      <aside class="info-panel-stack" aria-label="Mechanic information">
        <section class="card-surface role-summary">
          <span class="role-summary-icon" :style="{ '--role-color': selectedRoleData.color }">
            <img :src="selectedRoleData.icon" :alt="`${selectedRoleData.group} icon`" />
            <span>{{ selectedRoleData.badge }}</span>
          </span>
          <div class="min-w-0">
            <p class="eyebrow">Selected role</p>
            <h2 class="truncate text-base font-black text-slate-50">
              {{ selectedRoleData.label }} - {{ selectedRoleData.group }}
            </h2>
          </div>
        </section>

        <section class="card-surface">
          <p class="eyebrow">Timer</p>
          <div class="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <strong class="text-3xl font-black tabular-nums text-amber-300">
              {{ elapsedLabel }}
            </strong>
            <button type="button" class="panel-button" @click="toggleTimer">
              {{ isPlaying ? 'Pause' : 'Start' }}
            </button>
            <button type="button" class="panel-button" @click="resetTimer">Reset</button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <button type="button" class="panel-button" @click="previousStep">Prev</button>
            <button type="button" class="panel-button" @click="nextStep">Next</button>
          </div>
        </section>

        <section class="card-surface">
          <p class="eyebrow">Current call</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ selectedStep.callout }}</p>
        </section>

        <section class="card-surface">
          <p class="eyebrow">Resolve note</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ selectedStep.detail }}</p>
        </section>

        <section class="card-surface timeline-card">
          <p class="eyebrow">Timeline</p>
          <div class="timeline-list mt-3" aria-label="Forsaken timeline">
            <button
              v-for="(step, index) in forsakenSteps"
              :key="step.id"
              type="button"
              :class="{ active: selectedStepIndex === index }"
              @click="setStep(index)"
            >
              <span>{{ formatTime(step.time) }}</span>
              <strong>{{ step.title }}</strong>
            </button>
          </div>
        </section>

        <section class="card-surface">
          <p class="eyebrow">Arena marker</p>
          <p class="mt-2 text-sm leading-6 text-slate-200">{{ canvasState.feedback }}</p>
          <button type="button" class="panel-button mt-3 w-full" @click="resetPlacement">
            Clear arena marker
          </button>
        </section>
      </aside>
    </main>
  </div>
</template>
