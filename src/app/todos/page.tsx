"use client";

import * as React from "react";
import { todos as seedTodos, type TodoItem } from "@/lib/data";
import { Topbar } from "@/components/design/topbar";
import { Icon } from "@/components/design/icons";

type Filter = "open" | "all" | "done";

export default function TodosPage() {
  const [done, setDone] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(seedTodos.map((t) => [t.id, !!t.done]))
  );
  const [filter, setFilter] = React.useState<Filter>("open");

  const visible = seedTodos
    .filter((t) => (filter === "open" ? !done[t.id] : filter === "done" ? done[t.id] : true))
    .slice()
    .sort((a, b) => {
      const order: Record<TodoItem["priority"], number> = { high: 0, med: 1, low: 2 };
      return order[a.priority] - order[b.priority] || (a.due || "").localeCompare(b.due || "");
    });

  const openCount = seedTodos.filter((t) => !done[t.id]).length;
  const highOpen = seedTodos.filter((t) => !done[t.id] && t.priority === "high").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Topbar
        crumbs={["Workspace", "TODOs"]}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
              {openCount} open · {highOpen} high
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                border: "1px solid var(--line-soft)",
                borderRadius: 6,
                padding: 2,
              }}
            >
              {(["open", "all", "done"] as Filter[]).map((id) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 4,
                    border: 0,
                    background: filter === id ? "var(--bg-3)" : "transparent",
                    color: filter === id ? "var(--text-0)" : "var(--text-2)",
                    fontSize: 11,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 }}>What&apos;s on you</h1>
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Ranked by priority, then due date.</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              border: "1px solid var(--line-soft)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {visible.length === 0 && (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 12.5 }}>
                {filter === "open" ? "Nothing on you. Quiet day." : filter === "done" ? "No completed items yet." : "No items."}
              </div>
            )}
            {visible.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                done={!!done[t.id]}
                onToggle={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
              />
            ))}
          </div>

          <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-3)", display: "flex", justifyContent: "space-between" }}>
            <span>Items here are pulled from compliance, logistics, and advisor channels.</span>
            <span className="mono">{seedTodos.length} total</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodoRow({ todo, done, onToggle }: { todo: TodoItem; done: boolean; onToggle: () => void }) {
  const pColor =
    todo.priority === "high" ? "var(--amber)" :
    todo.priority === "med"  ? "var(--sky)"   :
    "var(--text-3)";
  const overdue = !done && todo.due && new Date(todo.due) < new Date("2025-11-05");

  return (
    <button
      onClick={onToggle}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 6px 1fr auto auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 16px",
        background: "var(--bg-1)",
        border: 0,
        borderTop: "1px solid var(--line-soft)",
        cursor: "pointer",
        textAlign: "left",
        color: "var(--text-0)",
        opacity: done ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1.5px solid ${done ? "var(--green)" : "var(--line)"}`,
          background: done ? "var(--green)" : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done && <Icon name="check" size={10} color="var(--bg-0)" />}
      </span>
      <span style={{ width: 3, height: 18, background: pColor, borderRadius: 2 }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            textDecoration: done ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {todo.title}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--text-3)" }}>
          <span className="mono" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>{todo.area}</span>
          <span>·</span>
          <span>{todo.owner}</span>
        </span>
      </span>
      <span className="mono" style={{ fontSize: 11, color: overdue ? "var(--amber)" : "var(--text-2)" }}>
        {todo.due}
      </span>
      <Icon name="chev" size={11} color="var(--text-3)" />
    </button>
  );
}
