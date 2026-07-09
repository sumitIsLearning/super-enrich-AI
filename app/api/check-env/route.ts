import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireApiSession } from '@/lib/auth/session';

export async function GET() {
  const unauthorized = await requireApiSession(await headers());
  if (unauthorized) return unauthorized;

  const environmentStatus = {
    FIRECRAWL_API_KEY: !!process.env.FIRECRAWL_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
    SERPER_API_KEY: !!process.env.SERPER_API_KEY,
    GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    FIRESTARTER_DISABLE_CREATION_DASHBOARD: process.env.FIRESTARTER_DISABLE_CREATION_DASHBOARD === 'true',
  };

  return NextResponse.json({ environmentStatus });
} 