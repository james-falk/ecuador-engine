// /drive — live Drive folder browser. Files live in Google Drive; this is
// a window into them, not a copy. Pin a file to a company so it shows up
// on /companies/[slug] → Documents.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import { DriveBrowser } from "@/components/design/drive-browser";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { asc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  // Pin targets — only the operating entities you'd actually file documents
  // under. Add more kinds here when the model grows.
  const pinTargets = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug })
    .from(companies)
    .where(inArray(companies.kind, ["producer", "importer", "holding", "packing_facility"] as const))
    .orderBy(asc(companies.name));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Drive"]}
        right={
          <Link href="/admin/google-auth" className="mono" style={{ fontSize: 11, color: "var(--text-3)", textDecoration: "none" }}>
            connection ↗
          </Link>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Drive
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Browse the connected Google account&apos;s files. Pin to an entity to surface on its Documents tab.
            </span>
          </div>

          <DriveBrowser pinTargets={pinTargets} />
        </div>
      </div>
    </div>
  );
}
