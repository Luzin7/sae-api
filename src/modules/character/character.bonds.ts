const BOND_SEPARATOR = ',';
const SPACE_RUN = /\s+/g;
const LOCALE = 'pt-BR';

function collapseSpaces(value: string): string {
  return value.trim().replace(SPACE_RUN, ' ');
}

function titleCaseWord(word: string): string {
  const first = word.charAt(0).toLocaleUpperCase(LOCALE);
  const rest = word.slice(1).toLocaleLowerCase(LOCALE);

  return first + rest;
}

function titleCase(tag: string): string {
  return tag.split(' ').map(titleCaseWord).join(' ');
}

function dedupeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();

  return tags.filter((tag) => {
    const key = tag.toLocaleLowerCase(LOCALE);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function normalizeBonds(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const tags = raw
    .split(BOND_SEPARATOR)
    .map(collapseSpaces)
    .filter((tag) => tag.length > 0)
    .map(titleCase);

  return dedupeTags(tags);
}

/** A normalized bonds patch; an omitted field must not overwrite stored bonds. */
export function bondsPatch(raw: string | undefined): { bonds?: string[] } {
  if (raw === undefined) return {};

  return { bonds: normalizeBonds(raw) };
}
