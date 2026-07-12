import {
  generateCrosswind,
  generatePerformanceInterpolation,
  generateWeatherDecoding,
  generateWeightAndBalance,
} from './calculations';
import type { ModuleContent, NumericQuestion, Question, SourceCitation } from './content/types';

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

export function buildVocabularyQuestions(module: ModuleContent): Question[] {
  return module.glossary.map((term, index) => {
    const normalizedTerm = normalizeText(term.term);
    const distractorPool = [
      ...new Map(
        module.glossary
          .filter(
            (item) =>
              item.id !== term.id &&
              normalizeText(item.term) !== normalizedTerm &&
              normalizeText(item.definition) !== normalizeText(term.definition),
          )
          .map((item) => [normalizeText(item.definition), item] as const),
      ).values(),
    ];

    if (distractorPool.length < 3) {
      throw new Error(`Vocabulary term ${term.id} needs at least three unambiguous distractors.`);
    }

    const distractors = Array.from(
      { length: 3 },
      (_, offset) => distractorPool[(index + offset) % distractorPool.length].definition,
    );
    const correctIndex = index % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, term.definition);

    return {
      id: `vocab-${term.id}`,
      type: 'multipleChoice',
      prompt: `Which definition best matches “${term.term}”?`,
      options,
      correctIndex,
      explanation: term.definition,
      sourceCitation: term.sourceCitation,
      acsCodes: term.acsCodes,
    };
  });
}

export function selectQuestionWindow<T>(
  questions: readonly T[],
  offset: number,
  size: number,
): T[] {
  if (!questions.length || size <= 0) return [];
  const normalizedOffset = ((Math.trunc(offset) % questions.length) + questions.length) % questions.length;
  const count = Math.min(Math.trunc(size), questions.length);
  return Array.from(
    { length: count },
    (_, index) => questions[(normalizedOffset + index) % questions.length],
  );
}

export function buildCalculationQuestions(module: ModuleContent): Question[] {
  const seed = new Date().toISOString().slice(0, 10);
  const wb = generateWeightAndBalance(seed);
  const crosswind = generateCrosswind(seed);
  const performance = generatePerformanceInterpolation(seed);
  const weather = generateWeatherDecoding(seed);
  const citation = (chapter: string, page: string): SourceCitation => ({
    handbook: "Pilot's Handbook of Aeronautical Knowledge",
    edition: 'FAA-H-8083-25C',
    chapter,
    page,
    url: module.source.url,
  });
  const numeric = (
    problem: typeof wb | typeof crosswind | typeof performance,
    chapter: string,
    page: string,
  ): NumericQuestion => ({
    id: `practice-${problem.id}`,
    type: 'numeric',
    prompt: problem.prompt,
    answer: problem.answer,
    explanation: problem.explanation,
    sourceCitation: citation(chapter, page),
    acsCodes: chapter === '10' ? ['PA.I.F.K1'] : ['PA.I.F.K2'],
  });

  return [
    numeric(wb, '10', '10-7'),
    numeric(crosswind, '14', '14-18'),
    numeric(performance, '11', '11-15'),
    {
      id: `practice-${weather.id}`,
      type: 'multipleChoice',
      prompt: weather.prompt,
      options: weather.options,
      correctIndex: weather.correctIndex,
      explanation: weather.explanation,
      sourceCitation: citation('13', '13-12'),
      acsCodes: ['PA.I.C.K3'],
    },
  ];
}
