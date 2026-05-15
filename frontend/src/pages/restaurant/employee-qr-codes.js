import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { api } from "../../services/api";

// Frontend URL the printed QR resolves to. The diner scans, lands on this
// page (no auth wall), the page hands them off to the mobile deep link or
// shows the survey inline. Reads NEXT_PUBLIC_APP_URL so dev / staging /
// prod all point at their own host; the window.location fallback keeps it
// working in environments where the env var isn't set.
function surveyUrlFor(token) {
  if (typeof window === "undefined") return `/scan/${token}`;
  const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${origin}/scan/${token}`;
}


function QRImage({ token, size = 220 }) {
  const ref = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(surveyUrlFor(token), {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token, size]);

  if (!dataUrl) {
    return <div ref={ref} style={{ width: size, height: size }} className="bg-gray-100 rounded animate-pulse" />;
  }
  return <img ref={ref} src={dataUrl} alt="QR code" width={size} height={size} className="rounded" />;
}


function ResultsModal({ employee, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getEmployeeSurveyResults(employee.id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [employee.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Survey Results — {employee.display_name}</h2>
            <p className="text-sm text-gray-500">Anonymous diner feedback from QR scans</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-brand-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-brand-700">{data.stats.total_responses}</p>
                <p className="text-xs text-gray-600 mt-0.5">Total responses</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{data.stats.unique_devices}</p>
                <p className="text-xs text-gray-600 mt-0.5">Unique diners</p>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-2">Ratings</h3>
            <div className="space-y-2 mb-5">
              {data.survey.questions.filter((q) => q.type === "rating_5").map((q) => {
                const r = data.stats.ratings[q.id];
                return (
                  <div key={q.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700">{q.prompt}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {r?.average != null ? `${r.average.toFixed(1)} ★` : "—"}
                      <span className="text-xs text-gray-400 ml-1">({r?.count || 0})</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-2">Would Return</h3>
            <div className="mb-5">
              {data.survey.questions.filter((q) => q.type === "yes_no").map((q) => {
                const b = data.stats.booleans[q.id];
                return (
                  <div key={q.id} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{q.prompt}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {b?.yes_percent != null ? `${b.yes_percent}% yes` : "—"}
                      <span className="text-xs text-gray-400 ml-1">({(b?.yes_count || 0) + (b?.no_count || 0)})</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Comments</h3>
            {data.stats.comments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No comments yet.</p>
            ) : (
              <div className="space-y-2">
                {data.stats.comments.map((c, i) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-gray-700">
                    "{c.text}"
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


export default function EmployeeQRCodes() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultsFor, setResultsFor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployeeQRCodes();
      setEmployees(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔳 Employee QR Codes</h1>
          <p className="text-gray-400 mt-1 text-sm">Print these for each employee — diners scan to leave anonymous feedback</p>
        </div>
        <button
          onClick={handlePrint}
          disabled={!employees.length}
          className="bg-brand-500 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          🖨️ Print All
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 print:hidden">{error}</div>}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex gap-3 print:hidden">
        <span className="text-xl mt-0.5">💡</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">How employee QR codes work</p>
          <p className="text-sm text-blue-600 mt-0.5">
            Each employee has a unique QR. When a diner scans it (no app needed — phone camera works), they get a short
            anonymous survey that ties to that employee. Results are aggregated below. Add new employees on the{" "}
            <a href="/restaurant/employees" className="underline">Employee Logins</a> page — they get a QR automatically.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">🔳</p>
          <p className="text-gray-500 font-medium">No employees yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Add employees on the <a href="/restaurant/employees" className="text-brand-600 underline">Employee Logins</a> page first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-2 print:gap-3">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm print:break-inside-avoid print:border-gray-300 print:shadow-none">
              <div className="text-center">
                <p className="font-semibold text-gray-900">{emp.display_name}</p>
                <p className="text-xs text-gray-500 mb-3">{emp.email}</p>
                <div className="flex justify-center mb-3">
                  <QRImage token={emp.qr_token} size={220} />
                </div>
                <p className="text-xs text-gray-400 break-all">Scan to leave anonymous feedback</p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-50 print:hidden">
                <button
                  onClick={() => setResultsFor(emp)}
                  className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-sm transition-colors"
                >
                  View results
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resultsFor && <ResultsModal employee={resultsFor} onClose={() => setResultsFor(null)} />}
    </div>
  );
}
