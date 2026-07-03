import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ErrorMessage from "../../components/ErrorMessage";

const CATEGORIES = ["general", "opening", "closing", "prep", "compliance", "maintenance"];
const CAT_ICON = { general: "📋", opening: "🌅", closing: "🌙", prep: "🔪", compliance: "🛡️", maintenance: "🔧" };

export default function Operations() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTask, setNewTask] = useState({ title: "", category: "general" });
  const [busy, setBusy] = useState(false);
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [clForm, setClForm] = useState({ name: "", category: "opening", items: "" });

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([api.getOpsTasks(), api.getChecklists()])
      .then(([tk, cl]) => { setTasks(tk); setChecklists(cl); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    setBusy(true);
    try {
      await api.createOpsTask({ title: newTask.title.trim(), category: newTask.category });
      setNewTask({ title: "", category: newTask.category });
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const toggle = async (task) => {
    // optimistic
    setTasks((prev) => {
      if (!prev) return prev;
      const moving = { ...task, done: !task.done };
      return {
        ...prev,
        open: task.done ? [...prev.open, moving] : prev.open.filter((x) => x.id !== task.id),
        done: task.done ? prev.done.filter((x) => x.id !== task.id) : [...prev.done, moving],
      };
    });
    try { await api.toggleOpsTask(task.id, !task.done); load(); }
    catch { load(); }
  };

  const removeTask = async (id) => { try { await api.deleteOpsTask(id); load(); } catch (e) { setError(e.message); } };

  const runChecklist = async (id) => { setBusy(true); try { await api.instantiateChecklist(id); load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  const addChecklist = async () => {
    if (!clForm.name.trim()) return;
    setBusy(true);
    try {
      await api.createChecklist({
        name: clForm.name.trim(), category: clForm.category,
        items: clForm.items.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setClForm({ name: "", category: "opening", items: "" });
      setShowChecklistForm(false);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("opsPage.title")}</h1>
        <p className="text-gray-400 mt-1">{t("opsPage.subtitle")}</p>
      </div>

      {tasks.overdue_count > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium">
          ⚠️ {t("opsPage.overdue", { count: tasks.overdue_count })}
        </div>
      )}

      {/* Checklists — one-tap instantiate */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-gray-900">{t("opsPage.checklists")}</h2>
          <button onClick={() => setShowChecklistForm((v) => !v)} className="text-sm text-brand-600 font-bold hover:text-brand-800">
            {showChecklistForm ? t("opsPage.cancel") : `+ ${t("opsPage.newChecklist")}`}
          </button>
        </div>
        {showChecklistForm && (
          <div className="mb-3 bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <input value={clForm.name} onChange={(e) => setClForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("opsPage.checklistNamePh")}
                className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              <select value={clForm.category} onChange={(e) => setClForm((f) => ({ ...f, category: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`opsPage.cat_${c}`)}</option>)}
              </select>
            </div>
            <textarea value={clForm.items} onChange={(e) => setClForm((f) => ({ ...f, items: e.target.value }))}
              rows={4} placeholder={t("opsPage.checklistItemsPh")}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none mb-2" />
            <button onClick={addChecklist} disabled={busy} className="bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-brand-700 disabled:opacity-60">
              {t("opsPage.save")}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {checklists.length === 0 && <p className="text-sm text-gray-400">{t("opsPage.noChecklists")}</p>}
          {checklists.map((c) => (
            <div key={c.id} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-sm font-semibold text-gray-800">{CAT_ICON[c.category] || "📋"} {c.name}</span>
              <span className="text-xs text-gray-400">{c.items.length}</span>
              <button onClick={() => runChecklist(c.id)} disabled={busy}
                className="text-xs font-bold bg-brand-100 text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-200">
                {t("opsPage.runToday")}
              </button>
              <button onClick={() => api.deleteChecklist(c.id).then(load)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
        </div>
      </section>

      {/* Add task */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={newTask.title} onChange={(e) => setNewTask((f) => ({ ...f, title: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder={t("opsPage.taskPh")}
          className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
        <select value={newTask.category} onChange={(e) => setNewTask((f) => ({ ...f, category: e.target.value }))}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`opsPage.cat_${c}`)}</option>)}
        </select>
        <button onClick={addTask} disabled={busy} className="bg-brand-600 text-white font-bold px-5 rounded-xl hover:bg-brand-700 disabled:opacity-60 text-sm">
          {t("opsPage.addTask")}
        </button>
      </div>

      {/* Task lists */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {tasks.open.length === 0 && tasks.done.length === 0 && (
          <p className="text-center text-gray-400 py-10 text-sm">{t("opsPage.allClear")}</p>
        )}
        {tasks.open.map((tk) => (
          <TaskRow key={tk.id} task={tk} onToggle={() => toggle(tk)} onRemove={() => removeTask(tk.id)} catIcon={CAT_ICON} t={t} />
        ))}
        {tasks.done.map((tk) => (
          <TaskRow key={tk.id} task={tk} onToggle={() => toggle(tk)} onRemove={() => removeTask(tk.id)} catIcon={CAT_ICON} t={t} done />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onRemove, catIcon, t, done }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <button onClick={onToggle} className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${done ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
        {done && "✓"}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-900 font-medium"}`}>
          {catIcon[task.category] || "📋"} {task.title}
        </p>
        {task.assignee && <p className="text-xs text-gray-400">{task.assignee}</p>}
      </div>
      {task.due_date && <span className="text-xs text-gray-400 flex-shrink-0">{task.due_date}</span>}
      <button onClick={onRemove} className="text-gray-300 hover:text-red-500 flex-shrink-0">🗑️</button>
    </div>
  );
}
