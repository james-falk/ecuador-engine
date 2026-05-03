// USDA AMS market news source for dragon fruit pricing.
// Uses the MARS REST API (marsapi.ams.usda.gov) — structured JSON, no PDFs.
// Covers 5 reports: National FOB + NY / Philly / Miami / LA terminals.
// Graceful on HTTP failure: returns empty array + logs reason.

export interface UsdaAmsRow {
  source: string;
  market: string;
  reportDate: Date;
  variety: string | null;
  cartonSize: string | null;
  origin: string | null;
  priceLow: number | null;
  priceHigh: number | null;
  rawBlob: Record<string, unknown>;
}

interface MarsApiRecord {
  report_date?: string;
  report_title?: string;
  commodity?: string;
  package?: string;
  origin?: string;
  grade?: string;
  type?: string;
  low_price?: string | number;
  high_price?: string | number;
  mostly_low?: string | number;
  mostly_high?: string | number;
  unit?: string;
  [key: string]: unknown;
}

interface MarsApiResponse {
  results?: MarsApiRecord[];
  [key: string]: unknown;
}

const MARS_BASE = "https://marsapi.ams.usda.gov/services/v1.2";

// USDA AMS reports we pull dragon fruit pricing from. slug_id values
// verified against the live MARS API directory. Mix of two report types:
//
//   *_FV010 = Terminal Market FRUIT prices (per-city wholesale)
//   *_FV111 = Shipping Point FRUIT prices (per-city import/origin)
//
// Originally the list had hardcoded IDs (2608/2609/2617/2628/2634) that
// were ALL "Invalid Identifier" — every call 404'd. Re-verify with:
//   `npx tsx scripts/probe-usda.ts`
const REPORT_CONFIGS = [
  { slugId: "2395", source: "usda-ams-miami-shipping",  market: "Miami-shipping" },    // MH_FV111 — densest dragon fruit data
  { slugId: "2310", source: "usda-ams-miami-terminal",  market: "Miami-terminal" },    // MH_FV010
  { slugId: "2314", source: "usda-ams-ny-terminal",     market: "NY-terminal" },       // NX_FV010
  { slugId: "2318", source: "usda-ams-philly-terminal", market: "Philly-terminal" },   // NA_FV010
  { slugId: "2306", source: "usda-ams-la-terminal",     market: "LA-terminal" },       // HC_FV010 — Vietnam vs Ecuador comp
] as const;

const DRAGON_FRUIT_RE = /dragon\s*fruit|pitahaya|pitaya/i;

// Normalize variety from commodity + type fields
function extractVariety(record: MarsApiRecord): string | null {
  const combined = [record.commodity, record.type, record.grade]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (combined.includes("red") && combined.includes("white")) return "red-skin-white-flesh";
  if (combined.includes("red") && combined.includes("red")) return "red-skin-red-flesh";
  if (combined.includes("yellow")) return "yellow-skin-white-flesh";
  if (combined.includes("white")) return "red-skin-white-flesh";
  return null;
}

function parsePrice(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function parseReportDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

function extractRows(records: MarsApiRecord[], source: string, market: string): UsdaAmsRow[] {
  return records
    .filter((r) => DRAGON_FRUIT_RE.test(r.commodity ?? ""))
    .map((r) => {
      const priceLow = parsePrice(r.low_price ?? r.mostly_low);
      const priceHigh = parsePrice(r.high_price ?? r.mostly_high);
      return {
        source,
        market,
        reportDate: parseReportDate(r.report_date),
        variety: extractVariety(r),
        cartonSize: r.package ? String(r.package) : null,
        origin: r.origin ? String(r.origin).toLowerCase() : null,
        priceLow: priceLow,
        priceHigh: priceHigh ?? priceLow,
        rawBlob: r as Record<string, unknown>,
      } satisfies UsdaAmsRow;
    })
    .filter((row) => row.priceLow !== null || row.priceHigh !== null);
}

// In test mode (USDA_TEST_MODE=true) skip real HTTP and use the fixture.
const TEST_FIXTURE: MarsApiRecord[] = [
  {
    report_date: "2026-04-28",
    commodity: "Dragon Fruit",
    type: "Red Skin White Flesh",
    package: "4.5 kg carton",
    origin: "Ecuador",
    low_price: "18.00",
    high_price: "22.00",
    unit: "carton",
  },
  {
    report_date: "2026-04-28",
    commodity: "Pitahaya",
    type: "Yellow Skin White Flesh",
    package: "10 lb box",
    origin: "Vietnam",
    low_price: "14.00",
    high_price: "17.00",
    unit: "box",
  },
  // Record with no price — should be filtered out
  {
    report_date: "2026-04-28",
    commodity: "Dragon Fruit",
    type: "Red Skin Red Flesh",
    package: "6 lb box",
    origin: "Nicaragua",
    low_price: "",
    high_price: "",
    unit: "box",
  },
];

async function fetchReport(
  slugId: string,
  source: string,
  market: string,
  testMode: boolean
): Promise<UsdaAmsRow[]> {
  if (testMode) {
    return extractRows(TEST_FIXTURE, source, market);
  }

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // MARS API auth: HTTP Basic with the API key as the username and an
  // empty password. Per USDA AMS docs:
  //   curl -u "$MARS_API_KEY:" https://marsapi.ams.usda.gov/services/v1.2/...
  const apiKey = process.env.MARS_API_KEY;
  if (!apiKey) {
    console.log(
      `[market-intel/usda-ams] MARS_API_KEY not set — upstream unavailable, returning 0 rows`
    );
    return [];
  }
  const authHeader = "Basic " + Buffer.from(`${apiKey}:`).toString("base64");

  // The MARS API has no server-side commodity filter that actually works
  // (q=, search=, filter[commodity]= are all silently ignored or rejected).
  // We have to pull the "Report Details" section for the date window and
  // filter client-side. URL-encoded space in "Report Details" is critical.
  const url =
    `${MARS_BASE}/reports/${slugId}/Report%20Details` +
    `?report_begin_date=${fmt(sevenDaysAgo)}` +
    `&report_end_date=${fmt(today)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Accept: "application/json", Authorization: authHeader },
      // 60-second hard timeout. Each report's "Report Details" section
      // returns up to 100K rows (the API caps page size there) — the
      // larger terminals (LA, NY) take 30-45s to stream over the wire.
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[market-intel/usda-ams] ${source}: fetch failed — ${msg}`);
    return [];
  }

  if (resp.status === 404 || resp.status === 204) {
    console.log(`[market-intel/usda-ams] ${source}: no fresh USDA post today (${resp.status})`);
    return [];
  }

  if (!resp.ok) {
    console.log(`[market-intel/usda-ams] ${source}: HTTP ${resp.status} — skipping`);
    return [];
  }

  let body: MarsApiResponse;
  try {
    body = (await resp.json()) as MarsApiResponse;
  } catch {
    console.log(`[market-intel/usda-ams] ${source}: failed to parse JSON response`);
    return [];
  }

  const records = Array.isArray(body) ? (body as MarsApiRecord[]) : (body.results ?? []);
  const rows = extractRows(records, source, market);
  console.log(`[market-intel/usda-ams] ${source}: ${rows.length} dragon fruit rows`);
  return rows;
}

export async function fetchUsdaAmsRows(testMode = false): Promise<UsdaAmsRow[]> {
  const results = await Promise.allSettled(
    REPORT_CONFIGS.map((cfg) => fetchReport(cfg.slugId, cfg.source, cfg.market, testMode))
  );

  const rows: UsdaAmsRow[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") rows.push(...r.value);
  }
  return rows;
}
