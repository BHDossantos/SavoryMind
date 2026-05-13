import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

// Phase 8 — browseable catalog of every wine / beer / spirit Flavor
// can pair from. Three-tab layout (Wine | Beer | Spirits), each with
// inline filters. Catalog is fetched whole on mount + filtered
// client-side so flipping filters is instant.
//
// "Ask Flavor about this →" link on each card routes to the assistant
// chat with a pre-seeded question — same agent that runs the pairing
// engine, just entered via this surface.

const TABS = [
  { id: "wine",    label: "Wine",    icon: "🍷" },
  { id: "beer",    label: "Beer",    icon: "🍺" },
  { id: "spirits", label: "Spirits", icon: "🥃" },
];

function uniqueValues(items, key) {
  // Returns sorted unique values for a field — used to populate filter
  // dropdowns dynamically based on whatever the catalog actually
  // contains, so adding wines for a new region doesn't need code change.
  const set = new Set();
  for (const it of items) {
    const v = it[key];
    if (Array.isArray(v)) v.forEach((x) => x && set.add(x));
    else if (v) set.add(v);
  }
  return Array.from(set).sort();
}

function ChipRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onChange("")}
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
          value === "" ? "bg-consumer-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}>
        All
      </button>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            value === o ? "bg-consumer-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function WineCard({ w }) {
  return (
    <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-bold text-gray-900">{w.name}</h3>
        <span className="text-xs text-consumer-700 bg-consumer-50 rounded-full px-2.5 py-0.5 font-semibold flex-shrink-0">
          {w.style}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-3">{w.flavor_profile}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(w.regions || []).map((r) => (
          <span key={r} className="text-[10px] text-gray-600 bg-gray-50 rounded px-2 py-0.5">{r}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mb-3">
        <span>💰 {w.price_range}</span>
        <span>🌡️ {w.serving_temp}</span>
        {w.decant && <span>🍷 Decant {w.decant_time || "30 min"}</span>}
      </div>
      <Link href={`/consumer/assistant?q=${encodeURIComponent(`Tell me about ${w.name} and what to pair with it.`)}`}
        className="text-xs font-semibold text-consumer-700 hover:text-consumer-800">
        Ask Flavor about this →
      </Link>
    </div>
  );
}

function BeerCard({ b }) {
  return (
    <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-bold text-gray-900">{b.name}</h3>
        <span className="text-xs text-consumer-700 bg-consumer-50 rounded-full px-2.5 py-0.5 font-semibold flex-shrink-0">
          {b.style}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-2">{b.flavour}</p>
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mb-3">
        <span>🍺 {b.brewery}</span>
        <span>{b.abv}% ABV</span>
        <span>🌡️ {b.serve}</span>
      </div>
      <Link href={`/consumer/assistant?q=${encodeURIComponent(`What food pairs with a ${b.name} (${b.style})?`)}`}
        className="text-xs font-semibold text-consumer-700 hover:text-consumer-800">
        Ask Flavor about this →
      </Link>
    </div>
  );
}

function SpiritCard({ s }) {
  return (
    <div className="bg-white rounded-2xl border border-consumer-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
        <span className="text-xs text-consumer-700 bg-consumer-50 rounded-full px-2.5 py-0.5 font-semibold flex-shrink-0">
          {s.spirit}
        </span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-2">{s.flavour}</p>
      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mb-3">
        <span>📍 {s.region}</span>
        <span>{s.abv}% ABV</span>
        <span>🥃 {s.serve}</span>
      </div>
      <Link href={`/consumer/assistant?q=${encodeURIComponent(`What food pairs with ${s.name}?`)}`}
        className="text-xs font-semibold text-consumer-700 hover:text-consumer-800">
        Ask Flavor about this →
      </Link>
    </div>
  );
}

export default function CellarPage() {
  const [tab, setTab] = useState("wine");
  const [wines, setWines]     = useState([]);
  const [beers, setBeers]     = useState([]);
  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filterStyle, setFilterStyle]   = useState("");
  const [filterRegion, setFilterRegion] = useState("");

  useEffect(() => {
    Promise.all([api.getWineCatalog(), api.getBeerCatalog(), api.getSpiritsCatalog()])
      .then(([w, b, s]) => {
        setWines(w.wines || []);
        setBeers(b.beers || []);
        setSpirits(s.spirits || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reset filters when switching tabs so a filter that's valid for
  // wine ("Burgundy") doesn't haunt the beer view as a no-results state.
  const switchTab = (id) => {
    setTab(id);
    setFilterStyle("");
    setFilterRegion("");
  };

  const items = tab === "wine" ? wines : tab === "beer" ? beers : spirits;
  const styleOptions  = useMemo(() => uniqueValues(items, tab === "spirits" ? "spirit" : "style"), [items, tab]);
  const regionOptions = useMemo(() => uniqueValues(items, tab === "wine" ? "regions" : "region"), [items, tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      // Free-text search across the cheap-to-stringify fields.
      if (q) {
        const haystack = JSON.stringify(it).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterStyle) {
        const v = it.style || it.spirit;
        if (v !== filterStyle) return false;
      }
      if (filterRegion) {
        const regs = Array.isArray(it.regions) ? it.regions : [it.region];
        if (!regs.some((r) => r === filterRegion)) return false;
      }
      return true;
    });
  }, [items, search, filterStyle, filterRegion]);

  if (loading) return <LoadingSpinner message="Loading the cellar…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Cellar</h1>
        <p className="text-gray-400 mt-1">Every wine, beer, and spirit Flavor can pair from.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-consumer-50 rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              tab === t.id ? "bg-white text-consumer-700 shadow-sm" : "text-gray-500 hover:text-consumer-600"
            }`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab}s…`}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400" />

        {styleOptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Style</p>
            <ChipRow options={styleOptions} value={filterStyle} onChange={setFilterStyle} />
          </div>
        )}

        {regionOptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Region</p>
            <ChipRow options={regionOptions.slice(0, 30)} value={filterRegion} onChange={setFilterRegion} />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">{filtered.length} of {items.length} {tab}s</p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-consumer-100">
          <p className="text-3xl mb-2">🔎</p>
          <p className="text-sm text-gray-500">Nothing matches these filters yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it, i) => (
            tab === "wine"
              ? <WineCard key={it.slug || i} w={it} />
              : tab === "beer"
                ? <BeerCard key={it.name || i} b={it} />
                : <SpiritCard key={it.name || i} s={it} />
          ))}
        </div>
      )}
    </div>
  );
}
