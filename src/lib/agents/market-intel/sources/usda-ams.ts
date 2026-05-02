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

// These slugs map to the 5 USDA AMS terminal market reports for produce.
// slug_id values sourced from MARS API report directory.
const REPORT_CONFIGS = [
  { slugId: "2634", source: "usda-ams-national-fob", market: "national-fob" },
  { slugId: "2608", source: "usda-ams-ny-terminal", market: "NY-terminal" },
  { slugId: "2609", source: "usda-ams-philly-terminal", market: "Philly-terminal" },
  { slugId: "2617", source: "usda-ams-miami-terminal", market: "Miami-terminal" },
  { slugId: "2628", source: "usda-ams-la-terminal", market: "LA-terminal" },
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

  const url =
    `${MARS_BASE}/reports/${slugId}` +
    `?q=dragon+fruit` +
    `&report_begin_date=${fmt(sevenDaysAgo)}` +
    `&report_end_date=${fmt(today)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { Accept: "application/json" },
      // 15-second hard timeout
      signal: AbortSignal.timeout(15_000),
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
