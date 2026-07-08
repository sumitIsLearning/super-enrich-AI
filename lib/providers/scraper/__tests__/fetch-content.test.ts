import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPageContent } from '../fetch-content';

describe('fetchPageContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns markdown text extracted from HTML', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          `<html><head><title>Acme Corp</title></head>
           <body><h1>About Acme</h1><p>We build great things.</p></body></html>`
        ),
    } as unknown as Response);

    const result = await fetchPageContent('https://acme.com/about');
    expect(result).not.toBeNull();
    expect(result?.markdown).toContain('About Acme');
    expect(result?.markdown).toContain('We build great things');
  });

  it('returns null when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await fetchPageContent('https://bad-url.com');
    expect(result).toBeNull();
  });

  it('returns null on non-OK response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    } as unknown as Response);
    const result = await fetchPageContent('https://example.com/missing');
    expect(result).toBeNull();
  });

  it('blocks SSRF to loopback/private IP literals without fetching', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    for (const target of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/', 'http://[::1]/']) {
      const result = await fetchPageContent(target);
      expect(result).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('blocks a redirect that points at a private IP', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: { get: (k: string) => (k.toLowerCase() === 'location' ? 'http://127.0.0.1/admin' : null) },
    } as unknown as Response);

    const result = await fetchPageContent('https://example.com/redirector');
    expect(result).toBeNull();
  });
});
