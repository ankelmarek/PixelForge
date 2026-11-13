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
  const movement = record(g.movement, 'movement');
  for (const key of ['speed', 'jump', 'gravity'])
    number(movement[key], `movement.${key}`, 1);
  return value as GameDefinition;
}
export function validateLevel(value: unknown): LevelDefinition {
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
  return value as LevelDefinition;
}
export async function loadLevel(
  url: string,
  signal?: AbortSignal,
): Promise<LevelDefinition> {
  const response = await fetch(new URL(url, document.baseURI), { signal });
  if (!response.ok)
    throw new Error(`Nie można wczytać poziomu (${response.status})`);
  return validateLevel(await response.json());
}
