import type { Lesson, ModuleContent, Section } from "./content/types";

export interface CompletionLike {
  contentId: string;
  contentType?: string;
}

export type CompletionInput =
  | ReadonlySet<string>
  | readonly string[]
  | readonly CompletionLike[];

export type LearningStatus = "locked" | "available" | "inProgress" | "complete";

export interface SectionProgress {
  sectionId: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
  isComplete: boolean;
}

export interface ModuleProgress {
  moduleId: string;
  completedLessons: number;
  totalLessons: number;
  completedSections: number;
  totalSections: number;
  lessonPercentage: number;
  sectionPercentage: number;
  percentage: number;
  isComplete: boolean;
}

export function toCompletedIdSet(completions: CompletionInput): ReadonlySet<string> {
  if (completions instanceof Set) return completions;
  const items = completions as readonly (string | CompletionLike)[];
  return new Set(
    items.map((completion) =>
      typeof completion === "string" ? completion : completion.contentId,
    ),
  );
}

export function orderedSections(module: Pick<ModuleContent, "sections">): Section[] {
  return [...module.sections].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function orderedLessons(section: Pick<Section, "lessons">): Lesson[] {
  return [...section.lessons].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function getLessonSequence(module: Pick<ModuleContent, "sections">): Lesson[] {
  return orderedSections(module).flatMap(orderedLessons);
}

export function isLessonComplete(lessonId: string, completions: CompletionInput): boolean {
  return toCompletedIdSet(completions).has(lessonId);
}

export function isSectionComplete(section: Section, completions: CompletionInput): boolean {
  const completed = toCompletedIdSet(completions);
  if (completed.has(section.id)) return true;
  const lessons = orderedLessons(section);
  return lessons.length > 0 && lessons.every((lesson) => completed.has(lesson.id));
}

export function isSectionUnlocked(
  module: Pick<ModuleContent, "sections">,
  sectionId: string,
  completions: CompletionInput,
): boolean {
  const sections = orderedSections(module);
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return false;
  if (index === 0) return true;
  return sections.slice(0, index).every((section) => isSectionComplete(section, completions));
}

export function isLessonUnlocked(
  module: Pick<ModuleContent, "sections">,
  lessonId: string,
  completions: CompletionInput,
): boolean {
  const completed = toCompletedIdSet(completions);
  const sections = orderedSections(module);
  const section = sections.find((candidate) =>
    candidate.lessons.some((lesson) => lesson.id === lessonId),
  );
  if (!section || !isSectionUnlocked(module, section.id, completed)) return false;

  const lessons = orderedLessons(section);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return false;
  return lessons.slice(0, index).every((lesson) => completed.has(lesson.id));
}

export function calculateSectionProgress(
  section: Section,
  completions: CompletionInput,
): SectionProgress {
  const completed = toCompletedIdSet(completions);
  const lessons = orderedLessons(section);
  const completedLessons = lessons.filter((lesson) => completed.has(lesson.id)).length;
  const isComplete =
    completed.has(section.id) || (lessons.length > 0 && completedLessons === lessons.length);

  return {
    sectionId: section.id,
    completedLessons,
    totalLessons: lessons.length,
    percentage: lessons.length === 0 ? (isComplete ? 100 : 0) : (completedLessons / lessons.length) * 100,
    isComplete,
  };
}

export function calculateModuleProgress(
  module: Pick<ModuleContent, "id" | "sections">,
  completions: CompletionInput,
): ModuleProgress {
  const sections = orderedSections(module);
  const sectionProgress = sections.map((section) => calculateSectionProgress(section, completions));
  const totalLessons = sectionProgress.reduce((sum, section) => sum + section.totalLessons, 0);
  const completedLessons = sectionProgress.reduce(
    (sum, section) => sum + section.completedLessons,
    0,
  );
  const completedSections = sectionProgress.filter((section) => section.isComplete).length;
  const lessonPercentage = totalLessons === 0 ? 0 : (completedLessons / totalLessons) * 100;
  const sectionPercentage = sections.length === 0 ? 0 : (completedSections / sections.length) * 100;

  return {
    moduleId: module.id,
    completedLessons,
    totalLessons,
    completedSections,
    totalSections: sections.length,
    lessonPercentage,
    sectionPercentage,
    percentage: lessonPercentage,
    isComplete: sections.length > 0 && completedSections === sections.length,
  };
}

export function getSectionStatus(
  module: Pick<ModuleContent, "sections">,
  sectionId: string,
  completions: CompletionInput,
): LearningStatus {
  const section = module.sections.find((candidate) => candidate.id === sectionId);
  if (!section || !isSectionUnlocked(module, sectionId, completions)) return "locked";
  const progress = calculateSectionProgress(section, completions);
  if (progress.isComplete) return "complete";
  if (progress.completedLessons > 0) return "inProgress";
  return "available";
}

export function getLessonStatus(
  module: Pick<ModuleContent, "sections">,
  lessonId: string,
  completions: CompletionInput,
): LearningStatus {
  const completed = toCompletedIdSet(completions);
  if (completed.has(lessonId)) return "complete";
  return isLessonUnlocked(module, lessonId, completed) ? "available" : "locked";
}

export function getNextLesson(
  module: Pick<ModuleContent, "sections">,
  completions: CompletionInput,
): Lesson | null {
  const completed = toCompletedIdSet(completions);
  return (
    getLessonSequence(module).find(
      (lesson) => !completed.has(lesson.id) && isLessonUnlocked(module, lesson.id, completed),
    ) ?? null
  );
}

export function isModuleExamUnlocked(
  module: Pick<ModuleContent, "id" | "sections">,
  completions: CompletionInput,
): boolean {
  return calculateModuleProgress(module, completions).isComplete;
}

/** Clamp UI-facing percentages and avoid floating point tails such as 66.666666. */
export function formatProgressPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}
