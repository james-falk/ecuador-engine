import { NextResponse } from "next/server";
import { runMarketIntelAgent } from "@/lib/agents/market-intel/run";

export async function POST() {
  try {
    const result = await runMarketIntelAgent({ testMode: false, dryRun: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[api/agents/market-intel] error:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
