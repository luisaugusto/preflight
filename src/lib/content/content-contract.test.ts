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
});
