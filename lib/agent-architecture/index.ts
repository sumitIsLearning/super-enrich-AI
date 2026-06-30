import { AgentOrchestrator } from './orchestrator';
import type { ScraperProvider } from '../providers/scraper/types';
import type { LLMExtractor } from '../providers/llm/extraction';

export { AgentOrchestrator } from './orchestrator';
export * from './core/types';

// Factory function for easy initialization
export function createAgentOrchestrator(
  scraper: ScraperProvider,
  llm: LLMExtractor
) {
  return new AgentOrchestrator(scraper, llm);
}