/** Unicode-aware fold: NFD + strip diacritics + lowercase. */
export function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function nameMatches(fullName: string, query: string): boolean {
  const q = foldDiacritics(query.trim());
  if (!q) return true;
  return foldDiacritics(fullName).includes(q);
}
