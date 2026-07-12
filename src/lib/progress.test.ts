/// <reference types="jest" />

import type {
  Lesson,
  ModuleContent,
  MultipleChoiceQuestion,
  Section,
  SourceCitation,
} from "./content/types";
import {
  calculateModuleProgress,
  getNextLesson,
  getSectionStatus,
  isLessonUnlocked,
  isModuleExamUnlocked,
  isSectionUnlocked,
} from "./progress";

const citation: SourceCitation = {
  handbook: "PHAK",
  edition: "FAA-H-8083-25C",
  chapter: "1",
  page: "1-1",
  url: "https://www.faa.gov/example.pdf",
};

function question(id: string): MultipleChoiceQuestion {
  return {
    id,
    type: "multipleChoice",
    prompt: "Prompt",
    explanation: "Explanation",
    sourceCitation: citation,
    acsCodes: ["PA.I.A.K1"],
    options: ["Yes", "No"],
    correctIndex: 0,
  };
}

function lesson(id: string, order: number): Lesson {
  return {
    id,
    title: id,
    order,
    estimatedMinutes: 4,
    concept: "Concept",
    explanation: "Explanation",
    workedExample: "Example",
    sourceCitation: citation,
    acsCodes: ["PA.I.A.K1"],
    practice: question(`${id}-practice`),
  };
}

function section(id: string, order: number): Section {
  return {
    id,
    title: id,
    order,
    summary: "Summary",
    sourcePages: "1-1–1-10",
    acsCodes: ["PA.I.A.K1"],
    lessons: [lesson(`${id}-lesson-1`, 1), lesson(`${id}-lesson-2`, 2)],
    quiz: [question(`${id}-quiz`) ],
  };
}

const moduleContent: ModuleContent = {
  id: "phak",
  title: "PHAK",
  shortTitle: "PHAK",
  description: "Module",
  version: "1.0.0",
  source: {
    title: "PHAK",
    url: "https://www.faa.gov/example.pdf",
    edition: "FAA-H-8083-25C",
    checksum: "abc",
  },
  // Deliberately unsorted to verify order fields drive progression.
  sections: [section("section-2", 2), section("section-1", 1)],
  exam: [question("exam-1")],
  glossary: [],
};

describe("sequential progression", () => {
  it("unlocks only the first section and first lesson initially", () => {
    expect(isSectionUnlocked(moduleContent, "section-1", [])).toBe(true);
    expect(isSectionUnlocked(moduleContent, "section-2", [])).toBe(false);
    expect(isLessonUnlocked(moduleContent, "section-1-lesson-1", [])).toBe(true);
    expect(isLessonUnlocked(moduleContent, "section-1-lesson-2", [])).toBe(false);
    expect(getNextLesson(moduleContent, [])?.id).toBe("section-1-lesson-1");
  });

  it("unlocks later content as prerequisite lessons complete", () => {
    const firstLesson = ["section-1-lesson-1"];
    expect(isLessonUnlocked(moduleContent, "section-1-lesson-2", firstLesson)).toBe(true);
    expect(getSectionStatus(moduleContent, "section-1", firstLesson)).toBe("inProgress");

    const firstSection = ["section-1-lesson-1", "section-1-lesson-2"];
    expect(isSectionUnlocked(moduleContent, "section-2", firstSection)).toBe(true);
    expect(getNextLesson(moduleContent, firstSection)?.id).toBe("section-2-lesson-1");
  });

  it("calculates module progress and exam eligibility", () => {
    const threeOfFour = [
      "section-1-lesson-1",
      "section-1-lesson-2",
      "section-2-lesson-1",
    ];
    expect(calculateModuleProgress(moduleContent, threeOfFour)).toMatchObject({
      completedLessons: 3,
      totalLessons: 4,
      completedSections: 1,
      percentage: 75,
      isComplete: false,
    });
    expect(isModuleExamUnlocked(moduleContent, threeOfFour)).toBe(false);
    expect(
      isModuleExamUnlocked(moduleContent, [...threeOfFour, "section-2-lesson-2"]),
    ).toBe(true);
  });
});
