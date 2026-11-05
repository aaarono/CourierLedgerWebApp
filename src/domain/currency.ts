export const currencies = ['CZK', 'EUR', 'USD', 'UAH'] as const;
export type CurrencyCode = (typeof currencies)[number];
export const locales = ['ru', 'cs', 'en'] as const;
export type Locale = (typeof locales)[number];
export function isCurrencyCode(value: string): value is CurrencyCode {
  return currencies.includes(value as CurrencyCode);
}
export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
export function formatMoneyMinor(value: bigint | string | number, currency: CurrencyCode, locale: Locale = 'ru'): string {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  // Small UI values are safe to convert for Intl formatting; reject unsafe magnitude.
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Value is too large for Intl formatting');
  }
  return new Intl.NumberFormat(locale === 'cs' ? 'cs-CZ' : locale === 'en' ? 'en-US' : 'ru-RU', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(amount) / 100);
}
