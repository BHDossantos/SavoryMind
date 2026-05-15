import { useState, useEffect } from "react";
import { useRouter } from "next/router";

// Public, no-auth survey landing page. A diner scans an employee's printed
// QR code with their phone camera and arrives here. We give them a fixed,
// global survey tied to that employee + the restaurant; submissions are
// anonymous, identified only by a device_id we keep in localStorage so
// repeat submissions look distinct from a fresh diner.

const DEVICE_KEY = "sm_scan_device_id";

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return null;
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    // crypto.randomUUID exists on every browser ≥ 2022; fall back to a
    // timestamp-based id on the off chance it doesn't (older WebViews
    // embedded in social apps mostly).
    id = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// The same base-URL resolution logic as services/api.js, narrowed for
// our public surface — no auth headers, no refresh dance.
function getApiBase() {
  if (typeof window === "undefined") return "/backend";
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? "/backend" : (process.env.NEXT_PUBLIC_API_URL || "https://api.savorymind.net");
}

async function fetchSurvey(token) {
  const res = await fetch(`${getApiBase()}/api/employee-survey/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function submitSurvey(token, body) {
  const res = await fetch(`${getApiBase()}/api/employee-survey/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return res.json();
}


function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={
            "w-12 h-12 rounded-xl text-2xl border-2 transition-colors " +
            (value === n
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-gray-200 text-gray-300 hover:border-gray-300")
          }
          aria-label={`Rate ${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}


function YesNoPicker({ value, onChange }) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={
          "flex-1 py-3 rounded-xl font-semibold border-2 transition-colors " +
          (value === true
            ? "border-brand-500 bg-brand-50 text-brand-700"
            : "border-gray-200 text-gray-500 hover:border-gray-300")
        }
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={
          "flex-1 py-3 rounded-xl font-semibold border-2 transition-colors " +
          (value === false
            ? "border-brand-500 bg-brand-50 text-brand-700"
            : "border-gray-200 text-gray-500 hover:border-gray-300")
        }
      >
        No
      </button>
    </div>
  );
}


export default function ScanSurvey() {
  const router = useRouter();
  const { token } = router.query;
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedId, setSubmittedId] = useState(null);

  useEffect(() => {
    if (!router.isReady || !token) return;
    fetchSurvey(token)
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((e) => setState({ status: "error", data: null, error: e.message }));
  }, [router.isReady, token]);

  const updateAnswer = (qid, value) => setAnswers((a) => ({ ...a, [qid]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const required = state.data.survey.questions.filter((q) => q.required);
    for (const q of required) {
      if (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === "") {
        setSubmitError(`Please answer: ${q.prompt}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const device_id = getOrCreateDeviceId();
      const out = await submitSurvey(token, { device_id, answers });
      setSubmittedId(out.id);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">
          <p className="text-4xl mb-3">🤔</p>
          <h1 className="text-lg font-bold text-gray-900 mb-1">This QR isn't valid</h1>
          <p className="text-sm text-gray-500">{state.error}</p>
        </div>
      </div>
    );
  }

  if (submittedId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">
          <p className="text-5xl mb-3">🙏</p>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Thanks for the feedback!</h1>
          <p className="text-sm text-gray-500">It's been sent to {state.data.restaurant.restaurant_name || state.data.restaurant.display_name}.</p>
        </div>
      </div>
    );
  }

  const { employee, restaurant, survey } = state.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white p-4 pb-12">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">🍽️</p>
          <h1 className="text-xl font-bold text-gray-900">{restaurant.restaurant_name || restaurant.display_name}</h1>
          <p className="text-sm text-gray-500 mt-1">How was your time with <strong className="text-gray-700">{employee.display_name}</strong>?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {survey.questions.map((q) => (
            <div key={q.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <label className="block text-sm font-semibold text-gray-800 mb-3">
                {q.prompt}
                {q.required && <span className="text-brand-500 ml-1">*</span>}
              </label>
              {q.type === "rating_5" && (
                <StarPicker value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} />
              )}
              {q.type === "yes_no" && (
                <YesNoPicker value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} />
              )}
              {q.type === "text" && (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  placeholder="Optional..."
                  rows={3}
                  maxLength={2000}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              )}
            </div>
          ))}

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{submitError}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-500 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send feedback"}
          </button>

          <p className="text-xs text-gray-400 text-center px-4">
            Your responses are anonymous. No account needed.
          </p>
        </form>
      </div>
    </div>
  );
}
