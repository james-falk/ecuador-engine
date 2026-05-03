// One-shot: full check of computePricing / sellByMargin / sellByCartonPrice
// against the source Pricing Sheet.xlsx values. Prints actual vs. expected.

import "./_env";
import { computePricing, sellByMargin, sellByCartonPrice } from "../src/lib/queries/pricing";

const inputs = {
  id: "test",
  fruitCostPerKgUsd: 2.0,
  kgPerCarton: 4.5,
  labelCostPerCartonUsd: 0.10,
  packingCostPerCartonUsd: 1.60,
  materialCostPerCartonUsd: 0.30,
  ecuadorTransportUsd: 400,
  oceanFreightUsd: 7000,
  importCustomsUsd: 1200,
  cartonsPer20ft: 1920,
  cartonsPer40ft: 3840,
};

const p = computePricing(inputs);

const checks: Array<{ label: string; actual: string; expected: string }> = [];
const check = (label: string, actual: number, expected: number, decimals = 2) => {
  checks.push({ label, actual: actual.toFixed(decimals), expected: expected.toFixed(decimals) });
};

check("Total shipping", p.totalShippingUsd, 8600);
check("Packing per carton", p.packingPerCartonUsd, 2.0);

check("20ft cartons", p.twentyFt.cartons, 1920, 0);
check("20ft total kg", p.twentyFt.totalKg, 8640, 1);
check("20ft fruit cost", p.twentyFt.totalFruitCostUsd, 17280);
check("20ft packing cost", p.twentyFt.totalPackingCostUsd, 3840);
check("20ft shipping", p.twentyFt.totalShippingUsd, 8600);
check("20ft total landed", p.twentyFt.totalLandedUsd, 29720);
check("20ft cost/kg", p.twentyFt.costPerKgUsd, 3.4398, 4);
check("20ft cost/carton", p.twentyFt.costPerCartonUsd, 15.4792, 4);

check("40ft cartons", p.fortyFt.cartons, 3840, 0);
check("40ft total kg", p.fortyFt.totalKg, 17280, 1);
check("40ft fruit cost", p.fortyFt.totalFruitCostUsd, 34560);
check("40ft packing cost", p.fortyFt.totalPackingCostUsd, 7680);
check("40ft shipping", p.fortyFt.totalShippingUsd, 8600);
check("40ft total landed", p.fortyFt.totalLandedUsd, 50840);
check("40ft cost/kg", p.fortyFt.costPerKgUsd, 2.9421, 4);
check("40ft cost/carton", p.fortyFt.costPerCartonUsd, 13.2396, 4);

const m20 = sellByMargin(p.twentyFt, [20, 30, 40]);
check("20ft @20% $/kg", m20[0].pricePerKg, 4.2998, 4);
check("20ft @20% $/carton", m20[0].pricePerCarton, 19.35);
check("20ft @20% revenue", m20[0].revenue, 37150);
check("20ft @20% profit", m20[0].profit, 7430);
check("20ft @30% $/kg", m20[1].pricePerKg, 4.9140, 4);
check("20ft @30% $/carton", m20[1].pricePerCarton, 22.11);
check("20ft @30% revenue", m20[1].revenue, 42457.14);
check("20ft @30% profit", m20[1].profit, 12737.14);
check("20ft @40% $/kg", m20[2].pricePerKg, 5.7330, 4);
check("20ft @40% $/carton", m20[2].pricePerCarton, 25.80);
check("20ft @40% revenue", m20[2].revenue, 49533.33);
check("20ft @40% profit", m20[2].profit, 19813.33);

const m40 = sellByMargin(p.fortyFt, [20, 30, 40]);
check("40ft @20% $/kg", m40[0].pricePerKg, 3.6777, 4);
check("40ft @20% $/carton", m40[0].pricePerCarton, 16.55);
check("40ft @20% revenue", m40[0].revenue, 63550);
check("40ft @20% profit", m40[0].profit, 12710);
check("40ft @30% $/kg", m40[1].pricePerKg, 4.2030, 4);
check("40ft @30% $/carton", m40[1].pricePerCarton, 18.91);
check("40ft @30% revenue", m40[1].revenue, 72628.57);
check("40ft @30% profit", m40[1].profit, 21788.57);
check("40ft @40% $/kg", m40[2].pricePerKg, 4.9035, 4);
check("40ft @40% $/carton", m40[2].pricePerCarton, 22.07);
check("40ft @40% revenue", m40[2].revenue, 84733.33);
check("40ft @40% profit", m40[2].profit, 33893.33);

const c20 = sellByCartonPrice(p.twentyFt, [18, 20, 35], inputs.kgPerCarton);
check("20ft @$18 $/kg", c20[0].pricePerKg, 4.0, 4);
check("20ft @$18 margin", c20[0].marginPct, 14.0, 1);
check("20ft @$18 revenue", c20[0].revenue, 34560);
check("20ft @$18 profit", c20[0].profit, 4840);
check("20ft @$20 $/kg", c20[1].pricePerKg, 4.4444, 4);
check("20ft @$20 margin", c20[1].marginPct, 22.6, 1);
check("20ft @$20 revenue", c20[1].revenue, 38400);
check("20ft @$20 profit", c20[1].profit, 8680);
check("20ft @$35 $/kg", c20[2].pricePerKg, 7.7778, 4);
check("20ft @$35 margin", c20[2].marginPct, 55.8, 1);
check("20ft @$35 revenue", c20[2].revenue, 67200);
check("20ft @$35 profit", c20[2].profit, 37480);

const c40 = sellByCartonPrice(p.fortyFt, [18, 20, 35], inputs.kgPerCarton);
check("40ft @$18 $/kg", c40[0].pricePerKg, 4.0, 4);
check("40ft @$18 margin", c40[0].marginPct, 26.4, 1);
check("40ft @$18 revenue", c40[0].revenue, 69120);
check("40ft @$18 profit", c40[0].profit, 18280);
check("40ft @$20 $/kg", c40[1].pricePerKg, 4.4444, 4);
check("40ft @$20 margin", c40[1].marginPct, 33.8, 1);
check("40ft @$20 revenue", c40[1].revenue, 76800);
check("40ft @$20 profit", c40[1].profit, 25960);
check("40ft @$35 $/kg", c40[2].pricePerKg, 7.7778, 4);
check("40ft @$35 margin", c40[2].marginPct, 62.2, 1);
check("40ft @$35 revenue", c40[2].revenue, 134400);
check("40ft @$35 profit", c40[2].profit, 83560);

let pass = 0;
let fail = 0;
const failures: string[] = [];
for (const c of checks) {
  if (c.actual === c.expected) {
    pass++;
  } else {
    fail++;
    failures.push(`  ✗ ${c.label}: actual=${c.actual}  expected=${c.expected}`);
  }
}

console.log(`\n${pass} pass, ${fail} fail (out of ${checks.length})`);
if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(f);
  process.exit(1);
}
console.log("\nAll cells match the source Pricing Sheet.xlsx.");
