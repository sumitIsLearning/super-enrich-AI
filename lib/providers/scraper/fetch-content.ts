const FETCH_TIMEOUT_MS = 10_000;

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50_000);
}

export async function fetchPageContent(
  url: string
): Promise<{ markdown?: string; html?: string } | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SuperEnrich/1.0)' },
    });
    clearTimeout(timer);

    if (!response.ok) return null;

    const html = await response.text();
    const markdown = htmlToText(html);
    return { markdown, html: html.substring(0, 100_000) };
  } catch {
    return null;
  }
}
