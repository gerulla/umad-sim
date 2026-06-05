export class TimelineItem {
  constructor({ id, kind = 'event', time, duration = 0, title, callout = '', detail = '', payload = {} }) {
    this.id = id;
    this.kind = kind;
    this.time = time;
    this.duration = duration;
    this.title = title;
    this.callout = callout;
    this.detail = detail;
    this.payload = payload;
  }
}
