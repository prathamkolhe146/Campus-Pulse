import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Mail,
  MapPin,
  Menu,
  Printer,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  calculateErpSavings,
  calculateRecoveryMetrics,
  cycleAttendanceStatus,
} from '../lib/attendanceMath';
import { AttendanceStatus, Role } from '../lib/types';

interface LandingPageProps {
  onOpenLogin: (defaultTab?: 'ADMIN' | 'STAFF' | 'STUDENT') => void;
  onQuickDemoRole: (role: Role) => void;
  isBusy: boolean;
}

interface MicroDemoStudent {
  roll: string;
  name: string;
  status: AttendanceStatus;
}

const INITIAL_DEMO_ROSTER: MicroDemoStudent[] = [
  { roll: 'TC24001', name: 'Ananya Sharma', status: AttendanceStatus.PRESENT },
  { roll: 'TC24002', name: 'Rohan Deshmukh', status: AttendanceStatus.ABSENT },
  { roll: 'TC24003', name: 'Diya Krishnan', status: AttendanceStatus.PRESENT },
  { roll: 'TC24004', name: 'Kabir Malhotra', status: AttendanceStatus.LATE },
];

const LANDING_HEATMAP_PREVIEW: Record<
  'Aug' | 'Sep' | 'Oct' | 'Nov',
  { pct: number; attended: number; total: number; cells: Array<'P' | 'L' | 'A' | 'H'> }
> = {
  Aug: {
    pct: 91.7,
    attended: 11,
    total: 12,
    cells: ['H', 'P', 'P', 'H', 'P', 'P', 'H', 'H', 'P', 'L', 'P', 'H', 'P', 'H', 'H', 'P', 'A', 'P', 'P', 'P', 'H'],
  },
  Sep: {
    pct: 85.7,
    attended: 12,
    total: 14,
    cells: ['P', 'P', 'H', 'P', 'A', 'H', 'H', 'P', 'P', 'L', 'P', 'P', 'H', 'H', 'P', 'P', 'A', 'P', 'P', 'P', 'H'],
  },
  Oct: {
    pct: 80.0,
    attended: 12,
    total: 15,
    cells: ['P', 'A', 'P', 'P', 'P', 'H', 'H', 'L', 'P', 'P', 'A', 'P', 'H', 'H', 'P', 'P', 'P', 'A', 'P', 'P', 'H'],
  },
  Nov: {
    pct: 87.5,
    attended: 14,
    total: 16,
    cells: ['P', 'P', 'P', 'L', 'P', 'H', 'H', 'P', 'A', 'P', 'P', 'P', 'H', 'H', 'P', 'P', 'A', 'P', 'P', 'P', 'H'],
  },
};

const FAQ_ITEMS = [
  {
    q: 'How is role access restricted after logging into an account?',
    a: 'Every session is bound server-side to the authenticated user role (College Admin, Faculty, Operator, or Student). Cross-portal navigation is blocked with a 403 Access Restricted guard, and API responses only return records authorized for that role.',
  },
  {
    q: 'Can students inspect month-wise attendance across the whole semester?',
    a: 'Yes. The Student Portal provides month-by-month summary cards (August through November) plus an interactive All-Months semester calendar heatmap where clicking any date displays the exact lecture topics, time slots, and markings.',
  },
  {
    q: 'What can the Trinity College Admin view and export?',
    a: 'College Admins have unified institutional visibility across all departments, all teachers and operators, every enrolled student across divisions, global <75% defaulter lists, 1–31 monthly CSV matrices, official printable A4 registers, and the immutable Audit Log Vault.',
  },
  {
    q: 'How does the 48-hour mistake correction audit trail work?',
    a: 'Faculty can correct accidental attendance taps directly within 48 hours of a lecture. Edits after 48 hours enforce an administrative reason of at least 8 characters, and every modification is appended permanently to the Audit Log Vault.',
  },
];

function getStatusButtonClasses(status: AttendanceStatus): string {
  switch (status) {
    case AttendanceStatus.PRESENT:
      return 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/60 hover:bg-[#10B981]/30';
    case AttendanceStatus.ABSENT:
      return 'bg-[#EF4444]/20 text-[#FCA5A5] border-[#EF4444]/65 hover:bg-[#EF4444]/30';
    case AttendanceStatus.LATE:
      return 'bg-[#F59E0B]/20 text-[#FDE68A] border-[#F59E0B]/65 hover:bg-[#F59E0B]/30';
    default:
      return 'bg-[#38BDF8]/20 text-[#7DD3FC] border-[#38BDF8]/60';
  }
}

export function LandingPage({
  onOpenLogin,
  onQuickDemoRole,
  isBusy,
}: LandingPageProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [microRoster, setMicroRoster] = useState<MicroDemoStudent[]>(INITIAL_DEMO_ROSTER);
  const [studentCount, setStudentCount] = useState<number>(3200);
  const [simAttended, setSimAttended] = useState<number>(26);
  const [simTotal, setSimTotal] = useState<number>(36);
  const [previewMonth, setPreviewMonth] = useState<'Aug' | 'Sep' | 'Oct' | 'Nov'>('Nov');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const savings = useMemo(() => calculateErpSavings(studentCount), [studentCount]);
  const recoveryPreview = useMemo(
    () => calculateRecoveryMetrics(simAttended, simTotal, 75),
    [simAttended, simTotal]
  );

  const microCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    for (const s of microRoster) {
      if (s.status === AttendanceStatus.PRESENT) present += 1;
      else if (s.status === AttendanceStatus.ABSENT) absent += 1;
      else late += 1;
    }
    const creditedPct = Math.round(((present + late) / microRoster.length) * 100);
    return { present, absent, late, creditedPct };
  }, [microRoster]);

  const handleToggleDemoStudent = (roll: string) => {
    setMicroRoster((prev) =>
      prev.map((item) =>
        item.roll === roll
          ? { ...item, status: cycleAttendanceStatus(item.status) }
          : item
      )
    );
  };

  const activePreviewMonth = LANDING_HEATMAP_PREVIEW[previewMonth];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F1F5F9]">
      {/* Clean 3-Zone Top Bar Contract with Responsive Mobile Menu */}
      <header className="sticky top-0 z-40 border-b border-[#1E293B] bg-[#0B0F17]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            CampusPulse
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#94A3B8]"
          >
            <a
              href="#features"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#roi"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              ROI Calculator
            </a>
            <a
              href="#heatmap-preview"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Heatmap
            </a>
            <a
              href="#roles"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Role Portals
            </a>
            <a
              href="#faq"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onOpenLogin('STAFF')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6]"
            >
              Sign In to Portal
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden p-2 text-[#94A3B8] hover:text-white rounded-lg border border-[#1E293B] cursor-pointer"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileNavOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-[#1E293B] bg-[#0D131F] px-6 py-4 flex flex-col gap-3 text-sm font-medium text-[#CBD5E1]"
          >
            <a href="#features" onClick={() => setMobileNavOpen(false)} className="hover:text-white">
              Capabilities
            </a>
            <a href="#roi" onClick={() => setMobileNavOpen(false)} className="hover:text-white">
              ROI Calculator
            </a>
            <a href="#heatmap-preview" onClick={() => setMobileNavOpen(false)} className="hover:text-white">
              Heatmap Preview
            </a>
            <a href="#roles" onClick={() => setMobileNavOpen(false)} className="hover:text-white">
              Role Portals
            </a>
            <a href="#faq" onClick={() => setMobileNavOpen(false)} className="hover:text-white">
              FAQ
            </a>
          </nav>
        )}
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-6 pt-14 pb-16 lg:pt-20 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#38BDF8] mb-3">
                Trinity College of Engineering and Research · Pune
              </p>
              <h1
                className="font-bold tracking-tight text-white text-balance leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)' }}
              >
                Say Goodbye to Clunky ERPs. Welcome to One-Tap Campus Intelligence.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#94A3B8]">
                Built for modern engineering campuses: mark a 60-student lecture in under 15
                seconds, enforce strict role-locked access across Admin, Faculty, Operator,
                and Student accounts, explore multi-month student heatmaps, and export signed
                A4 compliance registers.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onOpenLogin('ADMIN')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Sign In to College Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onQuickDemoRole(Role.FACULTY)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#E2E8F0] bg-[#131A26] hover:bg-[#1A2333] border border-[#1E293B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Try Faculty Roll Call</span>
                </button>
              </div>
            </div>

            {/* Interactive Hero Roll-Call Sandbox */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#131A26] p-6">
              <div className="flex items-start justify-between gap-3 border-b border-[#1E293B] pb-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    CS301 · Data Structures &amp; Algorithms
                  </p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    COMP Division A · Tap any student status to test 1-tap cycling
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMicroRoster(INITIAL_DEMO_ROSTER)}
                    aria-label="Reset sample roll call"
                    className="p-1.5 text-[#94A3B8] hover:text-white bg-[#0B0F17] border border-[#1E293B] rounded-md cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMicroRoster((prev) =>
                        prev.map((item) => ({ ...item, status: AttendanceStatus.PRESENT }))
                      )
                    }
                    className="px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] bg-[#1E293B] hover:bg-[#334155] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Mark All Present
                  </button>
                </div>
              </div>

              <div className="my-3 divide-y divide-[#1E293B]">
                {microRoster.map((student) => (
                  <div
                    key={student.roll}
                    className="flex items-center justify-between py-3 gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {student.name}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-[#94A3B8]">
                        {student.roll}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleDemoStudent(student.roll)}
                      aria-label={`Toggle attendance status for ${student.name}`}
                      className={`min-w-[96px] px-3 py-1.5 text-xs font-semibold border rounded-md cursor-pointer whitespace-nowrap shrink-0 ${getStatusButtonClasses(
                        student.status
                      )}`}
                    >
                      {student.status}
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#1E293B] space-y-2.5">
                <div className="h-1.5 w-full rounded-full bg-[#0B0F17] overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] transition-all duration-200"
                    style={{ width: `${microCounts.creditedPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono tabular-nums text-[#94A3B8]">
                  <span className="text-[#34D399]">Present: {microCounts.present}</span>
                  <span className="text-[#F87171]">Absent: {microCounts.absent}</span>
                  <span className="text-[#FBBF24]">Late: {microCounts.late}</span>
                  <span className="text-white font-semibold">{microCounts.creditedPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width Quantitative Evidence Strip */}
          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-[#1E293B] pt-8">
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-white">&lt; 15 sec</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Average class roll call for 60 students using 1-tap toggle matrix
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-white">Strict RBAC</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Role-locked accounts with 403 route protection and scoped data APIs
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-white">All Months</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Semester-wide student calendar heatmap with daily lecture logs
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums text-white">AI Assistant</p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Context-aware CampusPulse chatbot for policy, math, and reports
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Asymmetric Bento Grid */}
        <section
          id="features"
          className="mx-auto max-w-7xl px-6 py-16 border-t border-[#1E293B]"
        >
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Interactive Academic Intelligence Modules
            </h2>
            <p className="mt-3 text-sm text-[#94A3B8] leading-relaxed">
              Test the savings estimator, 75% recovery calculator, and multi-month heatmap
              directly before signing into your Trinity College account.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1 (2 cols): Interactive ERP Savings Calculator */}
            <div
              id="roi"
              className="lg:col-span-2 rounded-xl border border-[#1E293B] bg-[#131A26] p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-white">
                    01. Legacy ERP Savings Calculator
                  </h3>
                  <TrendingUp className="w-5 h-5 text-[#3B82F6] shrink-0" />
                </div>
                <p className="mt-2 text-sm text-[#94A3B8]">
                  Estimate annual institutional budget recovered by retiring legacy ERP
                  attendance licenses and manual spreadsheet reconciliation.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {[1000, 3200, 7500, 12000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStudentCount(preset)}
                      className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md border cursor-pointer transition-colors ${
                        studentCount === preset
                          ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-white'
                          : 'border-[#1E293B] bg-[#0B0F17] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {preset.toLocaleString()} students
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label htmlFor="erp-student-slider" className="text-[#CBD5E1] font-medium">
                      Active Enrolled Students
                    </label>
                    <span className="font-mono tabular-nums font-semibold text-white">
                      {savings.studentCount.toLocaleString()} students
                    </span>
                  </div>
                  <input
                    id="erp-student-slider"
                    type="range"
                    min={500}
                    max={15000}
                    step={100}
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    className="w-full accent-[#3B82F6] cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-[#1E293B] pt-6">
                <div>
                  <p className="text-xs text-[#94A3B8]">Estimated Annual Savings</p>
                  <p
                    data-testid="roi-annual-savings"
                    className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#10B981]"
                  >
                    ${savings.annualSavings.toLocaleString()}
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5 font-mono tabular-nums">
                    Legacy ${savings.legacyAnnualCost.toLocaleString()} vs $
                    {savings.campusPulseAnnualCost.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8]">3-Year Budget Preserved</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
                    ${savings.threeYearSavings.toLocaleString()}
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5">Zero per-module upsells</p>
                </div>
                <div>
                  <p className="text-xs text-[#94A3B8]">Faculty Time Reclaimed</p>
                  <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#38BDF8]">
                    {savings.hoursSavedPerYear.toLocaleString()} hrs/yr
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5">Across daily roll calls</p>
                </div>
              </div>
            </div>

            {/* Card 2 (1 col): Live 75% Safe-Bunk / Recovery Preview */}
            <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  02. 75% Recovery Predictor
                </h3>
                <p className="mt-2 text-sm text-[#94A3B8]">
                  Try preset scenarios or drag the sliders to inspect exact eligibility math.
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {[
                    { label: 'At Risk (67%)', a: 24, t: 36 },
                    { label: 'Borderline (75%)', a: 27, t: 36 },
                    { label: 'Safe (89%)', a: 32, t: 36 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSimAttended(preset.a);
                        setSimTotal(preset.t);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#1E293B] bg-[#0B0F17] text-[#CBD5E1] hover:text-white hover:border-[#3B82F6] cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="sim-attended" className="text-[#CBD5E1]">
                        Classes Attended
                      </label>
                      <span className="font-mono tabular-nums text-white">{simAttended}</span>
                    </div>
                    <input
                      id="sim-attended"
                      type="range"
                      min={0}
                      max={simTotal}
                      value={simAttended}
                      onChange={(e) => setSimAttended(Number(e.target.value))}
                      className="w-full accent-[#3B82F6] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <label htmlFor="sim-total" className="text-[#CBD5E1]">
                        Total Conducted
                      </label>
                      <span className="font-mono tabular-nums text-white">{simTotal}</span>
                    </div>
                    <input
                      id="sim-total"
                      type="range"
                      min={10}
                      max={60}
                      value={simTotal}
                      onChange={(e) => {
                        const nextTotal = Number(e.target.value);
                        setSimTotal(nextTotal);
                        if (simAttended > nextTotal) setSimAttended(nextTotal);
                      }}
                      className="w-full accent-[#3B82F6] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#1E293B] pt-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#94A3B8]">Current Standing</span>
                  <span
                    className={`text-2xl font-bold font-mono tabular-nums ${
                      recoveryPreview.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                    }`}
                  >
                    {recoveryPreview.percentage.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-white leading-snug">
                  {recoveryPreview.headline}
                </p>
              </div>
            </div>

            {/* Card 3 (1 col): Interactive Month-Wise Heatmap Preview */}
            <div
              id="heatmap-preview"
              className="rounded-xl border border-[#1E293B] bg-[#131A26] p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-white">
                    03. All-Month Student Heatmap
                  </h3>
                  <CalendarDays className="w-5 h-5 text-[#06B6D4] shrink-0" />
                </div>
                <p className="mt-2 text-sm text-[#94A3B8]">
                  Students inspect month-wise attendance and click any date across the entire
                  semester.
                </p>

                <div className="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-[#0B0F17] p-1 border border-[#1E293B]">
                  {(['Aug', 'Sep', 'Oct', 'Nov'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPreviewMonth(m)}
                      className={`py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                        previewMonth === m
                          ? 'bg-[#3B82F6] text-white'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1.5">
                  {activePreviewMonth.cells.map((cell, idx) => {
                    const cls =
                      cell === 'P'
                        ? 'bg-[#10B981]/80 text-[#052E16]'
                        : cell === 'L'
                        ? 'bg-[#F59E0B]/85 text-[#451A03]'
                        : cell === 'A'
                        ? 'bg-[#EF4444]/85 text-white'
                        : 'bg-[#1E293B]/60 text-[#64748B]';
                    return (
                      <div
                        key={idx}
                        className={`h-7 rounded flex items-center justify-center text-[10px] font-mono font-bold ${cls}`}
                      >
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t border-[#1E293B] pt-4 flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-[#94A3B8]">
                  {previewMonth} 2026: {activePreviewMonth.attended}/{activePreviewMonth.total}
                </span>
                <span className="font-bold text-[#34D399]">
                  {activePreviewMonth.pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Card 4 (2 cols): Audit Trail & Compliance Export */}
            <div
              id="compliance"
              className="lg:col-span-2 rounded-xl border border-[#1E293B] bg-[#131A26] p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-white">
                  04. Mistake Correction, Onboarding &amp; Official Monthly Registers
                </h3>
                <ShieldCheck className="w-5 h-5 text-[#10B981] shrink-0" />
              </div>
              <p className="mt-2 text-sm text-[#94A3B8] max-w-2xl">
                Complete auditability for Trinity College of Engineering and Research — from
                automated onboarding emails to signed A4 monthly attendance registers.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 border-t border-[#1E293B] pt-5">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-[#06B6D4] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">Auto Credentials</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Single or CSV bulk onboarding dispatches temp keys instantly.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">48h Audit Vault</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Every edit logs actor, old/new status, timestamp &amp; reason.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#38BDF8] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">1–31 CSV Matrix</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Horizontal daily sheet with totals &amp; formula escaping.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Printer className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-white">A4 Print Register</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Landscape print layout with HOD signature &amp; seal box.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Role-Based Portals Preview */}
        <section
          id="roles"
          className="mx-auto max-w-7xl px-6 py-16 border-t border-[#1E293B]"
        >
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Four Strictly Isolated Role Workspaces
            </h2>
            <p className="mt-3 text-sm text-[#94A3B8]">
              Once authenticated into any account, access is strictly restricted to that role’s
              authorized pages and records. Sign out to switch roles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                role: Role.COLLEGE_ADMIN,
                tab: 'ADMIN' as const,
                title: 'College Admin',
                account: 'Dr. Siddharth Menon',
                points: [
                  'All departments, batches & courses',
                  'All teachers, operators & full student directory',
                  'Monthly 1–31 reports, defaulters & Audit Vault',
                ],
                cta: 'Sign In as Admin',
              },
              {
                role: Role.FACULTY,
                tab: 'STAFF' as const,
                title: 'Faculty / Teacher',
                account: 'Prof. Arvind Nair',
                points: [
                  'One-tap Present / Absent / Late grid',
                  '48-hour correction modal with audit log',
                  '1-tap defaulters, CSV & A4 PDF register',
                ],
                cta: 'Sign In as Faculty',
              },
              {
                role: Role.OPERATOR,
                tab: 'STAFF' as const,
                title: 'Operator / Staff',
                account: 'Nikhil Joshi',
                points: [
                  'Bulk CSV onboarding & credential emails',
                  'Institutional medical / duty leave entries',
                  'Monthly exports & audit log viewer',
                ],
                cta: 'Sign In as Operator',
              },
              {
                role: Role.STUDENT,
                tab: 'STUDENT' as const,
                title: 'Student Portal',
                account: 'Ananya Sharma (TC24001)',
                points: [
                  'Private personal attendance & course pulse',
                  'Month-wise attendance & all-month heatmap',
                  'Live 75% recovery math & printable report',
                ],
                cta: 'Sign In as Student',
              },
            ].map((item) => (
              <div
                key={item.role}
                className="rounded-xl border border-[#1E293B] bg-[#131A26] p-6 flex flex-col justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-[#94A3B8] mt-1">{item.account}</p>
                  <ul className="mt-5 space-y-2.5 text-sm text-[#CBD5E1]">
                    {item.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onQuickDemoRole(item.role)}
                  className="mt-6 w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#1E293B] hover:bg-[#3B82F6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {item.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive FAQ Section */}
        <section
          id="faq"
          className="mx-auto max-w-7xl px-6 py-16 border-t border-[#1E293B]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm text-[#94A3B8]">
                Governance, role security, and attendance compliance standards configured for
                Trinity College of Engineering and Research.
              </p>
            </div>
            <div className="lg:col-span-8 divide-y divide-[#1E293B] rounded-xl border border-[#1E293B] bg-[#131A26]">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-white hover:bg-[#172030] transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-[#94A3B8] leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Professional 4-Column Enterprise Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0D131F]">
        <div className="mx-auto max-w-7xl px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <p className="text-base font-bold tracking-tight text-white">CampusPulse</p>
            <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
              Modern Academic Attendance &amp; Compliance Platform deployed for{' '}
              <span className="text-[#CBD5E1] font-medium">
                Trinity College of Engineering and Research
              </span>
              .
            </p>
            <p className="mt-4 inline-flex items-start gap-2 text-xs text-[#64748B]">
              <MapPin className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 mt-0.5" />
              <span>Near Khadimachine Chowk, Kondhwa-Saswad Road, Pune 411048</span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-white mb-3">Platform Modules</p>
            <ul className="space-y-2.5 text-xs text-[#94A3B8]">
              <li>
                <a href="#top" className="hover:text-white transition-colors">
                  One-Tap Attendance Sheet
                </a>
              </li>
              <li>
                <a href="#roi" className="hover:text-white transition-colors">
                  ERP Savings Calculator
                </a>
              </li>
              <li>
                <a href="#heatmap-preview" className="hover:text-white transition-colors">
                  All-Month Student Heatmap
                </a>
              </li>
              <li>
                <a href="#compliance" className="hover:text-white transition-colors">
                  CSV Matrix &amp; A4 Registers
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white mb-3">Role Portals</p>
            <ul className="space-y-2.5 text-xs text-[#94A3B8]">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLogin('ADMIN')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  College Admin Portal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLogin('STAFF')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Faculty Workspace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLogin('STAFF')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Operator Data Suite
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLogin('STUDENT')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Student Self-Service Portal
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white mb-3">Academic Governance</p>
            <ul className="space-y-2.5 text-xs text-[#94A3B8]">
              <li>Eligibility Standard: 75% Minimum</li>
              <li>Direct Edit Policy: 48-Hour Window</li>
              <li>Institution Code: TCER-2026</li>
              <li>Academic Support: support@tcer.edu.in</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1E293B]">
          <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#64748B]">
            <p>
              © 2026 CampusPulse · Trinity College of Engineering and Research. All rights
              reserved.
            </p>
            <div className="flex items-center gap-5">
              <a href="#faq" className="hover:text-white transition-colors">
                RBAC Policy
              </a>
              <a href="#compliance" className="hover:text-white transition-colors">
                Audit Compliance
              </a>
              <button
                type="button"
                onClick={() => onOpenLogin('ADMIN')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Portal Sign In
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
