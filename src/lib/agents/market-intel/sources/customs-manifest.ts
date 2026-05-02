// US customs manifest source for dragon fruit shipment intelligence.
//
// Reads recent dragon fruit / pitahaya import shipments to the US so the
// market-intel agent can record who's actually moving fruit (importer +
// origin + volume signals). Pricing fields stay null — manifests don't
// publish FOB prices — but `raw_blob` carries the full shipment record so
// the buyer-scout agent (Item #5) can mine consignee names later.
//
// Upstream is configurable via env. Default integration target is ImportYeti
// (Bearer-token JSON API). When IMPORTYETI_API_KEY is unset we treat the
// upstream as unavailable and return [] — the agent run handles empty
// gracefully. Test mode bypasses HTTP entirely and uses a fixture.

import type { UsdaAmsRow } from "./usda-ams";

export type CustomsManifestRow = UsdaAmsRow;

interface ManifestShipment {
  bill_of_lading?: string;
  arrival_date?: string;
  shipper?: string;
  consignee?: string;
  product_description?: string;
  weight_kg?: string | number;
  container_count?: string | number;
  origin_country?: string;
  destination_port?: string;
  hs_code?: string;
  [key: string]: unknown;
}

interface ManifestApiResponse {
  shipments?: ManifestShipment[];
  results?: ManifestShipment[];
  [key: string]: unknown;
}

const SOURCE = "importyeti";
const MARKET = "import-manifest";
const IMPORTYETI_DEFAULT_BASE = "https://api.importyeti.com/v1/shipments";

const DRAGON_FRUIT_RE = /dragon\s*fruit|pitahaya|pitaya/i;

function extractVariety(desc: string | undefined): string | null {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("yellow")) return "yellow-skin-white-flesh";
  if (d.includes("red") && d.includes("white")) return "red-skin-white-flesh";
  if (d.includes("red") && d.includes("red")) return "red-skin-red-flesh";
  if (d.includes("white")) return "red-skin-white-flesh";
  return null;
}

function normalizeOrigin(country: string | undefined): string | null {
  if (!country) return null;
  return String(country).trim().toLowerCase();
}

function parseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Carton-size column on pricing_snapshots is overloaded for shipment rows
// to carry a coarse volume signal — container count when available, else
// gross weight. Real carton spec lives in raw_blob.
function shipmentVolumeLabel(
  weightKg: string | number | undefined,
  containers: string | number | undefined,
): string | null {
  if (containers !== undefined && containers !== "" && containers !== 0) {
    return `${containers}-container-shipment`;
  }
  if (weightKg !== undefined && weightKg !== "" && weightKg !== 0) {
    return `${weightKg}kg-shipment`;
  }
  return null;
}

const TEST_FIXTURE: ManifestShipment[] = [
  {
    bill_of_lading: "TESTBL00001",
    arrival_date: "2026-04-29",
    shipper: "Finca del Dragón S.A.",
    consignee: "Frieda's Specialty Produce",
    product_description: "FRESH DRAGON FRUIT - RED SKIN WHITE FLESH - 4.5KG CARTON",
    weight_kg: 18000,
    container_count: 1,
    origin_country: "Ecuador",
    destination_port: "Los Angeles, CA",
    hs_code: "081090",
  },
  {
    bill_of_lading: "TESTBL00002",
    arrival_date: "2026-04-28",
    shipper: "Vietnam Fresh Exports JSC",
    consignee: "Melissa's Produce",
    product_description: "FRESH PITAHAYA YELLOW SKIN WHITE FLESH 6LB BOX",
    weight_kg: 22000,
    container_count: 1,
    origin_country: "Vietnam",
    destination_port: "Long Beach, CA",
    hs_code: "081090",
  },
  // Non-dragon-fruit row — must be filtered out
  {
    bill_of_lading: "TESTBL00003",
    arrival_date: "2026-04-28",
    shipper: "Some Mango Co",
    consignee: "Generic Importer",
    product_description: "FRESH MANGO TOMMY ATKINS 4KG",
    weight_kg: 19000,
    container_count: 1,
    origin_country: "Mexico",
    destination_port: "Houston, TX",
    hs_code: "080450",
  },
];

function shipmentToRow(s: ManifestShipment): CustomsManifestRow {
  return {
    source: SOURCE,
    market: MARKET,
    reportDate: parseDate(s.arrival_date),
    variety: extractVariety(s.product_description),
    cartonSize: shipmentVolumeLabel(s.weight_kg, s.container_count),
    origin: normalizeOrigin(s.origin_country),
    priceLow: null,
    priceHigh: null,
    rawBlob: s as Record<string, unknown>,
  };
}

function extractRows(shipments: ManifestShipment[]): CustomsManifestRow[] {
  return shipments
    .filter((s) => DRAGON_FRUIT_RE.test(s.product_description ?? ""))
    .map(shipmentToRow);
}

export async function fetchCustomsManifestRows(
  testMode = false,
): Promise<CustomsManifestRow[]> {
  if (testMode) {
    const rows = extractRows(TEST_FIXTURE);
    console.log(
      `[market-intel/customs-manifest] test mode: ${rows.length} dragon fruit shipments`,
    );
    return rows;
  }

  const apiKey = process.env.IMPORTYETI_API_KEY;
  if (!apiKey) {
    console.log(
      "[market-intel/customs-manifest] IMPORTYETI_API_KEY not set — upstream unavailable, returning 0 rows",
    );
    return [];
  }

  const baseUrl = process.env.IMPORTYETI_BASE_URL ?? IMPORTYETI_DEFAULT_BASE;
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url =
    `${baseUrl}` +
    `?q=dragon+fruit` +
    `&date_from=${fmt(thirtyDaysAgo)}` +
    `&date_to=${fmt(today)}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[market-intel/customs-manifest] fetch failed — ${msg}`);
    return [];
  }

  if (resp.status === 401 || resp.status === 403) {
    console.log(
      `[market-intel/customs-manifest] auth rejected (HTTP ${resp.status}) — check IMPORTYETI_API_KEY`,
    );
    return [];
  }

  if (resp.status === 404 || resp.status === 204) {
    console.log(
      `[market-intel/customs-manifest] no shipment data (HTTP ${resp.status})`,
    );
    return [];
  }

  if (!resp.ok) {
    console.log(`[market-intel/customs-manifest] HTTP ${resp.status} — skipping`);
    return [];
  }

  let body: ManifestApiResponse;
  try {
    body = (await resp.json()) as ManifestApiResponse;
  } catch {
    console.log("[market-intel/customs-manifest] failed to parse JSON response");
    return [];
  }

  const shipments = Array.isArray(body)
    ? (body as ManifestShipment[])
    : (body.shipments ?? body.results ?? []);
  const rows = extractRows(shipments);
  console.log(
    `[market-intel/customs-manifest] ${rows.length} dragon fruit shipments`,
  );
  return rows;
}
