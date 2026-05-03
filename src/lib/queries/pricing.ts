// Pricing model — read paths.
//
// Mirror of the Ecuador/Selling in US/Documents/Pricing Sheet.xlsx file.
// All derived values (cost per kg, total landed, sell-pricing tables) are
// computed client-side from the inputs row to keep the schema small.

import { desc } from "drizzle-orm";
import { db } from "@/db";
import { pricingInputs } from "@/db/schema";

export type PricingInputsRow = {
  id: string;
  fruitCostPerKgUsd: number;
  kgPerCarton: number;
  labelCostPerCartonUsd: number;
  packingCostPerCartonUsd: number;
  materialCostPerCartonUsd: number;
  ecuadorTransportUsd: number;
  oceanFreightUsd: number;
  importCustomsUsd: number;
  cartonsPer20ft: number;
  cartonsPer40ft: number;
};

export async function getPricingInputs(): Promise<PricingInputsRow> {
  const [row] = await db
    .select()
    .from(pricingInputs)
    .orderBy(desc(pricingInputs.updatedAt))
    .limit(1);
  if (!row) {
    // Fall back to seed defaults if the row hasn't been migrated yet.
    return {
      id: "",
      fruitCostPerKgUsd: 2.0,
      kgPerCarton: 4.5,
      labelCostPerCartonUsd: 0.1,
      packingCostPerCartonUsd: 1.6,
      materialCostPerCartonUsd: 0.3,
      ecuadorTransportUsd: 400,
      oceanFreightUsd: 7000,
      importCustomsUsd: 1200,
      cartonsPer20ft: 1920,
      cartonsPer40ft: 3840,
    };
  }
  return {
    id: row.id,
    fruitCostPerKgUsd: Number(row.fruitCostPerKgUsd),
    kgPerCarton: Number(row.kgPerCarton),
    labelCostPerCartonUsd: Number(row.labelCostPerCartonUsd),
    packingCostPerCartonUsd: Number(row.packingCostPerCartonUsd),
    materialCostPerCartonUsd: Number(row.materialCostPerCartonUsd),
    ecuadorTransportUsd: Number(row.ecuadorTransportUsd),
    oceanFreightUsd: Number(row.oceanFreightUsd),
    importCustomsUsd: Number(row.importCustomsUsd),
    cartonsPer20ft: row.cartonsPer20ft,
    cartonsPer40ft: row.cartonsPer40ft,
  };
}

export type ContainerComputed = {
  cartons: number;
  totalKg: number;
  totalFruitCostUsd: number;
  totalPackingCostUsd: number;
  totalShippingUsd: number;
  totalLandedUsd: number;
  costPerKgUsd: number;
  costPerCartonUsd: number;
};

export type PricingComputed = {
  inputs: PricingInputsRow;
  totalShippingUsd: number;
  packingPerCartonUsd: number; // label + packing + material
  twentyFt: ContainerComputed;
  fortyFt: ContainerComputed;
};

export function computePricing(inputs: PricingInputsRow): PricingComputed {
  const totalShippingUsd =
    inputs.ecuadorTransportUsd + inputs.oceanFreightUsd + inputs.importCustomsUsd;
  const packingPerCartonUsd =
    inputs.labelCostPerCartonUsd + inputs.packingCostPerCartonUsd + inputs.materialCostPerCartonUsd;

  const compute = (cartons: number): ContainerComputed => {
    const totalKg = cartons * inputs.kgPerCarton;
    const totalFruitCostUsd = totalKg * inputs.fruitCostPerKgUsd;
    const totalPackingCostUsd = cartons * packingPerCartonUsd;
    const totalLandedUsd = totalFruitCostUsd + totalPackingCostUsd + totalShippingUsd;
    return {
      cartons,
      totalKg,
      totalFruitCostUsd,
      totalPackingCostUsd,
      totalShippingUsd,
      totalLandedUsd,
      costPerKgUsd: totalLandedUsd / totalKg,
      costPerCartonUsd: totalLandedUsd / cartons,
    };
  };

  return {
    inputs,
    totalShippingUsd,
    packingPerCartonUsd,
    twentyFt: compute(inputs.cartonsPer20ft),
    fortyFt: compute(inputs.cartonsPer40ft),
  };
}

export type MarginRow = {
  marginPct: number;
  pricePerKg: number;
  pricePerCarton: number;
  revenue: number;
  profit: number;
};

export function sellByMargin(c: ContainerComputed, marginPcts: number[]): MarginRow[] {
  // margin% = profit / revenue → revenue = totalLanded / (1 - margin)
  return marginPcts.map((m) => {
    const revenue = c.totalLandedUsd / (1 - m / 100);
    const profit = revenue - c.totalLandedUsd;
    return {
      marginPct: m,
      pricePerKg: revenue / c.totalKg,
      pricePerCarton: revenue / c.cartons,
      revenue,
      profit,
    };
  });
}

export type CartonPriceRow = {
  pricePerCarton: number;
  pricePerKg: number;
  marginPct: number;
  revenue: number;
  profit: number;
};

export function sellByCartonPrice(c: ContainerComputed, cartonPrices: number[], kgPerCarton: number): CartonPriceRow[] {
  return cartonPrices.map((pc) => {
    const revenue = pc * c.cartons;
    const profit = revenue - c.totalLandedUsd;
    const marginPct = (profit / revenue) * 100;
    return {
      pricePerCarton: pc,
      pricePerKg: pc / kgPerCarton,
      marginPct,
      revenue,
      profit,
    };
  });
}

// Default rows shown on the recreated pricing sheet — match the source xlsx.
export const DEFAULT_MARGIN_PCTS = [20, 30, 40];
export const DEFAULT_CARTON_PRICES = [18, 20, 35];

// Static market-data snapshot from the Pricing Sheet.xlsx "Market Data" tab.
// Living data here because we don't have a feed yet — a follow-on slice can
// pipe USDA AMS into a dynamic table.
export type MarketDataRow = {
  date: string;
  variety: string;
  pkg: string;
  size: string;
  priceLow: string;
  priceHigh: string;
  demand: string;
  market: string;
  notes: string;
};

export const MARKET_DATA_SNAPSHOT: MarketDataRow[] = [
  { date: "2025-09-19", variety: "Red Skin / White Flesh",    pkg: "4.5 kg carton", size: "7-10s", priceLow: "$28.00", priceHigh: "$30.00", demand: "Fairly Good", market: "Steady", notes: "Occasional higher" },
  { date: "2025-09-23", variety: "Red Skin / White Flesh",    pkg: "4.5 kg carton", size: "7-10s", priceLow: "$28.00", priceHigh: "$30.00", demand: "Fairly Good", market: "Steady", notes: "Occasional higher" },
  { date: "2025-09-26", variety: "Red Skin / White Flesh",    pkg: "4.5 kg carton", size: "7-10s", priceLow: "$28.00", priceHigh: "$30.00", demand: "Fairly Good", market: "Steady", notes: "Occasional higher" },
  { date: "2025-09-30", variety: "Red Skin / White Flesh",    pkg: "4.5 kg carton", size: "7-10s", priceLow: "$28.00", priceHigh: "$30.00", demand: "Fairly Good", market: "Steady", notes: "Occasional higher" },
  { date: "2026-04-03", variety: "Red Skin / White Flesh",    pkg: "4.5 kg carton", size: "7-10s", priceLow: "$18.00", priceHigh: "$20.00", demand: "Moderate",    market: "Steady", notes: "Few $22" },
  { date: "2025-09-19", variety: "Yellow Skin / White Flesh", pkg: "6 lb carton",   size: "7-10s", priceLow: "$24.00", priceHigh: "$26.00", demand: "Fairly Good", market: "Steady", notes: "12s: supply too low to quote" },
  { date: "2025-09-23", variety: "Yellow Skin / White Flesh", pkg: "6 lb carton",   size: "7-10s", priceLow: "$24.00", priceHigh: "$26.00", demand: "Fairly Good", market: "Steady", notes: "12s: supply too low to quote" },
  { date: "2025-09-26", variety: "Yellow Skin / White Flesh", pkg: "6 lb carton",   size: "7-10s", priceLow: "$24.00", priceHigh: "$26.00", demand: "Fairly Good", market: "Steady", notes: "12s: supply too low to quote" },
  { date: "2025-09-30", variety: "Yellow Skin / White Flesh", pkg: "6 lb carton",   size: "7-10s", priceLow: "$24.00", priceHigh: "$26.00", demand: "Fairly Good", market: "Steady", notes: "12s: supply too low to quote" },
  { date: "2026-04-03", variety: "Yellow Skin / White Flesh", pkg: "4.5 kg carton", size: "7-9s",  priceLow: "$17.00", priceHigh: "$20.00", demand: "Moderate",    market: "Steady", notes: "" },
];

export type SeasonalSummaryRow = {
  period: string;
  source: string;
  market: string;
  priceLow: string;
  priceHigh: string;
  avgPerKg: string;
};

export const SEASONAL_SUMMARY: SeasonalSummaryRow[] = [
  { period: "Sep 2025 (fall peak)",      source: "USDA MH_FV111",    market: "Miami FOB",   priceLow: "$28.00", priceHigh: "$30.00", avgPerKg: "$6.44/kg" },
  { period: "Apr 2026 (spring low)",     source: "USDA MH_FV111",    market: "Miami FOB",   priceLow: "$18.00", priceHigh: "$20.00", avgPerKg: "$4.22/kg" },
  { period: "Apr 2025",                  source: "Tridge",           market: "US Wholesale", priceLow: "$28.25", priceHigh: "$31.00", avgPerKg: "$6.58/kg" },
  { period: "Feb 2026 offer",            source: "Tridge",           market: "US Wholesale", priceLow: "$30.20", priceHigh: "$30.20", avgPerKg: "$6.71/kg" },
  { period: "Dec 2023 (peak)",           source: "USDA IndexMundi",  market: "New York",     priceLow: "$44.00", priceHigh: "$54.00", avgPerKg: "$10.89/kg" },
  { period: "Jul 2023 (summer)",         source: "USDA IndexMundi",  market: "New York",     priceLow: "$35.00", priceHigh: "$40.00", avgPerKg: "$8.33/kg" },
  { period: "Jan 2024 (multi-city)",     source: "USDA IndexMundi",  market: "Various",      priceLow: "$15.00", priceHigh: "$33.00", avgPerKg: "varies" },
];
