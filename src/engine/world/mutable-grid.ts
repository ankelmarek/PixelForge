/** Sparse persistent edits over deterministic terrain. No full-world path search. */
export class MutableGrid {
  private edits = new Map<number, number>();
  private revisions = new Map<string, number>();
  readonly columns: number;
  readonly rows: number;
  constructor(
    readonly width: number,
    readonly height: number,
    readonly tileSize: number,
    readonly sectorCells: number,
    private base: (x: number, y: number) => number,
  ) {
    if (
      ![width, height, tileSize, sectorCells].every(
        (n) => Number.isInteger(n) && n > 0,
      ) ||
      width % tileSize ||
      height % tileSize ||
      (width * height) / tileSize ** 2 > 1048576
    )
      throw Error('Siatka: nieprawidłowe wymiary');
    this.columns = width / tileSize;
    this.rows = height / tileSize;
  }
  get count() {
    return this.edits.size;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return -1;
    return this.edits.get(y * this.columns + x) ?? this.base(x, y);
  }
  set(x: number, y: number, value: number) {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 255 ||
      this.get(x, y) === -1
    )
      throw Error('Siatka: nieprawidłowa komórka');
    if (this.get(x, y) === value) return false;
    const key = y * this.columns + x;
    if (value === this.base(x, y)) this.edits.delete(key);
    else this.edits.set(key, value);
    // Painters may inspect neighbors for borders; invalidate across sector edges.
    const sectors = new Set(
      [
        [x, y],
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
        .filter(
          ([cx, cy]) =>
            cx >= 0 && cy >= 0 && cx < this.columns && cy < this.rows,
        )
        .map(
          ([cx, cy]) =>
            `${Math.floor(cx / this.sectorCells)},${Math.floor(cy / this.sectorCells)}`,
        ),
    );
    for (const sector of sectors)
      this.revisions.set(sector, (this.revisions.get(sector) ?? 0) + 1);
    return true;
  }
  revision(x: number, y: number) {
    return this.revisions.get(`${x},${y}`) ?? 0;
  }
  paintCircle(
    x: number,
    y: number,
    radius: number,
    value: number,
    accepts: (previous: number) => boolean,
  ) {
    let changed = 0;
    for (
      let row = Math.max(0, Math.floor((y - radius) / this.tileSize));
      row < Math.min(this.rows, Math.ceil((y + radius) / this.tileSize));
      row++
    )
      for (
        let col = Math.max(0, Math.floor((x - radius) / this.tileSize));
        col < Math.min(this.columns, Math.ceil((x + radius) / this.tileSize));
        col++
      )
        if (
          Math.hypot(
            (col + 0.5) * this.tileSize - x,
            (row + 0.5) * this.tileSize - y,
          ) <= radius &&
          accepts(this.get(col, row))
        )
          changed += Number(this.set(col, row, value));
    return changed;
  }
  snapshot(): [number, number][] {
    return [...this.edits].sort((a, b) => a[0] - b[0]);
  }
  restore(value: unknown) {
    if (!Array.isArray(value) || value.length > this.columns * this.rows)
      throw Error('Siatka: nieprawidłowy zapis');
    const edits = new Map<number, number>();
    for (const pair of value) {
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        !Number.isInteger(pair[0]) ||
        pair[0] < 0 ||
        pair[0] >= this.columns * this.rows ||
        !Number.isInteger(pair[1]) ||
        pair[1] < 0 ||
        pair[1] > 255 ||
        edits.has(pair[0])
      )
        throw Error('Siatka: nieprawidłowy zapis komórki');
      edits.set(pair[0], pair[1]);
    }
    // Publish only after complete validation. Invalidate old and new sectors.
    const affected = new Set([...this.edits.keys(), ...edits.keys()]);
    this.edits = edits;
    for (const cell of affected) {
      const sx = Math.floor((cell % this.columns) / this.sectorCells),
        sy = Math.floor(Math.floor(cell / this.columns) / this.sectorCells);
      this.revisions.set(`${sx},${sy}`, this.revision(sx, sy) + 1);
    }
  }
}
