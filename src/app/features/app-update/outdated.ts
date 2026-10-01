// A tab left open across a deploy asks for files the new version no longer has.
const OUTDATED =
  /dynamically imported module|importing a module script failed|unable to preload css|mime type|error loading dynamically imported/i;

export const isOutdated = (error: unknown): boolean =>
  OUTDATED.test(error instanceof Error ? error.message : String(error ?? ''));
