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
export async function listFolder(folderId: string, email?: string): Promise<DriveItem[]> {
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

// Free-text search across the whole Drive. Folders + files. Useful when
// a user knows the filename but not where it lives.
export async function searchFiles(query: string, email?: string): Promise<DriveItem[]> {
  const drive = await getDrive(email);
  const safe = query.replace(/'/g, "\\'");
  const q = `name contains '${safe}' and trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: 50,
    fields: FIELDS,
    orderBy: "modifiedTime desc",
  });
  return (res.data.files ?? []).map(shape);
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

// Resolve a folder's breadcrumb back to root. Drive doesn't return paths
// natively, so we walk parents up. Stops at root or after 12 hops to
// avoid runaway in pathological cases.
export async function resolveBreadcrumb(folderId: string, email?: string): Promise<DriveItem[]> {
  const trail: DriveItem[] = [];
  let current: string | null = folderId;
  for (let i = 0; i < 12 && current && current !== "root"; i++) {
    const meta = await getFileMeta(current, email);
    trail.unshift(meta);
    current = meta.parents[0] ?? null;
  }
  return trail;
}
