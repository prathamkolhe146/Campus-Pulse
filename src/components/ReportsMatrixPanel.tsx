import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Filter,
  Printer,
  X,
} from 'lucide-react';
import { calculateRecoveryMetrics } from '../lib/attendanceMath';
import { buildMonthlyMatrixCsv, buildMonthlyMatrixData } from '../lib/csvExport';
import { CampusStatePayload } from '../lib/types';

interface ReportsMatrixPanelProps {
  state: CampusStatePayload;
  onExportCsvFromServer?: (params: {
    year: number;
    month: number;
    batchId: string;
    courseId: string;
  }) => Promise<string>;
}

const MONTH_OPTIONS = [
  { label: 'November 2026', year: 2026, month: 11 },
  { label: 'October 2026', year: 2026, month: 10 },
  { label: 'September 2026', year: 2026, month: 9 },
  { label: 'August 2026', year: 2026, month: 8 },
];

export function ReportsMatrixPanel({
  state,
  onExportCsvFromServer,
}: ReportsMatrixPanelProps) {
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const [selectedDeptId, setSelectedDeptId] = useState('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState(state.batches[0]?.id ?? '');
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [onlyDefaulters, setOnlyDefaulters] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const visibleBatches = useMemo(
    () =>
      selectedDeptId === 'ALL'
        ? state.batches
        : state.batches.filter((b) => b.departmentId === selectedDeptId),
    [state.batches, selectedDeptId]
  );

  const effectiveBatchId = visibleBatches.some((b) => b.id === selectedBatchId)
    ? selectedBatchId
    : visibleBatches[0]?.id ?? '';

  const activeMonth = MONTH_OPTIONS[selectedMonthIdx];
  const selectedBatch = state.batches.find((b) => b.id === effectiveBatchId);
  const selectedDepartment = state.departments.find(
    (d) => d.id === selectedBatch?.departmentId
  );
  const batchCourses = useMemo(
    () =>
      state.courses.filter(
        (c) => !selectedBatch || c.departmentId === selectedBatch.departmentId
      ),
    [state.courses, selectedBatch]
  );

  const batchStudents = useMemo(
    () => state.students.filter((s) => s.batchId === effectiveBatchId),
    [state.students, effectiveBatchId]
  );

  const matrix = useMemo(
    () =>
      buildMonthlyMatrixData(
        batchStudents,
        state.sessions,
        state.records,
        activeMonth.year,
        activeMonth.month,
        selectedCourseId
      ),
    [
      batchStudents,
      state.sessions,
      state.records,
      activeMonth.year,
      activeMonth.month,
      selectedCourseId,
    ]
  );

  const displayedRows = useMemo(
    () => (onlyDefaulters ? matrix.rows.filter((r) => r.isDefaulter) : matrix.rows),
    [matrix.rows, onlyDefaulters]
  );

  const summary = useMemo(() => {
    const total = matrix.rows.length;
    const defaulters = matrix.rows.filter((r) => r.isDefaulter).length;
    const eligible = total - defaulters;
    const avg =
      total > 0
        ? matrix.rows.reduce((sum, r) => sum + r.percentage, 0) / total
        : 0;
    return { total, defaulters, eligible, avg };
  }, [matrix.rows]);

  const handleDownloadCsv = async () => {
    let csvContent: string;
    if (onExportCsvFromServer) {
      csvContent = await onExportCsvFromServer({
        year: activeMonth.year,
        month: activeMonth.month,
        batchId: effectiveBatchId,
        courseId: selectedCourseId,
      });
    } else {
      csvContent = buildMonthlyMatrixCsv(
        batchStudents,
        state.sessions,
        state.records,
        activeMonth.year,
        activeMonth.month,
        selectedCourseId
      );
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tcer-attendance-${selectedDepartment?.code.toLowerCase() ?? 'dept'}-${selectedBatch?.division?.replace(/\s+/g, '-').toLowerCase() ?? 'batch'}-${activeMonth.year}-${String(activeMonth.month).padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportNotice(
      `Exported ${activeMonth.label} horizontal 1–${matrix.days.length} CSV matrix (${matrix.rows.length} students).`
    );
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Monthly Compliance Matrix &amp; Defaulter Suite
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Inspect every department and month (Aug–Nov 2026), isolate students below 75%,
            export horizontal 1–31 CSV spreadsheets, or print official A4 registers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOnlyDefaulters((v) => !v)}
            aria-pressed={onlyDefaulters}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              onlyDefaulters
                ? 'border-[#EF4444]/60 bg-[#EF4444]/20 text-[#FCA5A5]'
                : 'border-[#1E293B] bg-[#131A26] text-[#CBD5E1] hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>
              {onlyDefaulters
                ? `Showing Defaulters (<75%) · ${summary.defaulters}`
                : `1-Tap Defaulters (<75%) · ${summary.defaulters}`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#131A26] hover:bg-[#1E293B] px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Monthly CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Official A4 Register</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          role="status"
          className="no-print flex items-center justify-between rounded-lg border border-[#10B981]/35 bg-[#10B981]/10 px-4 py-2.5 text-xs text-[#A7F3D0]"
        >
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            aria-label="Dismiss export notice"
            className="cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
        <div>
          <label htmlFor="report-month" className="block text-xs text-[#94A3B8] mb-1">
            Month Cycle
          </label>
          <select
            id="report-month"
            value={selectedMonthIdx}
            onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
          >
            {MONTH_OPTIONS.map((m, idx) => (
              <option key={m.label} value={idx}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-department" className="block text-xs text-[#94A3B8] mb-1">
            Department
          </label>
          <select
            id="report-department"
            value={selectedDeptId}
            onChange={(e) => {
              const nextDept = e.target.value;
              setSelectedDeptId(nextDept);
              const firstMatch =
                nextDept === 'ALL'
                  ? state.batches[0]
                  : state.batches.find((b) => b.departmentId === nextDept);
              if (firstMatch) setSelectedBatchId(firstMatch.id);
              setSelectedCourseId('ALL');
            }}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="ALL">All Departments ({state.departments.length})</option>
            {state.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-batch" className="block text-xs text-[#94A3B8] mb-1">
            Batch / Division
          </label>
          <select
            id="report-batch"
            value={effectiveBatchId}
            onChange={(e) => {
              setSelectedBatchId(e.target.value);
              setSelectedCourseId('ALL');
            }}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
          >
            {visibleBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.division}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-course" className="block text-xs text-[#94A3B8] mb-1">
            Course Filter
          </label>
          <select
            id="report-course"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="ALL">All Courses Combined</option>
            {batchCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
          <p className="text-xs text-[#94A3B8]">Enrolled in Division</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
            {summary.total}
          </p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
          <p className="text-xs text-[#94A3B8]">Eligible (&ge; 75%)</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#34D399]">
            {summary.eligible}
          </p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
          <p className="text-xs text-[#94A3B8]">Defaulters (&lt; 75%)</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#F87171]">
            {summary.defaulters}
          </p>
        </div>
        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
          <p className="text-xs text-[#94A3B8]">Monthly Batch Average</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#38BDF8]">
            {summary.avg.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Horizontal 1–31 Matrix Table */}
      <div className="no-print rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E293B] flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-white">
            {activeMonth.label} Horizontal Attendance Register ({displayedRows.length} rows)
          </h2>
          <span className="text-xs font-mono text-[#94A3B8]">
            P = Present · A = Absent · L = Late · E = Excused
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-[#1E293B] text-[#94A3B8] font-mono">
              <tr>
                <th className="sticky left-0 z-10 bg-[#131A26] px-4 py-3 font-medium">
                  Roll No
                </th>
                <th className="px-4 py-3 font-medium min-w-[160px]">Student</th>
                {matrix.days.map((d) => (
                  <th key={d} className="px-1.5 py-3 text-center font-medium tabular-nums">
                    {String(d).padStart(2, '0')}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-medium">Att/Held</th>
                <th className="px-3 py-3 text-right font-medium">%</th>
                <th className="px-4 py-3 font-medium">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B] font-mono tabular-nums">
              {displayedRows.map((row) => {
                const rec = calculateRecoveryMetrics(row.attended, row.held, 75);
                return (
                  <tr key={row.studentId} className="hover:bg-[#172030]">
                    <td className="sticky left-0 z-10 bg-[#131A26] px-4 py-2.5 text-[#CBD5E1]">
                      {row.rollNumber}
                    </td>
                    <td className="px-4 py-2.5 font-sans font-medium text-white whitespace-nowrap">
                      {row.studentName}
                    </td>
                    {matrix.days.map((d) => {
                      const code = row.dailyCodes[d] ?? '·';
                      const colorCls = code.includes('A')
                        ? 'text-[#F87171] font-semibold'
                        : code.includes('L')
                        ? 'text-[#FBBF24] font-semibold'
                        : code.includes('E')
                        ? 'text-[#7DD3FC] font-semibold'
                        : code.includes('P')
                        ? 'text-[#34D399]'
                        : 'text-[#334155]';
                      return (
                        <td key={d} className={`px-1.5 py-2.5 text-center ${colorCls}`}>
                          {code}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right text-[#CBD5E1]">
                      {row.attended}/{row.held}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold ${
                        row.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                      }`}
                    >
                      {row.percentage.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 font-sans whitespace-nowrap">
                      {row.isDefaulter ? (
                        <span className="inline-flex items-center gap-1 text-[#F87171]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Needs +{rec.classesNeededToReachThreshold}</span>
                        </span>
                      ) : (
                        <span className="text-[#34D399]">Eligible</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Printable A4 Register Modal */}
      {showPrintModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-register-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-6 backdrop-blur-sm"
        >
          <div className="mx-auto max-w-6xl rounded-xl bg-white text-slate-900 p-6 sm:p-8 shadow-2xl print-surface">
            <div className="no-print flex items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
              <div>
                <h2 id="print-register-title" className="text-base font-bold text-slate-900">
                  Official A4 Monthly Attendance Register Preview
                </h2>
                <p className="text-xs text-slate-500">
                  Formatted for landscape A4 PDF printing with faculty signature &amp; institutional seal block.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  aria-label="Close print register preview"
                  className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Official Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-600">
                  {state.institution.code} · OFFICIAL ACADEMIC ATTENDANCE REGISTER
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {state.institution.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">{state.institution.address}</p>
              </div>
              <div className="text-right text-xs text-slate-700 space-y-0.5 font-mono">
                <p>Department: {selectedDepartment?.name ?? 'All Departments'}</p>
                <p>
                  Batch: {selectedBatch?.name} · {selectedBatch?.division}
                </p>
                <p>Period: {activeMonth.label}</p>
                <p>Eligibility Threshold: {state.institution.attendanceThreshold}%</p>
              </div>
            </div>

            {/* Print Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border border-slate-300 border-collapse font-mono tabular-nums">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="border border-slate-300 px-2 py-1.5 text-left">Roll No</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-sans">
                      Student Name
                    </th>
                    {matrix.days.map((d) => (
                      <th key={d} className="border border-slate-300 px-1 py-1.5 text-center">
                        {d}
                      </th>
                    ))}
                    <th className="border border-slate-300 px-2 py-1.5 text-right">Att/Held</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row) => (
                    <tr key={row.studentId} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-2 py-1">{row.rollNumber}</td>
                      <td className="border border-slate-300 px-2 py-1 font-sans">
                        {row.studentName}
                      </td>
                      {matrix.days.map((d) => (
                        <td
                          key={d}
                          className={`border border-slate-300 px-1 py-1 text-center ${
                            row.dailyCodes[d]?.includes('A') ? 'font-bold text-red-700' : ''
                          }`}
                        >
                          {row.dailyCodes[d] ?? ''}
                        </td>
                      ))}
                      <td className="border border-slate-300 px-2 py-1 text-right">
                        {row.attended}/{row.held}
                      </td>
                      <td
                        className={`border border-slate-300 px-2 py-1 text-right font-semibold ${
                          row.isDefaulter ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {row.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Official Signature & Seal Block */}
            <div className="mt-10 grid grid-cols-3 gap-8 pt-6 text-xs text-slate-700">
              <div className="border-t border-slate-400 pt-2">
                <p className="font-semibold text-slate-900">Faculty In-Charge Signature</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Date &amp; Employee ID</p>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-semibold text-slate-900">Head of Department Verification</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedDepartment?.hodName ?? 'Department Chair'}
                </p>
              </div>
              <div className="border border-dashed border-slate-400 rounded-md p-3 text-center">
                <p className="font-semibold text-slate-900">Official Institutional Seal</p>
                <p className="text-[11px] text-slate-500 mt-1">{state.institution.code}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
