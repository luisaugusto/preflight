/// <reference types="jest" />

import { State } from 'ts-fsrs';

import {
  answerOutcomeToRating,
  createReviewCard,
  isReviewDue,
  previewReview,
  scheduleReview,
} from './fsrs';

describe('FSRS adapter', () => {
  const now = new Date('2026-07-12T12:00:00.000Z');

  it('creates a serializable new card', () => {
    const card = createReviewCard('lesson-1', 'lesson', now);
    expect(card).toMatchObject({
      contentId: 'lesson-1',
      contentType: 'lesson',
      due: now.toISOString(),
      state: State.New,
      reps: 0,
      lapses: 0,
      lastReview: null,
    });
    expect(isReviewDue(card, now)).toBe(true);
  });

  it('previews all ratings and schedules a selected review', () => {
    const card = createReviewCard('term-1', 'glossaryTerm', now);
    const previews = previewReview(card, now, { enable_fuzz: false });
    expect(Object.keys(previews)).toEqual(['again', 'hard', 'good', 'easy']);
    expect(new Date(previews.good.due).getTime()).toBeGreaterThan(now.getTime());

    const result = scheduleReview(card, 'good', now, { enable_fuzz: false });
    expect(result.card.reps).toBe(1);
    expect(result.card.lastReview).toBe(now.toISOString());
    expect(result.log.previousState).toBe(State.New);
    expect(result.log.reviewedAt).toBe(now.toISOString());
  });

  it('maps correctness and confidence onto review ratings', () => {
    expect(answerOutcomeToRating(false)).toBe('again');
    expect(answerOutcomeToRating({ isCorrect: true, confidence: 'low' })).toBe('hard');
    expect(answerOutcomeToRating(true)).toBe('good');
    expect(answerOutcomeToRating({ isCorrect: true, confidence: 'high' })).toBe('easy');
  });
});
