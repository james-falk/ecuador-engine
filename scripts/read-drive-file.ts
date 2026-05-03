// One-shot CLI: read a Drive file by path and print to stdout.
//
// Usage:
//   npx tsx scripts/read-drive-file.ts "Ecuador/Selling in US/Pricing"
//   npx tsx scripts/read-drive-file.ts --id <fileId>
//   npx tsx scripts/read-drive-file.ts --list "Ecuador/Selling in US"
//
// Behavior:
//   - Sheet → exports to CSV
//   - Other file → downloads as binary; for text-y mimeTypes prints contents,
//     for binary prints metadata only.
//   - --list prints folder children.

import "./_env";
import * as XLSX from "xlsx";
import {
  exportSheetCsv,
  findChildByName,
  getFileContent,
  getFileMeta,
  listFolder,
  resolvePath,
} from "../src/lib/google/drive";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function main() {
  const args = process.argv.slice(2);
  const list = args.includes("--list");
  const idIdx = args.indexOf("--id");

  // Pull the path argument (anything that's not a flag).
  const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--id");

  // ── Mode: --id <fileId> ────────────────────────────────────────────
  if (idIdx >= 0) {
    const fileId = args[idIdx + 1];
    if (!fileId) throw new Error("--id requires a fileId argument");
    await dumpFile(fileId);
    return;
  }

  if (positional.length === 0) {
    console.error("Usage: tsx scripts/read-drive-file.ts <path>  |  --id <fileId>  |  --list <path>");
    process.exit(1);
  }
  const path = positional.join(" "); // join in case the path had spaces split by argv

  // Resolve relative to "root". Paths starting "Ecuador/..." or just any
  // top-level folder name in My Drive both work.
  const target = await resolvePath("root", path);
  if (!target) {
    console.error(`Path not found: ${path}`);
    process.exit(2);
  }

  if (list) {
    if (!target.isFolder) {
      console.error(`--list expects a folder; ${path} is a file (mimeType=${target.mimeType})`);
      process.exit(3);
    }
    const items = await listFolder(target.id);
    console.log(`# ${path}  (${items.length} items)`);
    for (const it of items) {
      const kind = it.isFolder ? "DIR" : "FILE";
      const mod = it.modifiedTime?.slice(0, 10) ?? "—";
      console.log(`${kind.padEnd(4)}  ${mod}  ${it.name}  [${it.id}]  ${it.mimeType}`);
    }
    return;
  }

  if (target.isFolder) {
    console.error(`${path} is a folder. Use --list to print children, or supply a file path.`);
    process.exit(4);
  }

  await dumpFile(target.id);
}

async function dumpFile(fileId: string) {
  const meta = await getFileMeta(fileId);
  console.log(`# ${meta.name}`);
  console.log(`# id: ${fileId}`);
  console.log(`# mimeType: ${meta.mimeType}`);
  console.log(`# modified: ${meta.modifiedTime ?? "—"}`);
  console.log(`# size: ${meta.size ?? "—"}`);
  console.log(`# webViewLink: ${meta.webViewLink ?? "—"}`);
  console.log(`# parents: ${meta.parents.join(",") || "—"}`);
  console.log("");

  if (meta.mimeType === "application/vnd.google-apps.spreadsheet") {
    const { csv } = await exportSheetCsv(fileId);
    console.log(csv);
    return;
  }
  if (meta.mimeType === XLSX_MIME) {
    const { buffer } = await getFileContent(fileId);
    const wb = XLSX.read(buffer, { type: "buffer" });
    for (const sheetName of wb.SheetNames) {
      console.log(`──────── SHEET: ${sheetName} ────────`);
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      console.log(csv);
      console.log("");
    }
    return;
  }
  if (
    meta.mimeType === "application/vnd.google-apps.document" ||
    meta.mimeType === "text/plain" ||
    meta.mimeType === "text/csv"
  ) {
    if (meta.mimeType === "application/vnd.google-apps.document") {
      // Could implement export to text/plain; for now flag.
      console.log(`# (Google Doc — add an export to text/plain in drive.ts when needed.)`);
      return;
    }
    const { buffer } = await getFileContent(fileId);
    console.log(buffer.toString("utf8"));
    return;
  }
  console.log(`# (binary file — not printing. Use the Drive UI or download separately.)`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("read-drive-file failed:", e);
  process.exit(1);
});

// Mark unused symbol to avoid TS6133 if mode trees diverge.
void findChildByName;
