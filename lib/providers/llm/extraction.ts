import { generateObject } from 'ai';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import type { EnrichmentField, EnrichmentResult } from '../../types';

function buildEnrichmentSchema(fields: EnrichmentField[]) {
  const schemaProps: Record<string, z.ZodTypeAny> = {};
  const confidenceProps: Record<string, z.ZodTypeAny> = {};
  const sourceProps: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let base: z.ZodTypeAny;
    switch (field.type) {
      case 'number':  base = z.number(); break;
      case 'boolean': base = z.boolean(); break;
      case 'array':   base = z.array(z.string()); break;
      default:        base = z.string();
    }
    schemaProps[field.name] = field.required ? base : base.nullable();
    confidenceProps[`${field.name}_confidence`] = z.number().min(0).max(1);
    sourceProps[`${field.name}_sources`] = z
      .array(z.object({ url: z.string(), quote: z.string() }))
      .nullable();
  });

  return z.object({ ...schemaProps, ...confidenceProps, ...sourceProps });
}

function buildCorroboratedSchema(fields: EnrichmentField[]) {
  const schemaProps: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let valueSchema: z.ZodTypeAny;
    switch (field.type) {
      case 'number':  valueSchema = z.number().nullable(); break;
      case 'boolean': valueSchema = z.boolean().nullable(); break;
      case 'array':   valueSchema = z.array(z.string()).nullable(); break;
      default:        valueSchema = z.string().nullable();
    }
    schemaProps[field.name] = z.object({
      evidence: z.array(
        z.object({
          value: valueSchema,
          source_url: z.string(),
          exact_text: z.string(),
          confidence: z.number().min(0).max(1),
        })
      ),
      consensus_value: valueSchema,
      consensus_confidence: z.number().min(0).max(1),
      sources_agree: z.boolean(),
    });
  });

  return z.object(schemaProps);
}

function formatContext(context: Record<string, string>): string {
  return Object.entries(context)
    .map(([key, value]) => {
      if (key === 'targetDomain' && value)
        return `Company Domain: ${value} (content from this domain is likely the target company)`;
      if (key === 'name' || key === '_parsed_name') return `Person Name: ${value}`;
      return `${key}: ${value}`;
    })
    .filter((line) => !line.includes('undefined'))
    .join('\n');
}

const MAX_CONTENT_CHARS = 400_000;

function trimContent(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return content.substring(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated due to length...]';
}

function normalizeValue(value: unknown, field: EnrichmentField): unknown {
  if (value === '/' || value === '-' || value === 'N/A' || value === 'n/a') return null;

  if (value !== null && value !== undefined) {
    const name = field.name;
    if ((name === 'employeeCount' || field.displayName === 'Employee Count') && typeof value === 'number') {
      if (value > 1_000_000) return null;
    }
    if ((name === 'yearFounded' || field.displayName === 'Year Founded') && typeof value === 'number') {
      if (value < 1800 || value > new Date().getFullYear()) return null;
    }
    if ((name === 'fundingStage' || field.displayName === 'Funding Stage') && typeof value === 'string') {
      const lc = value.toLowerCase();
      if (lc.includes('seed') && !lc.includes('pre')) return 'Seed';
      if (lc.includes('pre-seed') || lc.includes('preseed')) return 'Pre-seed';
      const series = lc.match(/series\s*([a-e])/i)?.[1]?.toUpperCase();
      if (series) return `Series ${series}`;
    }
  }
  return value;
}

export interface LLMExtractor {
  extractStructuredDataWithCorroboration(
    content: string,
    fields: EnrichmentField[],
    context: Record<string, string>,
    onMessage?: (msg: string, type: 'info' | 'success' | 'warning' | 'agent') => void
  ): Promise<Record<string, EnrichmentResult>>;

  extractStructuredDataOriginal(
    content: string,
    fields: EnrichmentField[],
    context: Record<string, string>
  ): Promise<Record<string, EnrichmentResult>>;
}

export function createLLMExtractor(model: LanguageModel): LLMExtractor {
  return {
    async extractStructuredDataWithCorroboration(content, fields, context, onMessage) {
      const schema = buildCorroboratedSchema(fields);
      const fieldDescriptions = fields.map((f) => `- ${f.name}: ${f.description}`).join('\n');
      const contextInfo = formatContext(context);
      const customInstructions = context.instruction
        ? `\n\n**SPECIFIC INSTRUCTIONS FOR THIS EXTRACTION**:\n${context.instruction}`
        : '';

      const systemPrompt = `You are an expert data extractor. Extract information with evidence from each source.

**CRITICAL INSTRUCTIONS**:
1. For EACH field, find ALL mentions across ALL sources
2. Return an array of evidence for each field
3. Each evidence entry must include value, source_url (ONLY from "URL:" lines in the content), exact_text (verbatim sentence containing the value), and confidence
4. ONLY include evidence that is EXPLICITLY STATED in the content
5. DO NOT make up or infer values. If not found, consensus_value = null
6. NEVER use placeholder values like "/", "-", "N/A" — use null
7. ALWAYS capitalize fields properly (company names, industry names, job titles)
8. exact_text must be a complete sentence from the content that contains the value (20-200 chars)
9. DO NOT use page titles or headers as exact_text${customInstructions}

Context about the entity:
${contextInfo}

Fields to extract:
${fieldDescriptions}`;

      const { object } = await generateObject({
        model,
        schema,
        system: systemPrompt,
        prompt: trimContent(content),
        temperature: 0.1,
      });

      const results: Record<string, EnrichmentResult> = {};

      for (const field of fields) {
        const fieldData = (object as Record<string, {
          evidence: Array<{ value: unknown; source_url: string; exact_text: string; confidence: number }>;
          consensus_value: unknown;
          consensus_confidence: number;
          sources_agree: boolean;
        }>)[field.name];

        if (!fieldData) continue;

        const rawValue = normalizeValue(fieldData.consensus_value, field);
        if (rawValue === null || rawValue === undefined) continue;
        if (fieldData.consensus_confidence < 0.3) continue;

        const validEvidence = fieldData.evidence.filter(
          (e) => e.value !== null && e.confidence >= 0.2 && e.exact_text?.trim().length > 0
        );

        const sourceContext = validEvidence
          .filter((e) => e.source_url && e.source_url.startsWith('http'))
          .map((e) => ({ url: e.source_url, snippet: e.exact_text }));

        results[field.name] = {
          field: field.name,
          value: rawValue as string | number | boolean | string[],
          confidence: fieldData.consensus_confidence,
          source: validEvidence
            .filter((e) => e.source_url?.startsWith('http'))
            .map((e) => e.source_url)
            .slice(0, 2)
            .join(', '),
          sourceContext: sourceContext.length > 0 ? sourceContext : undefined,
          corroboration: {
            evidence: validEvidence.map((e) => ({
              value: e.value as string | number | boolean | string[],
              source_url: e.source_url,
              exact_text: e.exact_text,
              confidence: e.confidence,
            })),
            sources_agree: fieldData.sources_agree,
          },
        };

        onMessage?.(`Extracted ${field.name}: ${String(rawValue).substring(0, 60)}`, 'success');
      }

      return results;
    },

    async extractStructuredDataOriginal(content, fields, context) {
      const schema = buildEnrichmentSchema(fields);
      const fieldDescriptions = fields.map((f) => `- ${f.name}: ${f.description}`).join('\n');
      const contextInfo = formatContext(context);

      const systemPrompt = `You are an expert data extractor. Extract the requested information from the provided content with high accuracy.

**CRITICAL RULE**: ONLY extract information that is EXPLICITLY STATED in the content. DO NOT make up, guess, or infer values. If not found, return null.

For each field provide: the extracted value (or null), a confidence score (0-1), and a sources array with url and quote.

Confidence: 1.0 = explicitly stated; 0.8-0.9 = clearly present; 0.5-0.7 = some inference; 0.3-0.4 = unclear; 0.0 = not found.

TARGET ENTITY:
${contextInfo}

Fields to extract:
${fieldDescriptions}`;

      const { object } = await generateObject({
        model,
        schema,
        system: systemPrompt,
        prompt: trimContent(content),
      });

      const parsed = object as Record<string, unknown>;
      const results: Record<string, EnrichmentResult> = {};

      for (const field of fields) {
        let value = normalizeValue(parsed[field.name], field);
        const confidence = parsed[`${field.name}_confidence`] as number;
        const sources = parsed[`${field.name}_sources`] as Array<{ url: string; quote: string }> | null;

        value = normalizeValue(value, field);
        if (value === null || value === undefined || confidence <= 0.3) continue;

        results[field.name] = {
          field: field.name,
          value: value as string | number | boolean | string[],
          confidence,
          source: sources ? sources.map((s) => s.url).join(', ') : 'structured_extraction',
          sourceContext: sources
            ? sources.map((s) => ({ url: s.url, snippet: s.quote }))
            : undefined,
        };
      }

      return results;
    },
  };
}
