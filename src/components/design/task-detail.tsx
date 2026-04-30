"use client";

// Drawer body for tasks. Handles BOTH create (item === null) and edit
// (item !== null) modes against a single form, since the schemas line up.

import * as React from "react";
import {
  type TaskRow,
  type TaskStatus,
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

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "archived", label: "Archived" },
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
  const [priority, setPriority] = React.useState<number>(item?.priority ?? 0);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const onSave = () => {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: status === s.value ? "1px solid var(--green)" : "1px solid var(--line-soft)",
                  background: status === s.value ? "var(--green-glow)" : "var(--bg-3)",
                  color: status === s.value ? "var(--green)" : "var(--text-2)",
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mono"
              style={inputStyle}
            />
          </Field>
          <Field label="Priority" hint="Higher = more urgent.">
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 0)}
              className="mono num"
              style={inputStyle}
            />
          </Field>
        </div>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{hint}</div>}
    </div>
  );
}
