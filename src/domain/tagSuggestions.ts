/**
 * Tag suggestions for the tag input. `usedTags` are the existing tags, most used first.
 * While typing: every used tag that starts with the typed text (ignoring case).
 * Empty field: the 5 most used tags. Already chosen tags are never suggested.
 */
export function suggestTags(usedTags: readonly string[], query: string, selected: readonly string[], emptyLimit = 5): string[] {
  const q = query.trim().toLowerCase();
  const chosen = new Set(selected.map((x) => x.toLowerCase()));
  const matches = usedTags.filter((s) => !chosen.has(s.toLowerCase()) && (q === '' || s.toLowerCase().startsWith(q)));
  return q === '' ? matches.slice(0, emptyLimit) : matches;
}

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Adds a tag name to a list unless it is empty or already present (ignoring case). */
export function addTagName(tags: readonly string[], raw: string): string[] {
  const name = normalize(raw);
  if (!name) return [...tags];
  if (tags.some((x) => x.toLowerCase() === name.toLowerCase())) return [...tags];
  return [...tags, name];
}

/** Splits comma-separated input and adds every part. Returns the new list and the text left in the field. */
export function addTagsFromInput(tags: readonly string[], input: string): { tags: string[]; rest: string } {
  if (!input.includes(',')) return { tags: [...tags], rest: input };
  let out = [...tags];
  for (const part of input.split(',')) out = addTagName(out, part);
  return { tags: out, rest: '' };
}

/** The tags to save: the chosen chips plus whatever is still typed in the field. */
export function withPendingTag(tags: readonly string[], pendingText: string): string[] {
  return addTagName(tags, pendingText);
}
