/**
 * wedgeTaste — the localStorage handoff from the public wedge pages
 * (/discover/mood, /discover/menu) into onboarding. Pins down: stash →
 * consume round-trip, consume clears, TTL expiry, garbage tolerance.
 */
import { stashWedgeTaste, consumeWedgeTaste } from "../../utils/wedgeTaste";

const KEY = "savorymind.wedge_taste";

beforeEach(() => {
  window.localStorage.clear();
});

test("stash then consume round-trips cuisines and dietary", () => {
  stashWedgeTaste({ cuisines: ["Italian", "Thai"], dietary: ["vegan"] });
  const out = consumeWedgeTaste();
  expect(out).toEqual({ cuisines: ["Italian", "Thai"], dietary: ["vegan"] });
});

test("consume clears the stash so a second consume returns null", () => {
  stashWedgeTaste({ cuisines: ["Italian"], dietary: [] });
  expect(consumeWedgeTaste()).not.toBeNull();
  expect(consumeWedgeTaste()).toBeNull();
});

test("empty stash is a no-op (nothing written)", () => {
  stashWedgeTaste({ cuisines: [], dietary: [] });
  expect(window.localStorage.getItem(KEY)).toBeNull();
  expect(consumeWedgeTaste()).toBeNull();
});

test("expired stash returns null", () => {
  // Write directly with a timestamp older than the 1h TTL.
  window.localStorage.setItem(KEY, JSON.stringify({
    cuisines: ["Italian"], dietary: [], at: Date.now() - 2 * 60 * 60 * 1000,
  }));
  expect(consumeWedgeTaste()).toBeNull();
});

test("garbage in localStorage returns null instead of throwing", () => {
  window.localStorage.setItem(KEY, "not json {{{");
  expect(consumeWedgeTaste()).toBeNull();
});

test("non-array fields are normalised to empty arrays", () => {
  window.localStorage.setItem(KEY, JSON.stringify({
    cuisines: "Italian", dietary: { vegan: true }, at: Date.now(),
  }));
  expect(consumeWedgeTaste()).toEqual({ cuisines: [], dietary: [] });
});
