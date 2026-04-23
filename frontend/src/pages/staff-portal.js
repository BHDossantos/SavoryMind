import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { useRouter } from "next/router";

function formatTime(t) {
  if (!t) return "--:--";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? "AM" : "PM"}`;
}

function elapsed(clockIn) {
  if (!clockIn) return "";
  const [h, m] = clockIn.split(":").map(Number);
  const now = new Date();
  const start = new Date();
  start.setHours(h, m, 0, 0);
  const diff = Math.max(0, now - start);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m elapsed`;
}

export default function StaffPortal() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (user && user.account_type !== "staff") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    try {
      const [s, l] = await Promise.all([api.getClockStatus(), api.getMyLogs()]);
      setStatus(s);
      setLogs(l);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClockIn = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.clockIn({ notes });
      setNotes("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.clockOut({ break_minutes: parseInt(breakMinutes) || 0 });
      setBreakMinutes("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const totalHours = logs.filter(l => l.total_hours != null).reduce((s, l) => s + (l.total_hours || 0), 0);
  const shiftsThisWeek = logs.filter(l => {
    const d = new Date(l.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return d >= weekAgo;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <p className="font-bold text-gray-900">SavoryMind</p>
              <p className="text-xs text-gray-500">Staff Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{user?.display_name}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">{error}</div>
        )}

        {/* Clock card */}
        <div className={`rounded-2xl p-8 text-center shadow-sm border ${status?.clocked_in ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
          <div className="text-5xl mb-4">{status?.clocked_in ? "🟢" : "⚪"}</div>
          <p className="text-lg font-bold text-gray-900 mb-1">
            {status?.clocked_in ? "You are clocked in" : "You are clocked out"}
          </p>
          {status?.clocked_in && (
            <div className="mt-2 space-y-1">
              <p className="text-3xl font-black text-green-700">{formatTime(status.clock_in_time)}</p>
              <p className="text-sm text-green-600">{elapsed(status.clock_in_time)}</p>
              <p className="text-xs text-gray-500 mt-1">{status.clock_in_date}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {status?.clocked_in ? (
              <>
                <div className="flex items-center gap-3 max-w-xs mx-auto">
                  <label className="text-sm text-gray-600 whitespace-nowrap">Break mins:</label>
                  <input
                    type="number"
                    min="0"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(e.target.value)}
                    placeholder="0"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
                <button
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="w-full max-w-xs mx-auto block bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl text-lg transition-colors disabled:opacity-60 shadow-lg"
                >
                  {actionLoading ? "Clocking out..." : "Clock Out"}
                </button>
              </>
            ) : (
              <>
                <div className="max-w-xs mx-auto">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
                <button
                  onClick={handleClockIn}
                  disabled={actionLoading}
                  className="w-full max-w-xs mx-auto block bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl text-lg transition-colors disabled:opacity-60 shadow-lg"
                >
                  {actionLoading ? "Clocking in..." : "Clock In"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-2xl font-black text-gray-900">{logs.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Shifts</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-2xl font-black text-gray-900">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-gray-400 mt-1">Total Hours</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100 shadow-sm">
            <p className="text-2xl font-black text-gray-900">{shiftsThisWeek}</p>
            <p className="text-xs text-gray-400 mt-1">This Week</p>
          </div>
        </div>

        {/* Shift history */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Shift History</h2>
          <div className="space-y-3">
            {loading && <p className="text-sm text-gray-400 text-center py-4">Loading...</p>}
            {!loading && logs.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No shifts logged yet.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className={`bg-white rounded-2xl p-4 border shadow-sm ${log.is_open ? "border-green-200 bg-green-50" : "border-gray-100"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{log.date}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTime(log.clock_in)} → {log.is_open ? "In progress" : formatTime(log.clock_out)}
                    </p>
                    {log.break_minutes > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">{log.break_minutes}m break</p>
                    )}
                  </div>
                  <div className="text-right">
                    {log.is_open ? (
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Active</span>
                    ) : (
                      <p className={`text-lg font-black ${log.total_hours > 8 ? "text-red-600" : "text-gray-900"}`}>
                        {log.total_hours?.toFixed(1)}h
                      </p>
                    )}
                    {log.notes && <p className="text-xs text-gray-400 mt-1 italic">{log.notes}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
