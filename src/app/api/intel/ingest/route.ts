// POST /api/intel/ingest
//
// Generic document-store ingest endpoint for external agents. Any system
// (the nightly market-data agent, a webhook, a script) can POST a single
// document or a batch and it lands in `intel_documents`.
//
// Auth: a single shared bearer token in INTEL_INGEST_TOKEN env var.
// Header: `Authorization: Bearer <token>`. Cheap, agent-friendly, separate
// from the user-facing magic-link auth.
//
// Request body (single):
//   {
//     "topic": "market_data",
//     "source": "usda-ams",
//     "for_date": "2026-04-30",
//     "payload": { ... arbitrary JSON ... },
//     "idempotency_key": "usda-ams:2026-04-30",  // optional
//     "inserted_by": "nightly-agent"             // optional
//   }
//
// Or batch (array of those objects).
//
// Response: { ok: true, inserted: <count>, skipped: <count> }
//
// Idempotency: if idempotency_key is supplied and a row with that key
// already exists, the insert is silently skipped (via ON CONFLICT DO
// NOTHING on the unique partial index).

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { intelDocuments } from "@/db/schema";

export const dynamic = "force-dynamic";

type IncomingDoc = {
  topic?: unknown;
  source?: unknown;
  for_date?: unknown;
  payload?: unknown;
  idempotency_key?: unknown;
  inserted_by?: unknown;
};

function authFail(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function validateDoc(d: IncomingDoc, idx: number): { ok: true; row: typeof intelDocuments.$inferInsert } | { ok: false; error: string } {
  if (typeof d.topic !== "string" || !d.topic.trim()) return { ok: false, error: `[${idx}] topic required (string)` };
  if (typeof d.source !== "string" || !d.source.trim()) return { ok: false, error: `[${idx}] source required (string)` };
  if (typeof d.for_date !== "string" || !isIsoDate(d.for_date)) return { ok: false, error: `[${idx}] for_date required (YYYY-MM-DD)` };
  if (d.payload === undefined || d.payload === null) return { ok: false, error: `[${idx}] payload required` };
  return {
    ok: true,
    row: {
      topic: d.topic.trim(),
      source: d.source.trim(),
      forDate: d.for_date,
      payload: d.payload as object,
      idempotencyKey: typeof d.idempotency_key === "string" && d.idempotency_key.trim() ? d.idempotency_key.trim() : null,
      insertedBy: typeof d.inserted_by === "string" && d.inserted_by.trim() ? d.inserted_by.trim() : null,
    },
  };
}

export async function POST(req: NextRequest) {
  const expected = process.env.INTEL_INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "INTEL_INGEST_TOKEN not configured on server. Refusing." },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!presented || presented !== expected) {
    return authFail("Invalid or missing bearer token.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const incoming: IncomingDoc[] = Array.isArray(body) ? (body as IncomingDoc[]) : [body as IncomingDoc];
  if (incoming.length === 0) return badRequest("Body must be a document or array of documents.");
  if (incoming.length > 500) return badRequest("Batch too large (max 500 per request).");

  const rows: Array<typeof intelDocuments.$inferInsert> = [];
  for (let i = 0; i < incoming.length; i++) {
    const r = validateDoc(incoming[i], i);
    if (!r.ok) return badRequest(r.error);
    rows.push(r.row);
  }

  // ON CONFLICT DO NOTHING via the unique partial index on idempotency_key.
  // Drizzle's onConflictDoNothing accepts the target column.
  const inserted = await db
    .insert(intelDocuments)
    .values(rows)
    .onConflictDoNothing({ target: intelDocuments.idempotencyKey })
    .returning({ id: intelDocuments.id });

  return NextResponse.json({
    ok: true,
    inserted: inserted.length,
    skipped: rows.length - inserted.length,
  });
}

// GET /api/intel/ingest — sanity check + tiny status.
export async function GET() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(intelDocuments);
  return NextResponse.json({
    ok: true,
    docCount: count ?? 0,
    auth: !!process.env.INTEL_INGEST_TOKEN,
  });
}
