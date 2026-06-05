export class Debuff {
  constructor({ id, label, stacks = 0, icon = null, iconType = id, data = {} }) {
    this.id = id;
    this.label = label;
    this.stacks = stacks;
    this.icon = icon;
    this.iconType = iconType;
    this.data = data;
  }

  clone(overrides = {}) {
    return new Debuff({
      id: this.id,
      label: this.label,
      stacks: this.stacks,
      icon: this.icon,
      iconType: this.iconType,
      data: { ...this.data },
      ...overrides
    });
  }

  setStacks(stacks) {
    this.stacks = Math.max(0, stacks);
    return this;
  }

  decrement(amount = 1) {
    return this.setStacks(this.stacks - amount);
  }
}
