import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  calculateRecoveryMetrics,
  cycleAttendanceStatus,
  isAttendedStatus,
  isWithinDirectEditWindow,
} from '../lib/attendanceMath';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  CampusStatePayload,
} from '../lib/types';

interface FacultyAttendanceSheetProps {
  state: CampusStatePayload;
  onSubmitSession: (payload: {
    courseId: string;
    batchId: string;
    date: string;
    slot: string;
    topic: string;
    entries: Array<{ studentId: string; status: AttendanceStatus }>;
  }) => Promise<void>;
  onCorrectRecord: (
    recordId: string,
    payload: { newStatus: AttendanceStatus; reason: string }
  ) => Promise<void>;
}

const TIME_SLOTS = [
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:15 AM - 12:15 PM',
  '02:00 PM - 03:00 PM',
  '03:15 PM - 04:15 PM',
];

function statusStyle(status: AttendanceStatus): string {
  switch (status) {
    case AttendanceStatus.PRESENT:
      return 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/60 hover:bg-[#10B981]/30';
    case AttendanceStatus.ABSENT:
      return 'bg-[#EF4444]/20 text-[#FCA5A5] border-[#EF4444]/65 hover:bg-[#EF4444]/30';
    case AttendanceStatus.LATE:
      return 'bg-[#F59E0B]/20 text-[#FDE68A] border-[#F59E0B]/65 hover:bg-[#F59E0B]/30';
    case AttendanceStatus.EXCUSED:
      return 'bg-[#38BDF8]/20 text-[#7DD3FC] border-[#38BDF8]/60 hover:bg-[#38BDF8]/30';
  }
}

export function FacultyAttendanceSheet({
  state,
  onSubmitSession,
  onCorrectRecord,
}: FacultyAttendanceSheetProps) {
  const [mode, setMode] = useState<'LIVE' | 'HISTORY'>('LIVE');

  // Live Roll Call State
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    state.departments[0]?.id ?? ''
  );
  const deptBatches = useMemo(
    () => state.batches.filter((b) => b.departmentId === selectedDeptId),
    [state.batches, selectedDeptId]
  );
  const deptCourses = useMemo(
    () => state.courses.filter((c) => c.departmentId === selectedDeptId),
    [state.courses, selectedDeptId]
  );

  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    state.batches[0]?.id ?? ''
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    state.courses[0]?.id ?? ''
  );
  const [lectureDate, setLectureDate] = useState<string>('2026-11-21');
  const [slot, setSlot] = useState<string>(TIME_SLOTS[0]);
  const [topic, setTopic] = useState<string>('Dynamic Programming & Memoization');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [submitting, setSubmitting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Historical Correction State
  const sortedSessions = useMemo(
    () =>
      state.sessions
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [state.sessions]
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sortedSessions[0]?.id ?? ''
  );
  const [editingRecord, setEditingRecord] = useState<{
    record: AttendanceRecord;
    session: AttendanceSession;
    studentName: string;
    rollNumber: string;
  } | null>(null);
  const [editTargetStatus, setEditTargetStatus] = useState<AttendanceStatus>(
    AttendanceStatus.PRESENT
  );
  const [editReason, setEditReason] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Keep batch/course aligned when department changes
  useEffect(() => {
    if (deptBatches.length > 0 && !deptBatches.some((b) => b.id === selectedBatchId)) {
      setSelectedBatchId(deptBatches[0].id);
    }
    if (deptCourses.length > 0 && !deptCourses.some((c) => c.id === selectedCourseId)) {
      setSelectedCourseId(deptCourses[0].id);
    }
  }, [deptBatches, deptCourses, selectedBatchId, selectedCourseId]);

  const batchStudents = useMemo(
    () =>
      state.students
        .filter((s) => s.batchId === selectedBatchId)
        .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber)),
    [state.students, selectedBatchId]
  );

  // Initialize default PRESENT state for students in current batch
  useEffect(() => {
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const s of batchStudents) {
        if (!next[s.id]) {
          next[s.id] = AttendanceStatus.PRESENT;
        }
      }
      return next;
    });
  }, [batchStudents]);

  // Compute each student's historical standing
  const studentStandingMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateRecoveryMetrics>>();
    for (const s of state.students) {
      const recs = state.records.filter((r) => r.studentId === s.id);
      const attended = recs.filter((r) => isAttendedStatus(r.status)).length;
      map.set(s.id, calculateRecoveryMetrics(attended, recs.length, state.institution.attendanceThreshold));
    }
    return map;
  }, [state.students, state.records, state.institution.attendanceThreshold]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return batchStudents;
    return batchStudents.filter(
      (s) =>
        s.rollNumber.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
    );
  }, [batchStudents, searchQuery]);

  const liveTally = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let defaulters = 0;

    for (const s of batchStudents) {
      const st = statusMap[s.id] ?? AttendanceStatus.PRESENT;
      if (st === AttendanceStatus.PRESENT) present += 1;
      else if (st === AttendanceStatus.ABSENT) absent += 1;
      else if (st === AttendanceStatus.LATE) late += 1;

      const standing = studentStandingMap.get(s.id);
      if (standing?.isDefaulter) defaulters += 1;
    }

    return { present, absent, late, defaulters };
  }, [batchStudents, statusMap, studentStandingMap]);

  const handleToggleStudent = (studentId: string) => {
    setStatusMap((prev) => ({
      ...prev,
      [studentId]: cycleAttendanceStatus(prev[studentId] ?? AttendanceStatus.PRESENT),
    }));
  };

  const handleMarkAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of batchStudents) {
      next[s.id] = AttendanceStatus.PRESENT;
    }
    setStatusMap(next);
    setBannerMessage(`Marked all ${batchStudents.length} students Present.`);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setBannerMessage(null);
    if (!selectedCourseId || !selectedBatchId || batchStudents.length === 0) {
      setErrorMessage('Select a valid course and division with enrolled students.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitSession({
        courseId: selectedCourseId,
        batchId: selectedBatchId,
        date: lectureDate,
        slot,
        topic: topic.trim() || 'Scheduled Lecture',
        entries: batchStudents.map((s) => ({
          studentId: s.id,
          status: statusMap[s.id] ?? AttendanceStatus.PRESENT,
        })),
      });
      setBannerMessage(
        `Session synced for ${lectureDate} (${slot}) · ${liveTally.present} Present, ${liveTally.absent} Absent, ${liveTally.late} Late.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save attendance session.');
    } finally {
      setSubmitting(false);
    }
  };

  // Historical session details
  const activeHistorySession =
    sortedSessions.find((s) => s.id === selectedSessionId) ?? sortedSessions[0];
  const historyRecords = useMemo(() => {
    if (!activeHistorySession) return [];
    const studentById = new Map(state.students.map((s) => [s.id, s]));
    return state.records
      .filter((r) => r.sessionId === activeHistorySession.id)
      .map((r) => ({
        record: r,
        student: studentById.get(r.studentId),
      }))
      .filter((item): item is { record: AttendanceRecord; student: NonNullable<typeof item.student> } =>
        Boolean(item.student)
      )
      .sort((a, b) => a.student.rollNumber.localeCompare(b.student.rollNumber));
  }, [activeHistorySession, state.records, state.students]);

  const openCorrectionModal = (
    record: AttendanceRecord,
    session: AttendanceSession,
    studentName: string,
    rollNumber: string
  ) => {
    setEditingRecord({ record, session, studentName, rollNumber });
    setEditTargetStatus(
      record.status === AttendanceStatus.PRESENT
        ? AttendanceStatus.ABSENT
        : AttendanceStatus.PRESENT
    );
    setEditReason('');
    setEditError(null);
  };

  const handleSaveCorrection = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setEditError(null);

    const within48h = isWithinDirectEditWindow(editingRecord.session.date);
    if (editTargetStatus === editingRecord.record.status) {
      setEditError('Choose a different status than the current record.');
      return;
    }
    if (!within48h && editReason.trim().length < 8) {
      setEditError(
        'This session is older than 48 hours. Enter an administrative reason (minimum 8 characters).'
      );
      return;
    }
    if (editReason.trim().length < 3) {
      setEditError('Please enter a brief audit reason for this status change.');
      return;
    }

    setSavingEdit(true);
    try {
      await onCorrectRecord(editingRecord.record.id, {
        newStatus: editTargetStatus,
        reason: editReason.trim(),
      });
      setBannerMessage(
        `Audit log recorded: ${editingRecord.rollNumber} updated from ${editingRecord.record.status} to ${editTargetStatus}.`
      );
      setEditingRecord(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save correction.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            One-Tap Attendance &amp; Correction Engine
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Tap any student status button to cycle Present → Absent → Late, or inspect past
            sessions for audited edits.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Attendance workspace mode"
          className="inline-flex rounded-lg border border-[#1E293B] bg-[#131A26] p-1 self-start"
        >
          <button
            role="tab"
            type="button"
            aria-selected={mode === 'LIVE'}
            onClick={() => setMode('LIVE')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'LIVE' ? 'bg-[#3B82F6] text-white' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Live Roll Call
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={mode === 'HISTORY'}
            onClick={() => setMode('HISTORY')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'HISTORY'
                ? 'bg-[#3B82F6] text-white'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historical Correction ({sortedSessions.length})</span>
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-lg border border-[#10B981]/35 bg-[#10B981]/10 px-4 py-3 text-sm text-[#A7F3D0]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            aria-label="Dismiss notification"
            className="text-[#A7F3D0] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#FCA5A5]"
        >
          {errorMessage}
        </div>
      )}

      {mode === 'LIVE' ? (
        <>
          {/* Session Selector Panel */}
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label
                  htmlFor="mark-dept"
                  className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                >
                  Department
                </label>
                <select
                  id="mark-dept"
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  {state.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="mark-course"
                  className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                >
                  Course
                </label>
                <select
                  id="mark-course"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  {deptCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="mark-batch"
                  className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                >
                  Batch / Division
                </label>
                <select
                  id="mark-batch"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  {deptBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.division} (Sem {b.semester})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="mark-date"
                  className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                >
                  Lecture Date
                </label>
                <input
                  id="mark-date"
                  type="date"
                  value={lectureDate}
                  onChange={(e) => setLectureDate(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm font-mono text-white focus:border-[#3B82F6] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="mark-slot"
                  className="block text-xs font-medium text-[#94A3B8] mb-1.5"
                >
                  Time Slot
                </label>
                <select
                  id="mark-slot"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-[#1E293B]">
              <div className="flex-1">
                <label htmlFor="mark-topic" className="sr-only">
                  Lecture topic
                </label>
                <input
                  id="mark-topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Lecture topic covered (optional)"
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3.5 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>

              <div className="relative sm:w-64">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <label htmlFor="roster-search" className="sr-only">
                  Filter students by name or roll number
                </label>
                <input
                  id="roster-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roll no or name..."
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] pl-9 pr-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 hover:bg-[#10B981]/20 px-4 py-2 text-xs font-semibold text-[#34D399] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark All Present</span>
              </button>
            </div>
          </div>

          {/* Interactive One-Tap Attendance Matrix */}
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#94A3B8]">
                No students match your filter in this division.
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B]">
                {filteredStudents.map((student) => {
                  const currentStatus = statusMap[student.id] ?? AttendanceStatus.PRESENT;
                  const standing = studentStandingMap.get(student.id);

                  return (
                    <div
                      key={student.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#172030] transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="font-mono tabular-nums text-xs font-semibold text-[#94A3B8] w-20 shrink-0">
                          {student.rollNumber}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-[#94A3B8] font-mono tabular-nums mt-0.5">
                            Cumulative: {standing ? `${standing.percentage.toFixed(1)}%` : '100.0%'}
                            {standing?.isDefaulter && (
                              <span className="text-[#F87171] font-sans font-medium">
                                {' '}
                                · Below 75% (Needs {standing.classesNeededToReachThreshold})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleStudent(student.id)}
                          aria-label={`Set attendance for ${student.firstName} ${student.lastName}, currently ${currentStatus}`}
                          className={`min-w-[116px] h-11 px-4 text-xs font-semibold border rounded-lg active:scale-[0.98] cursor-pointer whitespace-nowrap ${statusStyle(
                            currentStatus
                          )}`}
                        >
                          {currentStatus}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Bottom Live Tally & Submit Bar */}
          <div className="fixed bottom-4 left-4 right-4 lg:left-72 lg:right-8 z-20 max-w-[1296px] mx-auto">
            <div className="rounded-xl border border-[#334155] bg-[#0B0F17] px-5 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.7)] flex flex-wrap items-center justify-between gap-4">
              <div
                data-testid="live-attendance-tally"
                className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs sm:text-sm font-mono tabular-nums"
              >
                <span className="text-[#34D399] font-semibold">
                  Present: {liveTally.present}
                </span>
                <span className="text-[#F87171] font-semibold">
                  Absent: {liveTally.absent}
                </span>
                <span className="text-[#FBBF24] font-semibold">Late: {liveTally.late}</span>
                <span className="text-[#94A3B8] hidden sm:inline">
                  Defaulter Alerts: {liveTally.defaulters}
                </span>
              </div>

              <button
                type="button"
                disabled={submitting || batchStudents.length === 0}
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Syncing...' : 'Submit Session'}</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Historical Correction & Audit Engine */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#1E293B]">
              <h2 className="text-sm font-semibold text-white">Recorded Sessions</h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Select any past lecture to rectify errors
              </p>
            </div>
            <div className="max-h-[540px] overflow-y-auto divide-y divide-[#1E293B]">
              {sortedSessions.map((sess) => {
                const course = state.courses.find((c) => c.id === sess.courseId);
                const batch = state.batches.find((b) => b.id === sess.batchId);
                const selected = activeHistorySession?.id === sess.id;
                const directWindow = isWithinDirectEditWindow(sess.date);

                return (
                  <button
                    key={sess.id}
                    type="button"
                    onClick={() => setSelectedSessionId(sess.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                      selected ? 'bg-[#3B82F6]/15' : 'hover:bg-[#172030]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono tabular-nums font-semibold text-white">
                        {sess.date} · {course?.code}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          directWindow ? 'text-[#34D399]' : 'text-[#FBBF24]'
                        }`}
                      >
                        {directWindow ? '48h Window' : 'Audit Reason Req.'}
                      </span>
                    </div>
                    <p className="text-xs text-[#CBD5E1] mt-1 truncate">{sess.topic}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {batch?.division} · {sess.slot}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            {activeHistorySession ? (
              <>
                <div className="px-5 py-4 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      {activeHistorySession.topic}
                    </h2>
                    <p className="text-xs text-[#94A3B8] mt-0.5 font-mono tabular-nums">
                      {activeHistorySession.date} · {activeHistorySession.slot} · Marked by{' '}
                      {activeHistorySession.markedByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span className="text-[#CBD5E1]">
                      {isWithinDirectEditWindow(activeHistorySession.date)
                        ? 'Inside 48-hour direct edit window'
                        : 'Post-48h policy: mandatory administrative reason'}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#1E293B]">
                  {historyRecords.map(({ record, student }) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-[#172030]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          <span className="font-mono text-xs text-[#94A3B8] mr-3">
                            {student.rollNumber}
                          </span>
                          {student.firstName} {student.lastName}
                        </p>
                        {record.remarks && (
                          <p className="text-xs text-[#94A3B8] mt-0.5 truncate">
                            Audit note: {record.remarks}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs font-mono font-semibold ${
                            record.status === AttendanceStatus.PRESENT
                              ? 'text-[#34D399]'
                              : record.status === AttendanceStatus.ABSENT
                              ? 'text-[#F87171]'
                              : record.status === AttendanceStatus.LATE
                              ? 'text-[#FBBF24]'
                              : 'text-[#7DD3FC]'
                          }`}
                        >
                          {record.status}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            openCorrectionModal(
                              record,
                              activeHistorySession,
                              `${student.firstName} ${student.lastName}`,
                              student.rollNumber
                            )
                          }
                          aria-label={`Edit attendance for ${student.firstName} ${student.lastName}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#1E293B] bg-[#0B0F17] hover:bg-[#1E293B] px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-10 text-center text-sm text-[#94A3B8]">
                No historical sessions found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mistake Correction Modal */}
      {editingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="correct-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-[#1E293B] bg-[#131A26] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="correct-modal-title" className="text-lg font-bold text-white">
                  Edit Attendance Record
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1 font-mono">
                  {editingRecord.rollNumber} · {editingRecord.studentName} ·{' '}
                  {editingRecord.session.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                aria-label="Close edit attendance dialog"
                className="p-1.5 text-[#94A3B8] hover:text-white rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isWithinDirectEditWindow(editingRecord.session.date) && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#F59E0B]/35 bg-[#F59E0B]/10 p-3 text-xs text-[#FDE68A]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This session is beyond the 48-hour direct edit window. An administrative
                  justification is required and will be logged permanently.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveCorrection} className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-[#1E293B] pb-3">
                <span className="text-[#94A3B8]">Current Recorded Status</span>
                <span className="font-mono font-semibold text-white">
                  {editingRecord.record.status}
                </span>
              </div>

              <div>
                <label
                  htmlFor="edit-new-status"
                  className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                >
                  Updated Status
                </label>
                <select
                  id="edit-new-status"
                  value={editTargetStatus}
                  onChange={(e) => setEditTargetStatus(e.target.value as AttendanceStatus)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2.5 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value={AttendanceStatus.PRESENT}>PRESENT</option>
                  <option value={AttendanceStatus.ABSENT}>ABSENT</option>
                  <option value={AttendanceStatus.LATE}>LATE</option>
                  <option value={AttendanceStatus.EXCUSED}>EXCUSED</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-reason"
                  className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                >
                  Audit Correction Reason
                </label>
                <textarea
                  id="edit-reason"
                  rows={3}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Describe why this attendance entry is being corrected..."
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>

              {editError && (
                <p role="alert" className="text-xs font-medium text-[#F87171]">
                  {editError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white bg-[#1E293B] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save & Log Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
