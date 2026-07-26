import { z } from 'zod';
import {
  CONTENT_REPORT_DETAILS_MAX_LENGTH,
  CONTENT_REPORT_REQUEST_MAX_BYTES,
  CONTENT_REPORT_SNAPSHOT_MAX_LENGTH,
  type ContentReportPayload,
} from '@/lib/content-report-contract';

const CONTENT_LOOKUP_QUERY = '*[_type == $contentType && stableId == $contentId][0]._id';
const contentReportPayloadSchema = z
  .object({
    submissionId: z.uuid(),
    contentType: z.enum(['lesson', 'question']),
    contentId: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Content ID must use kebab-case.'),
    contentPart: z.enum(['question', 'concept', 'workedExample']),
    details: z.string().trim().min(1).max(CONTENT_REPORT_DETAILS_MAX_LENGTH),
    contentSnapshot: z.string().min(1).max(CONTENT_REPORT_SNAPSHOT_MAX_LENGTH),
    sourceLabel: z.string().min(1).max(300),
    appVersion: z.string().min(1).max(40),
    platform: z.enum(['ios', 'android', 'web', 'unknown']),
  })
  .superRefine((payload, context) => {
    if (payload.contentType === 'question' && payload.contentPart !== 'question') {
      context.addIssue({
        code: 'custom',
        path: ['contentPart'],
        message: 'Question reports must use the question content part.',
      });
    }

    if (payload.contentType === 'lesson' && payload.contentPart === 'question') {
      context.addIssue({
        code: 'custom',
        path: ['contentPart'],
        message: 'Lesson reports must identify the reported lesson part.',
      });
    }
  });

type ContentReportDocument = Omit<ContentReportPayload, 'submissionId' | 'contentId'> & {
  _id: string;
  _type: 'contentReport';
  status: 'new';
  contentStableId: string;
  reportedContent?: {
    _type: 'reference';
    _ref: string;
    _weak: true;
  };
};

export interface ContentReportSanityClient {
  fetch(
    query: string,
    params: { contentType: ContentReportPayload['contentType']; contentId: string },
  ): Promise<string | null>;
  createIfNotExists(document: ContentReportDocument): Promise<{ _id: string }>;
}

export async function handleContentReportRequest(
  request: Request,
  client: ContentReportSanityClient,
): Promise<Response> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > CONTENT_REPORT_REQUEST_MAX_BYTES) {
    return Response.json({ error: 'Report is too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > CONTENT_REPORT_REQUEST_MAX_BYTES) {
      return Response.json({ error: 'Report is too large.' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = contentReportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid report.' }, { status: 400 });
  }

  try {
    const reportedContentId = await client.fetch(CONTENT_LOOKUP_QUERY, {
      contentType: parsed.data.contentType,
      contentId: parsed.data.contentId,
    });
    const document = toContentReportDocument(parsed.data, reportedContentId);
    const storedReport = await client.createIfNotExists(document);

    return Response.json({ reportId: storedReport._id }, { status: 200 });
  } catch (error) {
    console.error('Failed to store content report', error);
    return Response.json({ error: 'Unable to store report.' }, { status: 500 });
  }
}

function toContentReportDocument(
  payload: ContentReportPayload,
  reportedContentId: string | null,
): ContentReportDocument {
  const { contentId, submissionId, ...report } = payload;

  return {
    ...report,
    _id: `drafts.contentReport.${submissionId}`,
    _type: 'contentReport',
    status: 'new',
    contentStableId: contentId,
    ...(reportedContentId
      ? {
          reportedContent: {
            _type: 'reference' as const,
            _ref: reportedContentId,
            _weak: true as const,
          },
        }
      : {}),
  };
}
