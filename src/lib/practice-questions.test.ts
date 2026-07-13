import phakContent from '../content/phak.json';
import type { ModuleContent } from './content/types';
import { buildVocabularyQuestions, selectQuestionWindow } from './practice-questions';

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
});
