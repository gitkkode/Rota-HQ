import { AuditEvent } from '../models/hq.models';

/** Fallback detail body when an event has no explicit detailNotes. */
export function activityDetailNotes(event: AuditEvent): string {
  if (event.detailNotes?.trim()) {
    return event.detailNotes.trim();
  }

  return [
    `Summary: ${event.description}`,
    '',
    `This ${event.category.toLowerCase()} event was recorded on ${new Date(event.timestamp).toLocaleString('en-IN')} by ${event.actor}. The operation targeted ${event.target} and completed with result "${event.result}".`,
    '',
    'In production, this panel would include gateway payloads, invoice line items, retry history, and any operator notes attached at the time of the action. Mock data keeps a short generated narrative until live billing webhooks populate the audit stream.',
  ].join('\n');
}

export function activityDetailParagraphs(event: AuditEvent): string[] {
  return activityDetailNotes(event)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
