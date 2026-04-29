// Money helpers. All amounts in v1 are USD strings (Postgres `numeric` round-trips
// as string in the Drizzle/neon driver) — JS `number` is intentionally not used
// for money math.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_SHORT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Format a numeric string as USD: "690.00" → "$690.00"
export function formatUsd(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return USD.format(n);
}

// Compact form for grid cells: "690.00" → "$690"
export function formatUsdShort(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return USD_SHORT.format(n);
}

// Add a list of numeric strings; returns a string with two decimals. Use for
// SQL-side aggregates where we need to display a sum without losing precision
// at the cost of the conversion at the boundary. For exact accounting math,
// keep aggregation in SQL.
export function sumUsd(values: Array<string | number | null | undefined>): string {
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "string" ? Number(v) : v;
    if (Number.isFinite(n)) total += n;
  }
  return total.toFixed(2);
}

// Subtract b from a. Both numeric strings. Returns numeric string.
export function subUsd(a: string | number, b: string | number): string {
  const an = typeof a === "string" ? Number(a) : a;
  const bn = typeof b === "string" ? Number(b) : b;
  return (an - bn).toFixed(2);
}
