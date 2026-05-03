// Drive v3 wrappers. Read-only by design — listing and metadata only.
// Writes (uploading new artifacts directly from the engine) come later
// when we add a write scope.

import { google, drive_v3 } from "googleapis";
import { getAccessToken } from "./oauth";

// The single account in v1. When we add multi-account support, every
// caller passes the email through; for now we resolve from this env
// var so callers don't need to know the address.
function getDefaultAccount(): string {
  const v = process.env.GOOGLE_OAUTH_DEFAULT_EMAIL;
  if (!v) {
    throw new Error(
      "GOOGLE_OAUTH_DEFAULT_EMAIL is missing. Set it to the account that will own the Drive connection (e.g. jamesfalk4@gmail.com)."
    );
  }
  return v;
}

// The "/Ecuador" folder is the only subtree the engine reads. Listing or
// searching outside this subtree is rejected at the boundary so a signed-in
// user can never accidentally browse the rest of James's Drive.
//
// Returns null when the env var isn't configured — callers should surface
// a configuration banner instead of crashing.
export function getEcuadorRootId(): string | null {
  const v = process.env.ECUADOR_DRIVE_FOLDER_ID;
  return v && v.trim() ? v.trim() : null;
}

export class DriveScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveScopeError";
  }
}

async function getDrive(email?: string): Promise<drive_v3.Drive> {
  const target = email ?? getDefaultAccount();
  const accessToken = await getAccessToken(target);
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: client });
}

export type DriveItem = {
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

const FIELDS =
  "files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size, parents)";

function shape(f: drive_v3.Schema$File): DriveItem {
  return {
    id: f.id ?? "",
    name: f.name ?? "(unnamed)",
    mimeType: f.mimeType ?? "",
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    size: f.size ?? null,
    parents: f.parents ?? [],
  };
}

// List children of a folder. Pass "root" to start at My Drive root.
//
// Internal helper — bypasses scope check. Used by privileged paths (e.g.
// the read-drive-file CLI script) and recursively by isWithinEcuador.
async function listFolderUnscoped(folderId: string, email?: string): Promise<DriveItem[]> {
  const drive = await getDrive(email);
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: 200,
    fields: FIELDS,
    orderBy: "folder,name",
  });
  return (res.data.files ?? []).map(shape);
}

// Public list: enforces the Ecuador scope. Pass "root" to start at the
// Ecuador folder (NOT My Drive root). Throws DriveScopeError if the
// requested folder is outside the Ecuador subtree.
export async function listFolder(folderId: string, email?: string): Promise<DriveItem[]> {
  const target = await resolveScopedFolderId(folderId, email);
  return listFolderUnscoped(target, email);
}

// Resolve "root" → ECUADOR_DRIVE_FOLDER_ID, or pass through any folderId
// that's confirmed to be inside the Ecuador subtree. Throws otherwise.
async function resolveScopedFolderId(folderId: string, email?: string): Promise<string> {
  const ecuador = getEcuadorRootId();
  if (!ecuador) {
    throw new DriveScopeError(
      "ECUADOR_DRIVE_FOLDER_ID is not set. Configure it in .env.local before browsing Drive."
    );
  }
  if (folderId === "root" || folderId === ecuador) return ecuador;
  const within = await isWithinEcuador(folderId, ecuador, email);
  if (!within) {
    throw new DriveScopeError(`Folder is outside the Ecuador subtree.`);
  }
  return folderId;
}

// Walk parents up; return true if any ancestor is the Ecuador root.
async function isWithinEcuador(folderId: string, ecuadorRoot: string, email?: string): Promise<boolean> {
  let current: string | null = folderId;
  for (let i = 0; i < 12 && current; i++) {
    if (current === ecuadorRoot) return true;
    const meta = await getFileMeta(current, email);
    current = meta.parents[0] ?? null;
  }
  return false;
}

// Free-text search scoped to the Ecuador subtree. Drive's search doesn't
// support a "subtree" filter natively, so we filter results client-side
// by walking each hit's parent chain.
export async function searchFiles(query: string, email?: string): Promise<DriveItem[]> {
  const ecuador = getEcuadorRootId();
  if (!ecuador) {
    throw new DriveScopeError(
      "ECUADOR_DRIVE_FOLDER_ID is not set. Configure it in .env.local before searching Drive."
    );
  }
  const drive = await getDrive(email);
  const safe = query.replace(/'/g, "\\'");
  const q = `name contains '${safe}' and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: 100,
    fields: FIELDS,
    orderBy: "modifiedTime desc",
  });
  const all = (res.data.files ?? []).map(shape);
  const out: DriveItem[] = [];
  for (const item of all) {
    if (await isWithinEcuador(item.id, ecuador, email)) out.push(item);
    if (out.length >= 50) break;
  }
  return out;
}

export async function getFileMeta(fileId: string, email?: string): Promise<DriveItem> {
  const drive = await getDrive(email);
  const res = await drive.files.get({
    fileId,
    fields:
      "id, name, mimeType, modifiedTime, webViewLink, iconLink, size, parents",
  });
  return shape(res.data);
}

// Resolve a folder's breadcrumb back up to the Ecuador root (NOT My Drive
// root). The Ecuador folder itself is included as the first crumb if we
// can resolve its metadata; otherwise the trail starts at the first
// ancestor we can read.
export async function resolveBreadcrumb(folderId: string, email?: string): Promise<DriveItem[]> {
  const ecuador = getEcuadorRootId();
  const trail: DriveItem[] = [];
  let current: string | null = folderId;
  for (let i = 0; i < 12 && current && current !== "root"; i++) {
    const meta = await getFileMeta(current, email);
    trail.unshift(meta);
    if (ecuador && current === ecuador) break;
    current = meta.parents[0] ?? null;
  }
  return trail;
}

// Find a child of a folder by exact (case-insensitive) name. Returns the
// matching DriveItem, or null. Used to walk a path like "Ecuador/Selling
// in US/Pricing" segment-by-segment.
export async function findChildByName(
  parentFolderId: string,
  name: string,
  email?: string
): Promise<DriveItem | null> {
  const drive = await getDrive(email);
  const safeName = name.replace(/'/g, "\\'");
  const safeParent = parentFolderId.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${safeParent}' in parents and trashed = false and name = '${safeName}'`,
    pageSize: 5,
    fields: FIELDS,
  });
  const files = res.data.files ?? [];
  if (files.length > 0) return shape(files[0]);
  // Fallback to a case-insensitive scan when an exact match misses.
  const all = await listFolderUnscoped(parentFolderId, email);
  const lower = name.toLowerCase();
  const match = all.find((f) => f.name.toLowerCase() === lower);
  return match ?? null;
}

// Hardcoded company → Drive subfolder name mapping. Owner-managed; we
// don't try to magically match accents or spelling variants. If a folder
// is renamed in Drive, update this table — single source of truth.
//
// Keys are companies.name values from the DB (case-insensitive match).
const COMPANY_FOLDER_OVERRIDES: Record<string, string> = {
  "finca del dragón": "Finca Del Dragon",
  "puresol imports":  "PureSol Imports",
};

// Hardcoded well-known Drive files / folders we reference by ID rather
// than by path. Survives folder renames; only breaks if the file itself
// is moved out of My Drive or trashed.
//
// To find an ID: run `npx tsx scripts/read-drive-file.ts --list "<path>"`
// and copy the bracketed value next to the file name.
export const KNOWN_DRIVE_FILES = {
  // Ecuador/Selling in US/Documents/Pricing Sheet.xlsx
  pricingSheet: "1kX99GoA810mbc-pHgc01HJXFAJ3r6k-F",
  // Ecuador/Selling in US (folder)
  sellingInUsFolder: "1ForWmONb3rjlN26TI1pvyc3y1p5CKB7G",
  // Ecuador/Selling in US/Documents (folder)
  sellingInUsDocumentsFolder: "1fHS1hpnODQT7kUx3EBjOS0WQ0-T1Maxu",
} as const;

// Find a subfolder under the Ecuador root for a given company. First tries
// the hardcoded override, then falls back to a case-insensitive name match.
// Returns null if not found OR the engine isn't configured.
export async function findCompanyFolder(companyName: string, email?: string): Promise<DriveItem | null> {
  const ecuador = getEcuadorRootId();
  if (!ecuador) return null;

  const override = COMPANY_FOLDER_OVERRIDES[companyName.trim().toLowerCase()];
  if (override) {
    const child = await findChildByName(ecuador, override, email);
    if (child && child.isFolder) return child;
  }

  const child = await findChildByName(ecuador, companyName, email);
  if (child && child.isFolder) return child;
  return null;
}

// List files in a company's Drive folder. Returns null if no matching folder.
// Uses the unscoped lister because we already validated the folder lives
// under Ecuador via findCompanyFolder.
export async function listCompanyFolder(companyName: string, email?: string): Promise<{ folder: DriveItem; files: DriveItem[] } | null> {
  const folder = await findCompanyFolder(companyName, email);
  if (!folder) return null;
  const files = await listFolderUnscoped(folder.id, email);
  return { folder, files };
}

// Walk a slash-separated path. Always starts at the Ecuador root —
// callers cannot escape the subtree by passing a different starting
// folder. Returns the final DriveItem (file or folder) or null if any
// segment is missing.
//
// Example: resolvePath("Selling in US/Documents/Pricing Sheet.xlsx") → file or null.
//
// NOTE: callers that need to traverse from My Drive root (rare —
// admin-only) should use resolvePathUnscoped explicitly.
export async function resolvePath(path: string, email?: string): Promise<DriveItem | null> {
  const ecuador = getEcuadorRootId();
  if (!ecuador) {
    throw new DriveScopeError(
      "ECUADOR_DRIVE_FOLDER_ID is not set. Configure it in .env.local before resolving Drive paths."
    );
  }
  return resolvePathUnscoped(ecuador, path, email);
}

// Admin-only: resolve a path from any starting folder. Used by the
// read-drive-file CLI script to bootstrap (e.g. find the Ecuador folder
// itself). Not callable from user-facing surfaces.
export async function resolvePathUnscoped(
  startFolderId: string,
  path: string,
  email?: string
): Promise<DriveItem | null> {
  const segments = path.split("/").map((s) => s.trim()).filter(Boolean);
  let currentId = startFolderId;
  let currentItem: DriveItem | null = null;
  for (const seg of segments) {
    const child = await findChildByName(currentId, seg, email);
    if (!child) return null;
    currentItem = child;
    currentId = child.id;
  }
  return currentItem;
}

// Download a non-Google-doc file as Buffer (e.g. uploaded PDF or XLSX).
export async function getFileContent(fileId: string, email?: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  name: string;
}> {
  const drive = await getDrive(email);
  const meta = await getFileMeta(fileId, email);
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  // googleapis typings say the body for arraybuffer is unknown; cast safely.
  const buffer = Buffer.from(res.data as ArrayBuffer);
  return { buffer, mimeType: meta.mimeType, name: meta.name };
}

// Export a Google Sheet as CSV (single tab — first sheet by default).
// Sheets are stored as application/vnd.google-apps.spreadsheet and need
// .export() rather than .get(alt: 'media').
export async function exportSheetCsv(fileId: string, email?: string): Promise<{
  csv: string;
  name: string;
}> {
  const drive = await getDrive(email);
  const meta = await getFileMeta(fileId, email);
  const res = await drive.files.export(
    { fileId, mimeType: "text/csv" },
    { responseType: "text" }
  );
  return { csv: String(res.data ?? ""), name: meta.name };
}

// Export a single tab of a Google Sheet by tab name. Useful when a workbook
// has multiple sheets (Pricing / Costs / Buyers / etc.). Drive's export only
// returns the first sheet, so we fall back to the Sheets API for tab-specific
// reads. Returns CSV-style rows.
//
// Not implemented in v1 — we'll add it if/when the pricing workbook actually
// has multiple meaningful tabs. For now `exportSheetCsv` (first tab) suffices.
