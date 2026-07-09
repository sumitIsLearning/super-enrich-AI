'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ScraperMeta {
  id: string;
  displayName: string;
  description: string;
}

interface LLMModelInfo {
  id: string;
  displayName: string;
  description: string;
  pricing: { inputPer1M: number; outputPer1M: number };
}

interface ProviderPickerProps {
  scraperId: string;
  llmModelId: string;
  onScraperChange: (id: string) => void;
  onLlmChange: (id: string) => void;
}

export function ProviderPicker({
  scraperId,
  llmModelId,
  onScraperChange,
  onLlmChange,
}: ProviderPickerProps) {
  const [scrapers, setScrapers] = useState<ScraperMeta[]>([]);
  const [models, setModels] = useState<LLMModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data: { scrapers: ScraperMeta[]; models: LLMModelInfo[] }) => {
        setScrapers(data.scrapers ?? []);
        setModels(data.models ?? []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="text-body-small text-black-alpha-56">
        Loading providers…
      </div>
    );
  }

  const selectedScraper = scrapers.find((s) => s.id === scraperId);
  const selectedModel = models.find((m) => m.id === llmModelId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Scraper picker */}
      <div className="space-y-1.5">
        <label htmlFor="scraper-select" className="text-label-medium">
          Scraper
        </label>
        <Select value={scraperId} onValueChange={onScraperChange}>
          <SelectTrigger
            id="scraper-select"
            className="h-32 w-full border-gray-200 bg-white focus:border-gray-400 text-body-medium"
          >
            <SelectValue placeholder="Choose scraper" />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            {scrapers.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-body-medium">
                {s.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedScraper && (
          <p className="text-body-small text-black-alpha-56">
            {selectedScraper.description}
          </p>
        )}
      </div>

      {/* LLM model picker */}
      <div className="space-y-1.5">
        <label htmlFor="llm-select" className="text-label-medium">
          LLM Model
        </label>
        <Select value={llmModelId} onValueChange={onLlmChange}>
          <SelectTrigger
            id="llm-select"
            className="h-32 w-full border-gray-200 bg-white focus:border-gray-400 text-body-medium"
          >
            <SelectValue placeholder="Choose model" />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-body-medium">
                <span>{m.displayName}</span>
                <span className="ml-2 text-body-small text-black-alpha-56">
                  ${m.pricing.inputPer1M}/${m.pricing.outputPer1M} per 1M
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && (
          <p className="text-body-small text-black-alpha-56">
            {selectedModel.description}
          </p>
        )}
      </div>
    </div>
  );
}
