import { InvoiceDetailView } from './billing-detail.util';
import { formatHqCurrency } from '../constants/currency.constants';

const currency = (value: number): string => formatHqCurrency(value, true);

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

export async function buildInvoicePdf(detail: InvoiceDetailView): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const { invoice, organization, subscription, plan, lineItems, subtotal, taxAmount, total, payments } =
    detail;

  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentRight = pageW - margin;
  const colAmount = contentRight;
  const colUnit = contentRight - 88;
  const colQty = contentRight - 148;
  const descLeft = margin + 8;
  const descWidth = colQty - descLeft - 12;
  const labelRight = colUnit - 8;

  let y = margin;

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Workforce HQ', margin, 36);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice', margin, 54);

  doc.setTextColor(15, 23, 42);
  y = 96;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.number, margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Status: ${invoice.status.replace('_', ' ').toUpperCase()}`, margin, y);
  doc.text(`Issued: ${formatDate(invoice.issuedAt)}`, margin + 168, y);
  doc.text(`Due: ${formatDate(invoice.dueAt)}`, margin + 318, y);
  y += 28;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill to', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.text(organization.name, margin, y);
  y += 14;
  doc.setTextColor(100, 116, 139);
  doc.text(`${organization.industry} · ${organization.country}`, margin, y);
  y += 14;
  doc.text(`Org ID: ${organization.id}`, margin, y);
  y += 24;

  if (plan && subscription) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Subscription', margin, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text(`${plan.name} · ${subscription.interval} · ${subscription.seats} seats`, margin, y);
    y += 14;
    if (subscription.billingPeriodStart && subscription.billingPeriodEnd) {
      doc.text(
        `Billing period: ${formatDate(subscription.billingPeriodStart)} – ${formatDate(subscription.billingPeriodEnd)}`,
        margin,
        y,
      );
      y += 14;
    }
    y += 10;
  }

  const tableTop = y;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, tableTop, pageW - margin * 2, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Description', descLeft, tableTop + 14);
  doc.text('Qty', colQty, tableTop + 14, { align: 'right' });
  doc.text('Unit price', colUnit, tableTop + 14, { align: 'right' });
  doc.text('Amount', colAmount, tableTop + 14, { align: 'right' });
  y = tableTop + 30;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  lineItems.forEach((item) => {
    const descLines = doc.splitTextToSize(item.description, descWidth) as string[];
    const rowHeight = Math.max(18, descLines.length * 12 + 4);
    doc.text(descLines, descLeft, y);
    doc.text(String(item.quantity), colQty, y, { align: 'right' });
    doc.text(currency(item.unitPrice), colUnit, y, { align: 'right' });
    doc.text(currency(item.amount), colAmount, y, { align: 'right' });
    y += rowHeight;
  });

  y += 10;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, contentRight, y);
  y += 18;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal', labelRight, y, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(currency(subtotal), colAmount, y, { align: 'right' });
  y += 16;
  doc.setTextColor(100, 116, 139);
  doc.text('Tax (8%)', labelRight, y, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(currency(taxAmount), colAmount, y, { align: 'right' });
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('Total due', labelRight, y, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(currency(total), colAmount, y, { align: 'right' });
  y += 28;

  if (payments.length) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Payment history', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    payments.forEach((payment) => {
      const summary = `${formatDate(payment.processedAt)} · ${payment.method} · ${payment.status} · ${currency(payment.amount)}`;
      const summaryLines = doc.splitTextToSize(summary, pageW - margin * 2) as string[];
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 12;
      if (payment.transactionId) {
        doc.setTextColor(100, 116, 139);
        doc.text(`Transaction ${payment.transactionId}`, margin + 12, y);
        doc.setTextColor(15, 23, 42);
        y += 14;
      }
      y += 8;
    });
  }

  if (invoice.paidAt) {
    y += 6;
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(margin, y, 160, 24, 4, 4, 'F');
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.text(`Paid ${formatDate(invoice.paidAt)}`, margin + 10, y + 16);
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Generated by Workforce HQ · Mock invoice export for demonstration', margin, pageH - 32);

  return doc.output('blob');
}
