// Live embed of Ecuador/Selling in US/Documents/Pricing Sheet.xlsx via
// Google Sheets' iframe URL. Edits in the iframe save directly to the
// underlying Drive file (when the viewer is signed in to Google with edit
// access — same OAuth account that owns the Drive folder).
//
// We don't try to two-way sync with our `pricing_inputs` table; the sheet
// IS the source of truth. The DB table is kept for future engine code that
// wants a snapshot but isn't actively edited from the UI.

"use client";

import * as React from "react";

export function PricingSheetEmbed({
  fileId,
  viewLink,
  error,
}: {
  fileId: string | null;
  viewLink: string | null;
  error: string | null;
}) {
  if (error) {
    return (
      <div
        style={{
          padding: "14px 18px",
          border: "1px solid var(--rose)",
          background: "oklch(from var(--rose) l c h / 0.10)",
          color: "var(--rose)",
          borderRadius: 10,
          fontSize: 12.5,
        }}
      >
        Drive: {error}
      </div>
    );
  }
  if (!fileId) {
    return (
      <div
        style={{
          padding: "32px 18px",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: 12.5,
          border: "1px dashed var(--line-soft)",
          borderRadius: 10,
        }}
      >
        Pricing Sheet not found.
      </div>
    );
  }

  // Sheets accept a few embed query params:
  //   widget=true     — render the spreadsheet without the Drive chrome
  //   headers=false   — hide the row/column headers
  //   chrome=false    — strip the "open in Sheets" header band
  //   rm=embedded     — minimal mode (no Sheets UI, just the cells)
  // Edit-mode requires the viewer to be signed in to Google with edit
  // access; the iframe inherits whatever Google session their browser has.
  const editEmbedUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit?widget=true&headers=false&rm=embedded`;
  const previewUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 11.5,
          color: "var(--text-3)",
          flexWrap: "wrap",
        }}
      >
        <span>Live embed of Pricing Sheet.xlsx — edits save to Drive immediately.</span>
        <span style={{ flex: 1 }} />
        {viewLink && (
          <a
            href={viewLink}
            target="_blank"
            rel="noreferrer"
            className="mono"
            style={{ fontSize: 11, color: "var(--green)", textDecoration: "none" }}
          >
            Open in Drive ↗
          </a>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--bg-1)",
        }}
      >
        <iframe
          title="Pricing Sheet"
          src={editEmbedUrl}
          style={{
            width: "100%",
            height: "min(78vh, 720px)",
            border: 0,
            display: "block",
          }}
          // Fallback for browsers that block 3p cookies — they'll see the
          // preview-only renderer instead of the editor.
          onError={(e) => {
            const el = e.currentTarget as HTMLIFrameElement;
            if (el.src !== previewUrl) el.src = previewUrl;
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
        Sign in to Google in this browser (the same account connected at /admin/google-auth) for edit access.
        If the embed shows a sign-in screen, click <strong>Open in Drive</strong>.
      </div>
    </div>
  );
}
