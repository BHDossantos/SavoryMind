/**
 * Smoke tests for the i18n bootstrap. Guards the launch-critical
 * properties: language can be switched, persistence sticks, server
 * sync is called on user-driven changes, and unsupported codes
 * fall back to English.
 */
import * as SecureStore from 'expo-secure-store';
import i18n, { setLanguage, applyServerLanguage, SUPPORTED_LANGUAGES } from '../i18n';

describe('i18n service', () => {
  beforeEach(async () => {
    // Reset to English between tests so cross-test ordering doesn't matter.
    await i18n.changeLanguage('en');
  });

  test('English is the default', () => {
    expect(i18n.language).toBe('en');
  });

  test('exposes the supported set', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'es', 'it', 'pt']);
  });

  test('setLanguage switches active language', async () => {
    await setLanguage('es');
    expect(i18n.language).toBe('es');
    expect(i18n.t('auth.signInButton')).toBe('Iniciar sesión');
  });

  test('setLanguage persists via SecureStore', async () => {
    const spy = jest.spyOn(SecureStore, 'setItemAsync');
    await setLanguage('it');
    expect(spy).toHaveBeenCalledWith('savorymind.language', 'it');
    spy.mockRestore();
  });

  test('setLanguage syncs to server when callback provided', async () => {
    const sync = jest.fn().mockResolvedValue({});
    await setLanguage('es', { syncToServer: sync });
    expect(sync).toHaveBeenCalledWith({ language: 'es' });
  });

  test('setLanguage swallows server-sync failures (local switch still applies)', async () => {
    const sync = jest.fn().mockRejectedValue(new Error('network'));
    await setLanguage('es', { syncToServer: sync });
    expect(i18n.language).toBe('es');
  });

  test('applyServerLanguage normalises unsupported codes to English', async () => {
    await applyServerLanguage('fr-FR');
    expect(i18n.language).toBe('en');
  });

  test('applyServerLanguage handles full locale tags (es-MX → es)', async () => {
    await applyServerLanguage('es-MX');
    expect(i18n.language).toBe('es');
  });

  test('null / undefined language falls back to English', async () => {
    await applyServerLanguage(null);
    expect(i18n.language).toBe('en');
    await applyServerLanguage(undefined);
    expect(i18n.language).toBe('en');
  });
});
