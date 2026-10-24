import { useState } from 'react';
import samplePhoto from '../../../../assets/aryan.jpg';
import { SubmissionReviewFeed } from './SubmissionReviewFeed';
import type { AttendanceRecord } from '../../types';

export default function PreviewSubmissionReview() {
  const [record] = useState<AttendanceRecord>(() => ({
    id: 'design-preview', sessionId: 'design-preview', classId: 'design-preview', studentId: 'design-preview',
    studentName: 'Preview student', studentRollNumber: 'SAMPLE-USN-001', studentClassRollNumber: '01', studentSection: 'A',
    studentAvatarUrl: samplePhoto, verificationPhotoUrl: samplePhoto,
    submittedAt: new Date().toISOString(), status: 'PENDING',
  }));
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  return <SubmissionReviewFeed records={[record]} deciding={null} sessionOpen hasSubmissions={false} preview excludedIds={excluded} onToggleExcluded={id => setExcluded(previous => previous.has(id) ? new Set() : new Set([id]))}/>;
}
