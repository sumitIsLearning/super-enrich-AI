import { AgentOrchestrator } from '../agent-architecture';
import type { CSVRow, EnrichmentField, RowEnrichmentResult, EnrichmentResult } from '../types';
import { shouldSkipEmail, loadSkipList, getSkipReason } from '../utils/skip-list';
import type { ScraperProvider } from '../providers/scraper/types';
import type { LLMExtractor } from '../providers/llm/extraction';

export class AgentEnrichmentStrategy {
  private orchestrator: AgentOrchestrator;

  constructor(scraper: ScraperProvider, llm: LLMExtractor) {
    this.orchestrator = new AgentOrchestrator(scraper, llm);
  }

  async enrichRow(
    row: CSVRow,
    fields: EnrichmentField[],
    emailColumn: string,
    onProgress?: (field: string, value: unknown) => void,
    onAgentProgress?: (message: string, type: 'info' | 'success' | 'warning' | 'agent') => void
  ): Promise<RowEnrichmentResult> {
    const email = row[emailColumn];
    console.log(`[AgentEnrichmentStrategy] Starting enrichment for email: ${email}`);

    if (!email) {
      return {
        rowIndex: 0,
        originalData: row,
        enrichments: {},
        status: 'error',
        error: 'No email found in specified column',
      };
    }

    const skipList = await loadSkipList();
    if (shouldSkipEmail(email, skipList)) {
      const skipReason = getSkipReason(email, skipList);
      return {
        rowIndex: 0,
        originalData: row,
        enrichments: {},
        status: 'skipped',
        error: skipReason,
      };
    }

    try {
      const result = await this.orchestrator.enrichRow(
        row,
        fields,
        emailColumn,
        onProgress,
        onAgentProgress
      );

      const filteredEnrichments: Record<string, EnrichmentResult> = {};
      for (const [key, enrichment] of Object.entries(result.enrichments)) {
        if (enrichment.value !== null) {
          filteredEnrichments[key] = enrichment as EnrichmentResult;
        }
      }

      return { ...result, enrichments: filteredEnrichments };
    } catch (error) {
      console.error('[AgentEnrichmentStrategy] Enrichment error:', error);
      return {
        rowIndex: 0,
        originalData: row,
        enrichments: {},
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
