/**
 * Enrichment configuration
 */

export const ENRICHMENT_CONFIG = {
  /**
   * Number of rows to process concurrently
   * Higher values = faster processing but more API usage
   * Recommended: 2-5 for most use cases
   */
  CONCURRENT_ROWS: 10,

  /**
   * Delay between batches (milliseconds)
   * Helps prevent rate limiting
   */
  BATCH_DELAY_MS: 1000,

  /**
   * Hard ceiling on rows per enrichment request, enforced client- and
   * server-side. Always on, independent of SUPER_ENRICH_CONFIG's
   * demo-tier MAX_ROWS (which is 15/Infinity and skipped in unlimited mode).
   */
  MAX_ROWS_PER_REQUEST: 1000,
} as const;
