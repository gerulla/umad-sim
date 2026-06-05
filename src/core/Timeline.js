import { TimelineItem } from './TimelineItem.js';

export class Timeline {
  constructor({ start, end, items = [] }) {
    this.start = normalizeTimelineItem(start, 'start');
    this.end = normalizeTimelineItem(end, 'end');
    this.items = items.map((item) => normalizeTimelineItem(item)).sort((a, b) => a.time - b.time);
  }

  get allItems() {
    return [this.start, ...this.items, this.end].sort((a, b) => a.time - b.time);
  }

  getItemByIndex(index) {
    return this.items[clampIndex(index, this.items.length)];
  }

  getItemIndexAtTime(seconds) {
    let itemIndex = 0;

    this.items.forEach((item, index) => {
      if (seconds >= item.time) {
        itemIndex = index;
      }
    });

    return itemIndex;
  }
}

function normalizeTimelineItem(item, fallbackKind = 'event') {
  if (item instanceof TimelineItem) {
    return item;
  }

  return new TimelineItem({ kind: fallbackKind, ...item });
}

function clampIndex(index, length) {
  return Math.max(0, Math.min(index, length - 1));
}
