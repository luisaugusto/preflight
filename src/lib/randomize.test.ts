import { shuffle } from '@/lib/randomize';

describe('shuffle', () => {
  it('randomizes item positions without adding or removing items', () => {
    const randomValues = [0, 0.5, 0.25];
    const randomized = shuffle(['A', 'B', 'C', 'D'], () => randomValues.shift() ?? 0);

    expect(randomized).toEqual(['C', 'D', 'B', 'A']);
    expect(new Set(randomized)).toEqual(new Set(['A', 'B', 'C', 'D']));
  });

  it('does not mutate the authored order', () => {
    const original = ['term 1', 'term 2', 'term 3'];

    shuffle(original, () => 0);

    expect(original).toEqual(['term 1', 'term 2', 'term 3']);
  });
});
