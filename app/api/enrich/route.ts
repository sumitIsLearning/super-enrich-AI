import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/session';
import { AgentEnrichmentStrategy } from '@/lib/strategies/agent-enrichment-strategy';
import type { EnrichmentRequest, RowEnrichmentResult } from '@/lib/types';
import { loadSkipList, shouldSkipEmail, getSkipReason } from '@/lib/utils/skip-list';
import { ENRICHMENT_CONFIG } from '@/lib/config/enrichment';
import { getScraper } from '@/lib/providers/scraper/registry';
import { getLLM } from '@/lib/providers/llm/registry';
import { createLLMExtractor } from '@/lib/providers/llm/extraction';

// Use Node.js runtime for better compatibility
export const runtime = 'nodejs';

// Store active sessions in memory (in production, use Redis or similar)
const activeSessions = new Map<string, AbortController>();

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiSession(request.headers);
  if (unauthorized) return unauthorized;

  try {
    // Add request body size check
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
      );
    }

    const body: EnrichmentRequest = await request.json();
    const { rows, fields, emailColumn, nameColumn } = body;

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows provided' },
        { status: 400 }
      );
    }

    if (!fields || fields.length === 0 || fields.length > 10) {
      return NextResponse.json(
        { error: 'Please provide 1-10 fields to enrich' },
        { status: 400 }
      );
    }

    if (!emailColumn) {
      return NextResponse.json(
        { error: 'Email column is required' },
        { status: 400 }
      );
    }

    // Use a more compatible UUID generation
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const abortController = new AbortController();
    activeSessions.set(sessionId, abortController);

    const scraperId: string = body.scraperId ?? 'firecrawl';
    const llmModelId: string = body.llmModelId ?? 'openai:gpt-4o';
    const [llmProvider] = llmModelId.split(':');

    const scraperKeyMap: Record<string, string> = {
      firecrawl: process.env.FIRECRAWL_API_KEY || request.headers.get('X-Firecrawl-API-Key') || '',
      tavily:    process.env.TAVILY_API_KEY    || request.headers.get('X-Tavily-API-Key')    || '',
      serper:    process.env.SERPER_API_KEY    || request.headers.get('X-Serper-API-Key')    || '',
      tinyfish:  process.env.TINYFISH_API_KEY  || request.headers.get('X-TinyFish-API-Key')  || '',
    };
    const llmKeyMap: Record<string, string> = {
      openai:     process.env.OPENAI_API_KEY     || request.headers.get('X-OpenAI-API-Key')     || '',
      google:     process.env.GOOGLE_API_KEY     || request.headers.get('X-Google-API-Key')     || '',
      openrouter: process.env.OPENROUTER_API_KEY || request.headers.get('X-OpenRouter-API-Key') || '',
    };

    const scraperApiKey = scraperKeyMap[scraperId] ?? '';
    const llmApiKey = llmKeyMap[llmProvider] ?? '';

    if (!scraperApiKey) {
      return NextResponse.json(
        { error: `Missing API key for scraper "${scraperId}". Set ${scraperId.toUpperCase().replace(/-/g, '_')}_API_KEY or pass X-${scraperId}-API-Key header.` },
        { status: 400 }
      );
    }
    if (!llmApiKey) {
      return NextResponse.json(
        { error: `Missing API key for LLM provider "${llmProvider}". Set ${llmProvider.toUpperCase()}_API_KEY or pass X-${llmProvider}-API-Key header.` },
        { status: 400 }
      );
    }

    let scraperInstance: ReturnType<typeof getScraper>;
    let enrichmentStrategy: AgentEnrichmentStrategy;
    try {
      scraperInstance = getScraper(scraperId, scraperApiKey);
      const llmModel = getLLM(llmModelId, llmApiKey);
      const llmExtractor = createLLMExtractor(llmModel);
      enrichmentStrategy = new AgentEnrichmentStrategy(scraperInstance, llmExtractor);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to initialize providers' },
        { status: 400 }
      );
    }

    console.log(`[STRATEGY] scraper=${scraperId}, llm=${llmModelId}`);

    // Load skip list
    const skipList = await loadSkipList();

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send session ID
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`
            )
          );

          // Process rows with rolling concurrency (as each finishes, start the next)
          const concurrency = ENRICHMENT_CONFIG.CONCURRENT_ROWS;
          console.log(`[ENRICHMENT] Processing ${rows.length} rows with rolling concurrency: ${concurrency}`);

          // Send pending status for all rows
          for (let i = 0; i < rows.length; i++) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'pending',
                  rowIndex: i,
                  totalRows: rows.length,
                })}\n\n`
              )
            );
          }

          // Process rows with rolling concurrency
          const processRow = async (i: number) => {
            // Check if cancelled
            if (abortController.signal.aborted) {
              return;
            }

            const row = rows[i];
            const email = row[emailColumn];

            // Add name to row context if nameColumn is provided
            if (nameColumn && row[nameColumn]) {
              row._name = row[nameColumn];
            }

            // Check if email should be skipped
            if (email && shouldSkipEmail(email, skipList)) {
              const skipReason = getSkipReason(email, skipList);

              // Send skip result
              const skipResult: RowEnrichmentResult = {
                rowIndex: i,
                originalData: row,
                enrichments: {},
                status: 'skipped',
                error: skipReason,
              };

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result: skipResult,
                  })}\n\n`
                )
              );

              return;
            }

            // Send processing status
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'processing',
                  rowIndex: i,
                  totalRows: rows.length,
                })}\n\n`
              )
            );

            try {
              // Enrich the row
              console.log(`[ENRICHMENT] Processing row ${i + 1}/${rows.length} - Email: ${email} - scraper=${scraperId}, llm=${llmModelId}`);
              const startTime = Date.now();

              // Agent strategies return RowEnrichmentResult
              const result = await enrichmentStrategy.enrichRow(
                row,
                fields,
                emailColumn,
                undefined, // onProgress
                (message: string, type: 'info' | 'success' | 'warning' | 'agent', sourceUrl?: string) => {
                  // Stream agent progress messages
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'agent_progress',
                        rowIndex: i,
                        message,
                        messageType: type,
                        sourceUrl, // Include sourceUrl for favicons
                      })}\n\n`
                    )
                  );
                }
              );
              result.rowIndex = i; // Set the correct row index

              const duration = Date.now() - startTime;
              console.log(`[ENRICHMENT] Completed row ${i + 1} in ${duration}ms - Fields enriched: ${Object.keys(result.enrichments).length}`);

              // Log which fields were successfully enriched
              const enrichedFields = Object.entries(result.enrichments)
                .filter(([, enrichment]) => enrichment.value)
                .map(([fieldName, enrichment]) => `${fieldName}: ${enrichment.value ? '✓' : '✗'}`)
                .join(', ');
              if (enrichedFields) {
                console.log(`[ENRICHMENT] Fields: ${enrichedFields}`);
              }

              // Send result
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result,
                  })}\n\n`
                )
              );
            } catch (error) {
              // Send error for this row
              const errorResult: RowEnrichmentResult = {
                rowIndex: i,
                originalData: row,
                enrichments: {},
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              };

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'result',
                    result: errorResult,
                  })}\n\n`
                )
              );
            }
          };

          // Create a queue and process with rolling concurrency
          let currentIndex = 0;
          const activePromises: Promise<void>[] = [];

          while (currentIndex < rows.length || activePromises.length > 0) {
            // Check if cancelled
            if (abortController.signal.aborted) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'cancelled' })}\n\n`
                )
              );
              break;
            }

            // Start new rows up to concurrency limit
            while (currentIndex < rows.length && activePromises.length < concurrency) {
              const rowIndex = currentIndex++;
              const promise = processRow(rowIndex).then(() => {
                // Remove this promise from active list when done
                const index = activePromises.indexOf(promise);
                if (index > -1) {
                  activePromises.splice(index, 1);
                }
              });
              activePromises.push(promise);
            }

            // Wait for at least one to finish before continuing
            if (activePromises.length > 0) {
              await Promise.race(activePromises);
            }
          }

          // Send completion
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'complete' })}\n\n`
            )
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              })}\n\n`
            )
          );
        } finally {
          activeSessions.delete(sessionId);
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to start enrichment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start enrichment',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Cancel endpoint
export async function DELETE(request: NextRequest) {
  const unauthorized = await requireApiSession(request.headers);
  if (unauthorized) return unauthorized;

  // TODO(auth): no per-user ownership check — any authenticated user can cancel any run by sessionId.
  // Revisit when runs become user-scoped (activeSessions is a global map today).

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  const controller = activeSessions.get(sessionId);
  if (controller) {
    controller.abort();
    activeSessions.delete(sessionId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: 'Session not found' },
    { status: 404 }
  );
}