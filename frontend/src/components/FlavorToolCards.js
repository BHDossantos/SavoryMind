import Link from "next/link";

// Phase 12 — inline tool-result cards in the Flavor chat.
//
// When Flavor calls a data tool (search_wines, get_wine_pairing,
// search_recipes, suggest_tonight, build_shopping_list, …) the
// structured result rides back in tool_calls[].result. This component
// turns the renderable ones into real cards under the message bubble,
// so the chat shows the actual wines / recipes / shopping list — not
// just the "✓ Flavor checked the wine catalog" ghost line.
//
// Tools without a card renderer (action tools, memory tools) fall
// through silently — the ghost line still covers them.

function WineCard({ w }) {
  return (
    <div className="flex-shrink-0 w-52 bg-white border border-consumer-100 rounded-xl p-3 shadow-sm">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-bold text-gray-900 leading-tight">{w.name}</p>
        {w.confidence != null && (
          <span className="text-[10px] font-bold text-consumer-700 bg-consumer-50 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {Math.round(w.confidence * 100)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-consumer-600 mt-0.5">{w.style}</p>
      {w.flavor_profile && (
        <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">{w.flavor_profile}</p>
      )}
      {w.rationale && (
        <p className="text-[11px] text-gray-600 mt-1 leading-snug line-clamp-3 italic">{w.rationale}</p>
      )}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[10px] text-gray-400">
        {w.price_range && <span>💰 {w.price_range}</span>}
        {w.serving_temp && <span>🌡 {w.serving_temp}</span>}
      </div>
    </div>
  );
}

function BeerCard({ b }) {
  return (
    <div className="flex-shrink-0 w-52 bg-white border border-consumer-100 rounded-xl p-3 shadow-sm">
      <p className="text-sm font-bold text-gray-900 leading-tight">{b.name}</p>
      <p className="text-[11px] text-consumer-600 mt-0.5">{b.style}{b.abv ? ` · ${b.abv}% ABV` : ""}</p>
      {b.flavour && <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">{b.flavour}</p>}
      {b.serve && <p className="text-[10px] text-gray-400 mt-1.5">🍺 {b.serve}</p>}
    </div>
  );
}

function SpiritCard({ s }) {
  return (
    <div className="flex-shrink-0 w-52 bg-white border border-consumer-100 rounded-xl p-3 shadow-sm">
      <p className="text-sm font-bold text-gray-900 leading-tight">{s.name}</p>
      <p className="text-[11px] text-consumer-600 mt-0.5">{s.spirit}{s.region ? ` · ${s.region}` : ""}</p>
      {s.flavour && <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">{s.flavour}</p>}
      {s.serve && <p className="text-[10px] text-gray-400 mt-1.5">🥃 {s.serve}</p>}
    </div>
  );
}

function RecipeCard({ r }) {
  // Recipes with an id deep-link into the guided-cooking flow; ones
  // without (rare — only AI-sketched recipes) just render flat.
  const inner = (
    <div className="flex-shrink-0 w-52 bg-white border border-consumer-100 rounded-xl p-3 shadow-sm hover:border-consumer-300 transition-colors">
      <div className="text-2xl">{r.image_emoji || "🍽️"}</div>
      <p className="text-sm font-bold text-gray-900 mt-1 leading-tight line-clamp-1">{r.title}</p>
      {r.description && (
        <p className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-2">{r.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        {r.cuisine && (
          <span className="text-[10px] bg-consumer-100 text-consumer-700 px-1.5 py-0.5 rounded-full">{r.cuisine}</span>
        )}
        {r.time_minutes != null && <span className="text-[10px] text-gray-400">⏱ {r.time_minutes}m</span>}
        {r.difficulty && <span className="text-[10px] text-gray-400">{r.difficulty}</span>}
      </div>
    </div>
  );
  return r.id ? (
    <Link href={`/consumer/guided-cooking?id=${r.id}`} className="flex-shrink-0">{inner}</Link>
  ) : inner;
}

function CardRow({ children }) {
  return <div className="flex gap-2 overflow-x-auto pb-1 mt-2">{children}</div>;
}

function ShoppingList({ result }) {
  const { recipe, need_to_buy = [], already_have = [] } = result;
  return (
    <div className="mt-2 bg-white border border-consumer-100 rounded-xl p-3 shadow-sm">
      <p className="text-xs font-bold text-gray-900 mb-1.5">🛒 Shopping list — {recipe}</p>
      {need_to_buy.length > 0 ? (
        <ul className="space-y-0.5">
          {need_to_buy.map((item, i) => (
            <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
              <span className="text-consumer-400 mt-px">▢</span>{item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-green-600">You've got everything already 🎉</p>
      )}
      {already_have.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-1.5">
          Already in your pantry: {already_have.length} item{already_have.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

/**
 * Render every renderable tool call attached to an assistant message.
 * Returns null when nothing in the batch has a card renderer (so the
 * caller can keep relying on the ghost line alone).
 */
export default function FlavorToolCards({ toolCalls }) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const blocks = [];

  toolCalls.forEach((tc, idx) => {
    const r = tc.result;
    if (!r || typeof r !== "object" || r.error) return;

    switch (tc.name) {
      case "search_wines":
        if (r.wines?.length) {
          blocks.push(<CardRow key={idx}>{r.wines.slice(0, 8).map((w, i) => <WineCard key={i} w={w} />)}</CardRow>);
        }
        break;
      case "get_wine_pairing":
        if (r.pairings?.length) {
          blocks.push(<CardRow key={idx}>{r.pairings.map((w, i) => <WineCard key={i} w={w} />)}</CardRow>);
        }
        break;
      case "search_beers":
        if (r.beers?.length) {
          blocks.push(<CardRow key={idx}>{r.beers.slice(0, 8).map((b, i) => <BeerCard key={i} b={b} />)}</CardRow>);
        }
        break;
      case "get_beer_pairing":
        if (r.pairings?.length) {
          blocks.push(<CardRow key={idx}>{r.pairings.map((b, i) => <BeerCard key={i} b={b} />)}</CardRow>);
        }
        break;
      case "search_spirits":
        if (r.spirits?.length) {
          blocks.push(<CardRow key={idx}>{r.spirits.slice(0, 8).map((s, i) => <SpiritCard key={i} s={s} />)}</CardRow>);
        }
        break;
      case "get_spirits_pairing":
        if (r.pairings?.length) {
          blocks.push(<CardRow key={idx}>{r.pairings.map((s, i) => <SpiritCard key={i} s={s} />)}</CardRow>);
        }
        break;
      case "search_recipes":
        if (r.recipes?.length) {
          blocks.push(<CardRow key={idx}>{r.recipes.slice(0, 8).map((rec, i) => <RecipeCard key={i} r={rec} />)}</CardRow>);
        }
        break;
      case "get_recipe":
        if (r.id) blocks.push(<CardRow key={idx}><RecipeCard r={r} /></CardRow>);
        break;
      case "suggest_tonight": {
        const recs = [r.top_pick, ...(r.runners_up || [])].filter(Boolean);
        if (recs.length) {
          blocks.push(<CardRow key={idx}>{recs.map((rec, i) => <RecipeCard key={i} r={rec} />)}</CardRow>);
        }
        break;
      }
      case "build_shopping_list":
        blocks.push(<ShoppingList key={idx} result={r} />);
        break;
      default:
        break; // action / memory tools — ghost line covers them
    }
  });

  return blocks.length > 0 ? <div>{blocks}</div> : null;
}
