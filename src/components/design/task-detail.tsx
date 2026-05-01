"use client";

// Drawer body for tasks. Handles BOTH create (item === null) and edit
// (item !== null) modes against a single form, since the schemas line up.

import * as React from "react";
import {
  type TaskRow,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/queries/tasks";
import { createTask, updateTask, completeTask, reopenTask, deleteTask } from "@/lib/actions/tasks";
import { Icon } from "./icons";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg-3)",
  border: "1px solid var(--line-soft)",
  borderRadius: 8,
  color: "var(--text-0)",
  fontSize: 12.5,
  outline: "none",
};

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: "open",        label: "Open",        color: "var(--text-2)" },
  { value: "in_progress", label: "In progress", color: "var(--sky)" },
  { value: "blocked",     label: "Blocked",     color: "var(--rose)" },
  { value: "done",        label: "Done",        color: "var(--green)" },
  { value: "archived",    label: "Archived",    color: "var(--text-3)" },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: "low",    label: "Low",    color: "var(--text-3)" },
  { value: "medium", label: "Medium", color: "var(--sky)" },
  { value: "high",   label: "High",   color: "var(--rose)" },
];

type Option = { id: string; name: string };

export function TaskDetail({
  item,
  onClose,
  assigneeOptions,
  companyOptions,
}: {
  item: TaskRow | null;
  onClose: () => void;
  assigneeOptions: Option[];
  companyOptions: Option[];
}) {
  const isCreate = item === null;
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [status, setStatus] = React.useState<TaskStatus>(item?.status ?? "open");
  const [assigneePersonId, setAssigneePersonId] = React.useState<string>(item?.assigneePersonId ?? "");
  const [relatedCompanyId, setRelatedCompanyId] = React.useState<string>(item?.relatedCompanyId ?? "");
  const [tagsInput, setTagsInput] = React.useState((item?.tags ?? []).join(", "));
  const [dueDate, setDueDate] = React.useState(item?.dueDate ?? "");
  const [priority, setPriority] = React.useState<TaskPriority>(item?.priority ?? "medium");
  const [blockedReason, setBlockedReason] = React.useState(item?.blockedReason ?? "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onSave = () => {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    if (status === "blocked" && !blockedReason.trim()) {
      setError("Blocked tasks need a reason.");
      return;
    }
    const payload = {
      title: trimmed,
      description: description.trim() || null,
      status,
      assigneePersonId: assigneePersonId || null,
      relatedCompanyId: relatedCompanyId || null,
      tags: tagsInput,
      dueDate: dueDate || null,
      priority,
      blockedReason: blockedReason.trim() || null,
    };
    startTransition(async () => {
      const r = isCreate
        ? await createTask(payload)
        : await updateTask({ id: item!.id, ...payload });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onClose();
    });
  };

  const onComplete = () => {
    if (isCreate) return;
    startTransition(async () => {
      const r = await completeTask(item!.id);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  };

  const onReopen = () => {
    if (isCreate) return;
    startTransition(async () => {
      const r = await reopenTask(item!.id);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  };

  const onDelete = () => {
    if (isCreate) return;
    if (!confirm("Delete this task? This cannot be undone.")) return;
    startTransition(async () => {
      const r = await deleteTask(item!.id);
      if (!r.ok) setError(r.error);
      else onClose();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--line-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="label" style={{ marginBottom: 6 }}>{isCreate ? "New task" : "Task"}</div>
          <h2 style={{ font: "500 18px/1.2 var(--font-display)", letterSpacing: "-0.01em", margin: 0 }}>
            {isCreate ? "Add a task" : item.title}
          </h2>
          {!isCreate && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 4 }}>
              {item.dueDate ? `due ${item.dueDate}` : "no due date"} · {item.source ?? "manual"}
            </div>
          )}
        </div>
        <button onClick={onClose} className="btn btn--ghost" type="button">
          <Icon name="x" size={11} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Export License"
            style={inputStyle}
            autoFocus={isCreate}
          />
        </Field>

        <Field label="Description" hint="Context, links, decisions made.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder=""
            style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}
          />
        </Field>

        <Field label="Status">
          <Pills
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v as TaskStatus)}
          />
        </Field>

        {status === "blocked" && (
          <Field label="Blocked reason" hint="Why is this stuck? Required when status=blocked.">
            <input
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              placeholder="Waiting on Tim Forrest…"
              style={inputStyle}
            />
          </Field>
        )}

        <Field label="Priority">
          <Pills
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(v) => setPriority(v as TaskPriority)}
          />
        </Field>

        <Field label="Assignee">
          <select value={assigneePersonId} onChange={(e) => setAssigneePersonId(e.target.value)} style={inputStyle}>
            <option value="">— unassigned —</option>
            {assigneeOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Related company">
          <select value={relatedCompanyId} onChange={(e) => setRelatedCompanyId(e.target.value)} style={inputStyle}>
            <option value="">— none —</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Tags" hint="Comma-separated. Lowercase. e.g. compliance, export">
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="compliance, export"
            className="mono"
            style={inputStyle}
          />
        </Field>

        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mono"
            style={inputStyle}
          />
        </Field>
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--line-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-1)",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!isCreate && (
            <>
              <button className="btn btn--ghost" type="button" onClick={onDelete} disabled={isPending} style={{ color: "var(--rose)" }}>
                <Icon name="x" size={11} color="var(--rose)" /> Delete
              </button>
              {item.status !== "done" ? (
                <button className="btn" type="button" onClick={onComplete} disabled={isPending}>
                  <Icon name="check" size={11} /> Complete
                </button>
              ) : (
                <button className="btn" type="button" onClick={onReopen} disabled={isPending}>
                  Reopen
                </button>
              )}
            </>
          )}
          {error && <span style={{ fontSize: 11, color: "var(--rose)" }}>{error}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={onSave}
            disabled={isPending || !title.trim()}
          >
            <Icon name="check" size={11} /> {isPending ? "Saving…" : isCreate ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; color: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${active ? o.color : "var(--line-soft)"}`,
              background: active ? `oklch(from ${o.color} l c h / 0.15)` : "var(--bg-3)",
              color: active ? o.color : "var(--text-2)",
              fontSize: 11.5,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}
