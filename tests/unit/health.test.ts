import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('returns 200 with status ok when Supabase is reachable', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const { GET } = await import('@/app/health/route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = (await GET()) as any;

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      db: { reachable: true },
    });
    expect(typeof response.body.db.latencyMs).toBe('number');
  });

  it('returns 503 with status degraded when Supabase throws', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('Network error'));

    const { GET } = await import('@/app/health/route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = (await GET()) as any;

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      db: { reachable: false },
    });
  });

  it('includes commit and env fields in response', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const { GET } = await import('@/app/health/route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = (await GET()) as any;

    expect(response.body).toHaveProperty('commit');
    expect(response.body).toHaveProperty('env');
  });
});
