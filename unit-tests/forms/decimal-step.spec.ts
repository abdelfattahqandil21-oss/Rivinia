import { expect, it } from 'vitest';
import { stepDecimal } from '../../projects/forms/src/lib/utils/decimal-step';

it('steps exactly across decimal scales and signed zero', () => {
  expect(stepDecimal('999999999999999999.999', '0.001', 1)).toBe('1000000000000000000.000');
  expect(stepDecimal('0.10', '0.2', -1)).toBe('-0.10');
  expect(stepDecimal('-0.10', '0.1', 1)).toBe('0.00');
});
