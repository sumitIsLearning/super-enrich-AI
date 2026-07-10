/**
 * Single source of truth mapping a provider id to its browser-key wiring:
 * the env flag reported by /api/check-env, the localStorage slot, the request
 * header read by /api/enrich, a docs link, and an input placeholder.
 *
 * Header and env names here mirror app/api/enrich/route.ts exactly.
 */
export interface ProviderKeyDescriptor {
  label: string;
  envStatusKey: string; // matches /api/check-env environmentStatus keys
  localStorageKey: string;
  header: string; // matches the X-*-API-Key names read in /api/enrich
  docsUrl: string;
  placeholder: string;
}

export const PROVIDER_KEYS: Record<string, ProviderKeyDescriptor> = {
  firecrawl: {
    label: "Firecrawl",
    envStatusKey: "FIRECRAWL_API_KEY",
    localStorageKey: "firecrawl_api_key",
    header: "X-Firecrawl-API-Key",
    docsUrl: "https://www.firecrawl.dev/app/api-keys",
    placeholder: "fc-...",
  },
  tavily: {
    label: "Tavily",
    envStatusKey: "TAVILY_API_KEY",
    localStorageKey: "tavily_api_key",
    header: "X-Tavily-API-Key",
    docsUrl: "https://app.tavily.com",
    placeholder: "tvly-...",
  },
  serper: {
    label: "Serper",
    envStatusKey: "SERPER_API_KEY",
    localStorageKey: "serper_api_key",
    header: "X-Serper-API-Key",
    docsUrl: "https://serper.dev",
    placeholder: "Your Serper API key",
  },
  tinyfish: {
    label: "TinyFish",
    envStatusKey: "TINYFISH_API_KEY",
    localStorageKey: "tinyfish_api_key",
    header: "X-TinyFish-API-Key",
    docsUrl: "https://docs.tinyfish.ai/",
    placeholder: "Your TinyFish API key",
  },
  openai: {
    label: "OpenAI",
    envStatusKey: "OPENAI_API_KEY",
    localStorageKey: "openai_api_key",
    header: "X-OpenAI-API-Key",
    docsUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  google: {
    label: "Google (Gemini)",
    envStatusKey: "GOOGLE_API_KEY",
    localStorageKey: "google_api_key",
    header: "X-Google-API-Key",
    docsUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza...",
  },
  openrouter: {
    label: "OpenRouter",
    envStatusKey: "OPENROUTER_API_KEY",
    localStorageKey: "openrouter_api_key",
    header: "X-OpenRouter-API-Key",
    docsUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-...",
  },
};

/**
 * Resolve the provider ids a given selection needs keys for.
 * scraperId is already a bare provider id; llmModelId is namespaced
 * "provider:model", so take the part before the first colon.
 */
export function providerIdsForSelection(
  scraperId: string,
  llmModelId: string,
): string[] {
  return [scraperId, llmModelId.split(":")[0]];
}
