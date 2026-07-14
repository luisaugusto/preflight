import phakContent from '../content/phak.json';
import catalogContent from '../content/catalog.json';
import type { ModuleContent } from './content/types';
import {
  buildCalculationQuestions,
  buildVocabularyQuestions,
  selectQuestionWindow,
} from './practice-questions';
import { normalizeCurriculum } from './content-sync';

const moduleContent = phakContent as ModuleContent;

describe('practice question builders', () => {
  it('builds an unambiguous question for every glossary term', () => {
    const questions = buildVocabularyQuestions(moduleContent);

    expect(questions).toHaveLength(moduleContent.glossary.length);
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);

    questions.forEach((question) => {
      expect(question.type).toBe('multipleChoice');
      if (question.type !== 'multipleChoice') return;
      expect(question.options).toHaveLength(4);
      expect(
        new Set(question.options.map((option) => option.trim().toLocaleLowerCase('en-US'))).size,
      ).toBe(4);
      expect(question.options[question.correctIndex]).toBe(question.explanation);
    });
  });

  it('rotates fixed-size drill windows through the entire pool', () => {
    const questions = buildVocabularyQuestions(moduleContent);
    const seen = new Set<string>();

    for (let offset = 0; offset < questions.length; offset += 10) {
      selectQuestionWindow(questions, offset, 10).forEach((question) => seen.add(question.id));
    }

    expect(seen.size).toBe(questions.length);
    expect(selectQuestionWindow([1, 2, 3], 2, 3)).toEqual([3, 1, 2]);
  });

  it('combines modules but only uses completed-section vocabulary', () => {
    const catalog = normalizeCurriculum(catalogContent);
    const completed = new Set([
      catalog.modules[0].sections[0].id,
      catalog.modules[1].sections[0].id,
    ]);
    const questions = buildVocabularyQuestions(catalog.modules, completed);

    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.every((question) => completed.has(question.sectionId ?? ''))).toBe(true);
    expect(new Set(questions.map((question) => question.moduleId))).toEqual(
      new Set(['phak', 'afh']),
    );
  });

  it('does not generate drills from unseen sections', () => {
    const catalog = normalizeCurriculum(catalogContent);
    expect(buildVocabularyQuestions(catalog.modules, new Set())).toEqual([]);
    expect(buildCalculationQuestions(catalog.modules, new Set())).toEqual([]);

    const eligibleSections = catalog.modules
      .flatMap((module) => module.sections)
      .filter((section) => /Weight and Balance|Takeoffs|Observations|METAR/i.test(section.title));
    const completed = new Set(eligibleSections.map((section) => section.id));
    const calculations = buildCalculationQuestions(catalog.modules, completed);
    expect(calculations.length).toBeGreaterThan(0);
    expect(calculations.every((question) => completed.has(question.sectionId ?? ''))).toBe(true);
  });
});
