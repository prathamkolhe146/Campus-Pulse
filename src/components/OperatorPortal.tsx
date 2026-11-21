import { FormEvent, useState } from 'react';
import { CalendarCheck2, CheckCircle2, X } from 'lucide-react';
import { CampusStatePayload, OnboardingEmailLog } from '../lib/types';
import { StudentOnboardingPanel } from './StudentOnboardingPanel';

interface OperatorPortalProps {
  section: string;
  state: CampusStatePayload;
  onCreateStudent: (payload: {
    rollNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    batchId: string;
  }) => Promise<OnboardingEmailLog>;
  onBulkImport: (payload: {
    rawCsv: string;
    batchId: string;
  }) => Promise<{ createdCount: number; skipped: string[]; parseErrors: string[] }>;
  onResendCredentials: (studentId: string) => Promise<OnboardingEmailLog>;
  onCreateLeave: (payload: {
    studentId: string;
    date: string;
    reason: string;
    category: 'MEDICAL' | 'INSTITUTIONAL_DUTY' | 'APPROVED_LEAVE';
  }) => Promise<void>;
}

export function OperatorPortal({
  section,
  state,
  onCreateStudent,
  onBulkImport,
  onResendCredentials,
  onCreateLeave,
}: OperatorPortalProps) {
  const [studentId, setStudentId] = useState(state.students[1]?.id ?? state.students[0]?.id ?? '');
  const [date, setDate] = useState('2026-11-20');
  const [category, setCategory] = useState<'MEDICAL' | 'INSTITUTIONAL_DUTY' | 'APPROVED_LEAVE'>(
    'MEDICAL'
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLeaveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!studentId || !date || reason.trim().length < 5) {
      setError('Select a student, date, and provide an institutional leave reason (min 5 chars).');
      return;
    }

    setBusy(true);
    try {
      await onCreateLeave({
        studentId,
        date,
        category,
        reason: reason.trim(),
      });
      setReason('');
      setNotice(
        'Institutional leave approved. Matching lecture records for that date were updated to EXCUSED with audit entries.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record institutional leave.');
    } finally {
      setBusy(false);
    }
  };

  if (section === 'leaves') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Institutional Leave &amp; Excused Attendance
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Approve medical certificates or official college representation duty. Matching daily
            sessions automatically update to Excused with full audit trail entries.
          </p>
        </div>

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-lg border border-[#10B981]/35 bg-[#10B981]/10 px-4 py-3 text-sm text-[#A7F3D0]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
              className="cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FCA5A5]"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleLeaveSubmit}
            className="lg:col-span-5 rounded-xl border border-[#1E293B] bg-[#131A26] p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Record Approved Leave</h2>
              <CalendarCheck2 className="w-4 h-4 text-[#38BDF8]" />
            </div>

            <div>
              <label htmlFor="leave-student" className="block text-xs text-[#94A3B8] mb-1">
                Student
              </label>
              <select
                id="leave-student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
              >
                {state.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rollNumber} — {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="leave-date" className="block text-xs text-[#94A3B8] mb-1">
                  Date
                </label>
                <input
                  id="leave-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm font-mono text-white focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="leave-cat" className="block text-xs text-[#94A3B8] mb-1">
                  Category
                </label>
                <select
                  id="leave-cat"
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as 'MEDICAL' | 'INSTITUTIONAL_DUTY' | 'APPROVED_LEAVE'
                    )
                  }
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value="MEDICAL">Medical Leave</option>
                  <option value="INSTITUTIONAL_DUTY">Institutional Duty</option>
                  <option value="APPROVED_LEAVE">Dean Approved Leave</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="leave-reason" className="block text-xs text-[#94A3B8] mb-1">
                Reference &amp; Justification
              </label>
              <textarea
                id="leave-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Medical certificate ref #MC-2026-88 or event circular number..."
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
            >
              Apply Excused Attendance
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E293B]">
              <h2 className="text-base font-semibold text-white">
                Approved Leave Register ({state.leaveEntries.length})
              </h2>
            </div>
            <div className="divide-y divide-[#1E293B]">
              {state.leaveEntries.map((entry) => (
                <div key={entry.id} className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-white">
                      <span className="font-mono text-xs text-[#94A3B8] mr-2">
                        {entry.rollNumber}
                      </span>
                      {entry.studentName}
                    </p>
                    <span className="text-xs font-mono text-[#7DD3FC]">
                      {entry.date} · {entry.category.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#CBD5E1] mt-1.5">{entry.reason}</p>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Approved by {entry.approvedByName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'audit') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            System Audit &amp; Correction Log
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Read-only compliance trail of faculty edits and operator leave overrides.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
          <div className="divide-y divide-[#1E293B]">
            {state.auditLogs.map((log) => (
              <div key={log.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <span className="text-white font-semibold">
                    {log.rollNumber} · {log.studentName} ({log.courseCode})
                  </span>
                  <span className="text-[#94A3B8]">
                    {log.oldStatus} → <span className="text-[#34D399]">{log.newStatus}</span>
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1] mt-1">{log.reason}</p>
                <p className="text-[11px] text-[#64748B] mt-1 font-mono">
                  By {log.changedByName} ({log.changedByRole}) · Session {log.sessionDate} ·{' '}
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <StudentOnboardingPanel
      state={state}
      onCreateStudent={onCreateStudent}
      onBulkImport={onBulkImport}
      onResendCredentials={onResendCredentials}
    />
  );
}
