import { TimelineItem } from './TimelineItem.js';

export class MechanicAction extends TimelineItem {
  constructor({ id, type, time, title, callout, detail, payload = {}, validate = true }) {
    super({
      id,
      kind: 'action',
      time,
      title,
      callout,
      detail,
      payload
    });
    this.type = type;
    this.validate = validate;
  }
}
