import { NextResponse, type NextRequest } from "next/server";
import { runMarketIntelAgent } from "@/lib/agents/market-intel/run";

// Vercel cron triggers a GET request with `Authorization: Bearer
// ${CRON_SECRET}` (when CRON_SECRET is set in Vercel env). When the secret
// is set we verify it; when it's not we accept any GET (dev convenience).
// POST stays open for manual operator runs (deployment protection still
// gates external access).

export const dynamic = "force-dynamic";
export const maxDuration = 300; // up to 5 min — the 4-source pull takes ~150s

async function run() {
  try {
    const result = await runMarketIntelAgent({ testMode: false, dryRun: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[api/agents/market-intel] error:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

export async function POST() {
  return run();
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized — bad cron secret" },
        { status: 401 }
      );
    }
  }
  return run();
}
