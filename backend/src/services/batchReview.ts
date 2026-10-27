import { z } from 'zod';

export const batchReviewSchema = z.object({
  requestId: z.string().uuid(),
  expectedRecords: z.array(z.object({id: z.string().uuid(), status: z.enum(['PENDING','PRESENT','REJECTED'])})).max(5000),
  excludedRecordIds: z.array(z.string().uuid()).max(5000),
}).superRefine((value, context) => {
  const ids = new Set(value.expectedRecords.map(record => record.id));
  if (ids.size !== value.expectedRecords.length) context.addIssue({code:'custom',message:'Duplicate submission IDs.'});
  if (new Set(value.excludedRecordIds).size !== value.excludedRecordIds.length || value.excludedRecordIds.some(id => !ids.has(id))) {
    context.addIssue({code:'custom',message:'Exclusions must be submissions in this review.'});
  }
});

export function reviewDatabaseError(error: {code?: string; message?: string}) {
  const messages: Record<string, string> = {
    SESSION_NOT_FOUND: 'Session not found.', SESSION_FORBIDDEN: 'You cannot review this session.',
    STOP_SESSION_FIRST: 'Stop check-in before confirming the class.',
    AUDIT_NOT_READY:'The post-session audit is not complete yet. Refresh shortly.',
    FLAGGED_REVIEW_REQUIRED:'Review each flagged signal with a reason before confirming the class.',
    REVIEW_REASON_REQUIRED:'Enter a review reason (5–500 characters).',
    REVIEW_CHANGED: 'The submission list changed. Refresh it and review the updated list before confirming.',
    SESSION_ALREADY_CONFIRMED: 'This session was already confirmed. Open its report.',
    INVALID_REVIEW: 'Invalid review. Refresh the submission list.', INVALID_EXCLUSIONS: 'An excluded submission is not in this session.',
  };
  const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : ['40001','PT409'].includes(error.code || '') ? 409 : error.code === '22023' ? 400 : 503;
  return {status, error: messages[error.message || ''] || 'Class review is temporarily unavailable. Please contact the administrator.'};
}
