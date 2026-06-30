'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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
    return <div className="text-sm text-muted-foreground">Loading providers…</div>;
  }

  const selectedScraper = scrapers.find((s) => s.id === scraperId);
  const selectedModel = models.find((m) => m.id === llmModelId);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Scraper picker */}
      <div className="space-y-1.5">
        <Label htmlFor="scraper-select" className="text-sm font-medium">
          Scraper
        </Label>
        <Select value={scraperId} onValueChange={onScraperChange}>
          <SelectTrigger id="scraper-select" className="w-full">
            <SelectValue placeholder="Choose scraper" />
          </SelectTrigger>
          <SelectContent>
            {scrapers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedScraper && (
          <p className="text-xs text-muted-foreground">{selectedScraper.description}</p>
        )}
      </div>

      {/* LLM model picker */}
      <div className="space-y-1.5">
        <Label htmlFor="llm-select" className="text-sm font-medium">
          LLM Model
        </Label>
        <Select value={llmModelId} onValueChange={onLlmChange}>
          <SelectTrigger id="llm-select" className="w-full">
            <SelectValue placeholder="Choose model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span>{m.displayName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ${m.pricing.inputPer1M}/${m.pricing.outputPer1M} per 1M
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && (
          <p className="text-xs text-muted-foreground">{selectedModel.description}</p>
        )}
      </div>
    </div>
  );
}
