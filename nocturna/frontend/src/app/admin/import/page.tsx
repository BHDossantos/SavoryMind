'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface RowResult {
  row: number;
  slug: string;
  name: string;
  action: 'create' | 'update' | 'unchanged' | 'error';
  errors?: string[];
  changes?: Record<string, { from: any; to: any }>;
}
interface ImportSummary {
  dry_run: boolean;
  counts: { created: number; updated: number; errors: number; unchanged: number };
  results: RowResult[];
}

export default function VenueImport() {
  const [tpl, setTpl] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [committed, setCommitted] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/api/admin/import/template').then(setTpl).catch(() => {});
  }, []);

  function buildForm(dryRun: boolean) {
    const f = new FormData();
    if (file) f.append('file', file);
    else if (text.trim()) f.append('raw', text);
    f.append('dry_run', String(dryRun));
    return f;
  }

  async function run(dryRun: boolean) {
    setBusy(true); setErr(null);
    try {
      const r = await api.upload<ImportSummary>('/api/admin/import/venues', buildForm(dryRun));
      if (dryRun) { setPreview(r); setCommitted(null); }
      else { setCommitted(r); setPreview(null); }
    } catch (e: any) {
      setErr(e?.message || 'Import failed');
    } finally { setBusy(false); }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setErr(null);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setText(''); }
  }

  const summary = committed || preview;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Import venues</h1>
        <Link href="/admin/venues" className="btn btn-ghost">← Back to venues</Link>
      </div>

      <p className="text-gold-400/70 text-sm">
        Upload a CSV or JSON file. Existing venues match by <code>slug</code> and are updated in place.
      </p>

      <div
        ref={dropRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="border-2 border-dashed border-gold-500/30 rounded-2xl p-8 text-center hover:border-gold-500/60 transition"
      >
        <input
          type="file" accept=".csv,.json,text/csv,application/json"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setText(''); }}
          className="hidden" id="vfile"
        />
        <label htmlFor="vfile" className="btn btn-primary cursor-pointer">Choose file</label>
        <p className="mt-2 text-xs text-gold-400/60">…or drop a CSV / JSON file here</p>
        {file && <p className="mt-3 text-gold-400">📎 {file.name} ({Math.round(file.size / 1024)} KB)</p>}
      </div>

      <details className="card">
        <summary className="cursor-pointer text-gold-400">Or paste raw CSV / JSON</summary>
        <textarea
          rows={6} value={text}
          onChange={(e) => { setText(e.target.value); setFile(null); }}
          placeholder="slug,name,type,address,lat,lng,neighborhood,…"
          className="w-full mt-3 bg-night-900 border border-white/10 rounded-lg px-3 py-2 font-mono text-xs"
        />
      </details>

      <div className="flex gap-3">
        <button onClick={() => run(true)} disabled={busy || (!file && !text.trim())} className="btn btn-secondary disabled:opacity-30">
          {busy && preview === null ? 'Previewing…' : 'Preview (dry-run)'}
        </button>
        <button onClick={() => run(false)} disabled={busy || !preview || preview.counts.errors > 0} className="btn btn-primary disabled:opacity-30">
          {busy && committed === null ? 'Importing…' : 'Commit import'}
        </button>
        {tpl && (
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(tpl.csv_header)}`}
            download="nocturna-venues-template.csv"
            className="btn btn-ghost"
          >Download template</a>
        )}
      </div>

      {err && <p className="text-accent-500 text-sm">{err}</p>}

      {summary && (
        <section className="card space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="font-display text-2xl">
              {summary.dry_run ? 'Preview' : '✔ Imported'}
            </h2>
            <div className="flex gap-2 text-xs">
              <Stat label="Create" value={summary.counts.created} tone="positive" />
              <Stat label="Update" value={summary.counts.updated} tone="positive" />
              <Stat label="Unchanged" value={summary.counts.unchanged} />
              <Stat label="Errors" value={summary.counts.errors} tone={summary.counts.errors ? 'negative' : 'neutral'} />
            </div>
          </header>

          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-gold-400/60">
              <th className="py-1">#</th><th>Action</th><th>Slug</th><th>Name</th><th>Detail</th>
            </tr></thead>
            <tbody>
              {summary.results.slice(0, 200).map(r => (
                <tr key={r.row} className="border-t border-white/5 align-top">
                  <td className="py-1">{r.row}</td>
                  <td><Badge action={r.action} /></td>
                  <td className="font-mono text-xs">{r.slug || '—'}</td>
                  <td>{r.name || '—'}</td>
                  <td className="text-xs text-gold-400/70">
                    {r.action === 'error' && r.errors?.join('; ')}
                    {r.action === 'update' && r.changes && (
                      <details>
                        <summary className="cursor-pointer">{Object.keys(r.changes).length} field(s) changed</summary>
                        <ul className="mt-1 space-y-0.5">
                          {Object.entries(r.changes).map(([k, v]) => (
                            <li key={k}><code className="text-gold-400">{k}</code>:
                              {' '}<span className="text-accent-500/80">{JSON.stringify(v.from)}</span> →
                              {' '}<span className="text-gold-400">{JSON.stringify(v.to)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.results.length > 200 && (
            <p className="text-xs text-gold-400/60">Showing first 200 of {summary.results.length} rows.</p>
          )}
        </section>
      )}

      {tpl && (
        <details className="card">
          <summary className="cursor-pointer text-gold-400">CSV column reference</summary>
          <table className="mt-3 w-full text-xs">
            <thead><tr className="text-left text-gold-400/60"><th>Column</th><th>Required</th><th>Notes</th></tr></thead>
            <tbody>
              {tpl.columns.map((c: any) => (
                <tr key={c.name} className="border-t border-white/5">
                  <td className="font-mono py-1">{c.name}</td>
                  <td>{c.required ? '✓' : ''}</td>
                  <td className="text-gold-400/70">{c.help || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gold-400/60 mt-2">{tpl.notes.join(' · ')}</p>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'positive' | 'negative' | 'neutral' }) {
  const color = tone === 'positive' ? 'text-gold-400' : tone === 'negative' ? 'text-accent-500' : 'text-gold-400/60';
  return <div className="px-2"><div className="label">{label}</div><div className={`font-display text-xl ${color}`}>{value}</div></div>;
}

function Badge({ action }: { action: RowResult['action'] }) {
  const map: Record<string, string> = {
    create: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    update: 'bg-accent-500/10 text-accent-500 border-accent-500/30',
    unchanged: 'bg-night-700/40 text-gold-400/40 border-white/5',
    error: 'bg-red-900/30 text-red-300 border-red-700/40',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[action]}`}>{action}</span>;
}
