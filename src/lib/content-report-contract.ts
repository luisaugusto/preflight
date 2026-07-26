export const CONTENT_REPORT_DETAILS_MAX_LENGTH = 2000;
export const CONTENT_REPORT_SNAPSHOT_MAX_LENGTH = 8000;
export const CONTENT_REPORT_REQUEST_MAX_BYTES = 48 * 1024;

export type ContentReportPayload = {
  submissionId: string;
  contentType: 'lesson' | 'question';
  contentId: string;
  contentPart: 'question' | 'concept' | 'workedExample';
  details: string;
  contentSnapshot: string;
  sourceLabel: string;
  appVersion: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
};
