// /selling — outbound pillar.
//
//   • Pricing — recreated from Ecuador/Selling in US/Documents/Pricing Sheet.xlsx
//   • Buyers  — stage-based kanban (Lead → In conversation → Negotiating → Active / Lost)
//   • Drive   — auto-pulled files from Ecuador/Selling in US

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import { PricingSheet } from "@/components/design/pricing-sheet";
import { BuyerBoard } from "@/components/design/buyer-board";
import { listCompanyFolder } from "@/lib/google/drive";
import { getPricingInputs } from "@/lib/queries/pricing";
import { getBuyers } from "@/lib/queries/buyers";

type TabKey = "pricing" | "buyers" | "drive";
const VALID_TABS: TabKey[] = ["pricing", "buyers", "drive"];

export const dynamic = "force-dynamic";

export default async function SellingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: TabKey = VALID_TABS.includes(params.tab as TabKey) ? (params.tab as TabKey) : "pricing";

  const [pricing, buyers] = await Promise.all([getPricingInputs(), getBuyers()]);

  // Drive folder pull happens server-side. Failures surface inline.
  let driveFiles: Array<{ id: string; name: string; webViewLink: string | null; modifiedTime: string | null; isFolder: boolean }> = [];
  let driveError: string | null = null;
  let driveFolderLink: string | null = null;
  try {
    const result = await listCompanyFolder("Selling in US");
    if (result) {
      driveFiles = result.files;
      driveFolderLink = result.folder.webViewLink;
    }
  } catch (e) {
    driveError = (e as Error).message ?? "Drive lookup failed";
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar crumbs={["Selling"]} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Selling
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Outbound: Ecuador → US (and beyond).
            </span>
          </div>

          <Tabs current={tab} buyersCount={buyers.length} driveCount={driveFiles.length} />

          {tab === "pricing" && <PricingSheet inputs={pricing} />}
          {tab === "buyers" && <BuyerBoard buyers={buyers} />}
          {tab === "drive" && (
            <DriveSection files={driveFiles} folderLink={driveFolderLink} error={driveError} />
          )}
        </div>
      </div>
    </div>
  );
}

function Tabs({ current, buyersCount, driveCount }: { current: TabKey; buyersCount: number; driveCount: number }) {
  const items: Array<{ id: TabKey; label: string }> = [
    { id: "pricing", label: "Pricing" },
    { id: "buyers", label: `Buyers · ${buyersCount}` },
    { id: "drive", label: `Drive · ${driveCount}` },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        borderRadius: 8,
        background: "var(--bg-2)",
        border: "1px solid var(--line-soft)",
        marginBottom: 18,
      }}
    >
      {items.map((o) => {
        const active = o.id === current;
        return (
          <Link
            key={o.id}
            href={`?tab=${o.id}`}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              background: active ? "var(--bg-4)" : "transparent",
              color: active ? "var(--text-0)" : "var(--text-2)",
              fontSize: 11.5,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

function DriveSection({
  files,
  folderLink,
  error,
}: {
  files: Array<{ id: string; name: string; webViewLink: string | null; modifiedTime: string | null; isFolder: boolean }>;
  folderLink: string | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div style={{ padding: "10px 14px", border: "1px solid var(--rose)", borderRadius: 10, color: "var(--rose)", fontSize: 12.5, background: "oklch(from var(--rose) l c h / 0.10)" }}>
        Drive: {error}
      </div>
    );
  }
  if (files.length === 0) {
    return (
      <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5, border: "1px dashed var(--line-soft)", borderRadius: 10 }}>
        No files in Ecuador/Selling in US.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {folderLink && (
        <a href={folderLink} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11, color: "var(--green)", textDecoration: "none", alignSelf: "flex-start" }}>
          Open folder in Drive ↗
        </a>
      )}
      <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
        {files.map((f, i) => (
          <a
            key={f.id}
            href={f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr auto",
              gap: 12,
              padding: "10px 14px",
              alignItems: "center",
              borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
              fontSize: 12.5,
              textDecoration: "none",
              color: "var(--text-1)",
            }}
          >
            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>{f.modifiedTime?.slice(0, 10) ?? "—"}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.isFolder ? `📁 ${f.name}` : f.name}
            </span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--green)" }}>Open ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
