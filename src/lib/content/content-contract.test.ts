/// <reference types="jest" />

import phakJson from '../../content/phak.json';
import catalogJson from '../../content/catalog.json';
import { normalizeCurriculum, parseModuleContent } from '../content-sync';

describe('checked-in PHAK content', () => {
  it('satisfies the runtime content contract', () => {
    const module = parseModuleContent(phakJson);
    expect(module.id).toBe('phak');
    expect(module.sections.length).toBeGreaterThan(0);
    expect(module.sections.every((section) => section.lessons.length > 0)).toBe(true);
    expect(module.exam.length).toBeGreaterThan(0);
    expect(module.glossary.length).toBeGreaterThan(0);
  });
});

describe('checked-in FAA curriculum catalog', () => {
  it('satisfies the schema-v2 runtime contract with complete provenance', () => {
    const catalog = normalizeCurriculum(catalogJson);

    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.modules.map((module) => module.id)).toEqual(['phak', 'afh', 'awh', 'rmh']);
    expect(catalog.modules.reduce((total, module) => total + module.sections.length, 0)).toBe(89);
    expect(
      catalog.modules.reduce(
        (total, module) =>
          total + module.sections.reduce((count, section) => count + section.lessons.length, 0),
        0,
      ),
    ).toBe(390);

    catalog.modules.forEach((module) => {
      const sectionIds = new Set(module.sections.map((section) => section.id));
      module.sections.forEach((section) => {
        section.lessons.forEach((lesson) => {
          expect(lesson.sourceCitation.pdfPage).toBeGreaterThan(0);
          expect(lesson.practice).toMatchObject({ moduleId: module.id, sectionId: section.id });
        });
        section.quiz.forEach((question) =>
          expect(question).toMatchObject({ moduleId: module.id, sectionId: section.id }),
        );
      });
      module.exam.forEach((question) => {
        expect(question.moduleId).toBe(module.id);
        expect(sectionIds.has(question.sectionId ?? '')).toBe(true);
      });
    });
  });

  it('keeps generated lesson questions diverse and tied to lesson text', () => {
    const catalog = normalizeCurriculum(catalogJson);
    const generatedModules = catalog.modules.filter((module) => module.id !== 'phak');
    const genericFragments = [
      'what is the sound operational use of',
      'delay action until the remaining safety margin is nearly gone',
      'rely on memory and disregard the published limitation or procedure',
    ];
    const words = (value: string) =>
      new Set(
        value
          .toLowerCase()
          .match(/[a-z0-9]+/g)
          ?.filter((word) => word.length >= 4) ?? [],
      );

    generatedModules.forEach((module) => {
      const lessons = module.sections.flatMap((section) => section.lessons);
      const prompts = lessons.map((lesson) => lesson.practice.prompt.toLowerCase());
      expect(new Set(prompts).size).toBe(prompts.length);

      const choiceQuestions = lessons
        .map((lesson) => lesson.practice)
        .filter((question) => question.type === 'multipleChoice');
      const distractorSets = choiceQuestions.map((question) =>
        question.options
          .filter((_, index) => index !== question.correctIndex)
          .map((option) => option.toLowerCase())
          .sort()
          .join('|'),
      );
      expect(new Set(distractorSets).size).toBeGreaterThanOrEqual(
        Math.floor(choiceQuestions.length * 0.9),
      );
      expect(new Set(choiceQuestions.map((question) => question.correctIndex))).toEqual(
        new Set([0, 1, 2, 3]),
      );

      lessons.forEach((lesson) => {
        const question = lesson.practice;
        expect(
          genericFragments.some((fragment) => JSON.stringify(question).includes(fragment)),
        ).toBe(false);
        const correct =
          question.type === 'multipleChoice' ? question.options[question.correctIndex] : '';
        expect(correct.toLowerCase()).not.toBe(lesson.title.toLowerCase());
        const evidenceWords = words(`${question.prompt} ${correct}`);
        const lessonWords = words(`${lesson.title} ${lesson.concept} ${lesson.explanation}`);
        const overlap = [...evidenceWords].filter((word) => lessonWords.has(word));
        expect(overlap.length).toBeGreaterThanOrEqual(4);
      });
    });
  });
});
