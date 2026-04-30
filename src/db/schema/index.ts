// Re-export every pillar's schema so Drizzle can introspect a single root.
// Each pillar lives in its own file; cross-pillar references go through these
// exports rather than reaching into another pillar's internals.

export * from "./companies";
export * from "./people";
export * from "./compliance";
export * from "./accounts";
export * from "./harvests";
export * from "./expenses";
export * from "./cash-movements";
export * from "./tasks";
