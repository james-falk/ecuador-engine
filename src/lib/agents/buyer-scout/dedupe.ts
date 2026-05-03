// Buyer-scout dedupe contract per BUILD_LOG.md "Dedupe strategy".
//
// A lead is "already known" if its canonicalized identity matches any row
// in EITHER `lead_proposals` OR `companies` (kind='buyer'). Three tiers:
//
//   1. company_name + website (preferred; strongest)
//   2. company_name + email_domain (fallback when website is missing)
//   3. company_name alone (weakest — flag for human review)
//
// dedupe_key = SHA256(canonical components joined by '|').

import { createHash } from "node:crypto";

// Order matters: longer multi-word suffixes BEFORE single-word ones so we
// strip "imp exp" before each individual token.
const COMPANY_SUFFIXES = [
  "imp exp",
  "imp&exp",
  "import export",
  "imports exports",
  "produce co",
  "produce inc",
  "imports",
  "import",
  "exports",
  "export",
  "produce",
  "company",
  "corp",
  "corporation",
  "incorporated",
  "limited",
  "inc",
  "llc",
  "ltd",
  "co",
  "imp",
  "exp",
];

export function canonicalizeCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  let n = name.toLowerCase().trim();
  // Strip apostrophes/quote-like marks outright (no space) so possessives
  // like "Frieda's" canonicalize to "friedas", not "frieda s".
  n = n.replace(/['\u2018\u2019\u201C\u201D"`]/g, "");
  // Replace remaining punctuation with spaces; collapse runs of whitespace.
  n = n.replace(/[.,&()\\/]/g, " ");
  n = n.replace(/[^a-z0-9\s-]/g, " ");
  n = n.replace(/\s+/g, " ").trim();

  // Strip suffix tokens repeatedly. A name like "Frieda's Specialty
  // Produce, Inc." becomes "friedas specialty" after the loop.
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of COMPANY_SUFFIXES) {
      const re = new RegExp(`(^|\\s)${suffix}(\\s|$)`, "g");
      const next = n.replace(re, " ").replace(/\s+/g, " ").trim();
      if (next !== n) {
        n = next;
        changed = true;
      }
    }
  }
  return n;
}

export function canonicalizeWebsite(url: string | null | undefined): string {
  if (!url) return "";
  let u = url.trim().toLowerCase();
  u = u.replace(/^https?:\/\//, "");
  u = u.replace(/^www\./, "");
  // Drop path, query, fragment.
  u = u.split("/")[0].split("?")[0].split("#")[0];
  // Drop port.
  u = u.split(":")[0];
  return u.trim();
}

export function canonicalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function emailDomain(email: string | null | undefined): string {
  const e = canonicalizeEmail(email);
  if (!e || !e.includes("@")) return "";
  return e.split("@")[1] ?? "";
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface DedupeKeyInput {
  companyName: string | null | undefined;
  website?: string | null;
  email?: string | null;
}

export interface DedupeKeyResult {
  key: string;
  // Which tier produced the key — useful for the human-review flag on the
  // weakest tier (company-only).
  tier: "name+website" | "name+email-domain" | "name-only" | "empty";
}

export function computeDedupeKey(input: DedupeKeyInput): DedupeKeyResult {
  const name = canonicalizeCompanyName(input.companyName);
  const site = canonicalizeWebsite(input.website);
  const dom = emailDomain(input.email);

  if (!name) {
    return { key: sha256Hex(""), tier: "empty" };
  }

  if (site) {
    return { key: sha256Hex(`${name}|${site}`), tier: "name+website" };
  }
  if (dom) {
    return { key: sha256Hex(`${name}|${dom}`), tier: "name+email-domain" };
  }
  return { key: sha256Hex(name), tier: "name-only" };
}
