import { test, expect, Page, request } from '@playwright/test';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
const ADMIN = { email: 'admin@nocturna.app', password: 'ChangeMe123!' };

async function adminToken() {
  const ctx = await request.newContext();
  const r = await ctx.post(`${API}/api/auth/login`, { data: ADMIN });
  expect(r.ok()).toBeTruthy();
  const { access_token } = await r.json();
  return access_token as string;
}

async function pickFirstChip(page: Page) {
  // The planner uses round button chips; click the first non-active one.
  const buttons = page.getByRole('button').filter({ hasText: /./ });
  await buttons.first().waitFor();
}

test.describe('Nocturna golden path', () => {
  test('home -> planner -> results -> book plan -> admin sees booking', async ({ page }) => {
    // 1. Home
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Where should we go/ })).toBeVisible();
    await page.getByRole('link', { name: 'Plan my night' }).first().click();

    // 2. Planner — click "Next" through every step accepting defaults
    await expect(page.getByText(/Where are you tonight/)).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: 'Next' }).click();
    }
    // 9th screen is the review; submit
    await page.getByRole('button', { name: /Curate my night/ }).click();

    // 3. Results
    await page.waitForURL(/\/plan\/results/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Pick your favourite plan/ })).toBeVisible();
    const planCards = page.locator('article.card');
    await expect(planCards.first()).toBeVisible();

    // 4. Book this plan
    await planCards.first().getByRole('link', { name: /Book this plan/ }).click();
    await page.waitForURL(/\/bookings\/new\?plan_id=/);
    await expect(page.getByRole('heading', { name: /Book your night/ })).toBeVisible();

    await page.getByLabel('Name').fill('E2E Buyer');
    await page.getByLabel('Phone').fill('+39 333 0000001');
    await page.getByLabel('Email').fill('e2e@nocturna.app');

    const submit = page.getByRole('button', { name: /Submit \d+ booking/ });
    await expect(submit).toBeEnabled();
    await submit.click();

    // 5. Status board renders bookings
    await page.waitForURL(/\/plan\/\d+\/bookings/, { timeout: 15_000 });
    await expect(page.getByText(/status board/)).toBeVisible();
    await expect(page.getByText(/Stop 1/)).toBeVisible();

    // 6. Admin sees the booking via API
    const tok = await adminToken();
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${tok}` } });
    const list = await ctx.get(`${API}/api/admin/bookings?status=new`);
    expect(list.ok()).toBeTruthy();
    const bookings = await list.json();
    const mine = bookings.find((b: any) => b.contact_email === 'e2e@nocturna.app');
    expect(mine).toBeTruthy();
    expect(mine.contact_name).toBe('E2E Buyer');
  });

  test('venue detail loads with map + booking CTA', async ({ page }) => {
    // Find a venue from the API and visit its slug
    const ctx = await request.newContext();
    const r = await ctx.get(`${API}/api/venues/trending?city=rome&limit=1`);
    const [v] = await r.json();
    expect(v).toBeTruthy();
    await page.goto(`/venues/${v.slug}`);
    await expect(page.getByRole('heading', { name: v.name })).toBeVisible();
    await expect(page.getByRole('link', { name: /Request reservation/ })).toBeVisible();
    // Map (Mapbox or SVG fallback) is rendered
    await expect(page.locator('[role="img"][aria-label*="route"], div').first()).toBeVisible();
  });

  test('admin login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(ADMIN.email);
    await page.getByPlaceholder('Password').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/admin/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Admin/ })).toBeVisible();
  });
});
