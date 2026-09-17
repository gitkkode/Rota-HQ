import { Pipe, PipeTransform } from '@angular/core';
import { formatHqCurrency } from '../core/constants/currency.constants';

/** Formats amounts as Indian Rupees (₹) using en-IN locale. */
@Pipe({ name: 'hqCurrency', standalone: true })
export class HqCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, precise: boolean | string = false): string {
    if (value == null || Number.isNaN(Number(value))) {
      return '—';
    }
    const usePrecise = precise === true || precise === 'true';
    return formatHqCurrency(Number(value), usePrecise);
  }
}
