"use client";

// Modal Drive picker. Two modes:
//   • Browse  — folder tree with breadcrumb, click into folders.
//   • Search  — free-text query across the connected account.
//
// On select, calls onSelect with { fileId, name, webViewLink } and closes.
// Cancel = onClose() with no selection. Mobile: full-screen overlay.

import * as React from "react";
import { Icon } from "./icons";

export type DriveFile = {
  id: string;
  name: string;
  webViewLink: string | null;
};

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

export function DrivePicker({
  open,
  initialFolderId,
  onClose,
  onSelect,
}: {
  open: boolean;
  initialFolderId?: string;
  onClose: () => void;
  onSelect: (file: DriveFile) => void;
}) {
  const [folderId, setFolderId] = React.useState<string>(initialFolderId ?? "root");
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<DriveItem[]>([]);
  const [breadcrumb, setBreadcrumb] = React.useState<DriveItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isSearchMode = query.trim().length > 0;

  const load = React.useCallback(
    async (targetFolderId: string, q: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        else params.set("folderId", targetFolderId);
        const r = await fetch(`/api/drive/list?${params.toString()}`);
        const j = await r.json();
        if (!j.ok) throw new Error(j.error ?? "drive list failed");
        setItems(j.items ?? []);
        setBreadcrumb(j.breadcrumb ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!open) return;
    load(folderId, query);
  }, [open, folderId, query, load]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "oklch(0 0 0 / 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ee-drawer-panel"
        style={{
          width: 720,
          maxWidth: "100%",
          maxHeight: "80vh",
          background: "var(--bg-1)",
          border: "1px solid var(--line-soft)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
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
          <button onClick={onClose} className="btn btn--ghost" style={{ fontSize: 11.5 }}>
            Cancel
          </button>
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
            <button
              type="button"
              onClick={() => setFolderId("root")}
              style={{ ...crumbBtnStyle, color: folderId === "root" ? "var(--text-1)" : "var(--text-3)" }}
            >
              My Drive
            </button>
            {breadcrumb.map((b) => (
              <React.Fragment key={b.id}>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => setFolderId(b.id)}
                  style={{
                    ...crumbBtnStyle,
                    color: b.id === folderId ? "var(--text-1)" : "var(--text-3)",
                  }}
                >
                  {b.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
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
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
              {isSearchMode ? "No matches." : "Empty folder."}
            </div>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() =>
                  it.isFolder
                    ? setFolderId(it.id)
                    : onSelect({ id: it.id, name: it.name, webViewLink: it.webViewLink })
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "20px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  width: "100%",
                  padding: "10px 14px",
                  border: 0,
                  background: "transparent",
                  color: "var(--text-1)",
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: 6,
                  fontSize: 12.5,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon
                  name={it.isFolder ? "box" : "file"}
                  size={13}
                  color={it.isFolder ? "var(--text-2)" : "var(--text-3)"}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.name}
                </span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  {it.modifiedTime?.slice(0, 10) ?? ""}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const crumbBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: 0,
  padding: "2px 4px",
  cursor: "pointer",
  color: "var(--text-3)",
  fontSize: 11.5,
};
