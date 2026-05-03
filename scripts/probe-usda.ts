// Confirm date range narrows the row count, and check whether MH_FV111 +
// OR_FV111 actually carry dragon fruit rows in the recent window.
import "./_env";
const KEY = process.env.MARS_API_KEY!;
const AUTH = "Basic " + Buffer.from(KEY + ":").toString("base64");

async function probe(label: string, url: string) {
  const r = await fetch(url, { headers: { Accept: "application/json", Authorization: AUTH }});
  type Row = { commodity?: string; variety?: string; origin?: string; low_price?: string; high_price?: string; report_date?: string };
  let json: { stats?: { totalRows?: number; returnedRows?: number }; results?: Row[] } | null = null;
  try { json = await r.json(); } catch { /* ignore */ }
  const total = json?.stats?.totalRows;
  const returned = json?.stats?.returnedRows;
  const all = json?.results ?? [];
  const dragon = all.filter((row) => /dragon|pitahaya|pitaya/i.test(row.commodity ?? ""));
  const distinctC = new Set(all.map((r) => r.commodity ?? "?"));
  console.log(`\n──── ${label} ────`);
  console.log(`status: ${r.status}  total=${total}  returned=${returned}  distinct commodities=${distinctC.size}  dragon rows=${dragon.length}`);
  if (dragon.length > 0) {
    for (const d of dragon.slice(0, 5)) {
      console.log(`  ${d.report_date} ${d.commodity}/${d.variety} origin=${d.origin} ${d.low_price}-${d.high_price}`);
    }
  }
}

const base = "https://marsapi.ams.usda.gov/services/v1.2";

async function main() {
  // 7-day windows for the relevant reports
  const today = "2026-05-03";
  const week = "2026-04-26";
  await probe("Miami terminal — 7d window",
    `${base}/reports/2310/Report%20Details?report_begin_date=${week}&report_end_date=${today}`);
  await probe("Miami shipping point (MH_FV111) — 7d",
    `${base}/reports/2395/Report%20Details?report_begin_date=${week}&report_end_date=${today}`);
  await probe("Orlando shipping IMPORTS (OR_FV111) — 7d",
    `${base}/reports/2401/Report%20Details?report_begin_date=${week}&report_end_date=${today}`);
  await probe("LA terminal — 7d",
    `${base}/reports/2306/Report%20Details?report_begin_date=${week}&report_end_date=${today}`);

  // Try a longer window (60d) on the most-relevant Orlando IMPORTS report
  await probe("Orlando shipping IMPORTS — 60d",
    `${base}/reports/2401/Report%20Details?report_begin_date=2026-03-04&report_end_date=${today}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("probe failed:", e); process.exit(1); });
