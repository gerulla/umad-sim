import { EncounterState } from './EncounterState.js';
import { MechanicAction } from './MechanicAction.js';
import { Timeline } from './Timeline.js';
import { TimelineItem } from './TimelineItem.js';

export class BaseMechanic {
  constructor({ id, label, arena = {}, start, end, timeline = null, actions = [] }) {
    this.id = id;
    this.label = label;
    this.arena = {
      backgroundImage: null,
      ...arena
    };
    this.start = normalizeTimelineItem(start, 'start');
    this.end = normalizeTimelineItem(end, 'end');
    this.timeline = timeline || new Timeline({
      start: this.start,
      end: this.end,
      items: actions.map((action) => (
        action instanceof MechanicAction ? action : new MechanicAction(action)
      ))
    });
  }

  get actions() {
    return this.timeline.items.filter((item) => item.kind === 'action');
  }

  get timelineItems() {
    return this.timeline.items;
  }

  get allTimelineItems() {
    return this.timeline.allItems;
  }

  get duration() {
    return this.end.time - this.start.time;
  }

  createInitialState({ roles, controlledRoleId }) {
    return new EncounterState({
      roles,
      controlledRoleId,
      mechanicId: this.id
    });
  }

  initializeState(_state, _encounter) {}

  enterAction(action, state) {
    state.currentActionId = action.id;
  }

  update(_deltaSeconds, _state, _encounter) {}

  getActionByIndex(index) {
    return this.actions[clampIndex(index, this.actions.length)];
  }

  getActionIndexAtTime(seconds) {
    let actionIndex = 0;

    this.actions.forEach((action, index) => {
      if (seconds >= action.time) {
        actionIndex = index;
      }
    });

    return actionIndex;
  }
}

function normalizeTimelineItem(item, fallbackKind) {
  if (item instanceof TimelineItem) {
    return item;
  }

  return new TimelineItem({
    kind: fallbackKind,
    ...item
  });
}

function clampIndex(index, length) {
  return Math.max(0, Math.min(index, length - 1));
}
