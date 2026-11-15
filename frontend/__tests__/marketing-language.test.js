import { render, screen, waitFor, cleanup } from '@testing-library/react';
import MarketingShell, { signupHref } from '../src/components/marketing/MarketingShell';
import Signup from '../src/pages/signup';
import i18n, { setLanguage } from '../src/services/i18n';
let query = {};
jest.mock('next/router', () => ({ useRouter: () => ({ query }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ register: jest.fn(), user: null }) }));
jest.mock('next-auth/react', () => ({ signIn: jest.fn() }));
beforeEach(async () => { query = {}; global.fetch = jest.fn().mockResolvedValue({ json: async () => [] }); await setLanguage('en'); });
afterEach(cleanup);
test.each(['it', 'en'])('marketing %s CTA carries language, type and attribution', (lang) => {
 query = { utm_source: 'campaign', private: 'discard' };
 render(<MarketingShell lang={lang}>Content</MarketingShell>);
 const links = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/signup'));
 expect(links.length).toBeGreaterThan(0);
 for (const link of links) {
  const params = new URL(link.href).searchParams;
  expect(params.get('lng')).toBe(lang);
  expect(params.get('type')).toBe('restaurant');
  expect(params.get('utm_source')).toBe('campaign');
  expect(params.has('private')).toBe(false);
 }
 expect(screen.queryByText(/P.IVA 00000000000/)).toBeNull();
});
test('pricing links retain the plan and default Italian journey', () => {
 const params = new URL(signupHref({ ref: 'friend' }, { type: 'restaurant', plan: 'pro' }), 'https://example.test').searchParams;
 expect(Object.fromEntries(params)).toEqual({ lng: 'it', ref: 'friend', type: 'restaurant', plan: 'pro' });
});
test.each(['it', 'en'])('signup applies explicit %s language and persists it', async (lang) => {
 await setLanguage(lang === 'it' ? 'en' : 'it');
 query = { lng: lang, type: 'restaurant' };
 render(<Signup />);
 await waitFor(() => expect(i18n.language).toBe(lang));
 expect(localStorage.getItem('savorymind.language')).toBe(lang);
});
test.each([undefined, 'invalid', ['it', 'en']])('signup preserves preference for missing or invalid language %s', async (lng) => {
 await setLanguage('pt'); query = { lng, type: 'restaurant' }; render(<Signup />);
 await waitFor(() => expect(global.fetch).toHaveBeenCalled());
 expect(i18n.language).toBe('pt');
});
