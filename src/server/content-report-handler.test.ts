import {
  type ContentReportSanityClient,
  handleContentReportRequest,
} from '@/server/content-report-handler';

const validPayload = {
  submissionId: '2fb1f5c0-2acc-4b88-a1a9-44ed3d4e4651',
  contentType: 'lesson' as const,
  contentId: 'lesson-1',
  contentPart: 'concept' as const,
  details: 'The explanation conflicts with the cited source.',
  contentSnapshot: 'Lesson ID: lesson-1\nContent: Lift acts perpendicular to relative wind.',
  sourceLabel: 'Pilot Handbook · p. 2-4',
  appVersion: '1.0.0',
  platform: 'ios' as const,
};

function reportRequest(
  body: unknown = validPayload,
  headers: HeadersInit = { 'Content-Type': 'application/json' },
) {
  return new Request('https://preflight.example/api/content-reports', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function reportClient(reportedContentId: string | null = 'lesson.afh-01-lesson-01') {
  return {
    fetch: jest.fn().mockResolvedValue(reportedContentId),
    createIfNotExists: jest.fn().mockImplementation(async (document) => ({ _id: document._id })),
  } as jest.Mocked<ContentReportSanityClient>;
}

describe('handleContentReportRequest', () => {
  it('creates an idempotent draft with a weak reference to reported content', async () => {
    const client = reportClient();
    const response = await handleContentReportRequest(reportRequest(), client);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reportId: 'drafts.contentReport.2fb1f5c0-2acc-4b88-a1a9-44ed3d4e4651',
    });
    expect(client.fetch).toHaveBeenCalledWith(expect.any(String), {
      contentType: 'lesson',
      contentId: 'lesson-1',
    });
    expect(client.createIfNotExists).toHaveBeenCalledWith({
      _id: 'drafts.contentReport.2fb1f5c0-2acc-4b88-a1a9-44ed3d4e4651',
      _type: 'contentReport',
      status: 'new',
      contentType: 'lesson',
      contentStableId: 'lesson-1',
      contentPart: 'concept',
      details: validPayload.details,
      contentSnapshot: validPayload.contentSnapshot,
      sourceLabel: validPayload.sourceLabel,
      appVersion: '1.0.0',
      platform: 'ios',
      reportedContent: {
        _type: 'reference',
        _ref: 'lesson.afh-01-lesson-01',
        _weak: true,
      },
    });
  });

  it('keeps a report when its stable ID no longer resolves', async () => {
    const client = reportClient(null);
    const response = await handleContentReportRequest(reportRequest(), client);

    expect(response.status).toBe(200);
    expect(client.createIfNotExists).toHaveBeenCalledWith(
      expect.not.objectContaining({ reportedContent: expect.anything() }),
    );
  });

  it('rejects invalid report context before calling Sanity', async () => {
    const client = reportClient();
    const response = await handleContentReportRequest(
      reportRequest({ ...validPayload, contentPart: 'question' }),
      client,
    );

    expect(response.status).toBe(400);
    expect(client.fetch).not.toHaveBeenCalled();
    expect(client.createIfNotExists).not.toHaveBeenCalled();
  });

  it('rejects malformed and oversized bodies', async () => {
    const client = reportClient();

    const malformed = await handleContentReportRequest(reportRequest('{not json'), client);
    const oversized = await handleContentReportRequest(
      reportRequest(validPayload, {
        'Content-Type': 'application/json',
        'Content-Length': String(49 * 1024),
      }),
      client,
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(client.fetch).not.toHaveBeenCalled();
  });

  it('returns a generic error when Sanity cannot store the report', async () => {
    const client = reportClient();
    client.createIfNotExists.mockRejectedValue(new Error('Sanity unavailable'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await handleContentReportRequest(reportRequest(), client);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Unable to store report.' });
    consoleSpy.mockRestore();
  });
});
