/** Stable no-ops so live Current-column components never write in the sandbox. */

export const sandboxNoop = (): void => {}

export const sandboxNoopAsync = async (): Promise<void> => {}

export function sandboxNoopPatch(
  _patch: Partial<{ adultId: string; kidIds: string[] }>,
): void {}
