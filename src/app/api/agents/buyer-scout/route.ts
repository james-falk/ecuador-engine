import { NextResponse } from "next/server";
import { runBuyerScoutAgent } from "@/lib/agents/buyer-scout/run";

export async function POST() {
  try {
    const result = await runBuyerScoutAgent({ testMode: false, dryRun: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[api/agents/buyer-scout] error:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
