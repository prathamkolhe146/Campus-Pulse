import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Lock,
  Printer,
  X,
} from 'lucide-react';
import {
  calculateRecoveryMetrics,
  computeStudentAnalytics,
  HeatmapDayEntry,
} from '../lib/attendanceMath';
import { AttendanceStatus, CampusStatePayload, UserAccount } from '../lib/types';

interface StudentPortalProps {
  section: string;
  user: UserAccount;
  state: CampusStatePayload;
}

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function heatmapCellStyle(status: HeatmapDayEntry['status'], isSelected: boolean): string {
  const ring = isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-[#131A26]' : '';
  switch (status) {
    case 'ALL_PRESENT':
      return `bg-[#10B981]/85 hover:bg-[#10B981] text-[#052E16] ${ring}`;
    case 'HAS_LATE':
      return `bg-[#F59E0B]/85 hover:bg-[#F59E0B] text-[#451A03] ${ring}`;
    case 'HAS_ABSENT':
      return `bg-[#EF4444]/85 hover:bg-[#EF4444] text-white ${ring}`;
    case 'NO_CLASS':
      return `bg-[#1E293B]/55 hover:bg-[#334155] text-[#64748B] ${ring}`;
  }
}

export function StudentPortal({ section, user, state }: StudentPortalProps) {
  // Strictly scoped to the authenticated student's own record (no cross-student selector)
  const activeStudent =
    state.students.find((s) => s.userId === user.id || s.email === user.email) ??
    state.students[0];

  const [whatIfDelta, setWhatIfDelta] = useState<number>(0);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-20');
  const [showReportModal, setShowReportModal] = useState(false);

  const summary = useMemo(() => {
    if (!activeStudent) return null;
    return computeStudentAnalytics(
      activeStudent,
      state.sessions,
      state.records,
      state.courses,
      '2026-11-21',
      state.institution.attendanceThreshold
    );
  }, [activeStudent, state]);

  const projected = useMemo(() => {
    if (!summary) return null;
    const extraTotal = Math.abs(whatIfDelta);
    const extraAttended = whatIfDelta > 0 ? whatIfDelta : 0;
    return calculateRecoveryMetrics(
      summary.overall.attended + extraAttended,
      summary.overall.total + extraTotal,
      state.institution.attendanceThreshold
    );
  }, [summary, whatIfDelta, state.institution.attendanceThreshold]);

  const allDaysIndex = useMemo(() => {
    const map = new Map<string, HeatmapDayEntry>();
    if (!summary) return map;
    for (const monthGroup of summary.monthlyHeatmaps) {
      for (const day of monthGroup.days) {
        map.set(day.date, day);
      }
    }
    return map;
  }, [summary]);

  if (!summary || !activeStudent || !projected) {
    return (
      <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-8 text-center text-sm text-[#94A3B8]">
        Student profile not found.
      </div>
    );
  }

  const displayedMonths =
    selectedMonthKey === 'ALL'
      ? summary.monthlyHeatmaps
      : summary.monthlyHeatmaps.filter((m) => m.monthKey === selectedMonthKey);

  const fallbackDay =
    displayedMonths
      .flatMap((m) => m.days)
      .slice()
      .reverse()
      .find((d) => d.lectures.length > 0) ??
    summary.heatmapDays[summary.heatmapDays.length - 1];

  const activeDay = allDaysIndex.get(selectedDate) ?? fallbackDay;

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonthKey(monthKey);
    if (monthKey !== 'ALL') {
      const targetMonth = summary.monthlyHeatmaps.find((m) => m.monthKey === monthKey);
      const latestLectureDay = targetMonth?.days
        .slice()
        .reverse()
        .find((d) => d.lectures.length > 0);
      if (latestLectureDay) {
        setSelectedDate(latestLectureDay.date);
      }
    }
  };

  // Radial progress SVG math
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, summary.overall.percentage) / 100) * circumference;

  const batch = state.batches.find((b) => b.id === activeStudent.batchId);
  const department = state.departments.find((d) => d.id === activeStudent.departmentId);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {activeStudent.firstName} {activeStudent.lastName}
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1 font-mono">
            {activeStudent.rollNumber} · {department?.code ?? 'COMP'} · {batch?.name}{' '}
            {batch?.division} · {state.institution.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <Lock className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Personal Student Record Only</span>
          </span>

          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Download Attendance Report</span>
          </button>
        </div>
      </div>

      {/* Hero Metric Bento Grid */}
      {section !== 'history' && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card 1: Radial Attendance Gauge */}
          <div className="lg:col-span-4 rounded-xl border border-[#1E293B] bg-[#131A26] p-6 flex items-center gap-6">
            <div className="relative w-32 h-32 shrink-0">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 132 132" aria-hidden="true">
                <circle
                  cx="66"
                  cy="66"
                  r={radius}
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="10"
                />
                <circle
                  cx="66"
                  cy="66"
                  r={radius}
                  fill="none"
                  stroke={summary.overall.isDefaulter ? '#EF4444' : '#10B981'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  data-testid="student-overall-pct"
                  className="text-2xl font-bold font-mono tabular-nums text-white"
                >
                  {summary.overall.percentage.toFixed(1)}%
                </span>
                <span className="text-[11px] text-[#94A3B8]">Semester</span>
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <p className="text-xs font-medium text-[#94A3B8]">Standing Status</p>
              <p
                className={`text-base font-bold ${
                  summary.overall.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                }`}
              >
                {summary.overall.isDefaulter ? 'Below 75% Threshold' : 'Exam Eligible'}
              </p>
              <p className="text-xs font-mono tabular-nums text-[#CBD5E1]">
                {summary.overall.attended} / {summary.overall.total} lectures credited
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[#64748B]">
                P: {summary.presentCount} · L: {summary.lateCount} · E: {summary.excusedCount} ·
                A: {summary.absentCount}
              </p>
            </div>
          </div>

          {/* Card 2: 75% Recovery & Safe-Bunk Predictor */}
          <div className="lg:col-span-8 rounded-xl border border-[#1E293B] bg-[#131A26] p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#94A3B8]">
                  75% Recovery &amp; Safe-Bunk Predictor
                </p>
                <h2
                  data-testid="student-predictor-headline"
                  className={`mt-1.5 text-xl font-bold leading-snug ${
                    summary.overall.isDefaulter ? 'text-[#FCA5A5]' : 'text-[#A7F3D0]'
                  }`}
                >
                  {summary.overall.headline}
                </h2>
                <p className="mt-1 text-xs text-[#94A3B8]">{summary.overall.subtext}</p>
              </div>
              {summary.overall.isDefaulter ? (
                <AlertTriangle className="w-6 h-6 text-[#F87171] shrink-0" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-[#34D399] shrink-0" />
              )}
            </div>

            {/* Interactive What-If Scenario Simulator */}
            <div className="mt-5 border-t border-[#1E293B] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                <label htmlFor="whatif-slider" className="text-[#CBD5E1] font-medium">
                  What-If Projection:{' '}
                  <span className="font-mono text-white">
                    {whatIfDelta === 0
                      ? 'Current state'
                      : whatIfDelta > 0
                      ? `Attend next ${whatIfDelta} lectures`
                      : `Miss next ${Math.abs(whatIfDelta)} lectures`}
                  </span>
                </label>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    projected.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                  }`}
                >
                  Projected: {projected.percentage.toFixed(1)}% ({projected.attended}/
                  {projected.total})
                </span>
              </div>
              <input
                id="whatif-slider"
                type="range"
                min={-8}
                max={8}
                value={whatIfDelta}
                onChange={(e) => setWhatIfDelta(Number(e.target.value))}
                className="w-full accent-[#3B82F6] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-[#64748B] mt-1">
                <span>Miss 8</span>
                <span>Current (0)</span>
                <span>Attend +8</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Month-Wise Attendance Cards (All Months of Semester) */}
      <div className="no-print rounded-xl border border-[#1E293B] bg-[#131A26] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Month-Wise Attendance Summary ({summary.monthlyHeatmaps.length} Months)
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Click any month to filter the calendar heatmap below, or view all months together
            </p>
          </div>
          {selectedMonthKey !== 'ALL' && (
            <button
              type="button"
              onClick={() => handleSelectMonth('ALL')}
              className="text-xs font-semibold text-[#38BDF8] hover:text-white cursor-pointer"
            >
              Show All Months
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summary.monthlyHeatmaps.map((month) => {
            const isSelected = selectedMonthKey === month.monthKey;
            return (
              <button
                key={month.monthKey}
                type="button"
                onClick={() =>
                  handleSelectMonth(isSelected ? 'ALL' : month.monthKey)
                }
                aria-pressed={isSelected}
                className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#3B82F6] bg-[#3B82F6]/15'
                    : 'border-[#1E293B] bg-[#0B0F17] hover:border-[#334155]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white">{month.label}</span>
                  <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                </div>
                <p
                  className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                    month.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                  }`}
                >
                  {month.percentage.toFixed(1)}%
                </p>
                <p className="mt-1 text-[11px] font-mono tabular-nums text-[#94A3B8]">
                  {month.attended}/{month.total} credited · {month.absentCount} absent
                </p>
                <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#1E293B] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      month.isDefaulter ? 'bg-[#EF4444]' : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${Math.min(100, month.percentage)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* All-Month & Month-Wise Calendar Heatmap + Daily Lecture Log */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-[#1E293B] bg-[#131A26] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                All-Month Attendance Heatmap
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Hover or click any date tile across all recorded months to inspect lectures
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" /> Present
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" /> Late
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" /> Missed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1E293B]" /> No Class
              </span>
            </div>
          </div>

          {/* Month Filter Bar */}
          <div
            role="tablist"
            aria-label="Filter heatmap by month"
            className="flex flex-wrap gap-1.5 mb-5 pb-4 border-b border-[#1E293B]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedMonthKey === 'ALL'}
              onClick={() => handleSelectMonth('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedMonthKey === 'ALL'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#0B0F17] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              All Months ({summary.monthlyHeatmaps.length})
            </button>
            {summary.monthlyHeatmaps.map((m) => (
              <button
                key={m.monthKey}
                type="button"
                role="tab"
                aria-selected={selectedMonthKey === m.monthKey}
                onClick={() => handleSelectMonth(m.monthKey)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  selectedMonthKey === m.monthKey
                    ? 'bg-[#3B82F6] text-white'
                    : 'bg-[#0B0F17] text-[#94A3B8] hover:text-white border border-[#1E293B]'
                }`}
              >
                {m.shortLabel}
              </button>
            ))}
          </div>

          {/* Calendar Grids */}
          <div
            className={`grid gap-5 ${
              displayedMonths.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {displayedMonths.map((month) => (
              <div
                key={month.monthKey}
                className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{month.label}</h3>
                    <p className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                      {month.attended}/{month.total} lectures
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums ${
                      month.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                    }`}
                  >
                    {month.percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-center text-[10px] font-mono text-[#64748B]">
                  {WEEKDAY_HEADERS.map((wd, i) => (
                    <span key={`${month.monthKey}-wd-${i}`}>{wd}</span>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: month.leadingEmptySlots }).map((_, idx) => (
                    <div key={`${month.monthKey}-empty-${idx}`} aria-hidden="true" />
                  ))}
                  {month.days.map((day) => {
                    const isSelected = activeDay?.date === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        onMouseEnter={() => setSelectedDate(day.date)}
                        aria-label={`${day.date} (${day.weekday}): ${day.status.replace('_', ' ')}`}
                        className={`h-8 rounded-md flex items-center justify-center text-[11px] font-mono font-bold tabular-nums transition-all cursor-pointer ${heatmapCellStyle(
                          day.status,
                          isSelected
                        )}`}
                      >
                        {day.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Day Lecture Detail Panel */}
        <div className="lg:col-span-4 rounded-xl border border-[#1E293B] bg-[#131A26] p-6 self-start lg:sticky lg:top-24">
          <div className="border-b border-[#1E293B] pb-3.5">
            <h2 className="text-base font-semibold text-white">Daily Lecture Log</h2>
            <p
              data-testid="student-selected-date"
              className="text-xs font-mono text-[#94A3B8] mt-0.5"
            >
              {activeDay.date} ({activeDay.weekday}) · {activeDay.lectures.length} scheduled{' '}
              {activeDay.lectures.length === 1 ? 'lecture' : 'lectures'}
            </p>
          </div>

          {activeDay.lectures.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#94A3B8]">
              No classes conducted on {activeDay.date}.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#1E293B]">
              {activeDay.lectures.map((lec) => (
                <div key={lec.sessionId} className="py-3.5 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">
                      <span className="font-mono text-xs text-[#38BDF8] mr-2">
                        {lec.courseCode}
                      </span>
                      {lec.courseName}
                    </span>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        lec.status === AttendanceStatus.PRESENT
                          ? 'text-[#34D399]'
                          : lec.status === AttendanceStatus.ABSENT
                          ? 'text-[#F87171]'
                          : lec.status === AttendanceStatus.LATE
                          ? 'text-[#FBBF24]'
                          : 'text-[#7DD3FC]'
                      }`}
                    >
                      {lec.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#CBD5E1] mt-1">{lec.topic}</p>
                  <p className="text-[11px] font-mono text-[#64748B] mt-0.5">{lec.slot}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Course-Wise Progress Breakdown */}
      {section !== 'history' && (
        <div className="no-print rounded-xl border border-[#1E293B] bg-[#131A26] p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Course-Wise Attendance Pulse
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Individual subject standing against the 75% exam eligibility line
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {summary.courseBreakdowns.map((course) => {
              const barColor = course.recovery.isDefaulter
                ? 'bg-[#EF4444]'
                : course.percentage >= 85
                ? 'bg-[#10B981]'
                : 'bg-[#3B82F6]';
              return (
                <div
                  key={course.courseId}
                  className="border-t border-[#1E293B] pt-4 first:border-t-0 first:pt-0 md:nth-2:border-t-0 md:nth-2:pt-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        <span className="font-mono text-xs text-[#38BDF8] mr-2">
                          {course.courseCode}
                        </span>
                        {course.courseName}
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        {course.recovery.headline}
                      </p>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <p
                        className={`text-sm font-bold ${
                          course.recovery.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                        }`}
                      >
                        {course.percentage.toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {course.attended}/{course.total}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-3 h-2 w-full rounded-full bg-[#0B0F17] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${Math.min(100, course.percentage)}%` }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                      style={{ left: '75%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Printable Student Monthly Report Modal */}
      {showReportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-report-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-6 backdrop-blur-sm"
        >
          <div className="mx-auto max-w-3xl rounded-xl bg-white text-slate-900 p-6 sm:p-8 shadow-2xl print-surface">
            <div className="no-print flex items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
              <h2 id="student-report-title" className="text-base font-bold text-slate-900">
                Student Attendance Summary Report
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  aria-label="Close student report preview"
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-600">{state.institution.code}</p>
                <h3 className="text-xl font-bold text-slate-900">{state.institution.name}</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Student Attendance Transcript · {state.institution.academicYear}
                </p>
              </div>
              <div className="text-right text-xs font-mono text-slate-700">
                <p className="font-bold text-slate-900">
                  {activeStudent.firstName} {activeStudent.lastName}
                </p>
                <p>Roll No: {activeStudent.rollNumber}</p>
                <p>
                  {department?.code} · {batch?.division}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm">
              <div>
                <p className="text-xs text-slate-500">Overall Attendance</p>
                <p className="text-xl font-bold font-mono text-slate-900">
                  {summary.overall.percentage.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Credited / Conducted</p>
                <p className="text-xl font-bold font-mono text-slate-900">
                  {summary.overall.attended} / {summary.overall.total}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Eligibility Status</p>
                <p
                  className={`text-sm font-bold mt-1 ${
                    summary.overall.isDefaulter ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {summary.overall.isDefaulter ? 'DEFAULTER (<75%)' : 'ELIGIBLE (>=75%)'}
                </p>
              </div>
            </div>

            {/* Month-Wise Table */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Month-Wise Attendance Summary
            </h4>
            <table className="w-full text-xs border border-slate-300 border-collapse mb-6">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left">Month</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Attended</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Total</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Absent</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {summary.monthlyHeatmaps.map((m) => (
                  <tr key={m.monthKey}>
                    <td className="border border-slate-300 px-3 py-2 font-medium">{m.label}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {m.attended}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {m.total}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {m.absentCount}
                    </td>
                    <td
                      className={`border border-slate-300 px-3 py-2 text-right font-mono font-semibold ${
                        m.isDefaulter ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {m.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Course-Wise Table */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Course-Wise Standing
            </h4>
            <table className="w-full text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left">Course</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Attended</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">Total</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">%</th>
                  <th className="border border-slate-300 px-3 py-2 text-left">Actionable Note</th>
                </tr>
              </thead>
              <tbody>
                {summary.courseBreakdowns.map((c) => (
                  <tr key={c.courseId}>
                    <td className="border border-slate-300 px-3 py-2 font-medium">
                      {c.courseCode} · {c.courseName}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {c.attended}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                      {c.total}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono font-semibold">
                      {c.percentage.toFixed(1)}%
                    </td>
                    <td className="border border-slate-300 px-3 py-2">{c.recovery.headline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
