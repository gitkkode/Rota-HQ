import { Invoice, Organization, Payment, Plan, Subscription } from '../models/hq.models';
import { formatHqCurrency } from '../constants/currency.constants';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceDetailView {
  invoice: Invoice;
  organization: Organization;
  subscription: Subscription | undefined;
  plan: Plan | undefined;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  payments: Payment[];
}

export interface PaymentDetailView {
  payment: Payment;
  organization: Organization;
  invoice: Invoice | undefined;
  subscription: Subscription | undefined;
  plan: Plan | undefined;
}

export function buildInvoiceLineItems(
  subscription: Subscription | undefined,
  plan: Plan | undefined,
  invoiceAmount: number,
): InvoiceLineItem[] {
  if (!subscription || !plan) {
    return [
      {
        description: 'Subscription billing',
        quantity: 1,
        unitPrice: invoiceAmount,
        amount: invoiceAmount,
      },
    ];
  }

  const seatOverage = Math.max(0, subscription.seats - plan.seatsIncluded);
  const baseAmount = plan.priceMonthly;
  const overageRate = Math.round(plan.priceMonthly / Math.max(plan.seatsIncluded, 1));
  const overageAmount = Math.max(0, invoiceAmount - baseAmount);

  const items: InvoiceLineItem[] = [
    {
      description: `${plan.name} plan (${subscription.interval})`,
      quantity: 1,
      unitPrice: baseAmount,
      amount: baseAmount,
    },
  ];

  if (seatOverage > 0 && overageAmount > 0) {
    items.push({
      description: `Additional seats (${seatOverage} × ${formatHqCurrency(overageRate)})`,
      quantity: seatOverage,
      unitPrice: overageRate,
      amount: overageAmount,
    });
  } else if (items[0].amount !== invoiceAmount) {
    items[0] = {
      description: `${plan.name} subscription`,
      quantity: 1,
      unitPrice: invoiceAmount,
      amount: invoiceAmount,
    };
  }

  return items;
}

export function computeInvoiceTax(subtotal: number): number {
  return Math.round(subtotal * 0.08 * 100) / 100;
}
