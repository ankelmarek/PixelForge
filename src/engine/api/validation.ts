import { RuleSystem } from '../systems/rules';
import type { Requirement, RuleAction } from './types';
import type { GameDefinition, LevelDefinition } from './types';
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path}: oczekiwano obiektu`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${path}: oczekiwano tekstu`);
}
function number(
  value: unknown,
  path: string,
  min = 0,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    throw new Error(`${path}: nieprawidłowa liczba`);
}
function point(value: unknown, path: string, width: number, height: number) {
  const p = record(value, path);
  number(p.x, `${path}.x`);
  number(p.y, `${path}.y`);
  if (p.x >= width || p.y >= height)
    throw new Error(`${path}: pozycja poza poziomem`);
  return p;
}
function asset(value: unknown, path: string) {
  text(value, path);
  if (
    !/^assets\/[a-zA-Z0-9_./-]+$/.test(value) ||
    value.split('/').includes('..')
  )
    throw new Error(`${path}: wymagana lokalna ścieżka assets/`);
}
export function validateGame(value: unknown): GameDefinition {
  const g = record(value, 'Gra');
  if (g.schemaVersion !== 1) throw new Error('Gra: nieobsługiwana wersja');
  text(g.id, 'id');
  if (!/^[a-z0-9-]+$/.test(g.id))
    throw new Error('id: nieprawidłowy identyfikator');
  for (const key of ['title', 'description']) text(g[key], key);
  const viewport = record(g.viewport, 'viewport');
  if (viewport.width !== 320 || viewport.height !== 180)
    throw new Error('viewport: M0 wymaga 320 × 180');
  asset(g.levelUrl, 'levelUrl');
  const assets = record(g.assets, 'assets');
  for (const key of ['player', 'background', 'terrain', 'beacon', 'portal'])
    asset(assets[key], `assets.${key}`);
  for (const [key, path] of Object.entries(assets))
    asset(path, `assets.${key}`);
  if (g.levels !== undefined) {
    if (
      !Array.isArray(g.levels) ||
      !g.levels.length ||
      g.levels[0] !== g.levelUrl ||
      new Set(g.levels).size !== g.levels.length
    )
      throw new Error('levels: nieprawidłowy katalog poziomów');
    g.levels.forEach((path, i) => asset(path, `levels[${i}]`));
  }
  if (g.version !== undefined) text(g.version, 'version');
  if (
    g.startingLives !== undefined &&
    (!Number.isInteger(g.startingLives) ||
      (g.startingLives as number) < 1 ||
      (g.startingLives as number) > 9)
  )
    throw new Error('startingLives: wymagane 1–9');
  if (g.registerRules !== undefined && typeof g.registerRules !== 'function')
    throw new Error('registerRules: rozszerzenie musi być zaufanym modułem TS');
  if (g.spriteSheets !== undefined) {
    for (const [key, value] of Object.entries(
      record(g.spriteSheets, 'spriteSheets'),
    )) {
      const sheet = record(value, key);
      if (!(key in assets)) throw new Error(`Brak tekstury: ${key}`);
      for (const field of ['frameWidth', 'frameHeight']) {
        number(sheet[field], field, 1);
        if (!Number.isInteger(sheet[field]) || (sheet[field] as number) > 256)
          throw new Error('Nieprawidłowa klatka');
      }
    }
  }
  const movement = record(g.movement, 'movement');
  for (const key of ['speed', 'jump', 'gravity'])
    number(movement[key], `movement.${key}`, 1);
  if (movement.acceleration !== undefined)
    number(movement.acceleration, 'acceleration', 1);
  return value as GameDefinition;
}
export function validateLevel(
  value: unknown,
  rules = new RuleSystem(),
): LevelDefinition {
  const l = record(value, 'Poziom');
  if (l.schemaVersion !== 1) throw new Error('Poziom: nieobsługiwana wersja');
  text(l.id, 'level.id');
  number(l.width, 'width', 320);
  number(l.height, 'height', 180);
  point(l.spawn, 'spawn', l.width, l.height);
  point(l.exit, 'exit', l.width, l.height);
  const interaction = point(l.interaction, 'interaction', l.width, l.height);
  if (interaction.action !== 'activate')
    throw new Error('interaction.action: nieznana akcja');
  if (!Array.isArray(l.platforms) || !l.platforms.length)
    throw new Error('platforms: wymagane platformy');
  l.platforms.forEach((value, i) => {
    const p = point(
      value,
      `platforms[${i}]`,
      l.width as number,
      l.height as number,
    );
    number(p.width, 'platform.width', 1);
    number(p.height, 'platform.height', 1);
    if (
      (p.x as number) + p.width > (l.width as number) ||
      (p.y as number) + p.height > (l.height as number)
    )
      throw new Error('platform: rozmiar poza poziomem');
  });
  const requirement = (value: unknown) => {
    if (value === undefined) return;
    const r = record(value, 'requires');
    if (
      r.allFlags !== undefined &&
      (!Array.isArray(r.allFlags) ||
        !r.allFlags.every(
          (flag) => typeof flag === 'string' && flag.length > 0,
        ))
    )
      throw new Error('allFlags: nieprawidłowe flagi');
    if (r.condition !== undefined) text(r.condition, 'condition');
    rules.validateRequirement(r as Requirement);
  };
  requirement(l.exitRequires);
  if (l.entities !== undefined) {
    if (!Array.isArray(l.entities))
      throw new Error('entities: oczekiwano listy');
    const ids = new Set<string>();
    for (const value of l.entities) {
      const e = point(value, 'entity', l.width, l.height);
      text(e.id, 'entity.id');
      if (ids.has(e.id)) throw new Error(`Powtórzone ID: ${e.id}`);
      ids.add(e.id);
      if (
        ![
          'trigger',
          'collectible',
          'enemy',
          'hazard',
          'checkpoint',
          'switch',
          'door',
        ].includes(String(e.type))
      )
        throw new Error(`Nieznany typ encji: ${e.type}`);
      for (const field of ['width', 'height'])
        if (e[field] !== undefined) number(e[field], field, 1);
      if (e.texture !== undefined) text(e.texture, 'texture');
      if (e.flag !== undefined) text(e.flag, 'flag');
      requirement(e.requires);
      if (e.onInteract !== undefined) {
        if (!Array.isArray(e.onInteract))
          throw new Error('onInteract: oczekiwano listy');
        for (const value of e.onInteract) {
          const a = record(value, 'action');
          text(a.action, 'action');
          if (a.value !== undefined && typeof a.value !== 'boolean')
            throw new Error('value: oczekiwano boolean');
          rules.validateAction(a as unknown as RuleAction);
        }
      }
      if (e.patrol !== undefined) {
        const p = record(e.patrol, 'patrol');
        number(p.min, 'patrol.min');
        number(p.max, 'patrol.max');
        number(p.speed, 'patrol.speed', 1);
        if (
          (p.max as number) <= (p.min as number) ||
          (p.max as number) >= (l.width as number) ||
          (e.x as number) < (p.min as number) ||
          (e.x as number) > (p.max as number)
        )
          throw new Error('patrol: nieprawidłowy zakres');
      }
    }
  }
  if (l.theme !== undefined) {
    const theme = record(l.theme, 'theme');
    text(theme.background, 'theme.background');
    number(theme.tint, 'theme.tint');
    if ((theme.tint as number) > 0xffffff)
      throw new Error('theme.tint: zły kolor');
    if (theme.decoration !== undefined) text(theme.decoration, 'decoration');
  }
  return value as LevelDefinition;
}
export async function loadLevel(
  url: string,
  signal?: AbortSignal,
  rules = new RuleSystem(),
): Promise<LevelDefinition> {
  const response = await fetch(new URL(url, document.baseURI), { signal });
  if (!response.ok)
    throw new Error(`Nie można wczytać poziomu (${response.status})`);
  return validateLevel(await response.json(), rules);
}
