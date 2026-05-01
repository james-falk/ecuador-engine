"use client";

// Live Drive folder browser. Reuses the same /api/drive/list endpoint as
// the modal picker. Two modes:
//   • Browse  — folder tree with breadcrumb.
//   • Search  — free-text query.
// Each file row has a "Pin to entity" inline action that posts to
// pinDriveFile and surfaces the file under /companies/[slug] → Documents.

import * as React from "react";
import { Icon } from "./icons";
import { pinDriveFile } from "@/lib/actions/drive-pins";

type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime: string | null;
  webViewLink: string | null;
  iconLink: string | null;
  size: string | null;
  parents: string[];
};

type PinTarget = { id: string; name: string; slug: string | null };

export function DriveBrowser({ pinTargets }: { pinTargets: PinTarget[] }) {
  const [folderId, setFolderId] = React.useState<string>("root");
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<DriveItem[]>([]);
  const [breadcrumb, setBreadcrumb] = React.useState<DriveItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pinningId, setPinningId] = React.useState<string | null>(null);
  const [pinnedFlash, setPinnedFlash] = React.useState<string | null>(null);

  const isSearchMode = query.trim().length > 0;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (isSearchMode) params.set("q", query.trim());
        else params.set("folderId", folderId);
        const r = await fetch(`/api/drive/list?${params.toString()}`);
        const j = await r.json();
        if (cancelled) return;
        if (!j.ok) throw new Error(j.error ?? "drive list failed");
        setItems(j.items ?? []);
        setBreadcrumb(j.breadcrumb ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderId, query, isSearchMode]);

  async function onPin(item: DriveItem, companyId: string) {
    if (!companyId) return;
    setPinningId(item.id);
    setError(null);
    try {
      const r = await pinDriveFile({
        companyId,
        driveFileId: item.id,
        driveFileName: item.name,
        driveViewLink: item.webViewLink ?? `https://drive.google.com/file/d/${item.id}/view`,
        driveMimeType: item.mimeType || null,
        driveModifiedTime: item.modifiedTime,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPinnedFlash(item.id);
      setTimeout(() => setPinnedFlash((id) => (id === item.id ? null : id)), 1800);
    } finally {
      setPinningId(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--line-soft)",
        borderRadius: 12,
        background: "var(--bg-1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--line-soft)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="search" size={13} color="var(--text-3)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Drive…"
          style={{
            flex: 1,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--text-0)",
            fontSize: 13,
          }}
        />
        {isSearchMode && (
          <button onClick={() => setQuery("")} className="btn btn--ghost" style={{ fontSize: 11 }}>
            Clear
          </button>
        )}
      </div>

      {!isSearchMode && (
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid var(--line-soft)",
            fontSize: 11.5,
            color: "var(--text-3)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <button type="button" onClick={() => setFolderId("root")} style={crumbBtn(folderId === "root")}>My Drive</button>
          {breadcrumb.map((b) => (
            <React.Fragment key={b.id}>
              <span>/</span>
              <button type="button" onClick={() => setFolderId(b.id)} style={crumbBtn(b.id === folderId)}>
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      <div style={{ minHeight: 320, padding: 8 }}>
        {error && (
          <div
            style={{
              padding: "10px 14px",
              margin: 8,
              background: "color-mix(in oklab, var(--rose) 12%, var(--bg-1))",
              color: "var(--rose)",
              border: "1px solid var(--rose)",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
            {isSearchMode ? "No matches." : "Empty folder."}
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              style={{
                display: "grid",
                gridTemplateColumns: "20px 1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 14px",
                borderBottom: "1px solid var(--line-soft)",
                fontSize: 12.5,
              }}
            >
              <Icon
                name={it.isFolder ? "box" : "file"}
                size={13}
                color={it.isFolder ? "var(--text-2)" : "var(--text-3)"}
              />
              {it.isFolder ? (
                <button
                  type="button"
                  onClick={() => setFolderId(it.id)}
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--text-1)",
                    textAlign: "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12.5,
                  }}
                >
                  {it.name}
                </button>
              ) : (
                <a
                  href={it.webViewLink ?? `https://drive.google.com/file/d/${it.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "var(--text-1)",
                    textDecoration: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.name}
                </a>
              )}
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {it.modifiedTime?.slice(0, 10) ?? ""}
              </span>
              {!it.isFolder ? (
                <PinControl
                  pinTargets={pinTargets}
                  onPin={(companyId) => onPin(it, companyId)}
                  pinning={pinningId === it.id}
                  pinned={pinnedFlash === it.id}
                />
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PinControl({
  pinTargets,
  onPin,
  pinning,
  pinned,
}: {
  pinTargets: PinTarget[];
  onPin: (companyId: string) => void;
  pinning: boolean;
  pinned: boolean;
}) {
  const [companyId, setCompanyId] = React.useState(pinTargets[0]?.id ?? "");
  if (pinned) {
    return (
      <span className="mono" style={{ fontSize: 10.5, color: "var(--green)" }}>Pinned ✓</span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
        style={{
          padding: "3px 6px",
          fontSize: 11,
          background: "var(--bg-3)",
          border: "1px solid var(--line-soft)",
          borderRadius: 6,
          color: "var(--text-1)",
          outline: "none",
        }}
      >
        {pinTargets.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onPin(companyId)}
        disabled={pinning || !companyId}
        style={{ fontSize: 11, padding: "3px 8px" }}
      >
        {pinning ? "…" : "Pin"}
      </button>
    </span>
  );
}

function crumbBtn(active: boolean): React.CSSProperties {
  return {
    background: "transparent",
    border: 0,
    padding: "2px 4px",
    cursor: "pointer",
    color: active ? "var(--text-1)" : "var(--text-3)",
    fontSize: 11.5,
  };
}
