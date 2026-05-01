// GET /api/drive/list?folderId=…&q=…
//
// Two modes:
//   • folderId given → list children of that folder (or "root").
//   • q given        → free-text search across the connected account.
//
// Both return DriveItem[] + an optional breadcrumb chain for the folder
// list mode so the client can render the path.

import { NextResponse, type NextRequest } from "next/server";
import { listFolder, searchFiles, resolveBreadcrumb } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId");
  const q = url.searchParams.get("q");

  try {
    if (q && q.trim()) {
      const items = await searchFiles(q.trim());
      return NextResponse.json({ ok: true, items, breadcrumb: [] });
    }
    const target = folderId && folderId.trim() ? folderId.trim() : "root";
    const items = await listFolder(target);
    const breadcrumb = target === "root" ? [] : await resolveBreadcrumb(target);
    return NextResponse.json({ ok: true, items, breadcrumb });
  } catch (e) {
    const msg = (e as Error).message ?? "drive_list_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
