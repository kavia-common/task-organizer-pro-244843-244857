"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  apiCreateTask,
  apiDeleteTask,
  apiListTasks,
  apiLogin,
  apiRegister,
  apiUpdateTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/api";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/authToken";

type AuthMode = "login" | "register";

type StatusFilter = TaskStatus | "all";
type PriorityFilter = TaskPriority | "all";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
  }
}

function formatPriorityLabel(p: TaskPriority): string {
  switch (p) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
  }
}

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const t of tasks) groups[t.status].push(t);
  return groups;
}

function sortTasksForColumn(tasks: Task[]): Task[] {
  // High priority first, then earliest due date.
  const priorityRank: Record<TaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return [...tasks].sort((a, b) => {
    const pr = priorityRank[a.priority] - priorityRank[b.priority];
    if (pr !== 0) return pr;

    const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
    return ad - bd;
  });
}

function RetroShell(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--retro-bg)] text-[var(--retro-ink)]">
      <div className="mx-auto max-w-6xl px-4 py-8">{props.children}</div>
    </div>
  );
}

function Banner(props: { title: string; subtitle: string }) {
  return (
    <header className="mb-6 rounded-xl border-2 border-[var(--retro-ink)] bg-[var(--retro-surface)] p-5 shadow-[6px_6px_0_0_var(--retro-ink)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-mono text-2xl md:text-3xl">{props.title}</h1>
          <p className="text-sm opacity-80">{props.subtitle}</p>
        </div>
        <div className="text-xs opacity-70">
          API:{" "}
          <span className="font-mono">
            {process.env.NEXT_PUBLIC_API_BASE_URL ?? "(missing NEXT_PUBLIC_API_BASE_URL)"}
          </span>
        </div>
      </div>
    </header>
  );
}

function RetroButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const variant = props.variant ?? "primary";
  const base =
    "inline-flex items-center justify-center rounded-lg border-2 px-3 py-2 text-sm font-semibold shadow-[3px_3px_0_0_var(--retro-ink)] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_0_var(--retro-ink)] disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "border-[var(--retro-ink)] bg-[var(--retro-accent)] text-[var(--retro-ink)]"
      : variant === "danger"
        ? "border-[var(--retro-ink)] bg-[var(--retro-danger)] text-white"
        : "border-[var(--retro-ink)] bg-transparent text-[var(--retro-ink)]";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`${base} ${styles}`}
      title={props.title}
    >
      {props.children}
    </button>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{props.label}</span>
      {props.children}
      {props.hint ? <span className="text-xs opacity-70">{props.hint}</span> : null}
    </label>
  );
}

function RetroInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border-2 border-[var(--retro-ink)] bg-white px-3 py-2 font-mono text-sm shadow-[3px_3px_0_0_var(--retro-ink)] outline-none focus:ring-2 focus:ring-[var(--retro-accent-2)] ${props.className ?? ""}`}
    />
  );
}

function RetroTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border-2 border-[var(--retro-ink)] bg-white px-3 py-2 font-mono text-sm shadow-[3px_3px_0_0_var(--retro-ink)] outline-none focus:ring-2 focus:ring-[var(--retro-accent-2)] ${props.className ?? ""}`}
    />
  );
}

function RetroSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border-2 border-[var(--retro-ink)] bg-white px-3 py-2 font-mono text-sm shadow-[3px_3px_0_0_var(--retro-ink)] outline-none focus:ring-2 focus:ring-[var(--retro-accent-2)] ${props.className ?? ""}`}
    >
      {props.children}
    </select>
  );
}

function Toast(props: { tone: "error" | "success" | "info"; message: string }) {
  const bg =
    props.tone === "error"
      ? "bg-[var(--retro-danger)] text-white"
      : props.tone === "success"
        ? "bg-[var(--retro-success)] text-[var(--retro-ink)]"
        : "bg-[var(--retro-accent-2)] text-[var(--retro-ink)]";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${bg} rounded-lg border-2 border-[var(--retro-ink)] px-4 py-3 text-sm shadow-[4px_4px_0_0_var(--retro-ink)]`}
    >
      <span className="font-mono">{props.message}</span>
    </div>
  );
}

function TaskCard(props: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const due = props.task.due_date ? new Date(props.task.due_date) : null;
  const isOverdue =
    due && props.task.status !== "done"
      ? due.getTime() < new Date(todayISODate()).getTime()
      : false;

  const priorityBadge =
    props.task.priority === "high"
      ? "bg-[var(--retro-danger)] text-white"
      : props.task.priority === "medium"
        ? "bg-[var(--retro-accent-2)] text-[var(--retro-ink)]"
        : "bg-[var(--retro-muted)] text-[var(--retro-ink)]";

  return (
    <article className="rounded-xl border-2 border-[var(--retro-ink)] bg-white p-3 shadow-[4px_4px_0_0_var(--retro-ink)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold">{props.task.title}</h3>
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${priorityBadge}`}>
          {formatPriorityLabel(props.task.priority)}
        </span>
      </div>

      {props.task.description ? (
        <p className="mb-2 whitespace-pre-wrap text-xs opacity-80">
          {props.task.description}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-[var(--retro-ink)] bg-[var(--retro-surface)] px-2 py-0.5 font-mono">
          {formatStatusLabel(props.task.status)}
        </span>
        <span
          className={`rounded-md border border-[var(--retro-ink)] px-2 py-0.5 font-mono ${
            isOverdue ? "bg-[var(--retro-danger)] text-white" : "bg-[var(--retro-surface)]"
          }`}
        >
          Due: {props.task.due_date ?? "—"}
        </span>
      </div>

      <div className="flex gap-2">
        <RetroButton variant="ghost" onClick={() => props.onEdit(props.task)}>
          Edit
        </RetroButton>
        <RetroButton variant="danger" onClick={() => props.onDelete(props.task)}>
          Delete
        </RetroButton>
      </div>
    </article>
  );
}

function TaskModal(props: {
  open: boolean;
  mode: "create" | "edit";
  initial?: Task | null;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
  }) => void;
  busy?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string>(todayISODate());

  useEffect(() => {
    if (!props.open) return;
    if (props.mode === "edit" && props.initial) {
      setTitle(props.initial.title);
      setDescription(props.initial.description ?? "");
      setStatus(props.initial.status);
      setPriority(props.initial.priority);
      setDueDate(props.initial.due_date ?? todayISODate());
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate(todayISODate());
    }
  }, [props.open, props.mode, props.initial]);

  if (!props.open) return null;

  const canSubmit = title.trim().length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={props.mode === "create" ? "Create task" : "Edit task"}
    >
      <div className="w-full max-w-xl rounded-2xl border-2 border-[var(--retro-ink)] bg-[var(--retro-surface)] p-4 shadow-[8px_8px_0_0_var(--retro-ink)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-lg font-bold">
            {props.mode === "create" ? "NEW TASK" : "EDIT TASK"}
          </h2>
          <RetroButton variant="ghost" onClick={props.onClose} disabled={props.busy}>
            Close
          </RetroButton>
        </div>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            props.onSubmit({
              title: title.trim(),
              description: description.trim(),
              status,
              priority,
              due_date: dueDate ? dueDate : null,
            });
          }}
        >
          <Field label="Title" hint="At least 2 characters.">
            <RetroInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ship v1"
              required
              minLength={2}
            />
          </Field>

          <Field label="Description">
            <RetroTextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Notes, links, acceptance criteria..."
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Status">
              <RetroSelect value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </RetroSelect>
            </Field>

            <Field label="Priority">
              <RetroSelect
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </RetroSelect>
            </Field>

            <Field label="Due date">
              <RetroInput
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <RetroButton
              type="submit"
              disabled={!canSubmit || props.busy}
              title={!canSubmit ? "Please enter a longer title." : undefined}
            >
              {props.busy ? "Saving..." : props.mode === "create" ? "Create" : "Save"}
            </RetroButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function AuthCard(props: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onAuth: (token: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return isValidEmail(email) && password.length >= 8;
  }, [email, password]);

  async function submit() {
    setError(null);
    if (!canSubmit) {
      setError("Enter a valid email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const res =
        props.mode === "login"
          ? await apiLogin({ email: email.trim(), password })
          : await apiRegister({ email: email.trim(), password });
      props.onAuth(res.access_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--retro-ink)] bg-[var(--retro-surface)] p-5 shadow-[8px_8px_0_0_var(--retro-ink)]">
      <h2 className="mb-1 font-mono text-lg font-bold">
        {props.mode === "login" ? "LOG IN" : "REGISTER"}
      </h2>
      <p className="mb-4 text-sm opacity-80">
        {props.mode === "login"
          ? "Use your account to manage tasks."
          : "Create an account to start managing tasks."}
      </p>

      <div className="grid gap-3">
        <Field label="Email">
          <RetroInput
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            inputMode="email"
            autoComplete="email"
          />
        </Field>

        <Field label="Password" hint="Min 8 characters.">
          <RetroInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete={props.mode === "login" ? "current-password" : "new-password"}
          />
        </Field>

        {error ? <Toast tone="error" message={error} /> : null}

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <RetroButton onClick={submit} disabled={busy || !canSubmit}>
            {busy ? "Working..." : props.mode === "login" ? "Log in" : "Register"}
          </RetroButton>

          <button
            className="text-left text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
            onClick={() => props.setMode(props.mode === "login" ? "register" : "login")}
            type="button"
          >
            {props.mode === "login"
              ? "Need an account? Register"
              : "Already have an account? Log in"}
          </button>
        </div>

        <p className="text-xs opacity-70">
          Note: Backend endpoints must exist at <span className="font-mono">/auth/*</span> and{" "}
          <span className="font-mono">/tasks</span>. If you see errors like 404, the backend container
          still needs implementing.
        </p>
      </div>
    </section>
  );
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const [toast, setToast] = useState<{ tone: "error" | "success" | "info"; message: string } | null>(
    null,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Task | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    const t = getStoredToken();
    if (t) setToken(t);
  }, []);

  async function refreshTasks(activeToken: string) {
    setLoadingTasks(true);
    try {
      const list = await apiListTasks({
        token: activeToken,
        q: q.trim() ? q.trim() : undefined,
        status: statusFilter,
        priority: priorityFilter,
      });
      setTasks(list);
    } catch (e) {
      setToast({
        tone: "error",
        message: e instanceof Error ? e.message : "Failed to load tasks.",
      });
    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void refreshTasks(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, q, statusFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const g = groupByStatus(tasks);
    return {
      todo: sortTasksForColumn(g.todo),
      in_progress: sortTasksForColumn(g.in_progress),
      done: sortTasksForColumn(g.done),
    };
  }, [tasks]);

  function openCreate() {
    setEditing(null);
    setModalMode("create");
    setModalOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setModalMode("edit");
    setModalOpen(true);
  }

  async function submitModal(input: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
  }) {
    if (!token) return;
    setSavingTask(true);
    try {
      if (modalMode === "create") {
        const created = await apiCreateTask({ token, input });
        setTasks((prev) => [created, ...prev]);
        setToast({ tone: "success", message: "Task created." });
      } else if (editing) {
        const updated = await apiUpdateTask({ token, id: editing.id, input });
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setToast({ tone: "success", message: "Task updated." });
      }
      setModalOpen(false);
    } catch (e) {
      setToast({
        tone: "error",
        message: e instanceof Error ? e.message : "Save failed.",
      });
    } finally {
      setSavingTask(false);
    }
  }

  async function deleteTask(t: Task) {
    if (!token) return;
    const ok = window.confirm(`Delete task "${t.title}"?`);
    if (!ok) return;

    try {
      await apiDeleteTask({ token, id: t.id });
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      setToast({ tone: "success", message: "Task deleted." });
    } catch (e) {
      setToast({
        tone: "error",
        message: e instanceof Error ? e.message : "Delete failed.",
      });
    }
  }

  function logout() {
    clearStoredToken();
    setToken(null);
    setTasks([]);
    setToast({ tone: "info", message: "Logged out." });
  }

  return (
    <RetroShell>
      <Banner title="TASK ORGANIZER PRO" subtitle="Retro-styled tasks with status lanes, due dates, priorities, filter + search." />

      {toast ? (
        <div className="mb-4">
          <Toast tone={toast.tone} message={toast.message} />
        </div>
      ) : null}

      {!token ? (
        <AuthCard
          mode={authMode}
          setMode={setAuthMode}
          onAuth={(newToken) => {
            setStoredToken(newToken);
            setToken(newToken);
            setToast({ tone: "success", message: "Authenticated." });
          }}
        />
      ) : (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border-2 border-[var(--retro-ink)] bg-[var(--retro-surface)] p-4 shadow-[8px_8px_0_0_var(--retro-ink)]">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-mono text-lg font-bold">CONTROL PANEL</h2>
                  <p className="text-sm opacity-80">Search + filter tasks. Create new tasks.</p>
                </div>
                <div className="flex gap-2">
                  <RetroButton onClick={openCreate}>New Task</RetroButton>
                  <RetroButton variant="ghost" onClick={logout}>
                    Log out
                  </RetroButton>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Search">
                  <RetroInput
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="title or description..."
                  />
                </Field>

                <Field label="Status">
                  <RetroSelect
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="all">All</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </RetroSelect>
                </Field>

                <Field label="Priority">
                  <RetroSelect
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                  >
                    <option value="all">All</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </RetroSelect>
                </Field>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs opacity-80">
                <span className="font-mono">
                  {loadingTasks ? "Loading tasks..." : `${tasks.length} task(s)`}
                </span>
                <RetroButton
                  variant="ghost"
                  onClick={() => token && refreshTasks(token)}
                  disabled={loadingTasks}
                >
                  Refresh
                </RetroButton>
              </div>
            </div>

            <aside className="rounded-2xl border-2 border-[var(--retro-ink)] bg-white p-4 shadow-[8px_8px_0_0_var(--retro-ink)]">
              <h3 className="mb-2 font-mono text-base font-bold">TIPS</h3>
              <ul className="list-disc pl-5 text-sm opacity-80">
                <li>High priority floats to the top within each status lane.</li>
                <li>Overdue tasks are highlighted (unless already Done).</li>
                <li>Use search + filters together.</li>
              </ul>
            </aside>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {(["todo", "in_progress", "done"] as const).map((s) => (
              <div
                key={s}
                className="rounded-2xl border-2 border-[var(--retro-ink)] bg-[var(--retro-surface)] p-4 shadow-[8px_8px_0_0_var(--retro-ink)]"
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-mono text-base font-bold">{formatStatusLabel(s)}</h2>
                  <span className="rounded-md border border-[var(--retro-ink)] bg-white px-2 py-0.5 text-xs font-mono">
                    {grouped[s].length}
                  </span>
                </div>
                <div className="grid gap-3">
                  {grouped[s].map((t) => (
                    <TaskCard key={t.id} task={t} onEdit={openEdit} onDelete={deleteTask} />
                  ))}
                  {grouped[s].length === 0 ? (
                    <p className="rounded-lg border-2 border-dashed border-[var(--retro-ink)] bg-white p-4 text-sm opacity-70">
                      No tasks here yet.
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </section>

          <TaskModal
            open={modalOpen}
            mode={modalMode}
            initial={editing}
            onClose={() => setModalOpen(false)}
            onSubmit={submitModal}
            busy={savingTask}
          />
        </>
      )}

      <footer className="mt-10 text-center text-xs opacity-70">
        <p className="font-mono">
          Static-exported UI. Configure <b>NEXT_PUBLIC_API_BASE_URL</b> to point at the FastAPI backend.
        </p>
      </footer>
    </RetroShell>
  );
}
