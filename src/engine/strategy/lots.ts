/** Integer quantities and quality moments: splitting never creates quality. */
export interface ResourceLot {
  id: string;
  owner: string;
  resource: string;
  kind: string;
  vintage: number;
  quantity: number;
  qualityMass: number;
  origins: string[];
}
export interface LotState {
  serial: number;
  lots: ResourceLot[];
}
export class LotBook {
  constructor(readonly state: LotState) {}
  list(owner: string, resource?: string, kind?: string) {
    return this.state.lots.filter(
      (l) =>
        l.owner === owner &&
        (!resource || l.resource === resource) &&
        (!kind || l.kind === kind),
    );
  }
  add(lot: Omit<ResourceLot, 'id'>) {
    if (
      !Number.isSafeInteger(lot.quantity) ||
      lot.quantity <= 0 ||
      !Number.isSafeInteger(lot.qualityMass) ||
      lot.qualityMass < 0 ||
      lot.qualityMass > lot.quantity * 10000
    )
      throw Error('Invalid resource lot');
    const same = this.list(lot.owner, lot.resource, lot.kind).find(
      (l) => l.vintage === lot.vintage,
    );
    if (same) {
      same.quantity += lot.quantity;
      same.qualityMass += lot.qualityMass;
      same.origins = [...new Set([...same.origins, ...lot.origins])].sort();
      return same;
    }
    const created = {
      ...lot,
      origins: [...lot.origins],
      id: `lot-${this.state.serial++}`,
    };
    this.state.lots.push(created);
    return created;
  }
  take(id: string, quantity: number): ResourceLot | null {
    const l = this.state.lots.find((l) => l.id === id);
    if (
      !l ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > l.quantity
    )
      return null;
    const part = {
      ...l,
      quantity,
      qualityMass: Math.floor((l.qualityMass * quantity) / l.quantity),
      origins: [...l.origins],
    };
    l.quantity -= quantity;
    l.qualityMass -= part.qualityMass;
    if (!l.quantity)
      this.state.lots = this.state.lots.filter((item) => item !== l);
    return part;
  }
  transfer(
    from: string,
    to: string,
    resource: string,
    kind: string,
    quantity: number,
  ) {
    const source = this.list(from, resource, kind);
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      source.reduce((n, l) => n + l.quantity, 0) < quantity
    )
      return false;
    for (const l of source) {
      const n = Math.min(quantity, l.quantity);
      if (!n) break;
      const part = this.take(l.id, n)!;
      this.add({ ...part, owner: to });
      quantity -= n;
    }
    return true;
  }
}
