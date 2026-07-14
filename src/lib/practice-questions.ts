import {
  generateCrosswind,
  generatePerformanceInterpolation,
  generateWeatherDecoding,
  generateWeightAndBalance,
} from './calculations';
import type { ModuleContent, NumericQuestion, Question, Section } from './content/types';

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function moduleList(input: ModuleContent | readonly ModuleContent[]): readonly ModuleContent[] {
  return Array.isArray(input) ? input : [input as ModuleContent];
}

export function getEligibleSections(
  modules: ModuleContent | readonly ModuleContent[],
  completedSectionIds?: ReadonlySet<string>,
): { module: ModuleContent; section: Section }[] {
  return moduleList(modules).flatMap((module) =>
    module.sections
      .filter((section) => !completedSectionIds || completedSectionIds.has(section.id))
      .map((section) => ({ module, section })),
  );
}

export function buildVocabularyQuestions(
  modules: ModuleContent | readonly ModuleContent[],
  completedSectionIds?: ReadonlySet<string>,
): Question[] {
  const eligibleSections = new Set(
    getEligibleSections(modules, completedSectionIds).map(({ section }) => section.id),
  );
  const glossary = moduleList(modules).flatMap((module) =>
    module.glossary
      .filter((term) => eligibleSections.has(term.sectionId))
      .map((term) => ({ ...term, moduleId: term.moduleId ?? module.id })),
  );
  if (glossary.length < 4) return [];
  const questions: Question[] = [];
  glossary.forEach((term, index) => {
    const normalizedTerm = normalizeText(term.term);
    const distractorPool = [
      ...new Map(
        glossary
          .filter(
            (item) =>
              item.id !== term.id &&
              normalizeText(item.term) !== normalizedTerm &&
              normalizeText(item.definition) !== normalizeText(term.definition),
          )
          .map((item) => [normalizeText(item.definition), item] as const),
      ).values(),
    ];

    if (distractorPool.length < 3) return;

    const distractors = Array.from(
      { length: 3 },
      (_, offset) => distractorPool[(index + offset) % distractorPool.length].definition,
    );
    const correctIndex = index % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, term.definition);

    questions.push({
      id: `vocab-${term.id}`,
      moduleId: term.moduleId,
      sectionId: term.sectionId,
      type: 'multipleChoice',
      prompt: `Which definition best matches “${term.term}”?`,
      options,
      correctIndex,
      explanation: term.definition,
      sourceCitation: term.sourceCitation,
      acsCodes: term.acsCodes,
    });
  });
  return questions;
}

export function selectQuestionWindow<T>(
  questions: readonly T[],
  offset: number,
  size: number,
): T[] {
  if (!questions.length || size <= 0) return [];
  const normalizedOffset =
    ((Math.trunc(offset) % questions.length) + questions.length) % questions.length;
  const count = Math.min(Math.trunc(size), questions.length);
  return Array.from(
    { length: count },
    (_, index) => questions[(normalizedOffset + index) % questions.length],
  );
}

export function buildCalculationQuestions(
  modules: ModuleContent | readonly ModuleContent[],
  completedSectionIds?: ReadonlySet<string>,
): Question[] {
  const eligible = getEligibleSections(modules, completedSectionIds);
  const seed = new Date().toISOString().slice(0, 10);
  const wb = generateWeightAndBalance(seed);
  const crosswind = generateCrosswind(seed);
  const performance = generatePerformanceInterpolation(seed);
  const weather = generateWeatherDecoding(seed);
  const findSource = (...patterns: RegExp[]) =>
    eligible.find(({ section }) => patterns.some((pattern) => pattern.test(section.title)));
  const numeric = (
    problem: typeof wb | typeof crosswind | typeof performance,
    source: { module: ModuleContent; section: Section },
  ): NumericQuestion => ({
    id: `practice-${problem.id}`,
    moduleId: source.module.id,
    sectionId: source.section.id,
    type: 'numeric',
    prompt: problem.prompt,
    answer: problem.answer,
    explanation: problem.explanation,
    sourceCitation: source.section.lessons[0].sourceCitation,
    acsCodes: source.section.acsCodes,
  });

  const questions: Question[] = [];
  const weightAndBalance = findSource(/Weight and Balance/i);
  const crosswindSource = findSource(/Takeoffs|Landings|Traffic Patterns/i);
  const performanceSource = findSource(/Performance/i, /Energy Management/i);
  const weatherSource = findSource(/Weather Services/i, /Observations|METAR/i);
  if (weightAndBalance) questions.push(numeric(wb, weightAndBalance));
  if (crosswindSource) questions.push(numeric(crosswind, crosswindSource));
  if (performanceSource) questions.push(numeric(performance, performanceSource));
  if (weatherSource) {
    questions.push({
      id: `practice-${weather.id}`,
      moduleId: weatherSource.module.id,
      sectionId: weatherSource.section.id,
      type: 'multipleChoice',
      prompt: weather.prompt,
      options: weather.options,
      correctIndex: weather.correctIndex,
      explanation: weather.explanation,
      sourceCitation: weatherSource.section.lessons[0].sourceCitation,
      acsCodes: weatherSource.section.acsCodes,
    });
  }
  return questions;
}
