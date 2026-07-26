/* eslint-disable import/first */
jest.mock('@/components/question-interaction', () => ({
  QuestionInteraction: () => null,
}));

import catalogContent from '@/content/catalog.json';
import { normalizeCurriculum } from '@/lib/content-sync';
import type { ResumePosition } from '@/lib/db';
import { isForwardResumeProgress, isLessonReached } from '@/application/preflight-app';

const catalog = normalizeCurriculum(catalogContent);
const module0 = catalog.modules[0];
const section = module0.sections[0];
const [lessonA, lessonB] = section.lessons;

function resumeAt(lessonId: string, blockIndex: number): ResumePosition {
  return {
    moduleId: module0.id,
    sectionId: section.id,
    lessonId,
    blockIndex,
    contentVersion: module0.version,
    updatedAt: new Date(0).toISOString(),
  };
}

describe('isForwardResumeProgress', () => {
  it('treats any position as progress when there is no prior resume position', () => {
    expect(isForwardResumeProgress(null, module0.id, section, lessonA.id, 0)).toBe(true);
  });

  it('is forward progress when moving to a later lesson', () => {
    const resume = resumeAt(lessonA.id, 2);
    expect(isForwardResumeProgress(resume, module0.id, section, lessonB.id, 0)).toBe(true);
  });

  it('is not forward progress when reviewing an earlier lesson', () => {
    const resume = resumeAt(lessonB.id, 1);
    expect(isForwardResumeProgress(resume, module0.id, section, lessonA.id, 3)).toBe(false);
  });

  it('is not forward progress when moving back to an earlier stage of the furthest lesson', () => {
    const resume = resumeAt(lessonB.id, 2);
    expect(isForwardResumeProgress(resume, module0.id, section, lessonB.id, 0)).toBe(false);
  });

  it('is forward progress when reaching a later or equal stage of the furthest lesson', () => {
    const resume = resumeAt(lessonB.id, 1);
    expect(isForwardResumeProgress(resume, module0.id, section, lessonB.id, 2)).toBe(true);
    expect(isForwardResumeProgress(resume, module0.id, section, lessonB.id, 1)).toBe(true);
  });
});

describe('isLessonReached', () => {
  it('treats completed lessons as reached', () => {
    expect(isLessonReached(null, module0.id, section, lessonA.id, new Set([lessonA.id]))).toBe(
      true,
    );
  });

  it('treats the furthest in-progress lesson tracked by the resume position as reached', () => {
    const resume = resumeAt(lessonB.id, 1);
    expect(isLessonReached(resume, module0.id, section, lessonB.id, new Set())).toBe(true);
  });

  it('does not treat an unreached, uncompleted lesson as reached', () => {
    const resume = resumeAt(lessonA.id, 1);
    expect(isLessonReached(resume, module0.id, section, lessonB.id, new Set())).toBe(false);
  });
});
