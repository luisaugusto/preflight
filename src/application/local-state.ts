import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const KEYS = {
  onboarding: 'preflight.onboarding.v1',
  timeline: 'preflight.timeline.v1',
  lessons: 'preflight.completed-lessons.v1',
  sections: 'preflight.completed-sections.v1',
  exam: 'preflight.module-exam.v1',
  exams: 'preflight.completed-module-exams.v2',
  activeModule: 'preflight.active-module.v2',
} as const;

export interface LocalLearningState {
  onboardingComplete: boolean;
  timeline: string;
  completedLessonIds: string[];
  completedSectionIds: string[];
  completedModuleIds: string[];
  activeModuleId: string;
}

export async function loadLocalLearningState(): Promise<LocalLearningState> {
  const [onboarding, timeline, lessons, sections, exam, exams, activeModule] = await Promise.all([
    getItem(KEYS.onboarding),
    getItem(KEYS.timeline),
    getItem(KEYS.lessons),
    getItem(KEYS.sections),
    getItem(KEYS.exam),
    getItem(KEYS.exams),
    getItem(KEYS.activeModule),
  ]);
  const completedModuleIds = new Set(parseStringArray(exams));
  if (exam === 'true') completedModuleIds.add('phak');
  return {
    onboardingComplete: onboarding === 'true',
    timeline: timeline ?? '',
    completedLessonIds: parseStringArray(lessons),
    completedSectionIds: parseStringArray(sections),
    completedModuleIds: [...completedModuleIds],
    activeModuleId: activeModule ?? 'phak',
  };
}

export async function saveOnboarding(timeline: string): Promise<void> {
  await Promise.all([setItem(KEYS.onboarding, 'true'), setItem(KEYS.timeline, timeline)]);
}

export async function saveCompletedLessons(ids: ReadonlySet<string>): Promise<void> {
  await setItem(KEYS.lessons, JSON.stringify([...ids]));
}

export async function saveCompletedSections(ids: ReadonlySet<string>): Promise<void> {
  await setItem(KEYS.sections, JSON.stringify([...ids]));
}

export async function saveCompletedModules(ids: ReadonlySet<string>): Promise<void> {
  await setItem(KEYS.exams, JSON.stringify([...ids]));
}

export async function saveActiveModuleId(moduleId: string): Promise<void> {
  await setItem(KEYS.activeModule, moduleId);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage.getItem(key);
  }
  return Storage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem(key, value);
    return;
  }
  await Storage.setItem(key, value);
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
