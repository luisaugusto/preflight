export type AnalyticsEvent =
  | 'section_started'
  | 'section_completed'
  | 'lesson_started'
  | 'lesson_completed'
  | 'question_answered'
  | 'quiz_completed'
  | 'module_exam_unlocked'
  | 'daily_practice_completed'
  | 'module_exam_completed';

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | undefined;
}

// Intentionally inert in the MVP. Call sites exist so a privacy-reviewed
// analytics adapter can be introduced later without touching every screen.
export const analytics = {
  track(_event: AnalyticsEvent, _properties: AnalyticsProperties = {}): void {
    // no-op
  },
};
