import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireApiSession } from '@/lib/auth/session';
import { listScrapers } from '@/lib/providers/scraper/registry';
import { listModels } from '@/lib/providers/llm/registry';

export const runtime = 'nodejs';

export async function GET() {
  const unauthorized = await requireApiSession(await headers());
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    scrapers: listScrapers(),
    models: listModels(),
  });
}
