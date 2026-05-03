// Invoke the autonomous market-intel agent end-to-end against real
// upstream sources (USDA AMS + customs manifest). Writes to
// pricing_snapshots in the production Neon DB.

import "./_env";
import { runMarketIntelAgent } from "../src/lib/agents/market-intel/run";

(async () => {
  console.log("Running market-intel agent (live mode, against real upstreams)...");
  const t0 = Date.now();
  try {
    const useFixtures = process.argv.includes("--fixtures");
    const result = await runMarketIntelAgent({ testMode: useFixtures, dryRun: false });
    const ms = Date.now() - t0;
    console.log(`\nresult: ${JSON.stringify(result, null, 2)}`);
    console.log(`elapsed: ${ms}ms`);
    process.exit(0);
  } catch (e) {
    console.error("FAILED:", e);
    process.exit(1);
  }
})();
