import { FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Search,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  calculateAttendancePercentage,
  calculateRecoveryMetrics,
  computeStudentAnalytics,
  isAttendedStatus,
} from '../lib/attendanceMath';
import { CampusStatePayload, Role } from '../lib/types';
import { ReportsMatrixPanel } from './ReportsMatrixPanel';

interface AdminPortalProps {
  section: string;
  state: CampusStatePayload;
  onNavigateSection?: (sectionId: string) => void;
  onCreateDepartment: (payload: {
    name: string;
    code: string;
    hodName: string;
  }) => Promise<void>;
  onCreateStaff: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: Role;
    departmentId: string;
  }) => Promise<void>;
  onExportCsvFromServer?: (params: {
    year: number;
    month: number;
    batchId: string;
    courseId: string;
  }) => Promise<string>;
}

export function AdminPortal({
  section,
  state,
  onNavigateSection,
  onCreateDepartment,
  onCreateStaff,
  onExportCsvFromServer,
}: AdminPortalProps) {
  // New Department Form
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [hodName, setHodName] = useState('');

  // New Staff Form
  const [staffFirst, setStaffFirst] = useState('');
  const [staffLast, setStaffLast] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<Role>(Role.FACULTY);
  const [staffDeptId, setStaffDeptId] = useState(state.departments[0]?.id ?? '');
  const [staffDeptFilter, setStaffDeptFilter] = useState('ALL');

  // All Students Directory Filters & Selection
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('ALL');
  const [studentStandingFilter, setStudentStandingFilter] = useState<
    'ALL' | 'ELIGIBLE' | 'DEFAULTER'
  >('ALL');
  const [inspectedStudentId, setInspectedStudentId] = useState<string | null>(
    state.students[0]?.id ?? null
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analytics = useMemo(() => {
    const totalAttended = state.records.filter((r) => isAttendedStatus(r.status)).length;
    const overallPct = calculateAttendancePercentage(totalAttended, state.records.length);

    const allStudentsRanked = state.students
      .map((student) => {
        const recs = state.records.filter((r) => r.studentId === student.id);
        const att = recs.filter((r) => isAttendedStatus(r.status)).length;
        const recovery = calculateRecoveryMetrics(
          att,
          recs.length,
          state.institution.attendanceThreshold
        );
        const dept = state.departments.find((d) => d.id === student.departmentId);
        const batch = state.batches.find((b) => b.id === student.batchId);
        return { student, recovery, dept, batch };
      })
      .sort((a, b) => a.student.rollNumber.localeCompare(b.student.rollNumber));

    const defaulters = allStudentsRanked
      .filter((item) => item.recovery.isDefaulter)
      .sort((a, b) => a.recovery.percentage - b.recovery.percentage);

    // Session trend chart (last 12 distinct dates across months)
    const byDate = new Map<string, { attended: number; total: number }>();
    const sessionById = new Map(state.sessions.map((s) => [s.id, s]));
    for (const r of state.records) {
      const sess = sessionById.get(r.sessionId);
      if (!sess) continue;
      const bucket = byDate.get(sess.date) ?? { attended: 0, total: 0 };
      bucket.total += 1;
      if (isAttendedStatus(r.status)) bucket.attended += 1;
      byDate.set(sess.date, bucket);
    }

    const trendData = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, vals]) => ({
        date: date.slice(5),
        rate: calculateAttendancePercentage(vals.attended, vals.total),
      }));

    // Department comparison chart
    const deptData = state.departments.map((dept) => {
      const deptStudentIds = new Set(
        state.students.filter((s) => s.departmentId === dept.id).map((s) => s.id)
      );
      const deptRecs = state.records.filter((r) => deptStudentIds.has(r.studentId));
      const deptAtt = deptRecs.filter((r) => isAttendedStatus(r.status)).length;
      return {
        code: dept.code,
        rate: deptRecs.length > 0 ? calculateAttendancePercentage(deptAtt, deptRecs.length) : 84,
      };
    });

    const facultyCount = state.users.filter((u) => u.role === Role.FACULTY).length;
    const operatorCount = state.users.filter((u) => u.role === Role.OPERATOR).length;

    return {
      overallPct,
      allStudentsRanked,
      defaulters,
      trendData,
      deptData,
      facultyCount,
      operatorCount,
    };
  }, [state]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return analytics.allStudentsRanked.filter(({ student, recovery }) => {
      if (studentDeptFilter !== 'ALL' && student.departmentId !== studentDeptFilter) {
        return false;
      }
      if (studentStandingFilter === 'ELIGIBLE' && recovery.isDefaulter) return false;
      if (studentStandingFilter === 'DEFAULTER' && !recovery.isDefaulter) return false;
      if (!q) return true;
      return (
        student.rollNumber.toLowerCase().includes(q) ||
        `${student.firstName} ${student.lastName}`.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q)
      );
    });
  }, [analytics.allStudentsRanked, studentSearch, studentDeptFilter, studentStandingFilter]);

  const inspectedStudentProfile = useMemo(() => {
    const target =
      state.students.find((s) => s.id === inspectedStudentId) ??
      filteredStudents[0]?.student ??
      null;
    if (!target) return null;
    return computeStudentAnalytics(
      target,
      state.sessions,
      state.records,
      state.courses,
      '2026-11-21',
      state.institution.attendanceThreshold
    );
  }, [inspectedStudentId, filteredStudents, state]);

  const handleAddDepartment = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!deptName.trim() || !deptCode.trim() || !hodName.trim()) {
      setError('Enter department name, code, and Head of Department.');
      return;
    }
    setBusy(true);
    try {
      await onCreateDepartment({
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
        hodName: hodName.trim(),
      });
      setDeptName('');
      setDeptCode('');
      setHodName('');
      setNotice('Department created with initial Section A batch.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create department.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!staffFirst.trim() || !staffLast.trim() || !staffEmail.trim()) {
      setError('Enter first name, last name, and institutional email.');
      return;
    }
    setBusy(true);
    try {
      await onCreateStaff({
        firstName: staffFirst.trim(),
        lastName: staffLast.trim(),
        email: staffEmail.trim().toLowerCase(),
        role: staffRole,
        departmentId: staffDeptId,
      });
      setStaffFirst('');
      setStaffLast('');
      setStaffEmail('');
      setNotice(`Provisioned ${staffRole.toLowerCase()} account successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to provision account.');
    } finally {
      setBusy(false);
    }
  };

  const renderFeedback = () => (
    <>
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
    </>
  );

  if (section === 'departments') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            All Departments, Batches &amp; Academic Cycles
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Complete overview of all {state.departments.length} departments at{' '}
            {state.institution.name}, including assigned HODs, teachers, courses, and divisions.
          </p>
        </div>

        {renderFeedback()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddDepartment}
            className="lg:col-span-5 rounded-xl border border-[#1E293B] bg-[#131A26] p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Add Department</h2>
              <Building2 className="w-4 h-4 text-[#3B82F6]" />
            </div>

            <div>
              <label htmlFor="dept-name" className="block text-xs text-[#94A3B8] mb-1">
                Department Name
              </label>
              <input
                id="dept-name"
                type="text"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Artificial Intelligence & Data Science"
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dept-code" className="block text-xs text-[#94A3B8] mb-1">
                  Code
                </label>
                <input
                  id="dept-code"
                  type="text"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  placeholder="AIDS"
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm font-mono text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="dept-hod" className="block text-xs text-[#94A3B8] mb-1">
                  Head of Department
                </label>
                <input
                  id="dept-hod"
                  type="text"
                  value={hodName}
                  onChange={(e) => setHodName(e.target.value)}
                  placeholder="Dr. Anjali Rao"
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
            >
              Create Department
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E293B]">
              <h2 className="text-base font-semibold text-white">
                All Active Departments ({state.departments.length})
              </h2>
            </div>
            <div className="divide-y divide-[#1E293B]">
              {state.departments.map((dept) => {
                const batches = state.batches.filter((b) => b.departmentId === dept.id);
                const courses = state.courses.filter((c) => c.departmentId === dept.id);
                const students = state.students.filter((s) => s.departmentId === dept.id);
                const teachers = state.users.filter(
                  (u) => u.role === Role.FACULTY && u.departmentId === dept.id
                );
                const deptRate =
                  analytics.deptData.find((d) => d.code === dept.code)?.rate ?? 0;

                return (
                  <div key={dept.id} className="p-5 hover:bg-[#172030] transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          <span className="font-mono text-[#38BDF8] mr-2">{dept.code}</span>
                          {dept.name}
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-1">HOD: {dept.hodName}</p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="text-sm font-bold text-[#34D399]">
                          {deptRate.toFixed(1)}% avg
                        </p>
                        <p className="text-xs text-[#CBD5E1]">
                          {teachers.length} teachers · {students.length} students ·{' '}
                          {courses.length} courses
                        </p>
                      </div>
                    </div>
                    <p className="mt-2.5 text-xs text-[#94A3B8]">
                      Divisions:{' '}
                      {batches
                        .map((b) => `${b.name} ${b.division} (Sem ${b.semester})`)
                        .join(' · ') || 'None configured'}
                    </p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Courses: {courses.map((c) => `${c.code} ${c.name}`).join(' · ') || 'None'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'staff') {
    const allStaffUsers = state.users.filter((u) => u.role !== Role.STUDENT);
    const filteredStaff =
      staffDeptFilter === 'ALL'
        ? allStaffUsers
        : allStaffUsers.filter((u) => u.departmentId === staffDeptFilter);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            All Teachers, Faculty &amp; Staff Directory
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Inspect every teacher and staff member across all departments with assigned courses, or
            provision new institutional accounts.
          </p>
        </div>

        {renderFeedback()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddStaff}
            className="lg:col-span-5 rounded-xl border border-[#1E293B] bg-[#131A26] p-5 space-y-4 self-start"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Provision Teacher / Staff</h2>
              <UserPlus className="w-4 h-4 text-[#3B82F6]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="staff-fn" className="block text-xs text-[#94A3B8] mb-1">
                  First Name
                </label>
                <input
                  id="staff-fn"
                  type="text"
                  value={staffFirst}
                  onChange={(e) => setStaffFirst(e.target.value)}
                  placeholder="Prof. Deepak"
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="staff-ln" className="block text-xs text-[#94A3B8] mb-1">
                  Last Name
                </label>
                <input
                  id="staff-ln"
                  type="text"
                  value={staffLast}
                  onChange={(e) => setStaffLast(e.target.value)}
                  placeholder="Kulkarni"
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-email" className="block text-xs text-[#94A3B8] mb-1">
                Institutional Email
              </label>
              <input
                id="staff-email"
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="deepak.kulkarni@tcer.edu.in"
                className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="staff-role" className="block text-xs text-[#94A3B8] mb-1">
                  RBAC Role
                </label>
                <select
                  id="staff-role"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  <option value={Role.FACULTY}>Faculty / Teacher</option>
                  <option value={Role.OPERATOR}>Operator / Staff</option>
                </select>
              </div>
              <div>
                <label htmlFor="staff-dept" className="block text-xs text-[#94A3B8] mb-1">
                  Department
                </label>
                <select
                  id="staff-dept"
                  value={staffDeptId}
                  onChange={(e) => setStaffDeptId(e.target.value)}
                  className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
                >
                  {state.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
            >
              Create Staff Account
            </button>
          </form>

          <div className="lg:col-span-7 rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">
                All Teachers &amp; Personnel ({filteredStaff.length})
              </h2>
              <select
                aria-label="Filter teachers by department"
                value={staffDeptFilter}
                onChange={(e) => setStaffDeptFilter(e.target.value)}
                className="rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-1.5 text-xs text-white focus:border-[#3B82F6] focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {state.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1E293B] text-xs text-[#94A3B8]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name &amp; Email</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Department</th>
                    <th className="px-5 py-3 font-medium">Assigned Courses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {filteredStaff.map((u) => {
                    const dept = state.departments.find((d) => d.id === u.departmentId);
                    const assignedCourses = state.courses.filter((c) =>
                      c.facultyIds.includes(u.id)
                    );
                    return (
                      <tr key={u.id} className="hover:bg-[#172030]">
                        <td className="px-5 py-3">
                          <p className="font-medium text-white">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-[#94A3B8]">{u.email}</p>
                        </td>
                        <td className="px-5 py-3 text-xs font-mono text-[#38BDF8] whitespace-nowrap">
                          {u.role.replace('_', ' ')}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#CBD5E1] whitespace-nowrap">
                          {dept?.code ?? 'Institution'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#94A3B8]">
                          {assignedCourses.length > 0
                            ? assignedCourses.map((c) => c.code).join(', ')
                            : u.role === Role.FACULTY
                            ? 'Department Pool'
                            : 'Administration'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'students') {
    const eligibleCount = analytics.allStudentsRanked.length - analytics.defaulters.length;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              All Students Directory (All Departments)
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Full college-wide student roster across {state.departments.length} departments. Click
              any student row to inspect month-wise attendance (Aug–Nov 2026).
            </p>
          </div>
          {onNavigateSection && (
            <button
              type="button"
              onClick={() => onNavigateSection('reports')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              <span>Open Monthly Matrix &amp; CSV</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
            <p className="text-xs text-[#94A3B8]">Total Enrolled</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
              {analytics.allStudentsRanked.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
            <p className="text-xs text-[#94A3B8]">Exam Eligible (&ge; 75%)</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#34D399]">
              {eligibleCount}
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
            <p className="text-xs text-[#94A3B8]">Defaulters (&lt; 75%)</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#F87171]">
              {analytics.defaulters.length}
            </p>
          </div>
          <div className="rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
            <p className="text-xs text-[#94A3B8]">Showing Filtered</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#38BDF8]">
              {filteredStudents.length}
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-[#1E293B] bg-[#131A26] p-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search students by roll number, name, or email"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search roll no, name, or email..."
              className="w-full rounded-lg border border-[#1E293B] bg-[#0B0F17] pl-9 pr-3 py-2 text-sm text-white placeholder-[#64748B] focus:border-[#3B82F6] focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter students by department"
            value={studentDeptFilter}
            onChange={(e) => setStudentDeptFilter(e.target.value)}
            className="rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="ALL">All Departments ({state.departments.length})</option>
            {state.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#0B0F17] p-1 border border-[#1E293B]">
            {(
              [
                ['ALL', 'All'],
                ['ELIGIBLE', '>=75%'],
                ['DEFAULTER', '<75%'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStudentStandingFilter(val)}
                className={`rounded-md py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  studentStandingFilter === val
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Student Table */}
          <div className="lg:col-span-8 rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#1E293B] text-xs text-[#94A3B8]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Roll No</th>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Dept / Batch</th>
                    <th className="px-4 py-3 font-medium text-right">Att/Held</th>
                    <th className="px-4 py-3 font-medium text-right">%</th>
                    <th className="px-4 py-3 font-medium">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {filteredStudents.map(({ student, recovery, dept, batch }) => {
                    const isSelected = inspectedStudentProfile?.student.id === student.id;
                    return (
                      <tr
                        key={student.id}
                        onClick={() => setInspectedStudentId(student.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#3B82F6]/15' : 'hover:bg-[#172030]'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#CBD5E1] whitespace-nowrap">
                          {student.rollNumber}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white whitespace-nowrap">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-[#94A3B8]">{student.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#CBD5E1] whitespace-nowrap">
                          <span className="font-mono text-[#38BDF8]">{dept?.code}</span> ·{' '}
                          {batch?.division}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-[#CBD5E1]">
                          {recovery.attended}/{recovery.total}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                            recovery.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                          }`}
                        >
                          {recovery.percentage.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {recovery.isDefaulter ? (
                            <span className="text-[#F87171]">
                              Needs +{recovery.classesNeededToReachThreshold}
                            </span>
                          ) : (
                            <span className="text-[#34D399]">Eligible</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-[#94A3B8]">
                        No students match your active filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Month-Wise Student Inspector Panel */}
          <div className="lg:col-span-4 rounded-xl border border-[#1E293B] bg-[#131A26] p-5 self-start space-y-5">
            {inspectedStudentProfile ? (
              <>
                <div className="border-b border-[#1E293B] pb-4">
                  <p className="text-xs font-mono text-[#38BDF8]">
                    {inspectedStudentProfile.student.rollNumber}
                  </p>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    {inspectedStudentProfile.student.firstName}{' '}
                    {inspectedStudentProfile.student.lastName}
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
                    {inspectedStudentProfile.student.email}
                  </p>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-[#94A3B8]">Semester Cumulative</span>
                    <span
                      className={`text-xl font-bold font-mono tabular-nums ${
                        inspectedStudentProfile.overall.isDefaulter
                          ? 'text-[#F87171]'
                          : 'text-[#34D399]'
                      }`}
                    >
                      {inspectedStudentProfile.overall.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-[#CBD5E1] mt-1">
                    {inspectedStudentProfile.overall.headline}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
                    Month-Wise Attendance Breakdown
                  </h3>
                  <div className="space-y-2.5">
                    {inspectedStudentProfile.monthlyHeatmaps.map((m) => (
                      <div
                        key={m.monthKey}
                        className="rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3.5 py-2.5 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-semibold text-white">{m.label}</p>
                          <p className="text-[11px] font-mono text-[#94A3B8] tabular-nums">
                            {m.attended}/{m.total} credited · {m.absentCount} absent
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold font-mono tabular-nums ${
                            m.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                          }`}
                        >
                          {m.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2.5">
                    Course Breakdown
                  </h3>
                  <div className="space-y-2">
                    {inspectedStudentProfile.courseBreakdowns.map((c) => (
                      <div
                        key={c.courseId}
                        className="flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-[#CBD5E1] truncate pr-2">
                          {c.courseCode} · {c.courseName}
                        </span>
                        <span
                          className={`font-semibold tabular-nums shrink-0 ${
                            c.recovery.isDefaulter ? 'text-[#F87171]' : 'text-[#34D399]'
                          }`}
                        >
                          {c.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#94A3B8]">Select a student to view monthly details.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (section === 'reports') {
    return (
      <ReportsMatrixPanel
        state={state}
        onExportCsvFromServer={onExportCsvFromServer}
      />
    );
  }

  if (section === 'audit') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Immutable Audit Log Vault
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            Append-only log of every attendance correction, status transition, actor role, and
            submitted justification.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1E293B] text-xs text-[#94A3B8]">
                <tr>
                  <th className="px-5 py-3 font-medium">Timestamp</th>
                  <th className="px-5 py-3 font-medium">Student &amp; Session</th>
                  <th className="px-5 py-3 font-medium">Status Change</th>
                  <th className="px-5 py-3 font-medium">Modified By</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {state.auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#172030]">
                    <td className="px-5 py-3 font-mono tabular-nums text-xs text-[#94A3B8] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-white">
                        {log.rollNumber} · {log.studentName}
                      </p>
                      <p className="text-xs font-mono text-[#94A3B8]">
                        {log.courseCode} · {log.sessionDate}
                      </p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                      <span className="text-[#F87171]">{log.oldStatus}</span>
                      <span className="mx-1.5 text-[#64748B]">→</span>
                      <span className="text-[#34D399] font-semibold">{log.newStatus}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#CBD5E1] whitespace-nowrap">
                      {log.changedByName}
                      <span className="text-[#64748B]"> · {log.changedByRole}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#CBD5E1] max-w-sm">
                      {log.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: Admin Command Center Overview
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Admin Command Center
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            {state.institution.name} · {state.institution.academicYear} · Minimum Eligibility{' '}
            {state.institution.attendanceThreshold}%
          </p>
        </div>

        {onNavigateSection && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection('departments')}
              className="rounded-lg border border-[#1E293B] bg-[#131A26] hover:bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
            >
              All Departments
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('staff')}
              className="rounded-lg border border-[#1E293B] bg-[#131A26] hover:bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
            >
              All Teachers
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('students')}
              className="rounded-lg border border-[#1E293B] bg-[#131A26] hover:bg-[#1E293B] px-3 py-2 text-xs font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
            >
              All Students
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('reports')}
              className="rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              Monthly Reports
            </button>
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateSection?.('reports')}
          className="text-left rounded-xl border border-[#1E293B] hover:border-[#334155] bg-[#131A26] p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#94A3B8]">Institutional Attendance</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white">
            {analytics.overallPct.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-[#34D399]">
            Across {state.sessions.length} recorded lectures
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection?.('students')}
          className="text-left rounded-xl border border-[#1E293B] hover:border-[#334155] bg-[#131A26] p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#94A3B8]">All Enrolled Students</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-white">
            {state.students.length}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {state.departments.length} departments · {state.batches.length} divisions
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection?.('staff')}
          className="text-left rounded-xl border border-[#1E293B] hover:border-[#334155] bg-[#131A26] p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#94A3B8]">Teachers &amp; Staff</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#38BDF8]">
            {analytics.facultyCount + analytics.operatorCount}
          </p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {analytics.facultyCount} faculty · {analytics.operatorCount} operators
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection?.('reports')}
          className="text-left rounded-xl border border-[#1E293B] hover:border-[#334155] bg-[#131A26] p-5 transition-colors cursor-pointer"
        >
          <p className="text-xs text-[#94A3B8]">Active Defaulters (&lt; 75%)</p>
          <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#F87171]">
            {analytics.defaulters.length}
          </p>
          <p className="mt-1 text-xs text-[#FCA5A5]">Require advisor intervention</p>
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">
              Institutional Attendance Rate Trend (%)
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Recent lecture dates across all {state.departments.length} Trinity College departments
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trendData}>
                <defs>
                  <linearGradient id="pulseTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} />
                <YAxis domain={[50, 100]} stroke="#64748B" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#pulseTrendGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-[#1E293B] bg-[#131A26] p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Department Standing (%)</h2>
              <p className="text-xs text-[#94A3B8]">Cumulative attendance across all departments</p>
            </div>
            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('departments')}
                className="text-xs font-medium text-[#38BDF8] hover:text-white cursor-pointer"
              >
                Inspect All
              </button>
            )}
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="code" stroke="#64748B" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0F17',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Bar
                  dataKey="rate"
                  fill="#06B6D4"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Split: Top Defaulters + Recent Audit Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F87171]" />
              <h2 className="text-sm font-semibold text-white">Priority Defaulter Alerts</h2>
            </div>
            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('students')}
                className="text-xs font-medium text-[#38BDF8] hover:text-white cursor-pointer"
              >
                View All Students
              </button>
            )}
          </div>
          <div className="divide-y divide-[#1E293B]">
            {analytics.defaulters.slice(0, 5).map(({ student, recovery, dept }) => (
              <div
                key={student.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-white">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-xs font-mono text-[#94A3B8]">
                    {student.rollNumber} · {dept?.code} · Needs +
                    {recovery.classesNeededToReachThreshold} classes
                  </p>
                </div>
                <span className="font-mono tabular-nums font-semibold text-[#F87171]">
                  {recovery.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#131A26] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#38BDF8]" />
              <h2 className="text-sm font-semibold text-white">Recent Audit Corrections</h2>
            </div>
            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('audit')}
                className="text-xs font-medium text-[#38BDF8] hover:text-white cursor-pointer"
              >
                Open Vault
              </button>
            )}
          </div>
          <div className="divide-y divide-[#1E293B]">
            {state.auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white font-semibold">
                    {log.rollNumber} · {log.courseCode}
                  </span>
                  <span className="text-[#94A3B8]">
                    {log.oldStatus} → <span className="text-[#34D399]">{log.newStatus}</span>
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1 truncate">{log.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
