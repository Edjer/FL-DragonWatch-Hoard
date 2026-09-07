export function dedupeIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].filter((id) => /^\d+$/.test(id));
}

export function missingIds(
  ids: Iterable<string>,
  cached: ReadonlySet<string>,
  pending: ReadonlySet<string>,
): string[] {
  return dedupeIds(ids).filter((id) => !cached.has(id) && !pending.has(id));
}
