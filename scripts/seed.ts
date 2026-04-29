/**
 * Seed script for Ecuador Engine — Slice A.
 *
 * Loads the entities, people, and compliance items the engine needs to be
 * useful out of the gate. Idempotent: skips entirely if any companies already
 * exist (so re-running doesn't duplicate). To re-seed, truncate the relevant
 * tables manually first.
 *
 * Source-of-truth notes for every fact below live in the project memory at
 * c:\Users\james\.claude\projects\c--Users-james-blob-dev-factory-ecuador-engine\memory\
 */

import "./_env"; // MUST be first — loads DATABASE_URL before any DB module is touched.
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  companies,
  complianceItems,
  people,
  accounts,
  harvests,
  harvestSettlements,
  expenseEntries,
  cashMovements,
  type NewCompany,
  type NewComplianceItem,
  type NewPerson,
  type NewAccount,
  type NewHarvest,
  type NewHarvestSettlement,
  type NewExpenseEntry,
  type NewCashMovement,
} from "../src/db/schema";

async function main() {
  // Re-seedable. Truncate the seeded tables in dependency order so foreign
  // references (compliance → companies, expense_entries → people/companies/accounts,
  // harvests → companies, harvest_settlements → harvests/accounts) don't block.
  // CASCADE keeps this safe across schema evolution.
  console.log("Truncating tables (CASCADE)…");
  await db.execute(
    sql`TRUNCATE TABLE cash_movements, expense_entries, harvest_settlements, harvests, accounts, compliance_items, people, companies RESTART IDENTITY CASCADE`
  );

  console.log("Seeding companies…");

  const companyData: Record<string, NewCompany> = {
    enigma: {
      slug: "enigma",
      name: "Enigma",
      kind: "holding",
      country: "United States",
      ein: "32-0657127",
      vettingStatus: "vetted",
      notes:
        "Parent holding company. Subsidiaries (Finca del Dragón, PureSol Imports) sit underneath. Articles of Incorporation status: TBD as of Sep 2025 per attorney Matt Kerry.",
    },
    finca: {
      slug: "finca",
      name: "Finca del Dragón",
      legalName: "LA FINCADELDRAGON S.A.S.",
      kind: "producer",
      country: "Ecuador",
      addressLine: "Calle 4 y Av. Quito Nte SN, Casa Blanca, PB",
      city: "San Clemente",
      region: "Manabí",
      website: "https://fincadeldragon.com",
      primaryEmail: "james@fincadeldragon.com",
      taxId: "1391938125001",
      duns: "889389069",
      vettingStatus: "vetted",
      notes:
        "Ecuador-side producer entity. Agrocalidad registration confirmed per Tim Forrest; registration number itself not yet captured. Phytosanitary certs are issued under the packing facility (INCALPACK), not under Finca's name.",
    },
    puresol: {
      slug: "puresol",
      name: "PureSol Imports",
      legalName: "PureSol Imports LLC",
      kind: "importer",
      country: "United States",
      addressLine: "5817 Staghorn Dr",
      city: "Ypsilanti",
      region: "MI",
      postalCode: "48197",
      website: "https://puresolimports.com",
      primaryEmail: "james@puresolimports.com",
      duns: "119578585",
      // EIN intentionally null — application faxed Sep 2025, no confirmation seen yet.
      vettingStatus: "vetted",
      notes:
        "US importer of record. Registered agent is Matt Kerry / Kerry Law PLLC (same address). EIN application was faxed in Sep 2025; no confirmation received as of last touch — still TBD.",
    },
    incalpack: {
      slug: "incalpack",
      name: "INCALPACK",
      kind: "packing_facility",
      country: "Ecuador",
      vettingStatus: "vetted",
      notes:
        "Third-party packing facility that receives Isaac Garcia's harvests at $2.00/kg (Grade 1.5+2). Has its own FDA registration (cert valid 2025). Will issue phytosanitary certs in its own name. Likely also the actual exporting entity — TBD per Export Checklist.",
    },
    seaboard: {
      name: "Seaboard Marine",
      kind: "carrier",
      country: "United States",
      vettingStatus: "vetted",
      notes:
        "Ocean carrier (tariff SMLU 049). GYE→MIA 40' reefer Yard-to-Yard quote: $7,175 mainline ($6,405 freight + $300 Panama + $195 GYE THC + $275 US THC). Demurrage tail risk: $250/day MIA after 3 free days. (Filename in Drive misspells as 'Seaborn'.)",
    },
    ianTaylor: {
      name: "Ian Taylor Ecuador C.A.",
      kind: "freight_forwarder",
      country: "Ecuador",
      vettingStatus: "vetted",
      notes:
        "Freight forwarder. Provided GYE→Puerto Quetzal Guatemala quotes Aug 2025 (now stale): $1,450 (20DV) and $1,750 (40DV) per unit. Both for dry-van (NOT reefer) — different market from US fresh-fruit route. Useful contact for Latin American secondary markets.",
    },
    timForrestConsulting: {
      name: "Tim Forrest Consulting",
      kind: "consultant",
      country: "United States",
      website: "https://timforrest.com",
      vettingStatus: "vetted",
      notes:
        "FDA / USDA import compliance consultant. Engaged for $3,500 / 3-year package. As of Mar 27, 2026, James has unanswered questions: (1) is Tim acting as licensed US customs broker, and (2) where is the FDA registration confirmation with facility number + US Agent details?",
    },
    kerryLaw: {
      name: "Kerry Law PLLC",
      kind: "lawyer",
      country: "United States",
      addressLine: "5817 Staghorn Dr",
      city: "Ypsilanti",
      region: "MI",
      postalCode: "48197",
      primaryEmail: "kerrylawpllc@gmail.com",
      primaryPhone: "+1 313-732-8424",
      vettingStatus: "vetted",
      notes:
        "Matt Kerry's law firm. Also serves as PureSol Imports' registered agent. Handles Enigma + subsidiaries' US legal/EIN paperwork.",
    },
    foodSalesForce: {
      name: "Food Sales Force",
      kind: "buyer",
      country: "United States",
      vettingStatus: "unvetted",
      notes:
        "US food distributor met at Miami Food Show. Daniela Diaz reached out via james@fincadeldragon.com Apr 2026 with wholesale catalog — IQF fruits, pulps, tropicals, etc. Not specifically a dragon-fruit buyer; potential outbound channel for our product.",
    },
  };

  const insertedCompanies = await db
    .insert(companies)
    .values(Object.values(companyData))
    .returning({ id: companies.id, name: companies.name });

  // Build a name → id lookup so we don't depend on insertion order.
  const companyId = Object.fromEntries(
    insertedCompanies.map((c) => [c.name, c.id])
  );

  // Wire Finca + PureSol up to Enigma as parent.
  await Promise.all([
    db
      .update(companies)
      .set({ parentId: companyId["Enigma"] })
      .where(eq(companies.id, companyId["Finca del Dragón"])),
    db
      .update(companies)
      .set({ parentId: companyId["Enigma"] })
      .where(eq(companies.id, companyId["PureSol Imports"])),
  ]);

  console.log(`  ✓ ${insertedCompanies.length} companies`);

  console.log("Seeding people…");

  const peopleData: NewPerson[] = [
    {
      name: "James Falk",
      role: "owner",
      companyIds: [
        companyId["Enigma"],
        companyId["Finca del Dragón"],
        companyId["PureSol Imports"],
      ],
      primaryEmail: "jamesfalk4@gmail.com",
      altEmails: ["james@fincadeldragon.com", "james@puresolimports.com"],
      country: "United States",
      vettingStatus: "vetted",
      notes: "Owner / operator across all three entities.",
    },
    {
      name: "Peter (Pete)",
      role: "co_owner",
      companyIds: [companyId["Enigma"], companyId["PureSol Imports"]],
      country: "United States",
      vettingStatus: "vetted",
      notes:
        "Partner / co-owner. Capital contribution discussions in Sep 2025. Has own 'Business Card - PureSol - Peter' folder in Drive. Last name TBD in records.",
    },
    {
      name: "Matt Kerry",
      role: "attorney",
      companyIds: [companyId["Kerry Law PLLC"], companyId["PureSol Imports"]],
      primaryEmail: "kerrylawpllc@gmail.com",
      primaryPhone: "+1 313-732-8424",
      country: "United States",
      vettingStatus: "vetted",
      notes:
        "US attorney + PureSol's registered agent. Working on Enigma + subsidiaries EIN paperwork (faxed Sep 2025, status unclear).",
    },
    {
      name: "Isaac Garcia",
      role: "operator",
      companyIds: [companyId["Finca del Dragón"]],
      primaryEmail: "isaacgarcia290399@gmail.com",
      country: "Ecuador",
      vettingStatus: "vetted",
      notes:
        "Ecuador on-the-ground operator. Producer of record on harvest receipts (Liquidación Proceso Pitahaya). Runs local worker payroll. Primary channel for ops is WhatsApp (engine integration pending).",
    },
    {
      name: "Andrade Jamileth Contadora",
      role: "accountant",
      companyIds: [companyId["Finca del Dragón"]],
      whatsapp: "+593 96 311 0456",
      country: "Ecuador",
      vettingStatus: "vetted",
      notes:
        "Ecuador-side lawyer/accountant. WhatsApp-only contact, no email captured. Handles Ecuador legal / SRI matters.",
    },
    {
      name: "Tim Forrest",
      role: "consultant",
      companyIds: [companyId["Tim Forrest Consulting"]],
      primaryEmail: "tim@timforrest.com",
      country: "United States",
      vettingStatus: "vetted",
      notes:
        "FDA / import compliance consultant. Calendly: calendly.com/tim-46/exclusive-client-consult-tim-forrest-consulting-clone. Several open questions outstanding (FFR registration #, customs broker, US Agent).",
    },
    {
      name: "Bruce",
      role: "advisor",
      country: "United States",
      vettingStatus: "vetted",
      notes:
        "US produce-industry advisor. Older relationship (~2024). Mostly inactive at the moment but kept on file.",
    },
    {
      name: "Vince",
      role: "advisor",
      vettingStatus: "unvetted",
      notes:
        "Referenced in Ecuador Notes Doc. Background TBD; legacy contact in Ecuador/Old/ Drive folder.",
    },
    {
      name: "Daniela Diaz",
      role: "buyer_contact",
      companyIds: [companyId["Food Sales Force"]],
      primaryEmail: "daniela@foodsalesforce.com",
      country: "United States",
      vettingStatus: "unvetted",
      notes:
        "Food Sales Force rep. Met at Miami Food Show. Sent wholesale catalog Apr 2026 to james@fincadeldragon.com.",
    },
  ];

  const insertedPeople = await db
    .insert(people)
    .values(peopleData)
    .returning({ id: people.id, name: people.name });

  const personId = Object.fromEntries(insertedPeople.map((p) => [p.name, p.id]));
  console.log(`  ✓ ${insertedPeople.length} people`);

  console.log("Seeding compliance items…");

  // Compliance items derived from:
  //  - Drive: Exporting/Export Checklist.docx
  //  - Drive: PureSol Imports/Importing/US Import Checklist.docx
  //  - Gmail: Tim Forrest "Prior Notice Account Setup" thread (verified facts)
  //  - Gmail: DUNS/EIN thread (Matt Kerry)
  // Per-shipment items (per-container BOL/phyto/seal numbers) are NOT seeded
  // here — those become rows in the shipments pillar, not standing compliance.

  // Note on `ownerCompanyId`: this is which OWNED entity (Finca, PureSol, Enigma)
  // carries the item. INCALPACK is a third-party packer — its FDA cert and
  // ISPM-15 pallets ARE compliance items, but they're owned by Finca's export
  // chain (Finca is the entity James operates). The free-text `responsible`
  // field captures who actually moves the work (often INCALPACK or Tim Forrest).
  const complianceData: NewComplianceItem[] = [
    // ─── Finca · Exporting (verified IDs) ─────────────────────────────────
    {
      bucket: "exporting",
      jurisdiction: "ecuador",
      area: "registration",
      item: "Finca RUC (Ecuador tax ID)",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "Andrade Jamileth",
      status: "verified",
      identifier: "1391938125001",
      evidenceSource: "Drive: Exporting/Export Checklist.docx",
    },
    {
      bucket: "exporting",
      jurisdiction: "ecuador",
      area: "registration",
      item: "Finca DUNS",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "You",
      status: "verified",
      identifier: "889389069",
      evidenceSource: "Gmail: DUNS thread (Matt Kerry, Sep 2025)",
    },
    {
      bucket: "exporting",
      jurisdiction: "ecuador",
      area: "registration",
      item: "Agrocalidad registration (Finca)",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "consultant_claims_done",
      evidenceSource: "Drive: Export Checklist.docx — 'Agrocalidad Registration: Confirmed'",
      notes: "Confirmed in checklist but registration number itself is TBD.",
    },
    {
      bucket: "exporting",
      jurisdiction: "us_federal",
      area: "registration",
      item: "Packing facility FDA registration (INCALPACK)",
      ownerCompanyId: companyId["Finca del Dragón"], // owned by Finca's export chain
      responsible: "INCALPACK",
      status: "verified",
      evidenceSource: "Drive: CERTIFICADO FDA INCALPACK VIGENCIA 2025.pdf",
      notes:
        "FDA cert valid 2025 (renewal status TBD). OFI document also on file.",
    },
    {
      bucket: "exporting",
      jurisdiction: "ecuador",
      area: "phytosanitary",
      item: "Phytosanitary issued under packing facility (not Finca)",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "INCALPACK",
      status: "verified",
      evidenceSource:
        "Gmail: James to Tim Forrest Oct 9, 2025 — 'issued by the processing facility we will use in Ecuador'",
      notes:
        "Phyto certs are per-shipment artifacts issued under INCALPACK's name. The actual cert lands per-shipment in the shipments pillar.",
    },
    {
      bucket: "exporting",
      jurisdiction: "ecuador",
      area: "documentation",
      item: "ECUAPASS export declaration handler",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "Isaac Garcia",
      responsiblePersonId: personId["Isaac Garcia"],
      status: "todo",
      notes:
        "TBD whether INCALPACK handles, Finca handles directly, or via export agent. Decision needed before first shipment.",
    },
    {
      bucket: "exporting",
      jurisdiction: "ecuador",
      area: "logistics",
      item: "Export under exporter (Finca) vs. facility (INCALPACK)",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "You",
      status: "todo",
      notes:
        "Decision: does the bill of lading and customs declaration name Finca or INCALPACK as the exporter of record?",
    },

    // ─── PureSol · Importing (verified IDs) ───────────────────────────────
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "registration",
      item: "PureSol DUNS",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "verified",
      identifier: "119578585",
      evidenceSource: "Drive: FSVP PureSol Imports LLC.pdf",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "registration",
      item: "Enigma EIN (parent)",
      ownerCompanyId: companyId["PureSol Imports"], // shows on PureSol's page since that's where the import side lives
      responsible: "Matt Kerry",
      responsiblePersonId: personId["Matt Kerry"],
      status: "verified",
      identifier: "32-0657127",
      evidenceSource: "Gmail: DUNS thread (James to Matt Kerry, Sep 11, 2025)",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "prior_notice",
      item: "FDA OAA / Prior Notice account",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      responsiblePersonId: personId["James Falk"],
      status: "verified",
      evidenceSource: "Gmail: James to Tim Nov 13, 2025 — 'I have successfully created the FDA OAA account'",
    },

    // ─── PureSol · Importing (consultant claims, unverified) ──────────────
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "fsvp",
      item: "FSVP plan complete (PureSol)",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "consultant_claims_done",
      evidenceSource:
        "Gmail: Tim Forrest checklist Oct 29, 2025 — claim only, no plan document received",
      notes:
        "Tim wrote 'FSVP – Complete' but has not delivered the plan document. James asked Mar 27, 2026 for FDA registration confirmation; no response with numbers.",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "registration",
      item: "FDA Food Facility Registration (PureSol importer side)",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "consultant_claims_done",
      evidenceSource:
        "Gmail: Tim Forrest claim Oct 29, 2025 — no registration number received",
      notes:
        "Tim claimed 'Facility FDA Registration – completed earlier'. Registration number not provided. Open follow-up Mar 27, 2026.",
    },

    // ─── PureSol · Importing (in flight) ──────────────────────────────────
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "registration",
      item: "PureSol EIN",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Matt Kerry",
      responsiblePersonId: personId["Matt Kerry"],
      status: "in_flight",
      evidenceSource: "Gmail: Matt Kerry Sep 17, 2025 — 'I am working on the EIN. Application is faxed in.'",
      notes:
        "Application faxed Sep 2025. No confirmation received in subsequent months. Will be issued under Enigma EIN umbrella per Matt.",
    },

    // ─── PureSol · Importing (todo) ───────────────────────────────────────
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "customs",
      item: "Customs broker selected for GYE→MIA",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
      notes:
        "James asked Tim Forrest Mar 27, 2026 whether Tim acts as the broker or refers one. No answer received.",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "customs",
      item: "CBP Form 5106 (Importer ID Input Record)",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "customs",
      item: "CBP customs bond (single-entry or continuous)",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "registration",
      item: "US Agent designation for foreign facility (INCALPACK)",
      ownerCompanyId: companyId["PureSol Imports"], // PureSol's responsibility to designate
      responsible: "You",
      status: "todo",
      notes:
        "Required by FDA for non-US food facilities. Could be PureSol itself, Tim Forrest's firm, or a third party — TBD.",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "fsvp",
      item: "Hazard analysis for fresh dragon fruit",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "todo",
      notes:
        "Required under 21 CFR 1.504. Microbial (Salmonella, Listeria, Cyclospora), chemical (pesticide residues, heavy metals), physical hazards documented.",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "fsvp",
      item: "Foreign supplier evaluation for INCALPACK",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "todo",
      notes: "21 CFR 1.505 — evaluate supplier performance and food risk.",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "fsvp",
      item: "Verification activities cadence (audit / sampling / COA)",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "todo",
      notes: "21 CFR 1.506 — typically annual audit or per-shipment COA review.",
    },
    {
      bucket: "importing",
      jurisdiction: "us_federal",
      area: "fsvp",
      item: "Qualified Individual designation for FSVP",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
      notes: "Per 21 CFR 1.503 — who at PureSol is the QI? Their qualifications must be on record.",
    },

    // ─── Shipment · the container itself ──────────────────────────────────
    {
      bucket: "shipment",
      jurisdiction: "us_federal",
      area: "labeling",
      item: "FDA carton labeling rules confirmed for fresh fruit",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "Tim Forrest",
      responsiblePersonId: personId["Tim Forrest"],
      status: "in_flight",
      evidenceSource: "Gmail: Tim Forrest 'FIT FOR FDA package rules' Nov 2025",
      notes:
        "James asked Tim if individual fruit stickers are required or just box labeling. Awaiting clarification.",
    },
    {
      bucket: "shipment",
      jurisdiction: "carrier",
      area: "logistics",
      item: "ISPM-15 compliant pallets confirmed",
      ownerCompanyId: companyId["Finca del Dragón"],
      responsible: "INCALPACK",
      status: "todo",
      notes: "Required for wood pallets entering the US.",
    },
    {
      bucket: "shipment",
      jurisdiction: "carrier",
      area: "logistics",
      item: "Freight forwarder for first shipment",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "in_flight",
      notes:
        "Have quotes: Seaboard Marine GYE→MIA $7,175 (40' reefer YY); Ian Taylor GYE→Puerto Quetzal (Guatemala route, dry van, stale Aug 2025). Need to lock Seaboard or get fresh quote.",
    },
    {
      bucket: "shipment",
      jurisdiction: "us_federal",
      area: "logistics",
      item: "Cold storage facility in Miami",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
      notes: "45-50°F (7-10°C) per packaging spec. No facility selected.",
    },
    {
      bucket: "shipment",
      jurisdiction: "us_federal",
      area: "logistics",
      item: "Drayage / port-to-warehouse transport (Miami)",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
      notes: "Yard-to-Yard freight excludes drayage — needs separate provider.",
    },
    {
      bucket: "shipment",
      jurisdiction: "us_federal",
      area: "logistics",
      item: "Receiving location in Miami",
      ownerCompanyId: companyId["PureSol Imports"],
      responsible: "You",
      status: "todo",
    },
  ];

  const insertedCompliance = await db
    .insert(complianceItems)
    .values(complianceData)
    .returning({ id: complianceItems.id });

  console.log(`  ✓ ${insertedCompliance.length} compliance items`);

  // ── Accounts ──────────────────────────────────────────────────────────
  // v1 ships with one row; future accounts (Enigma US, Isaac float, James
  // personal) get added when the cash-movements pillar lands.
  console.log("Seeding accounts…");
  const accountData: NewAccount[] = [
    {
      slug: "finca-ec",
      name: "Finca del Dragón — EC bank",
      currency: "USD",
      country: "Ecuador",
      notes:
        "Single Finca-side bank account. Receives Liquidación net pay; pays out worker payments. v1 single-account model.",
    },
  ];
  const insertedAccounts = await db
    .insert(accounts)
    .values(accountData)
    .returning({ id: accounts.id, slug: accounts.slug });
  const accountId = Object.fromEntries(insertedAccounts.map((a) => [a.slug, a.id]));
  console.log(`  ✓ ${insertedAccounts.length} accounts`);

  // ── Sample harvests + settlements ─────────────────────────────────────
  // Six recent harvests across three Sunday-start weeks (Apr 12, 19, 26).
  // Five are fully settled with grade breakdowns matching INCALPACK's typical
  // Liquidación shape; one is pending (no settlement row) to exercise the
  // "awaiting Liquidación" UI.
  console.log("Seeding harvests…");
  const incalpackId = companyId["INCALPACK"];
  const fincaEcId = accountId["finca-ec"];

  type HarvestSeed = NewHarvest & {
    settlement?: Omit<NewHarvestSettlement, "harvestId" | "paidToAccountId">;
  };
  const harvestSeeds: HarvestSeed[] = [
    {
      harvestDate: "2026-04-13",
      weekStartDate: "2026-04-12",
      processorCompanyId: incalpackId,
      lotNumber: "12440",
      kgDelivered: "412.00",
      notes: "Tuesday delivery; truck made it ahead of the rain.",
      settlement: {
        settlementDate: "2026-04-15",
        kgManifested: "412.00",
        kgProcessed: "375.00",
        kgWaste: "37.00",
        wastePct: "8.98",
        grade1_5Kg: "260.00",
        grade2Kg: "85.00",
        gradeSmallKg: "30.00",
        grade1_5RateUsd: "2.0000",
        grade2RateUsd: "2.0000",
        gradeSmallRateUsd: "1.0000",
        subtotalUsd: "720.00",
        retentionUsd: "30.00",
        netPayUsd: "690.00",
        paidDate: "2026-04-17",
        wasteObservations: "Mostly skin damage from handling; a few cracked.",
      },
    },
    {
      harvestDate: "2026-04-15",
      weekStartDate: "2026-04-12",
      processorCompanyId: incalpackId,
      lotNumber: "12442",
      kgDelivered: "388.00",
      settlement: {
        settlementDate: "2026-04-17",
        kgManifested: "388.00",
        kgProcessed: "353.00",
        kgWaste: "35.00",
        wastePct: "9.02",
        grade1_5Kg: "240.00",
        grade2Kg: "90.00",
        gradeSmallKg: "23.00",
        grade1_5RateUsd: "2.0000",
        grade2RateUsd: "2.0000",
        gradeSmallRateUsd: "1.0000",
        subtotalUsd: "683.00",
        retentionUsd: "25.00",
        netPayUsd: "658.00",
        paidDate: "2026-04-19",
      },
    },
    {
      harvestDate: "2026-04-20",
      weekStartDate: "2026-04-19",
      processorCompanyId: incalpackId,
      lotNumber: "12451",
      kgDelivered: "445.00",
      settlement: {
        settlementDate: "2026-04-22",
        kgManifested: "445.00",
        kgProcessed: "410.00",
        kgWaste: "35.00",
        wastePct: "7.87",
        grade1_5Kg: "295.00",
        grade2Kg: "90.00",
        gradeSmallKg: "25.00",
        grade1_5RateUsd: "2.0000",
        grade2RateUsd: "2.0000",
        gradeSmallRateUsd: "1.0000",
        subtotalUsd: "795.00",
        retentionUsd: "30.00",
        netPayUsd: "765.00",
        paidDate: "2026-04-24",
      },
    },
    {
      harvestDate: "2026-04-22",
      weekStartDate: "2026-04-19",
      processorCompanyId: incalpackId,
      lotNumber: "12453",
      kgDelivered: "402.00",
      settlement: {
        settlementDate: "2026-04-24",
        kgManifested: "402.00",
        kgProcessed: "366.00",
        kgWaste: "36.00",
        wastePct: "8.96",
        grade1_5Kg: "245.00",
        grade2Kg: "95.00",
        gradeSmallKg: "26.00",
        grade1_5RateUsd: "2.0000",
        grade2RateUsd: "2.0000",
        gradeSmallRateUsd: "1.0000",
        subtotalUsd: "706.00",
        retentionUsd: "26.00",
        netPayUsd: "680.00",
        paidDate: "2026-04-26",
      },
    },
    {
      harvestDate: "2026-04-27",
      weekStartDate: "2026-04-26",
      processorCompanyId: incalpackId,
      lotNumber: "12462",
      kgDelivered: "428.00",
      settlement: {
        settlementDate: "2026-04-29",
        kgManifested: "428.00",
        kgProcessed: "395.00",
        kgWaste: "33.00",
        wastePct: "7.71",
        grade1_5Kg: "280.00",
        grade2Kg: "92.00",
        gradeSmallKg: "23.00",
        grade1_5RateUsd: "2.0000",
        grade2RateUsd: "2.0000",
        gradeSmallRateUsd: "1.0000",
        subtotalUsd: "767.00",
        retentionUsd: "30.00",
        netPayUsd: "737.00",
        paidDate: null,
        // paidDate null = settlement issued, money not yet hit the account.
      },
    },
    {
      // No settlement row — exercises the "pending Liquidación" state.
      harvestDate: "2026-04-29",
      weekStartDate: "2026-04-26",
      processorCompanyId: incalpackId,
      lotNumber: "12465",
      kgDelivered: "395.00",
      notes: "Delivered this morning — awaiting Liquidación.",
    },
  ];

  for (const seed of harvestSeeds) {
    const { settlement, ...harvestRow } = seed;
    const [{ id: hid }] = await db
      .insert(harvests)
      .values(harvestRow)
      .returning({ id: harvests.id });
    if (settlement) {
      await db.insert(harvestSettlements).values({
        ...settlement,
        harvestId: hid,
        paidToAccountId: fincaEcId,
      });
    }
  }
  console.log(`  ✓ ${harvestSeeds.length} harvests (${harvestSeeds.filter((h) => h.settlement).length} settled, ${harvestSeeds.filter((h) => !h.settlement).length} pending)`);

  // ── Sample expense entries ────────────────────────────────────────────
  // ~16 entries across three Sunday-start weeks (Apr 12, 19, 26). Pay date is
  // the Saturday of each week (Apr 18, 25, May 2). Representative mix:
  // weekly water deliveries (operating_bills), Jornales, Chavito, Engineer
  // (single — historically Pocho/Joe collapsed to one engineer), Isaac wage,
  // plus a one-off equipment expense (lights repair) and an accountant fee.
  console.log("Seeding expense entries…");
  const isaacPersonId = personId["Isaac Garcia"];
  const expenseSeeds: NewExpenseEntry[] = [
    // Week of Apr 12 (Sun–Sat), pay Sat Apr 18
    { entryDate: "2026-04-18", weekStartDate: "2026-04-12", categoryType: "operating_bills", categoryLabel: "Water deliveries", amountUsd: "60.00",  accountId: fincaEcId, payee: "Water delivery service", source: "manual" },
    { entryDate: "2026-04-18", weekStartDate: "2026-04-12", categoryType: "labor_harvest",   categoryLabel: "Jornales",         amountUsd: "180.00", accountId: fincaEcId, payee: "Day laborers (wk 16)", source: "manual" },
    { entryDate: "2026-04-18", weekStartDate: "2026-04-12", categoryType: "labor_overhead",  categoryLabel: "Chavito",          amountUsd: "120.00", accountId: fincaEcId, payee: "Chavito", source: "manual" },
    { entryDate: "2026-04-18", weekStartDate: "2026-04-12", categoryType: "labor_overhead",  categoryLabel: "Engineer",         amountUsd: "100.00", accountId: fincaEcId, payee: "Engineer", source: "manual" },
    { entryDate: "2026-04-18", weekStartDate: "2026-04-12", categoryType: "labor_overhead",  categoryLabel: "Isaac",            amountUsd: "100.00", accountId: fincaEcId, payee: "Isaac Garcia", payeePersonId: isaacPersonId, source: "manual" },

    // Week of Apr 19, pay Sat Apr 25
    { entryDate: "2026-04-25", weekStartDate: "2026-04-19", categoryType: "operating_bills", categoryLabel: "Water deliveries", amountUsd: "60.00",  accountId: fincaEcId, payee: "Water delivery service", source: "manual" },
    { entryDate: "2026-04-25", weekStartDate: "2026-04-19", categoryType: "labor_harvest",   categoryLabel: "Jornales",         amountUsd: "210.00", accountId: fincaEcId, payee: "Day laborers (wk 17)", source: "manual" },
    { entryDate: "2026-04-25", weekStartDate: "2026-04-19", categoryType: "labor_overhead",  categoryLabel: "Chavito",          amountUsd: "120.00", accountId: fincaEcId, payee: "Chavito", source: "manual" },
    { entryDate: "2026-04-25", weekStartDate: "2026-04-19", categoryType: "labor_overhead",  categoryLabel: "Engineer",         amountUsd: "100.00", accountId: fincaEcId, payee: "Engineer", source: "manual" },
    { entryDate: "2026-04-25", weekStartDate: "2026-04-19", categoryType: "labor_overhead",  categoryLabel: "Isaac",            amountUsd: "100.00", accountId: fincaEcId, payee: "Isaac Garcia", payeePersonId: isaacPersonId, source: "manual" },
    { entryDate: "2026-04-22", weekStartDate: "2026-04-19", categoryType: "equipment",       categoryLabel: "Lights repair",    amountUsd: "180.00", accountId: fincaEcId, payee: "Hardware shop, San Clemente", notes: "Replaced two failed grow-lights.", source: "manual" },

    // Week of Apr 26, pay Sat May 2
    { entryDate: "2026-05-02", weekStartDate: "2026-04-26", categoryType: "operating_bills", categoryLabel: "Water deliveries", amountUsd: "60.00",  accountId: fincaEcId, payee: "Water delivery service", source: "manual" },
    { entryDate: "2026-05-02", weekStartDate: "2026-04-26", categoryType: "labor_harvest",   categoryLabel: "Jornales",         amountUsd: "195.00", accountId: fincaEcId, payee: "Day laborers (wk 18)", source: "manual" },
    { entryDate: "2026-05-02", weekStartDate: "2026-04-26", categoryType: "labor_overhead",  categoryLabel: "Chavito",          amountUsd: "120.00", accountId: fincaEcId, payee: "Chavito", source: "manual" },
    { entryDate: "2026-05-02", weekStartDate: "2026-04-26", categoryType: "labor_overhead",  categoryLabel: "Engineer",         amountUsd: "100.00", accountId: fincaEcId, payee: "Engineer", source: "manual" },
    { entryDate: "2026-05-02", weekStartDate: "2026-04-26", categoryType: "labor_overhead",  categoryLabel: "Isaac",            amountUsd: "100.00", accountId: fincaEcId, payee: "Isaac Garcia", payeePersonId: isaacPersonId, source: "manual" },
    { entryDate: "2026-04-28", weekStartDate: "2026-04-26", categoryType: "services",        categoryLabel: "Accountant",       amountUsd: "150.00", accountId: fincaEcId, payee: "Andrade Jamileth", notes: "Monthly accountant fee.", source: "manual" },
  ];
  const insertedExpenses = await db.insert(expenseEntries).values(expenseSeeds).returning({ id: expenseEntries.id });
  console.log(`  ✓ ${insertedExpenses.length} expense entries`);

  // ── Sample cash movements ─────────────────────────────────────────────
  // Two examples to exercise both directions of the US ↔ EC corridor.
  console.log("Seeding cash movements…");
  const cashMovementSeeds: NewCashMovement[] = [
    {
      transferDate: "2026-04-19",
      weekStartDate: "2026-04-19",
      direction: "in_to_ec",
      amountUsd: "1000.00",
      accountId: fincaEcId,
      counterparty: "James US",
      notes: "Wire from US to keep operations running through harvest dip.",
      source: "manual",
    },
    {
      transferDate: "2025-10-06",
      weekStartDate: "2025-10-05",
      direction: "out_to_us",
      amountUsd: "5000.00",
      accountId: fincaEcId,
      counterparty: "James US",
      notes: "Surplus return after Q3 harvest payments.",
      source: "manual",
    },
  ];
  const insertedCashMovements = await db.insert(cashMovements).values(cashMovementSeeds).returning({ id: cashMovements.id });
  console.log(`  ✓ ${insertedCashMovements.length} cash movements`);

  console.log("\nSeed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
