// Ecuador Engine — design data layer (shrinking).
//
// This file ORIGINALLY held mock data the design components consumed during
// handoff. It's being retired. As of the steady-the-engine pass:
//   • weather / pending / ops / recent — DELETED (Home + sidebar no longer
//     consume them).
//   • todos — kept temporarily until the tasks table replaces /pending
//     (Slice 2.5).
//   • entities / network / compliance / findEntity / findNetworkItem — kept
//     because entity-detail.tsx and compliance-detail.tsx still consume them
//     for the side drawer; will be removed when the Companies hub enrichment
//     (Slice 6) routes those through DB queries.
//
// The TYPES below are still imported by query modules and components and
// SHOULD STAY even after the runtime data is gone — they describe the
// presentation shape (DB rows are adapted INTO this shape in lib/queries/*).

export type EntityColor = "green" | "amber" | "sky";
export type ComplianceStatus =
  | "verified"
  | "todo"
  | "blocked"
  | "na"
  | "in_flight"
  | "consultant_claims_done";
export type ComplianceBucket = "importing" | "exporting" | "shipment";
export type TodoPriority = "high" | "med" | "low";

export type Entity = {
  id: string;
  name: string;
  role: string;
  country: string;
  kind: string;
  ids: Record<string, string>;
  color: EntityColor;
};

export type NetworkItem = {
  id: string;
  name: string;
  country: string;
  note: string;
};

export type NetworkGroup = {
  group: string;
  items: NetworkItem[];
};

export type ComplianceItem = {
  id: string;
  title: string;
  bucket: ComplianceBucket;
  area: string;
  jurisdiction: string;
  owner: string;
  responsible: string;
  status: ComplianceStatus;
  identifier: string | null;
  evidence: string;
  notes: string;
};

export type TodoItem = {
  id: string;
  title: string;
  ref: string;
  area: string;
  due: string;
  priority: TodoPriority;
  owner: string;
  done: boolean;
};

export const entities: Entity[] = [
  {
    id: "finca",
    name: "Finca del Dragón",
    role: "producer",
    country: "EC",
    kind: "S.A.S.",
    ids: { RUC: "1391938125001", DUNS: "889389069" },
    color: "green",
  },
  {
    id: "puresol",
    name: "PureSol Imports",
    role: "importer",
    country: "US",
    kind: "LLC",
    ids: { DUNS: "119578585", EIN: "pending" },
    color: "sky",
  },
];

export const network: NetworkGroup[] = [
  { group: "Packing", items: [{ id: "incalpack", name: "INCALPACK", country: "EC", note: "Third-party packer/exporter, FDA-registered" }] },
  {
    group: "Carriers",
    items: [
      { id: "seaboard", name: "Seaboard Marine", country: "US/EC", note: "Ocean: GYE → MIA" },
      { id: "iantaylor", name: "Ian Taylor", country: "EC", note: "Freight forwarder quote" },
    ],
  },
  { group: "Consultants", items: [{ id: "tim", name: "Tim Forrest Consulting", country: "US", note: "FDA / FSVP" }] },
  { group: "Legal", items: [{ id: "kerry", name: "Kerry Law PLLC", country: "US", note: "Counsel" }] },
  { group: "Buyers", items: [{ id: "fsf", name: "Food Sales Force", country: "US", note: "81 leads, unvetted" }] },
  {
    group: "Advisors",
    items: [
      { id: "bruce", name: "Bruce", country: "US", note: "Advisor" },
      { id: "vince", name: "Vince", country: "US", note: "Advisor" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "isaac", name: "Isaac Garcia", country: "EC", note: "Ground operator" },
      { id: "jamileth", name: "Andrade Jamileth", country: "EC", note: "Accountant" },
    ],
  },
];

export const compliance: ComplianceItem[] = [
  // — VERIFIED
  { id: "finca-ruc", title: "Finca RUC", bucket: "exporting", area: "Registration", jurisdiction: "Ecuador", owner: "finca", responsible: "Andrade Jamileth", status: "verified", identifier: "1391938125001", evidence: "SRI portal · captured Sep 2025", notes: "Registro Único de Contribuyentes — active." },
  { id: "finca-duns", title: "Finca DUNS", bucket: "exporting", area: "Registration", jurisdiction: "Ecuador", owner: "finca", responsible: "You", status: "verified", identifier: "889389069", evidence: "D&B email · Aug 2025", notes: "" },
  { id: "puresol-duns", title: "PureSol DUNS", bucket: "importing", area: "Registration", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "verified", identifier: "119578585", evidence: "D&B email · Aug 2025", notes: "" },
  { id: "puresol-parent-ein", title: "PureSol EIN (parent)", bucket: "importing", area: "Registration", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "verified", identifier: "32-0657127", evidence: "IRS CP575", notes: "" },
  { id: "incalpack-fda", title: "Packing facility FDA registration", bucket: "exporting", area: "FDA", jurisdiction: "US Federal", owner: "finca", responsible: "INCALPACK", status: "verified", identifier: "on file", evidence: "INCALPACK certificate", notes: "Verified active in FDA registry." },
  { id: "fda-oaa", title: "FDA OAA / Prior Notice account", bucket: "importing", area: "FDA", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "verified", identifier: "OAA active", evidence: "FDA portal", notes: "" },
  // — IN PROGRESS / TODO (kept as `todo` to match design data)
  { id: "puresol-ein", title: "PureSol EIN", bucket: "importing", area: "Registration", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "Form SS-4 faxed · Sep 2025", notes: "Awaiting IRS confirmation. ~30 day SLA exceeded." },
  { id: "forwarder", title: "Freight forwarder selection", bucket: "shipment", area: "Logistics", jurisdiction: "Carrier", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "Quotes: Seaboard, Ian Taylor", notes: "Decision pending. 40′ FCL pricing within $400 of each other." },
  { id: "carton-labels", title: "FDA carton labeling rules", bucket: "shipment", area: "Labeling", jurisdiction: "US Federal", owner: "puresol", responsible: "Tim Forrest", status: "todo", identifier: null, evidence: "Tim Forrest checklist · Oct 29 2025", notes: "Country of origin, lot, net weight, importer details required." },
  { id: "fsvp-plan", title: "FSVP plan", bucket: "importing", area: "FSVP", jurisdiction: "US Federal", owner: "puresol", responsible: "Tim Forrest", status: "todo", identifier: null, evidence: "Tim Forrest checklist · Oct 29 2025", notes: "Plan drafting in progress." },
  { id: "ffr", title: "FDA Food Facility Registration", bucket: "importing", area: "FDA", jurisdiction: "US Federal", owner: "puresol", responsible: "Tim Forrest", status: "todo", identifier: null, evidence: "Tim Forrest checklist · Oct 29 2025", notes: "Awaiting registration number." },
  { id: "agrocalidad", title: "Agrocalidad registration", bucket: "exporting", area: "Registration", jurisdiction: "Ecuador", owner: "finca", responsible: "Isaac Garcia", status: "todo", identifier: null, evidence: "Confirmed active", notes: "Number to be captured on file." },
  { id: "broker", title: "Customs broker (GYE→MIA)", bucket: "importing", area: "Customs", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "Need 2-3 quotes." },
  { id: "cbp-bond", title: "CBP customs bond", bucket: "importing", area: "Customs", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "Continuous bond preferred for >2 entries/yr." },
  { id: "cbp-5106", title: "CBP Form 5106", bucket: "importing", area: "Customs", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "Importer of record creation." },
  { id: "us-agent", title: "US Agent designation (foreign facility)", bucket: "importing", area: "FDA", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "hazard", title: "Hazard analysis — fresh dragon fruit", bucket: "importing", area: "FSVP", jurisdiction: "US Federal", owner: "puresol", responsible: "Tim Forrest", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "fse-incalpack", title: "Foreign supplier evaluation — INCALPACK", bucket: "importing", area: "FSVP", jurisdiction: "US Federal", owner: "puresol", responsible: "Tim Forrest", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "verif-cadence", title: "Verification activities cadence", bucket: "importing", area: "FSVP", jurisdiction: "US Federal", owner: "puresol", responsible: "Tim Forrest", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "qi", title: "Qualified Individual designation", bucket: "importing", area: "FSVP", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "ecuapass", title: "ECUAPASS export declaration handler", bucket: "exporting", area: "Customs", jurisdiction: "Ecuador", owner: "finca", responsible: "Isaac Garcia", status: "todo", identifier: null, evidence: "", notes: "Declaración Aduanera de Exportación." },
  { id: "eor", title: "Exporter of record — Finca vs INCALPACK", bucket: "exporting", area: "Decision", jurisdiction: "Ecuador", owner: "finca", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "Affects who issues the invoice and who appears on the BOL." },
  { id: "ispm15", title: "ISPM-15 compliant pallets", bucket: "shipment", area: "Phytosanitary", jurisdiction: "Ecuador", owner: "finca", responsible: "INCALPACK", status: "todo", identifier: null, evidence: "", notes: "Heat-treated pallets stamped HT." },
  { id: "cold-storage", title: "Cold storage — Miami", bucket: "shipment", area: "Logistics", jurisdiction: "US State", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "34–38°F preferred. Need 2 quotes." },
  { id: "drayage", title: "Drayage — port to warehouse, Miami", bucket: "shipment", area: "Logistics", jurisdiction: "US State", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "receiving", title: "Receiving location — Miami", bucket: "shipment", area: "Logistics", jurisdiction: "US State", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "" },
  { id: "phyto", title: "Phytosanitary certificate process", bucket: "exporting", area: "Phytosanitary", jurisdiction: "Ecuador", owner: "finca", responsible: "Isaac Garcia", status: "todo", identifier: null, evidence: "", notes: "Issued per shipment by Agrocalidad." },
  { id: "prior-notice", title: "Prior Notice filing process", bucket: "importing", area: "FDA", jurisdiction: "US Federal", owner: "puresol", responsible: "You", status: "todo", identifier: null, evidence: "", notes: "Filed per shipment via PNSI; OAA on file." },
];

export const todos: TodoItem[] = [
  { id: "t1", title: "Resolve EC export-license citation conflict", ref: "ec-export-license", area: "Compliance", due: "2025-11-12", priority: "high", owner: "You", done: false },
  { id: "t2", title: "Confirm DUNS for Pitayas del Pacifico", ref: "pitayas-duns", area: "Compliance", due: "2025-11-15", priority: "high", owner: "You", done: false },
  { id: "t3", title: "Review Tim Forrest checklist & flag delegations", ref: "tim-forrest", area: "Advisor", due: "2025-11-18", priority: "med", owner: "You", done: false },
  { id: "t4", title: "Reply to Seaboard with target sail date", ref: "forwarder", area: "Logistics", due: "2025-11-08", priority: "high", owner: "You", done: false },
  { id: "t5", title: "Sign INCOTERM addendum (FOB → CIF) for buyer #2", ref: "buyer-2", area: "Buyers", due: "2025-11-20", priority: "med", owner: "Counsel", done: false },
  { id: "t6", title: "Approve Q4 packout SOP revision", ref: "sop-packout", area: "Operations", due: "2025-11-25", priority: "low", owner: "You", done: false },
  { id: "t7", title: "Verify USDA APHIS PPQ permit window", ref: "aphis-permit", area: "Compliance", due: "2025-12-01", priority: "med", owner: "You", done: false },
  { id: "t8", title: "Reconcile Oct liquidaciones with bank deposits", ref: "expenses-oct", area: "Expenses", due: "2025-11-10", priority: "high", owner: "You", done: true },
];

// Convenience: lookup by id
export function findEntity(id: string): Entity | undefined {
  return entities.find((e) => e.id === id);
}
export function findNetworkItem(id: string): (NetworkItem & { _group: string }) | undefined {
  for (const g of network) {
    const it = g.items.find((i) => i.id === id);
    if (it) return { ...it, _group: g.group };
  }
  return undefined;
}
