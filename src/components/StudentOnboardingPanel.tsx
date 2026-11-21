import { FormEvent, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Mail,
  RefreshCw,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { parseStudentImportCsv } from '../lib/csvExport';
import { CampusStatePayload, OnboardingEmailLog } from '../lib/types';

interface StudentOnboardingPanelProps {
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
}

const SAMPLE_CSV = `Roll No, Name, Email, Division
TC24021, Aarav Mehta, aarav.mehta@tcer.edu.in, Section A
TC24022, Nisha Sundaram, nisha.sundaram@tcer.edu.in, Section A
TC24023, Varun Deshpande, varun.deshpande@tcer.edu.in, Section A`;

export function StudentOnboardingPanel({
  state,
  onCreateStudent,
  onBulkImport,
  onResendCredentials,
}: StudentOnboardingPanelProps) {
  const [rollNumber, setRollNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [batchId, setBatchId] = useState(state.batches[0]?.id ?? '');
  const [csvText, setCsvText] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState(state.batches[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<OnboardingEmailLog | null>(null);

  const csvPreview = useMemo(() => {
    if (!csvText.trim()) return null;
    return parseStudentImportCsv(csvText);
  }, [csvText]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = state.students
      .slice()
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
    if (!q) return list;
    return list.filter(
      (s) =>
        s.rollNumber.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [state.students, search]);

  const handleAddSingle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!rollNumber.trim() || !firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Fill in Roll Number, First Name, Last Name, and Email.');
      return;
    }

    setBusy(true);
    try {
      const log = await onCreateStudent({
        rollNumber: rollNumber.trim().toUpperCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        batchId,
      });
      setRollNumber('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setNotice(
        `Student ${log.rollNumber} onboarded. Credentials dispatched to ${log.recipientEmail} (Temp key: ${log.temporaryPassword}).`
      );
      setPreviewEmail(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add student.');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkSubmit = async () => {
    setError(null);
    setNotice(null);
    if (!csvText.trim()) {
      setError('Paste CSV student rows or load the sample cohort first.');
      return;
    }

    setBusy(true);
    try {
      const res = await onBulkImport({ rawCsv: csvText, batchId: bulkBatchId });
      setCsvText('');
      setNotice(
        `Bulk import completed: ${res.createdCount} student accounts provisioned and credential emails queued.${
          res.skipped.length > 0 ? ` Skipped: ${res.skipped.join(', ')}.` : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk CSV import failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async (studentId: string) => {
    setError(null);
    setNotice(null);
    setResendingId(studentId);
    try {
      const log = await onResendCredentials(studentId);
      setNotice(`Fresh credentials dispatched to ${log.recipientEmail}.`);
      setPreviewEmail(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend credentials.');
    } finally {
      setResendingId(null);
    }
  };

  const batchLabelById = useMemo(
    () => new Map(state.batches.map((b) => [b.id, `${b.name} · ${b.division}`])),
    [state.batches]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Student Roster &amp; Automated Onboarding
        </h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          Add individual students or bulk-import via CSV. CampusPulse generates temporary
          passwords and dispatches onboarding credentials automatically.
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
            aria-label="Dismiss notification"
            className="text-[#A7F3D0] hover:text-white cursor-pointer"
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

      {/* Dual Provisioning Forms: Individual + Bulk CSV */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAddSingle}
          className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Add Individual Student</h2>
            <UserPlus className="w-4 h-4 text-[#3B82F6]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="stu-roll" className="block text-xs text-[#94A3B8] mb-1">
                Roll Number
              </label>
              <input
                id="stu-roll"
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="TC24025"
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm font-mono text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="stu-batch" className="block text-xs text-[#94A3B8] mb-1">
                Batch &amp; Division
              </label>
              <select
                id="stu-batch"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
              >
                {state.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.division}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="stu-fname" className="block text-xs text-[#94A3B8] mb-1">
                First Name
              </label>
              <input
                id="stu-fname"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Raghav"
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="stu-lname" className="block text-xs text-[#94A3B8] mb-1">
                Last Name
              </label>
              <input
                id="stu-lname"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Menon"
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="stu-email" className="block text-xs text-[#94A3B8] mb-1">
              Institutional Email
            </label>
            <input
              id="stu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="raghav.menon@tcer.edu.in"
              className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Create Student &amp; Send Credentials</span>
          </button>
        </form>

        {/* Bulk CSV Importer */}
        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Bulk CSV Cohort Import</h2>
              <button
                type="button"
                onClick={() => setCsvText(SAMPLE_CSV)}
                className="text-xs font-medium text-[#38BDF8] hover:text-white transition-colors cursor-pointer"
              >
                Load Sample CSV
              </button>
            </div>

            <div>
              <label htmlFor="bulk-batch" className="block text-xs text-[#94A3B8] mb-1">
                Target Division
              </label>
              <select
                id="bulk-batch"
                value={bulkBatchId}
                onChange={(e) => setBulkBatchId(e.target.value)}
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
              >
                {state.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.division}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bulk-csv" className="block text-xs text-[#94A3B8] mb-1">
                CSV Rows (Roll No, Name, Email, Division)
              </label>
              <textarea
                id="bulk-csv"
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="TC24021, Aarav Mehta, aarav.mehta@tcer.edu.in, Section A"
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-xs font-mono text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            {csvPreview && (
              <p className="text-xs font-mono text-[#94A3B8]">
                Parsed: <span className="text-[#34D399]">{csvPreview.validRows.length} valid</span>
                {csvPreview.errors.length > 0 && (
                  <span className="text-[#F87171]">
                    {' '}
                    · {csvPreview.errors.length} invalid ({csvPreview.errors[0]})
                  </span>
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleBulkSubmit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E293B] hover:bg-[#334155] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Cohort &amp; Dispatch Emails</span>
          </button>
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Enrolled Students ({filteredStudents.length})
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Resend onboarding credentials anytime if a student misplaces their temporary password.
            </p>
          </div>
          <input
            type="search"
            aria-label="Filter enrolled students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roll no, name, or email..."
            className="sm:w-64 rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#1E293B] text-xs text-[#94A3B8]">
              <tr>
                <th className="px-5 py-3 font-medium">Roll No</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Batch / Division</th>
                <th className="px-5 py-3 font-medium">Portal Status</th>
                <th className="px-5 py-3 font-medium text-right">Credentials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {filteredStudents.map((stu) => (
                <tr key={stu.id} className="hover:bg-[#172030]">
                  <td className="px-5 py-3 font-mono tabular-nums text-xs text-[#CBD5E1]">
                    {stu.rollNumber}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">
                      {stu.firstName} {stu.lastName}
                    </p>
                    <p className="text-xs text-[#94A3B8]">{stu.email}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-[#CBD5E1]">
                    {batchLabelById.get(stu.batchId) ?? 'Assigned'}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span
                      className={stu.activated ? 'text-[#34D399]' : 'text-[#FBBF24]'}
                    >
                      {stu.activated ? 'Activated' : 'Invite Sent'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      disabled={resendingId === stu.id}
                      onClick={() => handleResend(stu.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#0B0F17] hover:bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        {resendingId === stu.id ? 'Sending...' : 'Resend Credentials'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboarding Email Dispatch Log */}
      <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E293B]">
          <h2 className="text-base font-semibold text-white">
            Automated Email Dispatch Log ({state.onboardingEmails.length})
          </h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Inspect every dispatched student credential email, temporary password, and activation link.
          </p>
        </div>

        <div className="divide-y divide-[#1E293B]">
          {state.onboardingEmails.map((log) => (
            <div
              key={log.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#172030]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {log.rollNumber} · {log.studentName}
                </p>
                <p className="text-xs text-[#94A3B8] font-mono tabular-nums mt-0.5 truncate">
                  To: {log.recipientEmail} · Temp Password: {log.temporaryPassword} ·{' '}
                  {log.deliveryMode === 'RESEND_LIVE' ? 'Resend Live' : 'Local Queue'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmail(log)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#0B0F17] hover:bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-white self-start sm:self-auto whitespace-nowrap cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect Email</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Email Template Preview Modal */}
      {previewEmail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#1E293B] bg-[#131A26] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="email-preview-title" className="text-base font-bold text-white">
                  Dispatched Onboarding Email
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1">{previewEmail.subject}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                aria-label="Close email preview"
                className="p-1.5 text-[#94A3B8] hover:text-white rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-[#1E293B] bg-[#0B0F17] p-4 text-xs font-mono text-[#CBD5E1] whitespace-pre-wrap leading-relaxed">
              {previewEmail.htmlPreview}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Sent {new Date(previewEmail.sentAt).toLocaleString()}</span>
              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
