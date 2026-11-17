import { useState } from "react";
import { useTranslation } from "react-i18next";

// Empty inputs are unknown, never a free ingredient or a zero-price dish.
export function marginPreview(priceInput, costInput, targetInput) {
  const number = (value) => String(value ?? "").trim() === "" ? NaN : Number(value);
  const price = number(priceInput), cost = number(costInput), target = number(targetInput);
  const validCost = Number.isFinite(cost) && cost >= 0;
  const validPrice = Number.isFinite(price) && price > 0;
  const contribution = price - cost;
  const foodCost = cost / price * 100;
  const targetPrice = cost / (target / 100);
  return {
    contribution: validCost && validPrice && Number.isFinite(contribution) ? contribution : null,
    foodCost: validCost && validPrice && Number.isFinite(foodCost) ? foodCost : null,
    targetPrice: validCost && cost > 0 && target > 0 && target < 100 && Number.isFinite(targetPrice) ? Math.ceil(Number(targetPrice.toFixed(8)) * 100) / 100 : null,
  };
}

export default function MenuMarginPreview({ price, cost, onUsePrice }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState("");
  const preview = marginPreview(price, cost, target);
  return (
    <section className="sm:col-span-2 rounded-lg bg-brand-50 p-4" aria-labelledby="margin-preview-title">
      <h3 id="margin-preview-title" className="font-semibold">{t("marginPreview.title")}</h3>
      <p className="text-sm text-gray-600">{t("marginPreview.scope")}</p>
      <div aria-live="polite" className="my-2 text-sm">
        {preview.contribution === null || preview.foodCost === null ? <p>{t("marginPreview.missing")}</p> : <>
          <p>{t("marginPreview.contribution", { value: preview.contribution.toFixed(2) })}</p>
          <p>{t("marginPreview.foodCost", { value: preview.foodCost.toFixed(1) })}</p>
          {preview.contribution <= 0 && <p className="text-red-700">{t("marginPreview.loss")}</p>}
        </>}
      </div>
      <label htmlFor="target-food-cost" className="block text-sm">{t("marginPreview.target")}</label>
      <input id="target-food-cost" type="number" min="0.01" max="99.99" step="0.01" value={target}
        onChange={(e) => setTarget(e.target.value)} className="border rounded px-3 py-2 w-32" />
      {preview.targetPrice !== null && <div className="mt-2" aria-live="polite">
        <p className="text-sm">{t("marginPreview.targetPrice", { value: preview.targetPrice.toFixed(2) })}</p>
        <button type="button" className="btn-primary mt-2" onClick={() => onUsePrice(preview.targetPrice.toFixed(2))}>{t("marginPreview.usePrice")}</button>
      </div>}
    </section>
  );
}
