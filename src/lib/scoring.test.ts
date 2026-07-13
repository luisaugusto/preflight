/// <reference types="jest" />

import type {
  MatchingQuestion,
  MultipleChoiceQuestion,
  NumericQuestion,
  SourceCitation,
} from './content/types';
import { parseNumericInput, scoreAssessment, scoreQuestion } from './scoring';

const citation: SourceCitation = {
  handbook: 'PHAK',
  edition: 'FAA-H-8083-25C',
  chapter: 'Weight and Balance',
  page: '10-4',
  url: 'https://www.faa.gov/example.pdf',
};

const numericQuestion: NumericQuestion = {
  id: 'numeric-1',
  type: 'numeric',
  prompt: 'What is the value?',
  explanation: 'Use the supplied formula.',
  sourceCitation: citation,
  acsCodes: ['PA.I.F.K1'],
  answer: { value: 100, tolerance: 0.5, unit: 'kt' },
};

const choiceQuestion: MultipleChoiceQuestion = {
  id: 'choice-1',
  type: 'multipleChoice',
  prompt: 'Choose B.',
  explanation: 'B is correct.',
  sourceCitation: citation,
  acsCodes: ['PA.I.F.K1'],
  options: ['A', 'B', 'C'],
  correctIndex: 1,
};

describe('numeric scoring', () => {
  it('accepts commas, mixed fractions, and an omitted expected unit', () => {
    expect(parseNumericInput('1,200', { unit: 'lb' })).toMatchObject({
      valid: true,
      value: 1200,
    });
    expect(parseNumericInput('40 1/2 in', { unit: 'in' })).toMatchObject({
      valid: true,
      value: 40.5,
    });
  });

  it('converts compatible aviation units before applying tolerance', () => {
    const result = scoreQuestion(numericQuestion, '115.1 mph');
    expect(result.isCorrect).toBe(true);
    expect(result.normalizedResponse).toBeCloseTo(100, 0);
    expect(parseNumericInput('1013.25 hPa', { unit: 'inHg' })).toMatchObject({
      valid: true,
      value: expect.closeTo(29.92, 2),
    });
    expect(parseNumericInput('M02 C', { unit: '°C' })).toMatchObject({
      valid: true,
      value: -2,
    });
  });

  it('rejects incompatible units and malformed values', () => {
    expect(scoreQuestion(numericQuestion, '100 lb').reason).toBe('invalidUnit');
    expect(scoreQuestion(numericQuestion, 'not a number').reason).toBe('invalidNumber');
  });

  it('includes values on the tolerance boundary', () => {
    expect(scoreQuestion(numericQuestion, '100.5 kt').isCorrect).toBe(true);
    expect(scoreQuestion(numericQuestion, '100.51 kt').isCorrect).toBe(false);
  });
});

describe('question and assessment scoring', () => {
  it('scores matching questions with deterministic partial credit', () => {
    const matching: MatchingQuestion = {
      id: 'matching-1',
      type: 'matching',
      prompt: 'Match the terms.',
      explanation: 'Each term has one definition.',
      sourceCitation: citation,
      acsCodes: ['PA.I.F.K1'],
      pairs: [
        { id: 'pair-a', left: 'A', right: 'Alpha' },
        { id: 'pair-b', left: 'B', right: 'Bravo' },
      ],
    };
    const result = scoreQuestion(matching, { 'pair-a': 'pair-a', 'pair-b': 'pair-a' });
    expect(result.isCorrect).toBe(false);
    expect(result.score).toBe(0.5);
    expect(result.reason).toBe('partiallyCorrect');
    expect(result.details).toMatchObject({ correctPairs: 1, totalPairs: 2 });
  });

  it('accepts either an option index or exact option text', () => {
    expect(scoreQuestion(choiceQuestion, 1).isCorrect).toBe(true);
    expect(scoreQuestion(choiceQuestion, 'B').isCorrect).toBe(true);
  });

  it('returns pass/fail, percent, and unanswered counts', () => {
    const result = scoreAssessment([choiceQuestion, numericQuestion], { 'choice-1': 1 }, 0.5);
    expect(result).toMatchObject({
      score: 1,
      maxScore: 2,
      correctCount: 1,
      answeredCount: 1,
      percentage: 50,
      passed: true,
    });
  });

  it('rejects an invalid pass threshold', () => {
    expect(() => scoreAssessment([], {}, 1.1)).toThrow(RangeError);
  });
});
