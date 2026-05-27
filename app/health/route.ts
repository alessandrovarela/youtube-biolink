import { createBrowserClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let reachable = false;

  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.getSession();
    reachable = true;
  } catch {
    reachable = false;
  }

  const latencyMs = Date.now() - start;
  const status = reachable ? 'ok' : 'degraded';
  const httpStatus = reachable ? 200 : 503;

  return NextResponse.json(
    {
      status,
      db: { reachable, latencyMs },
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
      env: process.env.VERCEL_ENV === 'production' ? 'production' : 'development',
    },
    { status: httpStatus }
  );
}
