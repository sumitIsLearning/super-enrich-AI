import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { listScrapers } from '@/lib/providers/scraper/registry';
import { listModels } from '@/lib/providers/llm/registry';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  return NextResponse.json({
    scrapers: listScrapers(),
    models: listModels(),
  });
}
