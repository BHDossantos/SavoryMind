// Jest mock for expo-localization. The real module is a native binding
// that doesn't load under Node, so unit tests get a deterministic
// "device language is English" answer instead.
module.exports = {
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
  getCalendars: () => [{ timeZone: 'UTC' }],
  locale: 'en-US',
  locales: ['en-US'],
};
