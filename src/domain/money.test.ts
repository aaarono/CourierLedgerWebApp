import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateRentalForPeriod, calculateCommission, fuelCostMinor, minorToDecimal, parseMoneyMinor, splitByBasisPoints } from './money.ts';

test('Money parser does not use floats', () => {
  assert.equal(parseMoneyMinor('1135,20'), 113520n);
  assert.equal(minorToDecimal(113520n), '1135.20');
  assert.throws(() => parseMoneyMinor('123.456'));
});
test('Bolt commission 8% snapshot for real shift', () => {
  assert.equal(calculateCommission(parseMoneyMinor('1135.20'), 800), 9082n);
});
test('Sharing preserves all minor units including uneven amounts', () => {
  assert.deepEqual(splitByBasisPoints(10001n, [5000,5000]), [5001n,5000n]);
  assert.equal(splitByBasisPoints(9999n, [3000,7000]).reduce((a,b) => a+b, 0n), 9999n);
});
test('Fuel from real shift: 71.4 km x 11.9 l/100km x 39.90', () => {
  // Exact calculated liters 8.4966; stored actual 8.5 liters should override in product form.
  assert.equal(fuelCostMinor('71.4','11.9',3990n), 33901n);
  assert.equal(fuelCostMinor('0','11.9',3990n), 0n);
});
test('Rental is allocated by real period, not by viewing days', () => {
  const a = allocateRentalForPeriod(150000n,'2026-11-04','2026-11-11','2026-11-02','2026-11-09');
  const b = allocateRentalForPeriod(150000n,'2026-11-04','2026-11-11','2026-11-09','2026-11-16');
  assert.equal(a,107143n);
  assert.equal(b,42857n);
  assert.equal(a+b,150000n);
});
test('Rental for overlapping reports does not alter original amount', () => {
  assert.equal(allocateRentalForPeriod(150000n,'2026-11-04','2026-11-11','2026-11-04','2026-11-11'),150000n);
  assert.equal(allocateRentalForPeriod(150000n,'2026-11-04','2026-11-11','2026-12-01','2026-12-05'),0n);
});
