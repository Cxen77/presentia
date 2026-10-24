import type { AttendanceRecord } from '../types';
import type { BatchReview } from '../services/api';

/** Freeze exactly what the teacher reviewed; never silently include a later arrival. */
export function prepareBatchReview(records: AttendanceRecord[], excludedIds: ReadonlySet<string>, requestId: string): BatchReview {
  const ids = new Set(records.map(record => record.id));
  if (ids.size !== records.length || [...excludedIds].some(id => !ids.has(id))) throw new Error('Refresh the student list before confirming.');
  return {requestId, excludedRecordIds:[...excludedIds], expectedRecords:records.map(record => {
    if (record.status === 'ABSENT') throw new Error('Unexpected submission status. Refresh the list.');
    return {id:record.id,status:record.status};
  })};
}
