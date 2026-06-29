import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmDialog from "../../components/ConfirmDialog";
import Link from "next/link";

// Backend stores English category IDs; display labels via i18n.
const CATEGORIES = ["Proteins", "Vegetables", "Dairy", "Grains", "Spices", "Fruits", "Condiments", "Other"];
const CATEGORY_KEY = {
  Proteins: "pantryPage.catProteins", Vegetables: "pantryPage.catVegetables",
  Dairy: "pantryPage.catDairy", Grains: "pantryPage.catGrains",
  Spices: "pantryPage.catSpices", Fruits: "pantryPage.catFruits",
  Condiments: "pantryPage.catCondiments", Other: "pantryPage.catOther",
};
const CATEGORY_EMOJI = {
  Proteins: "🥩", Vegetables: "🥦", Dairy: "🧀", Grains: "🌾",
  Spices: "🌶️", Fruits: "🍎", Condiments: "🫙", Other: "📦",
};
const DIFF_KEY = { Easy: "pantryPage.diffEasy", Medium: "pantryPage.diffMedium", Hard: "pantryPage.diffHard" };

const QUICK_ADD = [
  { id: "Chicken breast", labelKey: "pantryPage.qaChickenBreast" },
  { id: "Pasta",          labelKey: "pantryPage.qaPasta" },
  { id: "Eggs",           labelKey: "pantryPage.qaEggs" },
  { id: "Garlic",         labelKey: "pantryPage.qaGarlic" },
  { id: "Onion",          labelKey: "pantryPage.qaOnion" },
  { id: "Tomatoes",       labelKey: "pantryPage.qaTomatoes" },
  { id: "Butter",         labelKey: "pantryPage.qaButter" },
  { id: "Olive oil",      labelKey: "pantryPage.qaOliveOil" },
  { id: "Parmesan",       labelKey: "pantryPage.qaParmesan" },
  { id: "Lemon",          labelKey: "pantryPage.qaLemon" },
  { id: "Rice",           labelKey: "pantryPage.qaRice" },
  { id: "Potatoes",       labelKey: "pantryPage.qaPotatoes" },
];

export default function PantryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [matchedIngredients, setMatchedIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [ingredient, setIngredient] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("Other");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getPantry();
      setItems(data);
      if (data.length > 0) loadRecipes();
    } catch (e) { setError(e.message || t("pantryPage.errLoadPantry")); }
    finally { setLoading(false); }
  };

  const loadRecipes = async () => {
    setRecipeLoading(true);
    try {
      const data = await api.getPantryRecipes();
      setRecipes(data.recipes || []);
      setMatchedIngredients(data.matched_ingredients || []);
    } catch (e) { setError(e.message || t("pantryPage.errLoadRecipes")); }
    finally { setRecipeLoading(false); }
  };

  const addItem = async (ing = ingredient, qty = quantity, cat = category) => {
    if (!ing.trim()) { setError(t("pantryPage.errEnterName")); return; }
    setAdding(true); setError("");
    try {
      const item = await api.addPantryItem({ ingredient: ing.trim(), quantity: qty || null, category: cat });
      setItems((prev) => [item, ...prev]);
      setIngredient(""); setQuantity(""); setCategory("Other");
      loadRecipes();
    } catch (e) { setError(e.message); }
    finally { setAdding(false); }
  };

  const removeItem = async (id) => {
    try {
      await api.deletePantryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      loadRecipes();
    } catch (e) { setError(e.message || t("pantryPage.errRemove")); }
  };

  const clearAll = () => {
    setConfirmDialog({
      message: t("pantryPage.clearConfirm"),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.clearPantry();
          setItems([]); setRecipes([]); setMatchedIngredients([]);
        } catch (e) { setError(e.message || t("pantryPage.errClear")); }
      },
    });
  };

  const grouped = items.reduce((acc, item) => {
    const key = item.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  if (loading) return <LoadingSpinner />;

  const matchedLine = matchedIngredients.length > 4
    ? t("pantryPage.matchedOnExtra", { ingredients: matchedIngredients.slice(0, 4).join(", "), extra: matchedIngredients.length - 4 })
    : matchedIngredients.slice(0, 4).join(", ");

  return (
    <div>
      {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("pantryPage.title")}</h1>
          <p className="text-gray-400 mt-1">
            {items.length === 0
              ? t("pantryPage.subtitleEmpty")
              : t("pantryPage.subtitleCount", { count: items.length })}
          </p>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll}
            className="text-xs text-red-400 hover:text-red-600 font-medium border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
            {t("pantryPage.clearAll")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: add + pantry list */}
        <div className="lg:col-span-1 space-y-6">

          <div className="bg-white rounded-2xl border border-consumer-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">{t("pantryPage.addHeader")}</h2>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
            <div className="space-y-3">
              <input
                value={ingredient} onChange={(e) => { setIngredient(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                placeholder={t("pantryPage.ingredientPh")}
                className="w-full border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
              />
              <div className="flex gap-2">
                <input
                  value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  placeholder={t("pantryPage.qtyPh")}
                  className="flex-1 border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400"
                />
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 border border-consumer-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-consumer-400">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(CATEGORY_KEY[c])}</option>)}
                </select>
              </div>
              <button onClick={() => addItem()} disabled={adding}
                className="w-full bg-consumer-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-consumer-700 disabled:opacity-60 transition-colors">
                {adding ? t("pantryPage.adding") : t("pantryPage.addBtn")}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-consumer-100">
              <p className="text-xs font-semibold text-gray-400 mb-2">{t("pantryPage.quickAdd")}</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ADD
                  .filter((q) => !items.some((i) => i.ingredient.toLowerCase() === q.id.toLowerCase()))
                  .slice(0, 8)
                  .map((q) => (
                    <button key={q.id} onClick={() => addItem(q.id, "", "Other")}
                      className="text-xs px-2.5 py-1 rounded-full border border-consumer-200 text-consumer-600 hover:bg-consumer-50 hover:border-consumer-400 transition-all">
                      + {t(q.labelKey)}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="bg-white rounded-2xl border border-consumer-100 overflow-hidden">
              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="px-4 py-2 bg-consumer-50 border-b border-consumer-100">
                    <p className="text-xs font-bold text-consumer-700">
                      {CATEGORY_EMOJI[cat] || "📦"} {t(CATEGORY_KEY[cat] || "pantryPage.catOther")}
                    </p>
                  </div>
                  {catItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.ingredient}</p>
                        {item.quantity && <p className="text-xs text-gray-400">{item.quantity}</p>}
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-lg leading-none transition-all">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-consumer-50 rounded-2xl border border-consumer-100 p-6 text-center">
              <p className="text-3xl mb-2">🧺</p>
              <p className="text-sm text-gray-500">{t("pantryPage.emptyPantryHint")}</p>
            </div>
          )}
        </div>

        {/* Right: matched recipes */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              {items.length === 0 ? t("pantryPage.recipesHeader") : t("pantryPage.recipesHeaderActive")}
            </h2>
            {matchedIngredients.length > 0 && (
              <p className="text-xs text-gray-400">
                {t("pantryPage.matchedOn", { ingredients: matchedLine })}
              </p>
            )}
          </div>

          {recipeLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner /></div>
          ) : selectedRecipe ? (
            <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />
          ) : recipes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-consumer-100 p-10 text-center">
              <p className="text-4xl mb-3">👨‍🍳</p>
              <p className="text-sm text-gray-500 mb-4">
                {items.length === 0 ? t("pantryPage.noRecipesEmptyPantry") : t("pantryPage.noRecipesWithPantry")}
              </p>
              <Link href="/consumer/explore"
                className="inline-flex bg-consumer-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
                {t("pantryPage.browseAll")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipes.map((r) => (
                <button key={r.id} onClick={() => setSelectedRecipe(r)}
                  className="text-left bg-white rounded-2xl border border-consumer-100 hover:border-consumer-400 hover:shadow-md transition-all p-5 group">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0">{r.image_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm group-hover:text-consumer-700 mb-1">{r.title}</p>
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{r.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs bg-consumer-100 text-consumer-700 px-2 py-0.5 rounded-full">{r.cuisine}</span>
                        <span className="text-xs text-gray-400">⏱️ {r.time_minutes}m</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.difficulty === "Easy" ? "bg-green-100 text-green-700"
                          : r.difficulty === "Medium" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"}`}>
                          {DIFF_KEY[r.difficulty] ? t(DIFF_KEY[r.difficulty]) : r.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecipeDetail({ recipe: r, onBack }) {
  const { t } = useTranslation();
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps : [];
  const diffLabel = DIFF_KEY[r.difficulty] ? t(DIFF_KEY[r.difficulty]) : r.difficulty;

  return (
    <div className="bg-white rounded-3xl border border-consumer-200 p-6">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-consumer-600 font-semibold hover:text-consumer-800 mb-5">
        {t("pantryPage.backToRecipes")}
      </button>
      <div className="flex items-start gap-4 mb-6">
        <span className="text-5xl">{r.image_emoji}</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{r.title}</h2>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{r.description}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-sm bg-consumer-100 text-consumer-700 px-3 py-1 rounded-full font-medium">{r.cuisine}</span>
            <span className="text-sm text-gray-500">⏱️ {r.time_minutes} min</span>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              r.difficulty === "Easy" ? "bg-green-100 text-green-700"
              : r.difficulty === "Medium" ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"}`}>
              {diffLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ingredients.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">{t("pantryPage.ingredients")}</h3>
            <ul className="space-y-1.5">
              {ingredients.map((ing, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-consumer-400 flex-shrink-0" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}
        {steps.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">{t("pantryPage.steps")}</h3>
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-consumer-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <div className="mt-6 pt-5 border-t border-consumer-100 flex gap-3 flex-wrap">
        {r.id && (
          <Link href={`/consumer/guided-cooking?id=${r.id}`}
            className="bg-consumer-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-consumer-700 transition-colors">
            {t("pantryPage.startCooking")}
          </Link>
        )}
        <Link href="/consumer/wine"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          {t("pantryPage.pairWine")}
        </Link>
        <Link href="/consumer/music"
          className="border border-consumer-200 text-consumer-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-consumer-50 transition-colors">
          {t("pantryPage.setMood")}
        </Link>
      </div>
    </div>
  );
}
