# SavoryMind Codebase Concerns Report

## Critical Issues

### 1. **Missing Web Pages for Core Features**
**Severity: Critical**

The web frontend is missing pages that are already fully implemented in the mobile app and have backend API endpoints.

- **Missing `/consumer/planner`** — Meal planning page
  - Mobile app: `/mobile/app/(consumer)/planner.js` exists and calls `api.getMealPlan()`, `api.getShoppingList()`, `api.getDailySuggestion()`
  - Backend: `/backend/app/api/routes/consumer.py` (lines 221-252) has all three endpoints
  - Frontend: Page does NOT exist at `/frontend/src/pages/consumer/planner.js`
  - Impact: Consumer users cannot access meal planning via web browser

- **Missing `/diner/discover`** — Restaurant discovery page
  - Mobile app: `/mobile/app/(diner)/discover.js` exists and calls `api.discoverRestaurants()`, `api.getExperiencePlan()`
  - Backend: `/backend/app/api/routes/diner.py` (lines 92-117) has both endpoints
  - Frontend: Page does NOT exist at `/frontend/src/pages/diner/discover.js`
  - Impact: Diner users cannot discover restaurants via web browser

### 2. **Frontend API Service Missing Methods**
**Severity: Critical**

The frontend API service (`/frontend/src/services/api.js`) lacks methods that mobile has and that backend endpoints support.

- **Missing `getMenuTrends()` and `getMarketingInsights()` in frontend API**
  - Mobile API: Lines 120-121 define these methods
  - Backend: `/backend/app/api/routes/restaurant_ext.py` (lines 204-213) implements `/restaurant/trends` and `/restaurant/marketing`
  - Frontend API: Lines 1-152 do NOT include these methods
  - Impact: Frontend cannot call trends/marketing endpoints (but mobile app needs them)

### 3. **Mobile Restaurant Tab Navigation Routing Error**
**Severity: High**

File: `/mobile/app/(restaurant)/more.js` (lines 26-36)

The "more features" menu tries to navigate to nested routes incorrectly:
```javascript
const FEATURES = [
  { icon: '📅', title: 'Bookings', screen: '/bookings' },  // ❌ Should be 'bookings' (relative)
  { icon: '👥', title: 'CRM', screen: '/crm' },            // ❌ Should be 'crm'
  // ... 8 more routes like '/staff', '/trends', etc.
];
```

These routes are pushed via `router.push(f.screen)` from within a TabNavigator in the `(restaurant)` group. Absolute paths like `/bookings` won't resolve; should be relative like `bookings` or use proper expo-router group syntax.

Impact: Users clicking on any feature in the "More" menu will get 404/routing errors on mobile.

---

## High Priority Issues

### 4. **Missing API Methods in Frontend Service**
**Severity: High**

Comparison of Frontend API vs Backend routes reveals gaps:

Frontend `/frontend/src/services/api.js` is MISSING:
- Meal planner methods: `getMealPlan()`, `getShoppingList()`, `getDailySuggestion()`
- Diner discovery: `discoverRestaurants()`, `getExperiencePlan()`
- Trends/Marketing: `getMenuTrends()`, `getMarketingInsights()`

All of these have working backend endpoints (verified in `/backend/app/api/routes/`).

Files affected:
- `/frontend/src/services/api.js` lines 43-151

### 5. **Frontend Navigation Layout Missing Links**
**Severity: High**

The Consumer and Diner navigation layouts don't include all available features:

**ConsumerLayout** (`/frontend/src/components/ConsumerLayout.js` lines 6-14):
- Has 7 nav links but doesn't link to meal planner
- Backend has meal planner API, mobile has the page, but web layout doesn't expose it

**DinerLayout** (`/frontend/src/components/DinerLayout.js` lines 6-11):
- Has 4 nav links but doesn't include "Discover" restaurants
- Backend has discovery endpoints, mobile has discover page, but web layout doesn't expose it

Impact: Features exist on mobile and backend but are inaccessible from web UI.

### 6. **Restaurant Page Not in Web Layout**
**Severity: High**

File: `/frontend/src/components/Layout.js` (Restaurant layout, lines 6-19)

Missing pages that exist elsewhere:
- **No "Trends" link** — Trends page is not in the nav, but backend endpoint exists
- **No "Marketing" link** — Marketing insights not in nav, but backend endpoint exists
- Frontend pages for these don't exist either

Impact: Restaurant owners can't access trend alerts or marketing insights via web.

---

## Medium Priority Issues

### 7. **Deprecated Browser APIs in Web Frontend**
**Severity: Medium**

Multiple pages use `window.confirm()` for delete confirmations:
- `/frontend/src/pages/menu.js` line 116
- `/frontend/src/pages/sentiment.js` (delete review)
- `/frontend/src/pages/diner/book.js` line 45
- `/frontend/src/pages/diner/history.js` line 47
- `/frontend/src/pages/restaurant/kitchen.js` (delete entry)
- `/frontend/src/pages/restaurant/waste.js` (delete waste)

While this isn't broken, `window.confirm()` is deprecated and provides a poor UX. Should use a modal dialog component instead.

Impact: Delete operations show browser native dialogs; inconsistent with app design.

### 8. **Missing Validation on Mobile Diner Visit Ratings**
**Severity: Medium**

File: `/backend/app/api/routes/diner.py` lines 53-56

The `VisitCreate` schema validates ratings with:
```python
overall_rating: float = Field(default=5.0, ge=1, le=5)
food_rating: float = Field(default=5.0, ge=1, le=5)
staff_rating: float = Field(default=5.0, ge=1, le=5)
```

Mobile app (`/mobile/app/(diner)/history.js`) allows users to set ratings via input controls but frontend validation is minimal. Frontend should enforce 1-5 range on inputs.

Impact: Server will reject ratings outside 1-5; poor error messaging to users.

---

## Low Priority Issues

### 9. **Inconsistent Error Handling in Consumer Dashboard**
**Severity: Low**

File: `/frontend/src/pages/consumer/dashboard.js` lines 14-18

The dashboard swallows all errors silently:
```javascript
useEffect(() => {
  Promise.all([...])
    .catch(() => {})  // ❌ Silent error catch
    .finally(() => setLoading(false));
}, []);
```

If wine pairings, moods, recommendations, or connections fail to load, users won't see any error state. The page just shows empty states without indication of failure.

Impact: Users can't tell if a feature failed to load or if they genuinely have no data.

### 10. **Dead Code Pattern: window.confirm() on Mobile**
**Severity: Low**

Mobile app also has some usage of browser APIs that won't work:
- Files like `/mobile/app/(diner)/book.js` reference patterns that assume browser environment
- However, `window.confirm()` would fail in React Native; this code path likely isn't hit

Impact: If mobile ever calls window.confirm(), app will crash. (Low severity because React Native doesn't have window object, so code would fail at parse time, not runtime.)

---

## Validation & Data Integrity

### ✓ Good: Strong Validation

Positive findings:
- Menu item prices validated with `gt=0` (no zero/negative prices)
- Menu item ratings capped at 5.0 stars
- Diner ratings validated 1.0-5.0 range
- Food waste quantity and cost require positive values (`gt=0`)
- Cost must be less than price (cross-field validation)
- Category enum validation on menu items

No validation bypass vulnerabilities detected.

---

## API Endpoint Verification

### Summary by Service

**Consumer Routes** (`/backend/app/api/routes/consumer.py`):
- ✓ Wine pairing: POST/GET (/api/consumer/wine-pairing)
- ✓ Music mood: POST/GET (/api/consumer/music-mood)
- ✓ Recipes: GET with filters, single recipe GET
- ✓ Meal plan: GET /api/consumer/meal-plan
- ✓ Shopping list: GET /api/consumer/shopping-list
- ✓ Daily suggestion: GET /api/consumer/daily-suggestion

**Diner Routes** (`/backend/app/api/routes/diner.py`):
- ✓ Bookings: POST/GET/PATCH cancel
- ✓ Visits: POST/GET/DELETE
- ✓ Discover: GET /api/diner/discover
- ✓ Experience plan: GET /api/diner/experience-plan

**Restaurant Routes** (`/backend/app/api/routes/restaurant_ext.py`):
- ✓ All CRUD operations for bookings, CRM, staff
- ✓ Trends: GET /api/restaurant/trends
- ✓ Marketing: GET /api/restaurant/marketing

**Verified Mismatch**: Frontend API service lacks methods for meal planner, diner discovery, and trends/marketing.

---

## Navigation & Routing

### Mobile (Expo Router)
- ✓ Consumer layout properly registers all screens in TabNavigator
- ✓ Diner layout properly registers discover screen
- ❌ Restaurant more.js uses wrong route paths (absolute instead of relative)

### Web (Next.js)
- ✓ ConsumerLayout links are correct but incomplete (missing planner)
- ✓ DinerLayout links are correct but incomplete (missing discover)
- ✓ Layout (restaurant) has most pages linked but missing trends/marketing

---

## Summary Table

| Issue | Type | Severity | Blocks Users? |
|-------|------|----------|--------------|
| Missing /consumer/planner page | Feature | Critical | Yes |
| Missing /diner/discover page | Feature | Critical | Yes |
| Mobile restaurant routes (more.js) | Bug | High | Yes |
| Missing meal planner API methods (frontend) | Bug | Critical | Yes |
| Missing discovery API methods (frontend) | Bug | Critical | Yes |
| Missing trends/marketing API methods (frontend) | Bug | High | Yes |
| Frontend nav lacks planner/discover links | UI | High | Yes |
| window.confirm() patterns | UX | Low | No |
| Silent error catch in consumer dashboard | UX | Low | No |

---

## Recommended Action Priority

1. **Immediately (Blocks Production):**
   - Fix mobile restaurant routing in more.js — change `/bookings` → `bookings`, etc.
   - Add missing pages to frontend: consumer/planner.js, diner/discover.js
   - Add missing API methods to frontend service: meal planner, discovery, trends/marketing
   - Update frontend navigation layouts to include new pages

2. **High Priority (Before Wider Release):**
   - Replace window.confirm() dialogs with proper modal components
   - Add proper error handling to consumer dashboard

3. **Nice to Have:**
   - Validate diner visit ratings on frontend before submission

