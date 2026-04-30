// /pending — Pending Items pillar. Real DB-backed tasks (the mock TODOs from
// the design handoff have been retired). Filterable by assignee / company /
// tag. Done + archived rows are hidden by default.

import { Topbar } from "@/components/design/topbar";
import {
  getTasks,
  getTaskTags,
  getTaskAssigneeOptions,
  getTaskCompanyOptions,
} from "@/lib/queries/tasks";
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

  const [tasks, tags, assignees, companies] = await Promise.all([
    getTasks({ assigneeId, companyId, tag, includeDone }),
    getTaskTags(),
    getTaskAssigneeOptions(),
    getTaskCompanyOptions(),
  ]);

  const openCount = tasks.filter((t) => t.status !== "done" && t.status !== "archived").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Pending Items"]}
        right={
          <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {openCount} open · {tasks.length} shown
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
              Tasks with optional assignee, company, tags, and due date.
            </span>
          </div>

          <TaskList
            tasks={tasks}
            tags={tags}
            assignees={assignees}
            companies={companies}
            currentFilters={{ assigneeId, companyId, tag, includeDone }}
          />
        </div>
      </div>
    </div>
  );
}
