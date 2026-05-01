// /pending — Pending Items pillar. Two sections:
//   1. Pipeline — derived stage tasks from the harvest pipeline (awaiting
//      processed report / awaiting payment / awaiting balance). Computed
//      live from harvests + farm_harvests + harvest_settlements; not stored.
//   2. Tasks — manual DB-backed tasks (Pending Items tracker proper).
//      Filterable by assignee / company / tag. Done + archived hidden by default.

import Link from "next/link";
import { Topbar } from "@/components/design/topbar";
import {
  getTasks,
  getTaskTags,
  getTaskAssigneeOptions,
  getTaskCompanyOptions,
} from "@/lib/queries/tasks";
import { getPipelinePending } from "@/lib/queries/pending";
import { TaskList } from "@/components/design/task-list";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; company?: string; tag?: string; done?: string }>;
}) {
  const params = await searchParams;
  const includeDone = params.done === "1";
  const assigneeId = params.assignee || undefined;
  const companyId = params.company || undefined;
  const tag = params.tag || undefined;

  const [tasks, tags, assignees, companies, pipeline] = await Promise.all([
    getTasks({ assigneeId, companyId, tag, includeDone }),
    getTaskTags(),
    getTaskAssigneeOptions(),
    getTaskCompanyOptions(),
    getPipelinePending(),
  ]);

  const openCount = tasks.filter((t) => t.status !== "done" && t.status !== "archived").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Pending Items"]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {pipeline.length} pipeline · {openCount} tasks
          </span>
        }
      />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="ee-page-pad" style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
            <h1 style={{ font: "500 22px/1.1 var(--font-display)", letterSpacing: "-0.02em", margin: 0 }}>
              Pending Items
            </h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              Pipeline stages + manual tasks.
            </span>
          </div>

          {pipeline.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                <h2 style={{ font: "500 14px/1.2 var(--font-display)", margin: 0, color: "var(--text-1)" }}>
                  Harvest pipeline
                </h2>
                <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                  Auto-derived from harvests + payments. Resolve by advancing each item to its next stage.
                </span>
              </div>
              <div style={{ border: "1px solid var(--line-soft)", borderRadius: 10, overflow: "hidden" }}>
                {pipeline.map((p, i) => (
                  <Link
                    key={p.id}
                    href={p.relatedHarvestId ? `/harvests` : "/harvests"}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 130px 1fr",
                      gap: 14,
                      padding: "12px 14px",
                      alignItems: "center",
                      borderTop: i === 0 ? 0 : "1px solid var(--line-soft)",
                      fontSize: 12.5,
                      textDecoration: "none",
                      color: "var(--text-1)",
                    }}
                  >
                    <span className="mono" style={{ color: "var(--text-2)" }}>{p.date}</span>
                    <StageChip stage={p.stage} />
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ color: "var(--text-1)" }}>{p.title}</span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                        {p.detail}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
              <h2 style={{ font: "500 14px/1.2 var(--font-display)", margin: 0, color: "var(--text-1)" }}>
                Tasks
              </h2>
            </div>
            <TaskList
              tasks={tasks}
              tags={tags}
              assignees={assignees}
              companies={companies}
              currentFilters={{ assigneeId, companyId, tag, includeDone }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function StageChip({ stage }: { stage: "awaiting_processed" | "awaiting_payment" | "awaiting_balance" }) {
  const map = {
    awaiting_processed: { label: "report",  color: "var(--amber)" },
    awaiting_payment:   { label: "payment", color: "var(--rose)" },
    awaiting_balance:   { label: "balance", color: "var(--sky)" },
  } as const;
  const m = map[stage];
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: m.color,
        padding: "2px 6px",
        borderRadius: 3,
        background: `oklch(from ${m.color} l c h / 0.12)`,
        textAlign: "center",
        width: 100,
      }}
    >
      {m.label}
    </span>
  );
}
