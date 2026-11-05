// Money is stored and calculated as integer minor units (100 = 1 CZK/EUR/USD/UAH).
// Persist BIGINT values as strings in JSON to avoid precision loss.
export type MoneyMinor = bigint;
const PERCENT_BPS = 10_000n;

export function parseMoneyMinor(input: string): MoneyMinor {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid monetary amount');
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function minorToDecimal(value: MoneyMinor): string {
  const negative = value < 0n;
  const positive = negative ? -value : value;
  return `${negative ? '-' : ''}${positive / 100n}.${String(positive % 100n).padStart(2, '0')}`;
}
export function roundRatioHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n || numerator < 0n) throw new Error('Invalid ratio');
  return (numerator * 2n + denominator) / (2n * denominator);
}
export function calculateCommission(grossMinor: MoneyMinor, commissionBps: number): MoneyMinor {
  if (grossMinor < 0n || !Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) throw new Error('Invalid commission');
  return roundRatioHalfUp(grossMinor * BigInt(commissionBps), PERCENT_BPS);
}
export function splitByBasisPoints(totalMinor: MoneyMinor, weights: number[]): MoneyMinor[] {
  if (totalMinor < 0n || !weights.length || !weights.every(x => Number.isInteger(x) && x >= 0) || weights.reduce((a, b) => a + b, 0) !== 10000) {
    throw new Error('Shares must sum to 10000 basis points');
  }
  const raw = weights.map(w => totalMinor * BigInt(w));
  const values = raw.map(v => v / PERCENT_BPS);
  const residuals = raw.map((v, i) => ({ i, remainder: v % PERCENT_BPS }));
  residuals.sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  const remaining = Number(totalMinor - values.reduce((a, b) => a + b, 0n));
  for (let i = 0; i < remaining; i++) values[residuals[i].i] += 1n;
  return values;
}

function decimalRatio(value: string): { n: bigint; d: bigint } {
  const s = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(s)) throw new Error('Invalid decimal');
  const [whole, fraction = ''] = s.split('.');
  const d = 10n ** BigInt(fraction.length);
  return { n: BigInt(whole) * d + BigInt(fraction || 0), d };
}
/** fuel cost = (distance_km * consumption_l_per_100km / 100) * fuel_price_per_liter */
export function fuelCostMinor(distanceKm: string, litersPer100Km: string, fuelPriceMinorPerLiter: MoneyMinor): MoneyMinor {
  if (fuelPriceMinorPerLiter < 0n) throw new Error('Negative price');
  const d = decimalRatio(distanceKm);
  const c = decimalRatio(litersPer100Km);
  return roundRatioHalfUp(d.n * c.n * fuelPriceMinorPerLiter, d.d * c.d * 100n);
}
function dayOrdinal(dateOnly: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) throw new Error('Invalid ISO date');
  const date = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateOnly) throw new Error('Invalid calendar day');
  return Math.floor(date.getTime() / 86_400_000);
}
/** Date intervals are [start, end), independent of DST. Do not double-count rental across reports. */
export function allocateRentalForPeriod(totalMinor: MoneyMinor, rentStart: string, rentEndExclusive: string, reportStart: string, reportEndExclusive: string): MoneyMinor {
  if (totalMinor < 0n) throw new Error('Invalid rental amount');
  const a = dayOrdinal(rentStart), b = dayOrdinal(rentEndExclusive);
  const left = dayOrdinal(reportStart), right = dayOrdinal(reportEndExclusive);
  if (b <= a || right <= left) throw new Error('Invalid period');
  const lo = Math.max(a, left), hi = Math.min(b, right);
  if (hi <= lo) return 0n;
  const days = BigInt(b - a);
  const boundary = (offset: number) => roundRatioHalfUp(totalMinor * BigInt(offset), days);
  return boundary(hi - a) - boundary(lo - a);
}
