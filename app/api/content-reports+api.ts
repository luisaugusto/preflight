import { createClient } from '@sanity/client';
import {
  handleContentReportRequest,
  type ContentReportSanityClient,
} from '@/server/content-report-handler';

const projectId = process.env.SANITY_PROJECT_ID ?? '4qoowg94';
const dataset = process.env.SANITY_DATASET ?? 'production';
const apiVersion = '2026-07-12';

export async function POST(request: Request) {
  const token = process.env.SANITY_AUTH_TOKEN;
  if (!token) {
    console.error('SANITY_AUTH_TOKEN is not configured for the content report endpoint.');
    return Response.json({ error: 'Report service is unavailable.' }, { status: 503 });
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    perspective: 'published',
  });

  return handleContentReportRequest(request, client as ContentReportSanityClient);
}
