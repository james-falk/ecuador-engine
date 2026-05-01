"use client";

// Task list for /pending. Filter bar at top (assignee / company / tag / show-done),
// list of tasks below. Click a row to open the drawer in edit mode; "+ New" opens
// the drawer in create mode. Filters drive the URL so they survive refresh.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDrawer } from "./drawer";
import { Icon } from "./icons";
import type { TaskRow } from "@/lib/queries/tasks";

type Option = { id: string; name: string };

type Filters = {
  assigneeId?: string;
  companyId?: string;
  tag?: string;
  includeDone?: boolean;
};

export function TaskList({
  tasks,
  tags,
  assignees,
  companies,
  currentFilters,
}: {
  tasks: TaskRow[];
  tags: string[];
  assignees: Option[];
  companies: Option[];
  currentFilters: Filters;
}) {
  const router = useRouter();
  const { openTask, openTaskCreate } = useDrawer();

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams();
    if (currentFilters.assigneeId) sp.set("assignee", currentFilters.assigneeId);
    if (currentFilters.companyId) sp.set("company", currentFilters.companyId);
    if (currentFilters.tag) sp.set("tag", currentFilters.tag);
    if (currentFilters.includeDone) sp.set("done", "1");
    if (value === null) sp.delete(key);
    else sp.set(key, value);
    const qs = sp.toString();
    router.push(qs ? `/pending?${qs}` : "/pending");
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "10px 12px",
          border: "1px solid var(--line-soft)",
          borderRadius: 10,
          background: "var(--bg-1)",
        }}
      >
        <FilterSelect
          label="Assignee"
          value={currentFilters.assigneeId ?? ""}
          options={[{ id: "", name: "Anyone" }, ...assignees]}
          onChange={(v) => setParam("assignee", v || null)}
        />
        <FilterSelect
          label="Company"
          value={currentFilters.companyId ?? ""}
          options={[{ id: "", name: "Any company" }, ...companies]}
          onChange={(v) => setParam("company", v || null)}
        />
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span className="label" style={{ color: "var(--text-3)", marginRight: 4 }}>Tag</span>
            <FilterChip
              label="All"
              active={!currentFilters.tag}
              onClick={() => setParam("tag", null)}
            />
            {tags.map((t) => (
              <FilterChip
                key={t}
                label={t}
                active={currentFilters.tag === t}
                onClick={() => setParam("tag", currentFilters.tag === t ? null : t)}
              />
            ))}
          </div>
        )}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-2)", marginLeft: "auto" }}>
          <input
            type="checkbox"
            checked={!!currentFilters.includeDone}
            onChange={(e) => setParam("done", e.target.checked ? "1" : null)}
          />
          Show done
        </label>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => openTaskCreate()}
        >
          <Icon name="plus" size={11} /> New task
        </button>
      </div>

      {/* List */}
      {tasks.length === 0 ? (
        <div
          style={{
            padding: "48px 16px",
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: 13,
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            background: "var(--bg-1)",
          }}
        >
          No tasks {hasAnyFilter(currentFilters) ? "match these filters" : "yet"}.
          {!hasAnyFilter(currentFilters) && " Click \"New task\" to add the first one."}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {tasks.map((t) => (
            <TaskRowEl
              key={t.id}
              task={t}
              today={today}
              onOpen={() => openTask(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function hasAnyFilter(f: Filters): boolean {
  return !!(f.assigneeId || f.companyId || f.tag || f.includeDone);
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="label" style={{ color: "var(--text-3)" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "5px 8px",
          background: "var(--bg-3)",
          border: "1px solid var(--line-soft)",
          borderRadius: 6,
          color: "var(--text-1)",
          fontSize: 12,
          outline: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.id || "_any"} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{
        padding: "3px 9px",
        fontSize: 11,
        borderRadius: 999,
        border: `1px solid ${active ? "var(--green)" : "var(--line-soft)"}`,
        background: active ? "oklch(from var(--green) l c h / 0.15)" : "transparent",
        color: active ? "var(--green)" : "var(--text-2)",
        cursor: "pointer",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </button>
  );
}

function TaskRowEl({ task, today, onOpen }: { task: TaskRow; today: string; onOpen: () => void }) {
  const overdue = task.dueDate && task.status !== "done" && task.dueDate < today;
  const initials = task.assigneeName
    ? task.assigneeName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : null;
  const isDone = task.status === "done" || task.status === "archived";

  const priorityColor =
    task.priority === "high" ? "var(--rose)" :
    task.priority === "medium" ? "var(--sky)" :
    "var(--text-3)";

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 14px",
        background: "var(--bg-1)",
        border: 0,
        borderTop: "1px solid var(--line-soft)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
        opacity: isDone ? 0.55 : 1,
      }}
    >
      <span
        title={`priority: ${task.priority}`}
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: priorityColor,
          padding: "2px 5px",
          borderRadius: 3,
          background: `oklch(from ${priorityColor} l c h / 0.12)`,
          minWidth: 50,
          textAlign: "center",
        }}
      >
        {task.priority}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--text-0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {task.status === "blocked" && task.blockedReason && (
            <span className="mono" style={{ fontSize: 10, color: "var(--rose)" }}>
              blocked: {task.blockedReason}
            </span>
          )}
          {task.relatedCompanySlug && task.relatedCompanyName && (
            <Link
              href={`/companies/${task.relatedCompanySlug}`}
              onClick={(e) => e.stopPropagation()}
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--text-2)",
                textDecoration: "none",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {task.relatedCompanyName}
            </Link>
          )}
          {task.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                padding: "1px 6px",
                borderRadius: 999,
                border: "1px solid var(--line-soft)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <span
        className="mono num"
        style={{
          fontSize: 11,
          color: overdue ? "var(--rose)" : "var(--text-3)",
          fontWeight: overdue ? 500 : 400,
        }}
      >
        {task.dueDate ?? "—"}
      </span>
      <span
        title={task.assigneeName ?? "unassigned"}
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: initials ? "var(--bg-3)" : "transparent",
          border: initials ? "1px solid var(--line-soft)" : "1px dashed var(--line-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10.5,
          fontWeight: 500,
          color: initials ? "var(--text-1)" : "var(--text-3)",
        }}
      >
        {initials ?? "—"}
      </span>
      <Icon name="chev" size={12} color="var(--text-3)" />
    </button>
  );
}
