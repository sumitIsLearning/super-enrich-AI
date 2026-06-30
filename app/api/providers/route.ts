import { NextResponse } from 'next/server';
import { listScrapers } from '@/lib/providers/scraper/registry';
import { listModels } from '@/lib/providers/llm/registry';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    scrapers: listScrapers(),
    models: listModels(),
  });
}
