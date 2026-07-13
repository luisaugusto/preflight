import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  type Card,
  type FSRSParameters,
  type Grade,
} from 'ts-fsrs';

import type { ReviewableContentType } from './content/types';
import type { ReviewCardRecord, ReviewLogRecord } from './db';

export type FsrsRating = 'again' | 'hard' | 'good' | 'easy';
export type AnswerConfidence = 'low' | 'medium' | 'high';

export const DEFAULT_FSRS_PARAMETERS: Partial<FSRSParameters> = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ['1m', '10m'],
  relearning_steps: ['10m'],
};

export interface FsrsReviewResult {
  card: ReviewCardRecord;
  log: ReviewLogRecord;
}

export interface ReviewPreview {
  rating: FsrsRating;
  due: string;
  scheduledDays: number;
  state: State;
}

export type ReviewPreviews = Record<FsrsRating, ReviewPreview>;

function validDate(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Expected a valid review date');
  return date;
}

function assertStoredCard(card: ReviewCardRecord): void {
  const numbers = [
    card.stability,
    card.difficulty,
    card.elapsedDays,
    card.scheduledDays,
    card.learningSteps,
    card.reps,
    card.lapses,
    card.state,
  ];
  if (!numbers.every(Number.isFinite)) throw new TypeError('Review card contains invalid numbers');
  if (![State.New, State.Learning, State.Review, State.Relearning].includes(card.state)) {
    throw new RangeError('Review card contains an invalid FSRS state');
  }
  validDate(card.due);
  if (card.lastReview) validDate(card.lastReview);
}

export function toFsrsCard(card: ReviewCardRecord): Card {
  assertStoredCard(card);
  return {
    due: validDate(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ? validDate(card.lastReview) : undefined,
  };
}

export function fromFsrsCard(
  card: Card,
  identity: Pick<ReviewCardRecord, 'contentId' | 'contentType'>,
  updatedAt: string | Date = new Date(),
): ReviewCardRecord {
  return {
    contentId: identity.contentId,
    contentType: identity.contentType,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString() ?? null,
    updatedAt: validDate(updatedAt).toISOString(),
  };
}

export function createReviewCard(
  contentId: string,
  contentType: ReviewableContentType,
  now: string | Date = new Date(),
): ReviewCardRecord {
  const date = validDate(now);
  return fromFsrsCard(createEmptyCard(date), { contentId, contentType }, date);
}

export function ratingToGrade(rating: FsrsRating | Grade): Grade {
  if (typeof rating === 'number') {
    if ([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].includes(rating)) return rating;
    throw new RangeError('FSRS grade must be Again, Hard, Good, or Easy');
  }
  switch (rating) {
    case 'again':
      return Rating.Again;
    case 'hard':
      return Rating.Hard;
    case 'good':
      return Rating.Good;
    case 'easy':
      return Rating.Easy;
  }
}

function gradeToRating(grade: Grade): FsrsRating {
  switch (grade) {
    case Rating.Again:
      return 'again';
    case Rating.Hard:
      return 'hard';
    case Rating.Good:
      return 'good';
    case Rating.Easy:
      return 'easy';
  }
}

export function scheduleReview(
  current: ReviewCardRecord,
  rating: FsrsRating | Grade,
  reviewedAt: string | Date = new Date(),
  parameters: Partial<FSRSParameters> = DEFAULT_FSRS_PARAMETERS,
): FsrsReviewResult {
  const now = validDate(reviewedAt);
  const grade = ratingToGrade(rating);
  const scheduler = fsrs({ ...DEFAULT_FSRS_PARAMETERS, ...parameters });
  const result = scheduler.next(toFsrsCard(current), now, grade);
  const card = fromFsrsCard(result.card, current, now);
  return {
    card,
    log: {
      contentId: current.contentId,
      contentType: current.contentType,
      rating: result.log.rating,
      previousState: current.state,
      due: result.card.due.toISOString(),
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsedDays: result.log.elapsed_days,
      scheduledDays: result.card.scheduled_days,
      learningSteps: result.card.learning_steps,
      reviewedAt: now.toISOString(),
    },
  };
}

export function previewReview(
  current: ReviewCardRecord,
  reviewedAt: string | Date = new Date(),
  parameters: Partial<FSRSParameters> = DEFAULT_FSRS_PARAMETERS,
): ReviewPreviews {
  const now = validDate(reviewedAt);
  const scheduler = fsrs({ ...DEFAULT_FSRS_PARAMETERS, ...parameters });
  const preview = scheduler.repeat(toFsrsCard(current), now);
  const makePreview = (grade: Grade): ReviewPreview => ({
    rating: gradeToRating(grade),
    due: preview[grade].card.due.toISOString(),
    scheduledDays: preview[grade].card.scheduled_days,
    state: preview[grade].card.state,
  });
  return {
    again: makePreview(Rating.Again),
    hard: makePreview(Rating.Hard),
    good: makePreview(Rating.Good),
    easy: makePreview(Rating.Easy),
  };
}

export interface AnswerReviewOutcome {
  isCorrect: boolean;
  score?: number;
  maxScore?: number;
  confidence?: AnswerConfidence;
}

/** Map an answer result into an FSRS grade without inventing a user confidence. */
export function answerOutcomeToRating(outcome: boolean | AnswerReviewOutcome): FsrsRating {
  const normalized: AnswerReviewOutcome =
    typeof outcome === 'boolean' ? { isCorrect: outcome } : outcome;
  if (!normalized.isCorrect) return 'again';
  if (normalized.confidence === 'low') return 'hard';
  if (normalized.confidence === 'high') return 'easy';
  if (
    normalized.score !== undefined &&
    normalized.maxScore !== undefined &&
    normalized.maxScore > 0 &&
    normalized.score / normalized.maxScore < 0.75
  ) {
    return 'hard';
  }
  return 'good';
}

export function getRetrievability(
  card: ReviewCardRecord,
  now: string | Date = new Date(),
  parameters: Partial<FSRSParameters> = DEFAULT_FSRS_PARAMETERS,
): number {
  const scheduler = fsrs({ ...DEFAULT_FSRS_PARAMETERS, ...parameters });
  return scheduler.get_retrievability(toFsrsCard(card), validDate(now), false);
}

export function isReviewDue(
  card: Pick<ReviewCardRecord, 'due'>,
  now: string | Date = new Date(),
): boolean {
  return validDate(card.due).getTime() <= validDate(now).getTime();
}

export function sortReviewCardsByDue(cards: readonly ReviewCardRecord[]): ReviewCardRecord[] {
  return [...cards].sort(
    (left, right) => validDate(left.due).getTime() - validDate(right.due).getTime(),
  );
}
