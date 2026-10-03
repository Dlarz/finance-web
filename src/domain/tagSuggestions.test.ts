import { describe, expect, it } from 'vitest';
import { suggestTags } from './tagSuggestions';

// existing tags, most used first
const used = ['Mama', 'coop', 'Migros', 'mapa', 'lunch', 'Oma', 'sbb', 'ferien'];

describe('tag suggestions', () => {
  it('shows all used tags that start with the typed text, ignoring case, most used first', () => {
    expect(suggestTags(used, 'Ma', [])).toEqual(['Mama', 'mapa']);
    expect(suggestTags(used, 'ma', [])).toEqual(['Mama', 'mapa']);
    expect(suggestTags(used, 'MA', [])).toEqual(['Mama', 'mapa']);
    expect(suggestTags(used, 'm', [])).toEqual(['Mama', 'Migros', 'mapa']);
  });

  it('only matches the beginning of a tag, not the middle', () => {
    // "Oma" contains "ma" but does not start with it
    expect(suggestTags(used, 'ma', [])).not.toContain('Oma');
  });

  it('shows the 5 most used tags when the field is empty', () => {
    expect(suggestTags(used, '', [])).toEqual(['Mama', 'coop', 'Migros', 'mapa', 'lunch']);
    expect(suggestTags(used, '   ', [])).toHaveLength(5);
  });

  it('does not suggest tags that are already chosen, ignoring case', () => {
    expect(suggestTags(used, 'ma', ['mama'])).toEqual(['mapa']);
    expect(suggestTags(used, '', ['COOP', 'Mama'])).toEqual(['Migros', 'mapa', 'lunch', 'Oma', 'sbb']);
  });

  it('shows every match while typing, not only the first few', () => {
    const many = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    expect(suggestTags(many, 'tag', [])).toHaveLength(12);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(suggestTags(used, ' Ma ', [])).toEqual(['Mama', 'mapa']);
  });
});

describe('adding tags', () => {
  it('adds a typed name once, ignoring case and whitespace', async () => {
    const { addTagName, withPendingTag, addTagsFromInput } = await import('./tagSuggestions');
    expect(addTagName([], '  Mama ')).toEqual(['Mama']);
    expect(addTagName(['Mama'], 'mama')).toEqual(['Mama']);
    expect(addTagName(['Mama'], '')).toEqual(['Mama']);
    expect(withPendingTag(['coop'], 'Papa')).toEqual(['coop', 'Papa']);
    expect(withPendingTag(['coop'], '   ')).toEqual(['coop']);
    expect(addTagsFromInput(['a'], 'b, c,A')).toEqual({ tags: ['a', 'b', 'c'], rest: '' });
    expect(addTagsFromInput(['a'], 'bc')).toEqual({ tags: ['a'], rest: 'bc' });
  });
});
