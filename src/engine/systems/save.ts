export interface Progress {
  schemaVersion: 1;
  activated: boolean;
  completed: boolean;
}
export const freshProgress = (): Progress => ({
  schemaVersion: 1,
  activated: false,
  completed: false,
});
export function readProgress(
  gameId: string,
  storage?: Pick<Storage, 'getItem'>,
): Progress {
  try {
    const value: unknown = JSON.parse(
      (storage ?? localStorage).getItem(`pixelforge:v1:${gameId}`) ?? 'null',
    );
    if (
      value &&
      typeof value === 'object' &&
      'schemaVersion' in value &&
      value.schemaVersion === 1 &&
      'activated' in value &&
      typeof value.activated === 'boolean' &&
      'completed' in value &&
      typeof value.completed === 'boolean' &&
      (!value.completed || value.activated)
    )
      return value as Progress;
  } catch {
    /* Uszkodzony lub niedostępny zapis: nowa sesja. */
  }
  return freshProgress();
}
export function writeProgress(
  gameId: string,
  progress: Progress,
  storage?: Pick<Storage, 'setItem'>,
): boolean {
  try {
    (storage ?? localStorage).setItem(
      `pixelforge:v1:${gameId}`,
      JSON.stringify(progress),
    );
    return true;
  } catch {
    return false;
  }
}
